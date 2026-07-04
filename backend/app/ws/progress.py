"""WebSocket endpoint for structured job progress updates.

Pushes ionic/electronic step progress, convergence status, and energy data
to the frontend in real-time.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.ws.manager import ws_manager

router = APIRouter()


@router.websocket("/{job_id}")
async def progress_ws(websocket: WebSocket, job_id: str):
    await ws_manager.connect_progress(job_id, websocket)
    try:
        while True:
            # Client can send heartbeat/ping messages
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        await ws_manager.disconnect_progress(job_id, websocket)
