"""WebSocket endpoint for VASP console output.

When a client connects for a job_id, starts tailing vasp.out on the remote
server and streams each line to the WebSocket.
"""
import asyncio
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from app.ws.manager import ws_manager
from app.database import SessionLocal
from app.models.job import JobRecord
from app.services.ssh_manager import ssh_manager

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/{job_id}")
async def console_ws(websocket: WebSocket, job_id: str):
    await ws_manager.connect_console(job_id, websocket)

    # Look up the job to find the project path
    db = SessionLocal()
    job = db.query(JobRecord).filter(JobRecord.job_id == job_id).first()
    db.close()

    if not job or not job.project_path:
        await websocket.send_text("ERROR: Job not found or no project path")
        await ws_manager.disconnect_console(job_id, websocket)
        return

    log_path = f"{job.project_path.rstrip('/')}/vasp.out"
    alias = job.server_alias or ""

    if not alias or not ssh_manager.is_connected(alias):
        await websocket.send_text(f"ERROR: Server '{alias}' not connected")
        await ws_manager.disconnect_console(job_id, websocket)
        return

    logger.info(f"[CONSOLE] {job_id}: Streaming {log_path} on {alias}")

    try:
        # Start tail -f — show last 50 lines then follow
        process = await ssh_manager.create_process(alias, f"tail -f -n 50 {log_path} 2>/dev/null || echo 'FILE_NOT_FOUND'")
    except Exception as e:
        await websocket.send_text(f"ERROR: Could not start tail: {e}")
        await ws_manager.disconnect_console(job_id, websocket)
        return

    try:
        while True:
            # Read from stdout
            try:
                line = await asyncio.wait_for(process.stdout.readline(), timeout=30.0)
            except asyncio.TimeoutError:
                # No output for 30s — send keepalive, keep waiting
                try:
                    await websocket.send_text("")  # heartbeat
                except Exception:
                    break
                continue

            if not line:
                break  # EOF — process ended

            text = line if isinstance(line, str) else line.decode("utf-8", errors="replace")
            text = text.rstrip("\n\r")

            try:
                await websocket.send_text(text)
            except Exception:
                break  # Client disconnected

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"[CONSOLE] {job_id}: Error: {e}")
        try:
            await websocket.send_text(f"Stream error: {e}")
        except Exception:
            pass
    finally:
        try:
            process.terminate()
        except Exception:
            pass
        await ws_manager.disconnect_console(job_id, websocket)
