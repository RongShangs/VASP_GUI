"""Node status API routes."""
from fastapi import APIRouter, Depends, HTTPException
from app.services.auth_service import require_user
from app.services.ssh_manager import ssh_manager

router = APIRouter()

@router.get("/nodes/{alias}")
async def node_status(alias: str, user = Depends(require_user)):
    if not ssh_manager.is_connected(alias):
        raise HTTPException(status_code=400, detail="Server not connected")
    try:
        _, cpu_out, _ = await ssh_manager.execute(alias, "top -bn1 | head -5")
        _, mem_out, _ = await ssh_manager.execute(alias, "free -h")
        _, df_out, _ = await ssh_manager.execute(alias, "df -h /")
        return {"cpu": cpu_out, "memory": mem_out, "disk": df_out, "alias": alias}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/processes/{alias}")
async def list_processes(alias: str, user = Depends(require_user)):
    if not ssh_manager.is_connected(alias):
        raise HTTPException(status_code=400, detail="Server not connected")
    try:
        # Filter: match actual VASP executables, exclude "tail -f vasp.out" etc.
        cmd = r"ps aux | grep -E 'vasp_std|vasp_gam|vasp_ncl|vasp\.x|mpirun.*vasp' | grep -v grep || echo 'none'"
        _, out, _ = await ssh_manager.execute(alias, cmd)
        return {"processes": out, "alias": alias}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
