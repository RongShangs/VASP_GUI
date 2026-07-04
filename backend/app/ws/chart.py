"""WebSocket endpoint for energy convergence chart data.

Tails vasp.out on the remote server, parses OSZICAR lines, and pushes
structured energy data points to the frontend.
"""
import asyncio
import re
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from app.ws.manager import ws_manager
from app.database import SessionLocal
from app.models.job import JobRecord
from app.services.ssh_manager import ssh_manager

logger = logging.getLogger(__name__)
router = APIRouter()

# VASP OSZICAR has TWO formats:
#   Standard:  "  1 T= 300.0 E= -123.456 F= -123.457 E0= -123.456 EK= 1.234 SP= 0.00 SK= 0.00"
#   Compact:   "  1 F= -.43363039E+02 E0= -.43363085E+02  d E =0.135888E-03"
# We handle both by making T= and E= optional, and matching dE variant
RE_OSZICAR = re.compile(
    r'^\s*(?P<step>\d+)\s+'
    r'(?:T=\s*(?P<T>\S+)\s+)?'
    r'(?:E=\s*(?P<E>\S+)\s+)?'
    r'F=\s*(?P<F>\S+)'
    r'\s+E0=\s*(?P<E0>\S+)'
    r'(?:\s+d\s*E\s*=\s*(?P<dE>\S+))?'
    r'(?:\s+EK=\s*(?P<EK>\S+))?'
    r'(?:\s+SP=\s*(?P<SP>\S+))?'
    r'(?:\s+SK=\s*(?P<SK>\S+))?',
    re.MULTILINE,
)

RE_IONIC = re.compile(r'^\s*-+\s*ion\s+step\s+(\d+)\s*-+', re.IGNORECASE)


def safe_float(s: str | None) -> float | None:
    """Parse a float, returning None if it fails."""
    if not s:
        return None
    try:
        return float(s)
    except (ValueError, TypeError):
        return None


@router.websocket("/{job_id}")
async def chart_ws(websocket: WebSocket, job_id: str):
    await ws_manager.connect_chart(job_id, websocket)

    db = SessionLocal()
    job = db.query(JobRecord).filter(JobRecord.job_id == job_id).first()
    db.close()

    if not job or not job.project_path:
        await websocket.send_json({"error": "Job not found"})
        await ws_manager.disconnect_chart(job_id, websocket)
        return

    log_path = f"{job.project_path.rstrip('/')}/vasp.out"
    alias = job.server_alias or ""

    if not alias or not ssh_manager.is_connected(alias):
        await websocket.send_json({"error": f"Server '{alias}' not connected"})
        await ws_manager.disconnect_chart(job_id, websocket)
        return

    logger.info(f"[CHART] {job_id}: Parsing OSZICAR from {log_path} on {alias}")

    try:
        process = await ssh_manager.create_process(alias, f"tail -f -n 50 {log_path} 2>/dev/null")
    except Exception as e:
        await websocket.send_json({"error": str(e)})
        await ws_manager.disconnect_chart(job_id, websocket)
        return

    prev_energy: float | None = None
    current_ionic = 1

    try:
        while True:
            try:
                line = await asyncio.wait_for(process.stdout.readline(), timeout=30.0)
            except asyncio.TimeoutError:
                continue

            if not line:
                break

            text = line if isinstance(line, str) else line.decode("utf-8", errors="replace")

            # Check for ionic step header
            m_ion = RE_IONIC.match(text)
            if m_ion:
                current_ionic = int(m_ion.group(1))
                try:
                    await websocket.send_json({
                        "step": 0, "energy": 0, "free_energy": None,
                        "temperature": None, "delta_e": None,
                        "ionic_step": current_ionic, "step_type": "ionic",
                    })
                except Exception:
                    break
                continue

            # Parse OSZICAR line
            m = RE_OSZICAR.match(text)
            if not m:
                continue

            # In compact format, F is the total energy (no separate E field)
            # In standard format, E is the electronic energy, F is free energy
            energy = safe_float(m.group("E")) or safe_float(m.group("E0")) or safe_float(m.group("F"))
            free_energy = safe_float(m.group("F"))
            temperature = safe_float(m.group("T")) or 300.0
            step = int(m.group("step"))

            if energy is None:
                continue

            # Use dE from match if present, otherwise compute from previous
            dE_from_match = safe_float(m.group("dE"))
            delta_e = dE_from_match if dE_from_match is not None else (
                energy - prev_energy if prev_energy is not None else 0.0
            )
            prev_energy = energy

            point = {
                "step": step,
                "energy": energy,
                "free_energy": free_energy,
                "temperature": temperature,
                "delta_e": delta_e,
                "ionic_step": current_ionic,
                "step_type": "electronic",
            }

            try:
                await websocket.send_json(point)
                # Also broadcast to any other chart watchers
                await ws_manager.broadcast_chart(job_id, point)
            except Exception:
                break

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"[CHART] {job_id}: Error: {e}")
    finally:
        try:
            process.terminate()
        except Exception:
            pass
        await ws_manager.disconnect_chart(job_id, websocket)
