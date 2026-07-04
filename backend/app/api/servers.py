"""Server management API routes."""
import asyncio
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.server import ServerNode
from app.schemas.server import ServerCreate, ServerUpdate, ServerResponse, TestConnectionResponse
from app.services.auth_service import require_user, get_current_user
from app.models.user import User
from app.services.crypto_utils import encrypt_password, decrypt_password
from app.services.ssh_manager import ssh_manager

router = APIRouter()

@router.get("", response_model=list[ServerResponse])
def list_servers(db: Session = Depends(get_db), user: User | None = Depends(get_current_user)):
    servers = db.query(ServerNode).all()
    return [ServerResponse(
        id=s.id, alias=s.alias, host=s.host, port=s.port,
        username=s.username, auth_type=s.auth_type,
        has_password=bool(s.encrypted_password),
        created_at=s.created_at) for s in servers]

@router.post("", response_model=ServerResponse)
def create_server(req: ServerCreate, db: Session = Depends(get_db), user: User = Depends(require_user)):
    existing = db.query(ServerNode).filter(ServerNode.alias == req.alias).first()
    if existing:
        raise HTTPException(status_code=409, detail="Server alias '" + req.alias + "' already exists")
    server = ServerNode(
        user_id=user.id, alias=req.alias, host=req.host, port=req.port,
        username=req.username, auth_type=req.auth_type,
        encrypted_password=encrypt_password(req.password) if req.password else None,
        key_file_path=req.key_file, proxy_type=req.proxy_type,
        proxy_host=req.proxy_host, proxy_port=req.proxy_port,
    )
    db.add(server)
    db.commit()
    db.refresh(server)
    return ServerResponse(
        id=server.id, alias=server.alias, host=server.host, port=server.port,
        username=server.username, auth_type=server.auth_type,
        has_password=bool(server.encrypted_password), created_at=server.created_at)

@router.put("/{server_id}", response_model=ServerResponse)
def update_server(server_id: int, req: ServerUpdate, db: Session = Depends(get_db), user: User = Depends(require_user)):
    server = db.query(ServerNode).filter(ServerNode.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    if req.alias and req.alias != server.alias:
        dup = db.query(ServerNode).filter(ServerNode.alias == req.alias, ServerNode.id != server_id).first()
        if dup:
            raise HTTPException(status_code=409, detail="Server alias '" + req.alias + "' already exists")
    for field, value in req.model_dump(exclude_unset=True).items():
        if field == "password" and value:
            setattr(server, "encrypted_password", encrypt_password(value))
        elif hasattr(server, field):
            setattr(server, field, value)
    db.commit()
    db.refresh(server)
    return ServerResponse(
        id=server.id, alias=server.alias, host=server.host, port=server.port,
        username=server.username, auth_type=server.auth_type,
        has_password=bool(server.encrypted_password), created_at=server.created_at)

@router.delete("/{server_id}")
async def delete_server(server_id: int, db: Session = Depends(get_db), user: User = Depends(require_user)):
    server = db.query(ServerNode).filter(ServerNode.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    await ssh_manager.disconnect(server.alias)
    db.delete(server)
    db.commit()
    return {"ok": True}

async def detect_vasp(alias: str) -> list[dict]:
    """Detect installed VASP executables on the remote server."""
    results = []
    for cmd in ["vasp_std", "vasp_gam", "vasp_ncl"]:
        try:
            _, path_out, _ = await ssh_manager.execute(alias, "command -v " + cmd + " || echo ''")
            path = path_out.strip()
            if not path:
                continue
            # Use portable syntax: redirect stderr, take first 5 lines, timeout via shell built-in
            _, ver_out, _ = await ssh_manager.execute(
                alias, "timeout 2 " + path + " 2>&1 | head -n 5 || echo 'unknown'", timeout=5)
            version = "unknown"
            for line in ver_out.strip().split("\n"):
                line = line.strip()
                if "vasp" in line.lower():
                    version = line[:80]
                    break
            results.append({"name": cmd, "path": path, "version": version})
        except Exception:
            pass
    return results

@router.post("/{server_id}/test", response_model=TestConnectionResponse)
async def test_connection(server_id: int, db: Session = Depends(get_db), user: User = Depends(require_user)):
    server = db.query(ServerNode).filter(ServerNode.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    try:
        password = decrypt_password(server.encrypted_password) if server.encrypted_password else None
        # Hard 12s timeout for the entire connection attempt
        await asyncio.wait_for(
            ssh_manager.connect(
                alias=server.alias, host=server.host, port=server.port,
                username=server.username, password=password, key_file=server.key_file_path),
            timeout=12.0,
        )
        exit_code, stdout, stderr = await ssh_manager.execute(server.alias, "echo $HOME")
        home = stdout.strip() if exit_code == 0 else None
        vasp_versions = await detect_vasp(server.alias)
        return TestConnectionResponse(
            success=True, message="Connected successfully", home=home,
            vasp_versions=vasp_versions)
    except asyncio.TimeoutError:
        await ssh_manager.disconnect(server.alias)
        return TestConnectionResponse(success=False, message="Connection timed out (server unreachable)", vasp_versions=[])
    except Exception as e:
        return TestConnectionResponse(success=False, message=str(e), vasp_versions=[])

@router.post("/{server_id}/disconnect")
async def disconnect_server(server_id: int, db: Session = Depends(get_db), user: User = Depends(require_user)):
    server = db.query(ServerNode).filter(ServerNode.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    await ssh_manager.disconnect(server.alias)
    return {"ok": True}
