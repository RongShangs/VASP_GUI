"""Server CRUD schemas."""
from pydantic import BaseModel
from datetime import datetime

class ServerCreate(BaseModel):
    alias: str
    host: str
    port: int = 22
    username: str
    auth_type: str = "password"
    password: str | None = None
    key_file: str | None = None
    proxy_type: str | None = None
    proxy_host: str | None = None
    proxy_port: int | None = None

class ServerUpdate(BaseModel):
    alias: str | None = None
    host: str | None = None
    port: int | None = None
    username: str | None = None
    auth_type: str | None = None
    password: str | None = None
    key_file: str | None = None

class ServerResponse(BaseModel):
    id: int
    alias: str
    host: str
    port: int
    username: str
    auth_type: str
    has_password: bool = False
    created_at: datetime | None = None

    class Config:
        from_attributes = True

class TestConnectionResponse(BaseModel):
    success: bool
    message: str = ""
    home: str | None = None
    vasp_versions: list[dict] = []
