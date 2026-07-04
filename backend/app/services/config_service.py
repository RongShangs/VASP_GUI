"""Configuration management service."""
from app.config import config_loader, AppConfig, get_config

def get_web_config() -> dict:
    cfg = get_config()
    return {
        "host": cfg.web.host,
        "port": cfg.web.port,
        "access_token_expire_minutes": cfg.web.access_token_expire_minutes,
    }

def get_defaults() -> dict:
    cfg = get_config()
    return {
        "vasp_command": cfg.defaults.vasp_command,
        "mpi_np": cfg.defaults.mpi_np,
        "max_file_size_mb": cfg.defaults.max_file_size_mb,
        "keepalive_interval_s": cfg.defaults.keepalive_interval_s,
        "status_refresh_interval_s": cfg.defaults.status_refresh_interval_s,
    }

def update_web_config(data: dict) -> None:
    cfg = get_config()
    for k, v in data.items():
        if hasattr(cfg.web, k):
            setattr(cfg.web, k, v)
    config_loader.save(cfg)
