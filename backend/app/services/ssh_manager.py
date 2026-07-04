"""Async SSH connection manager using asyncssh."""
import asyncio
try:
    import asyncssh
    HAS_ASYNCSSH = True
except ImportError:
    asyncssh = None  # type: ignore
    HAS_ASYNCSSH = False
from typing import Optional, Any
from dataclasses import dataclass, field
import logging

logger = logging.getLogger(__name__)

@dataclass
class SSHConnection:
    alias: str
    host: str
    port: int = 22
    username: str = ""
    password: str | None = None
    key_file: str | None = None
    conn: Optional[asyncssh.SSHClientConnection] = None
    last_used: float = 0.0

class SSHManager:
    """Pool of async SSH connections with keep-alive."""

    def __init__(self, keepalive_interval: int = 30):
        self._connections: dict[str, SSHConnection] = {}
        self._keepalive_interval = keepalive_interval
        self._lock = asyncio.Lock()

    async def connect(
        self, alias: str, host: str, port: int = 22,
        username: str = "", password: str | None = None,
        key_file: str | None = None,
    ) -> SSHConnection:
        if not HAS_ASYNCSSH:
            raise ImportError("asyncssh is not installed. Run: pip install asyncssh")
        async with self._lock:
            if alias in self._connections:
                await self.disconnect(alias)
            conn_info = SSHConnection(
                alias=alias, host=host, port=port,
                username=username, password=password, key_file=key_file)
            connect_kwargs: dict[str, Any] = {
                "host": host, "port": port, "username": username,
                "known_hosts": None,
                "connect_timeout": 10,  # 10s SSH connect timeout
            }
            if key_file:
                connect_kwargs["client_keys"] = [key_file]
            elif password:
                connect_kwargs["password"] = password
            conn_info.conn = await asyncssh.connect(**connect_kwargs)
            conn_info.last_used = asyncio.get_event_loop().time()
            self._connections[alias] = conn_info
            logger.info(f"SSH connected: {alias} ({username}@{host}:{port})")
            return conn_info

    async def disconnect(self, alias: str) -> None:
        async with self._lock:
            conn_info = self._connections.pop(alias, None)
            if conn_info and conn_info.conn:
                try:
                    conn_info.conn.close()
                    await conn_info.conn.wait_closed()
                except Exception:
                    pass
                logger.info(f"SSH disconnected: {alias}")

    def get_connection(self, alias: str) -> Optional[SSHConnection]:
        return self._connections.get(alias)

    def is_connected(self, alias: str) -> bool:
        conn_info = self._connections.get(alias)
        return conn_info is not None and conn_info.conn is not None and not conn_info.conn.is_closed()

    async def execute(self, alias: str, command: str, timeout: int = 30) -> tuple[int, str, str]:
        conn_info = self.get_connection(alias)
        if not conn_info or not conn_info.conn:
            raise ValueError(f"Not connected to server: {alias}")
        conn_info.last_used = asyncio.get_event_loop().time()
        result = await conn_info.conn.run(command, timeout=timeout)
        return result.exit_status, result.stdout.strip() if result.stdout else "", result.stderr.strip() if result.stderr else ""

    async def create_process(self, alias: str, command: str) -> asyncssh.SSHClientProcess:
        conn_info = self.get_connection(alias)
        if not conn_info or not conn_info.conn:
            raise ValueError(f"Not connected to server: {alias}")
        return await conn_info.conn.create_process(command)

    async def disconnect_all(self) -> None:
        for alias in list(self._connections.keys()):
            await self.disconnect(alias)

# Global SSH manager instance
ssh_manager = SSHManager()
