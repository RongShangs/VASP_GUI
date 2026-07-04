"""Global configuration loader from config.yaml with auto-generation."""
import os
import secrets
from pathlib import Path
from typing import Optional

import yaml
from pydantic import BaseModel, Field


class WebConfig(BaseModel):
    host: str = "0.0.0.0"
    port: int = 1691
    secret_key: str = ""
    access_token_expire_minutes: int = 1440


class AdminConfig(BaseModel):
    username: str = "admin"
    password: str = ""


class LoggingConfig(BaseModel):
    level: str = "INFO"
    file: str = "vasp_gui.log"


class DefaultsConfig(BaseModel):
    vasp_command: str = "vasp_std"
    mpi_np: int = 4
    max_file_size_mb: int = 50
    keepalive_interval_s: int = 30
    status_refresh_interval_s: int = 5


class ServerPreset(BaseModel):
    alias: str = ""
    host: str = ""
    port: int = 22
    username: str = ""
    auth_type: str = "password"  # password | key
    password: str = ""
    key_file: str = ""
    proxy: dict | None = None


class AppConfig(BaseModel):
    web: WebConfig = Field(default_factory=WebConfig)
    admin: AdminConfig = Field(default_factory=AdminConfig)
    servers: list[dict] = []
    cors_origins: list[str] = ["*"]
    defaults: DefaultsConfig = Field(default_factory=DefaultsConfig)
    logging: LoggingConfig = Field(default_factory=LoggingConfig)


DEFAULT_CONFIG_YAML = """# ============================================================
# VASP GUI Web config
# ============================================================
web:
  host: "0.0.0.0"
  port: 1691
  secret_key: "{secret_key}"
  access_token_expire_minutes: 1440
admin:
  username: "admin"
  password: ""  # 留空=免密登录；设置后需密码
servers: []
cors_origins:
  - "*"
defaults:
  vasp_command: "vasp_std"
  mpi_np: 4
  max_file_size_mb: 50
  keepalive_interval_s: 30
  status_refresh_interval_s: 5
logging:
  level: "INFO"
  file: "vasp_gui.log"
"""


class ConfigLoader:
    def __init__(self, config_dir: Optional[Path] = None):
        if config_dir is None:
            config_dir = Path(__file__).resolve().parent.parent
        self.config_path = config_dir / "config.yaml"
        self._config: Optional[AppConfig] = None

    @property
    def config(self) -> AppConfig:
        if self._config is None:
            self.load()
        return self._config

    def load(self) -> AppConfig:
        if not self.config_path.exists():
            self._generate_default()
        with open(self.config_path, "r", encoding="utf-8") as f:
            raw = yaml.safe_load(f) or {}
        self._config = AppConfig(**raw)
        return self._config

    def _generate_default(self) -> None:
        secret_key = secrets.token_hex(32)
        admin_password = ""  # Empty = no password required
        content = DEFAULT_CONFIG_YAML.format(
            secret_key=secret_key, admin_password=admin_password)
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.config_path, "w", encoding="utf-8") as f:
            f.write(content)
        # Print credentials so admin knows how to log in
        print("=" * 60)
        print("  First launch: config.yaml generated")
        print(f"  Admin username: admin")
        print(f"  Admin password: {admin_password}")
        print("  Change password in config.yaml and restart")
        print("=" * 60)

    def save(self, config: AppConfig) -> None:
        self._config = config
        with open(self.config_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(config.model_dump(), f, default_flow_style=False, allow_unicode=True)


config_loader = ConfigLoader()

def get_config() -> AppConfig:
    return config_loader.config

def get_secret_key() -> str:
    return config_loader.config.web.secret_key
