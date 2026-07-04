"""File management API routes."""
import shlex
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.services.auth_service import require_user
from app.services.ssh_manager import ssh_manager
from app.services.sftp_manager import SFTPManager
from app.schemas.files import FileNode, FileContent, FileWriteRequest, FileMkdirRequest
from app.models.user import User
import io

router = APIRouter()
sftp_manager = SFTPManager(ssh_manager)


class RenameRequest(BaseModel):
    old_path: str
    new_path: str


class CopyRequest(BaseModel):
    src: str
    dst: str

@router.get("/{alias}", response_model=list[FileNode])
async def list_files(alias: str, path: str = Query(default="/"), user: User = Depends(require_user)):
    try:
        entries = await sftp_manager.list_dir(alias, path)
        return [FileNode(name=e.name, path=e.path, type=e.type, size=e.size, mtime=e.mtime) for e in entries]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SFTP error: {str(e)}")

@router.get("/{alias}/read", response_model=FileContent)
async def read_file(alias: str, path: str = Query(...), user: User = Depends(require_user)):
    try:
        content, size = await sftp_manager.read_file(alias, path)
        return FileContent(path=path, content=content, size=size)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{alias}/write")
async def write_file(alias: str, req: FileWriteRequest, user: User = Depends(require_user)):
    try:
        await sftp_manager.write_file(alias, req.path, req.content)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{alias}/mkdir")
async def make_directory(alias: str, req: FileMkdirRequest, user: User = Depends(require_user)):
    try:
        await sftp_manager.mkdir(alias, req.path)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{alias}")
async def delete_path(alias: str, path: str = Query(...), is_dir: bool = Query(False), user: User = Depends(require_user)):
    try:
        await sftp_manager.delete(alias, path, is_dir)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{alias}/info")
async def file_info(alias: str, path: str = Query(...), user: User = Depends(require_user)):
    info = await sftp_manager.file_info(alias, path)
    if not info:
        raise HTTPException(status_code=404, detail="File not found")
    return {"name": info.name, "path": info.path, "type": info.type, "size": info.size, "mtime": info.mtime}

@router.post("/{alias}/upload")
async def upload_file(alias: str, path: str = Query(...), file: UploadFile = File(...), user: User = Depends(require_user)):
    data = await file.read()
    remote_path = f"{path.rstrip('/')}/{file.filename}"
    # Check if content appears to be text (for VASP files) or binary
    try:
        content_str = data.decode("utf-8")
        await sftp_manager.write_file(alias, remote_path, content_str)
    except UnicodeDecodeError:
        await sftp_manager.write_file_bytes(alias, remote_path, data)
    return {"ok": True, "filename": file.filename}

@router.get("/{alias}/download")
async def download_file(alias: str, path: str = Query(...), user: User = Depends(require_user)):
    data = await sftp_manager.read_file_bytes(alias, path, max_size_mb=200)
    return StreamingResponse(io.BytesIO(data), media_type="application/octet-stream",
                             headers={"Content-Disposition": f'attachment; filename="{path.split("/")[-1]}"'})


@router.post("/{alias}/rename")
async def rename_path(alias: str, req: RenameRequest, user: User = Depends(require_user)):
    """Rename/move a file or directory."""
    try:
        await sftp_manager.rename(alias, req.old_path, req.new_path)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{alias}/copy")
async def copy_path(alias: str, req: CopyRequest, user: User = Depends(require_user)):
    """Copy a file or directory (recursive). Uses SSH cp command."""
    try:
        cmd = f"cp -r {shlex.quote(req.src)} {shlex.quote(req.dst)}"
        exit_code, stdout, stderr = await ssh_manager.execute(alias, cmd)
        if exit_code != 0:
            raise HTTPException(status_code=500, detail=stderr or "Copy failed")
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
