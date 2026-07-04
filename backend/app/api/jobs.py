"""Job management API routes."""
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.job import JobRecord
from app.schemas.jobs import JobSubmitRequest, JobSubmitResponse, JobStatusResponse
from app.services.auth_service import require_user
from app.services.ssh_manager import ssh_manager
from app.services.template_manager import TemplateManager
from app.models.user import User

router = APIRouter()

@router.post("/submit", response_model=JobSubmitResponse)
async def submit_job(req: JobSubmitRequest, db: Session = Depends(get_db), user: User = Depends(require_user)):
    job_id = str(uuid.uuid4())
    # Check SSH connection
    if not ssh_manager.is_connected(req.server_alias):
        raise HTTPException(status_code=400, detail="Server not connected")
    # Build command
    cmd = f"cd {req.project_path} && nohup mpirun -np {req.np} {req.vasp_command} > vasp.out 2>&1 & echo $!"
    try:
        exit_code, stdout, stderr = await ssh_manager.execute(req.server_alias, cmd)
        remote_pid = int(stdout.strip()) if stdout.strip() else None
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Job submission failed: {str(e)}")
    # Save to DB
    job = JobRecord(
        job_id=job_id, user_id=user.id, server_alias=req.server_alias,
        project_name=req.project_path.split("/")[-1] if "/" in req.project_path else req.project_path,
        project_path=req.project_path, calc_type=req.calc_type,
        status="running", remote_pid=remote_pid,
        vasp_command=req.vasp_command, np=req.np, started_at=datetime.utcnow())
    db.add(job)
    db.commit()
    return JobSubmitResponse(job_id=job_id, status="running")

@router.post("/{job_id}/cancel")
async def cancel_job(job_id: str, db: Session = Depends(get_db), user: User = Depends(require_user)):
    job = db.query(JobRecord).filter(JobRecord.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.remote_pid:
        await ssh_manager.execute(job.server_alias, f"kill -TERM {job.remote_pid}")
    job.status = "cancelled"
    job.finished_at = datetime.utcnow()
    db.commit()
    return {"ok": True}

@router.get("/{job_id}/status", response_model=JobStatusResponse)
def get_job_status(job_id: str, db: Session = Depends(get_db), user: User = Depends(require_user)):
    job = db.query(JobRecord).filter(JobRecord.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobStatusResponse(
        job_id=job.job_id, status=job.status, remote_pid=job.remote_pid,
        calc_type=job.calc_type, project_path=job.project_path,
        submitted_at=job.submitted_at, started_at=job.started_at,
        finished_at=job.finished_at, exit_code=job.exit_code,
        energy_final=job.energy_final, error_message=job.error_message)

@router.get("", response_model=list[JobStatusResponse])
def list_jobs(page: int = 1, limit: int = 20, db: Session = Depends(get_db), user: User = Depends(require_user)):
    jobs = db.query(JobRecord).order_by(JobRecord.submitted_at.desc()).offset((page-1)*limit).limit(limit).all()
    return [JobStatusResponse(
        job_id=j.job_id, status=j.status, remote_pid=j.remote_pid,
        calc_type=j.calc_type, project_path=j.project_path or "",
        submitted_at=j.submitted_at, started_at=j.started_at,
        finished_at=j.finished_at, exit_code=j.exit_code,
        energy_final=j.energy_final, error_message=j.error_message) for j in jobs]
