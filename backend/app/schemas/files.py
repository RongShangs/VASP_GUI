"""File operation schemas."""
from pydantic import BaseModel

class FileNode(BaseModel):
    name: str
    path: str
    type: str  # "file" | "dir"
    size: int = 0
    mtime: str | None = None

class FileContent(BaseModel):
    path: str
    content: str
    size: int = 0
    mtime: str | None = None

class FileWriteRequest(BaseModel):
    path: str
    content: str

class FileMkdirRequest(BaseModel):
    path: str

class FileOperationResponse(BaseModel):
    ok: bool = True
    message: str = ""
