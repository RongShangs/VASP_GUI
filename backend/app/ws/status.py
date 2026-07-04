"""WebSocket endpoint for node status updates."""
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.ws.manager import ws_manager
from app.services.ssh_manager import ssh_manager

router = APIRouter()

@router.websocket("/{alias}")
async def status_ws(websocket: WebSocket, alias: str):
    await ws_manager.connect_status(alias, websocket)
    try:
        while True:
            if ssh_manager.is_connected(alias):
                try:
                    _, cpu, _ = await ssh_manager.execute(alias, "top -bn1 | grep 'Cpu(s)' | head -1")
                    _, mem, _ = await ssh_manager.execute(alias, "free -h | grep Mem")
                    await ws_manager.broadcast_status(alias, {
                        "alias": alias, "cpu": cpu, "memory": mem, "connected": True})
                except Exception:
                    await ws_manager.broadcast_status(alias, {"alias": alias, "connected": False})
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        await ws_manager.disconnect_status(alias, websocket)
