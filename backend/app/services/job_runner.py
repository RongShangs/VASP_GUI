"""Remote VASP job submission and monitoring.

Runs VASP on the remote server via SSH and monitors its progress.
"""
import asyncio
import logging
import re
import time
from typing import Optional, Any
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class JobInfo:
    job_id: str
    alias: str
    project_dir: str
    vasp_command: str
    np: int
    status: str  # "submitted" | "running" | "finished" | "error" | "cancelled"
    remote_pid: Optional[int] = None
    submitted_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    finished_at: Optional[float] = None
    exit_code: Optional[int] = None
    energy_final: Optional[float] = None
    error_message: Optional[str] = None


class JobRunner:
    """Submit and monitor VASP jobs on remote servers."""

    def __init__(self, ssh_manager):
        self._ssh = ssh_manager
        self._jobs: dict[str, JobInfo] = {}
        self._monitor_tasks: dict[str, asyncio.Task] = {}

    async def submit(
        self,
        alias: str,
        project_dir: str,
        vasp_command: str = "vasp_std",
        np: int = 4,
    ) -> str:
        """Submit a VASP job on the remote server.

        Returns job_id (UUID).
        """
        import uuid
        job_id = str(uuid.uuid4())[:8]

        # Build the submission command
        # Use nohup to run in background, redirect output
        cmd = (
            f"cd {project_dir} && "
            f"nohup mpirun -np {np} {vasp_command} > vasp.out 2>&1 & "
            f"echo $!"
        )

        exit_code, stdout, stderr = await self._ssh.execute(alias, cmd, timeout=15)
        if exit_code != 0:
            raise RuntimeError(f"Job submission failed: {stderr}")

        try:
            pid = int(stdout.strip())
        except (ValueError, AttributeError):
            raise RuntimeError(f"Could not parse PID from output: {stdout}")

        job = JobInfo(
            job_id=job_id,
            alias=alias,
            project_dir=project_dir,
            vasp_command=vasp_command,
            np=np,
            status="running",
            remote_pid=pid,
            started_at=time.time(),
        )
        self._jobs[job_id] = job

        # Start monitoring coroutine
        self._monitor_tasks[job_id] = asyncio.create_task(
            self._monitor_job(job_id)
        )

        logger.info(f"Job {job_id}: submitted (PID={pid}) on {alias}")
        return job_id

    async def cancel(self, job_id: str) -> bool:
        """Cancel a running job."""
        job = self._jobs.get(job_id)
        if not job or not job.remote_pid:
            return False

        # Try SIGTERM first, then SIGKILL
        try:
            await self._ssh.execute(job.alias, f"kill -TERM {job.remote_pid}")
            await asyncio.sleep(2)
            # Check if still running
            code, stdout, _ = await self._ssh.execute(
                job.alias, f"ps -p {job.remote_pid} -o pid= 2>/dev/null"
            )
            if code == 0 and stdout.strip():
                # Still running, force kill
                await self._ssh.execute(job.alias, f"kill -9 {job.remote_pid}")
        except Exception as e:
            logger.error(f"Failed to cancel job {job_id}: {e}")
            return False

        job.status = "cancelled"
        job.finished_at = time.time()
        return True

    async def get_status(self, job_id: str) -> Optional[dict]:
        """Get current status of a job."""
        job = self._jobs.get(job_id)
        if not job:
            return None
        return {
            "job_id": job.job_id,
            "status": job.status,
            "pid": job.remote_pid,
            "vasp_command": job.vasp_command,
            "np": job.np,
            "energy_final": job.energy_final,
            "error_message": job.error_message,
        }

    async def get_processes(self, alias: str) -> list[dict]:
        """List all VASP processes on a remote server."""
        try:
            _, stdout, _ = await self._ssh.execute(
                alias, "ps aux 2>/dev/null | grep -E 'vasp_std|vasp_gam|vasp_ncl' | grep -v grep || true"
            )
            processes = []
            for line in stdout.split("\n"):
                line = line.strip()
                if not line:
                    continue
                parts = line.split()
                if len(parts) >= 11:
                    processes.append({
                        "user": parts[0],
                        "pid": int(parts[1]),
                        "cpu": float(parts[2]),
                        "mem": float(parts[3]),
                        "command": " ".join(parts[10:]),
                    })
            return processes
        except Exception as e:
            logger.error(f"Failed to list processes on {alias}: {e}")
            return []

    async def _monitor_job(self, job_id: str):
        """Background task: periodically check if the job is still running."""
        job = self._jobs.get(job_id)
        if not job:
            return

        try:
            while job.status == "running":
                await asyncio.sleep(5)

                # Check if PID still exists
                try:
                    code, stdout, _ = await self._ssh.execute(
                        job.alias,
                        f"ps -p {job.remote_pid} -o pid= 2>/dev/null",
                        timeout=10,
                    )
                except Exception:
                    # SSH connection lost — assume job might still be running
                    continue

                if code != 0 or not stdout.strip():
                    # Process no longer exists
                    # Check for OUTCAR to determine success/failure
                    try:
                        _, outcar_tail, _ = await self._ssh.execute(
                            job.alias,
                            f"tail -20 {job.project_dir}/OUTCAR 2>/dev/null | grep -E 'General timing|Voluntary context' || true",
                            timeout=10,
                        )
                    except Exception:
                        outcar_tail = ""

                    if "General timing" in outcar_tail or "Voluntary context" in outcar_tail:
                        job.status = "finished"
                        # Try to extract final energy
                        job.energy_final = await self._extract_final_energy(
                            job.alias, job.project_dir
                        )
                    else:
                        # Check if OSZICAR exists but OUTCAR incomplete → error
                        try:
                            _, oszicar_exists, _ = await self._ssh.execute(
                                job.alias,
                                f"test -f {job.project_dir}/OSZICAR && echo 'yes' || echo 'no'",
                                timeout=10,
                            )
                        except Exception:
                            oszicar_exists = "no"

                        if oszicar_exists.strip() == "yes":
                            job.status = "error"
                            job.error_message = "VASP terminated abnormally (OUTCAR incomplete)"
                        else:
                            job.status = "error"
                            job.error_message = "VASP process exited without output"

                    job.finished_at = time.time()
                    logger.info(
                        f"Job {job_id}: finished with status={job.status}"
                    )

        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Job {job_id}: monitor error: {e}")
            job.status = "error"
            job.error_message = str(e)
            job.finished_at = time.time()
        finally:
            self._monitor_tasks.pop(job_id, None)

    async def _extract_final_energy(
        self, alias: str, project_dir: str
    ) -> Optional[float]:
        """Extract the final energy from OSZICAR."""
        try:
            _, stdout, _ = await self._ssh.execute(
                alias,
                f"tail -5 {project_dir}/OSZICAR 2>/dev/null | grep -oP 'E=\\s*\\K[\\d.E+\\-]+' | tail -1 || true",
                timeout=10,
            )
            if stdout.strip():
                return float(stdout.strip())
        except Exception:
            pass
        return None


# Global instance (lazy init with ssh_manager)
job_runner: Optional[JobRunner] = None


def get_job_runner(ssh_manager=None) -> JobRunner:
    global job_runner
    if job_runner is None and ssh_manager is not None:
        job_runner = JobRunner(ssh_manager)
    elif job_runner is None:
        from app.services.ssh_manager import ssh_manager as sm
        job_runner = JobRunner(sm)
    return job_runner
