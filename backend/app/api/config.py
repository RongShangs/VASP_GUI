"""Configuration API routes."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services.auth_service import require_user
from app.services.config_service import get_web_config, get_defaults
from app.config import config_loader, get_config
from app.models.user import User

router = APIRouter()


class ConfigUpdateRequest(BaseModel):
    host: Optional[str] = None
    port: Optional[int] = None
    access_token_expire_minutes: Optional[int] = None
    vasp_command: Optional[str] = None
    mpi_np: Optional[int] = None
    max_file_size_mb: Optional[int] = None
    keepalive_interval_s: Optional[int] = None
    status_refresh_interval_s: Optional[int] = None
    log_level: Optional[str] = None


@router.get("")
def get_api_config(user: User = Depends(require_user)):
    return {
        **get_web_config(),
        **get_defaults(),
    }


@router.put("")
def update_config(req: ConfigUpdateRequest, user: User = Depends(require_user)):
    """Update configuration values. Requires service restart for changes to take effect."""
    try:
        cfg = config_loader.config

        # Web settings
        if req.host is not None:
            cfg.web.host = req.host
        if req.port is not None:
            cfg.web.port = req.port
        if req.access_token_expire_minutes is not None:
            cfg.web.access_token_expire_minutes = req.access_token_expire_minutes

        # Defaults
        if req.vasp_command is not None:
            cfg.defaults.vasp_command = req.vasp_command
        if req.mpi_np is not None:
            cfg.defaults.mpi_np = req.mpi_np
        if req.max_file_size_mb is not None:
            cfg.defaults.max_file_size_mb = req.max_file_size_mb
        if req.keepalive_interval_s is not None:
            cfg.defaults.keepalive_interval_s = req.keepalive_interval_s
        if req.status_refresh_interval_s is not None:
            cfg.defaults.status_refresh_interval_s = req.status_refresh_interval_s

        # Logging
        if req.log_level is not None:
            cfg.logging.level = req.log_level

        config_loader.save(cfg)
        return {"ok": True, "message": "Config saved. Restart the service for changes to take effect."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save config: {str(e)}")
