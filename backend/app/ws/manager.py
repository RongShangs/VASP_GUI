"""WebSocket connection manager."""
import asyncio
import logging
from typing import Any
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketManager:
    def __init__(self):
        self._console: dict[str, list[WebSocket]] = {}
        self._chart: dict[str, list[WebSocket]] = {}
        self._status: dict[str, list[WebSocket]] = {}
        self._progress: dict[str, list[WebSocket]] = {}
        self._terminal: dict[str, dict[str, Any]] = {}

    # ── Console ──────────────────────────────────────────────

    async def connect_console(self, job_id: str, ws: WebSocket):
        await ws.accept()
        self._console.setdefault(job_id, []).append(ws)

    async def disconnect_console(self, job_id: str, ws: WebSocket):
        conns = self._console.get(job_id, [])
        if ws in conns:
            conns.remove(ws)

    async def broadcast_console(self, job_id: str, line: str):
        for ws in self._console.get(job_id, []):
            try: await ws.send_text(line)
            except Exception: pass

    # ── Chart ────────────────────────────────────────────────

    async def connect_chart(self, job_id: str, ws: WebSocket):
        await ws.accept()
        self._chart.setdefault(job_id, []).append(ws)

    async def disconnect_chart(self, job_id: str, ws: WebSocket):
        conns = self._chart.get(job_id, [])
        if ws in conns:
            conns.remove(ws)

    async def broadcast_chart(self, job_id: str, point: dict):
        for ws in self._chart.get(job_id, []):
            try: await ws.send_json(point)
            except Exception: pass

    # ── Status ───────────────────────────────────────────────

    async def connect_status(self, alias: str, ws: WebSocket):
        await ws.accept()
        self._status.setdefault(alias, []).append(ws)

    async def disconnect_status(self, alias: str, ws: WebSocket):
        conns = self._status.get(alias, [])
        if ws in conns:
            conns.remove(ws)

    async def broadcast_status(self, alias: str, status: dict):
        for ws in self._status.get(alias, []):
            try: await ws.send_json(status)
            except Exception: pass

    # ── Progress (structured job progress updates) ──────────

    async def connect_progress(self, job_id: str, ws: WebSocket):
        await ws.accept()
        self._progress.setdefault(job_id, []).append(ws)

    async def disconnect_progress(self, job_id: str, ws: WebSocket):
        conns = self._progress.get(job_id, [])
        if ws in conns:
            conns.remove(ws)

    async def broadcast_progress(self, job_id: str, progress: dict):
        for ws in self._progress.get(job_id, []):
            try:
                await ws.send_json(progress)
            except Exception:
                pass

    # ── Terminal (bidirectional PTY) ─────────────────────────

    async def connect_terminal(self, alias: str, ws: WebSocket):
        from app.services.ssh_manager import ssh_manager

        await ws.accept()
        logger.info(f"[TERMINAL] {alias}: WebSocket accepted")

        conn_info = ssh_manager.get_connection(alias)
        if not conn_info or not conn_info.conn:
            logger.error(f"[TERMINAL] {alias}: SSH not connected")
            await ws.send_text("ERROR: SSH not connected\r\n")
            await ws.close()
            return

        logger.info(f"[TERMINAL] {alias}: SSH connection OK, creating shell process...")

        # Try multiple approaches to start a shell
        process = None
        for shell_cmd in ['bash -l', 'bash', '/bin/bash', '/bin/sh']:
            try:
                logger.info(f"[TERMINAL] {alias}: Trying: {shell_cmd}")
                process = await conn_info.conn.create_process(
                    shell_cmd,
                    term_type='xterm-256color',
                    term_size=(80, 24),
                )
                logger.info(f"[TERMINAL] {alias}: Shell started with '{shell_cmd}'")
                break
            except Exception as e:
                logger.warning(f"[TERMINAL] {alias}: '{shell_cmd}' failed: {e}")
                continue

        if process is None:
            logger.error(f"[TERMINAL] {alias}: All shell attempts failed")
            await ws.send_text("ERROR: Could not start shell\r\n")
            await ws.close()
            return

        self._terminal[alias] = {"ws": ws, "process": process}

        # Send immediate confirmation
        try:
            await ws.send_text(f"\x1b[36m[Connected to {alias} — shell ready]\x1b[0m\r\n")
        except Exception:
            pass

        # Start readers
        asyncio.create_task(self._read_terminal_output(alias))
        asyncio.create_task(self._cwd_poller(alias))

        logger.info(f"[TERMINAL] {alias}: Terminal fully initialized")

    async def _read_terminal_output(self, alias: str):
        """Continuously read stdout from the terminal process."""
        entry = self._terminal.get(alias)
        if not entry:
            return
        process = entry["process"]
        ws = entry["ws"]
        logger.info(f"[TERMINAL] {alias}: Starting stdout reader loop")
        try:
            while True:
                data = await process.stdout.read(4096)
                if not data:
                    # EOF reached
                    logger.info(f"[TERMINAL] {alias}: stdout EOF (process ended)")
                    break
                # data may be str (asyncssh >= 2.14) or bytes (older versions)
                text = data.decode("utf-8", errors="replace") if isinstance(data, bytes) else data
                try:
                    await ws.send_text(text)
                except Exception:
                    logger.info(f"[TERMINAL] {alias}: WS closed, stopping reader")
                    break
        except Exception as e:
            logger.error(f"[TERMINAL] {alias}: stdout reader error: {e}")
        finally:
            logger.info(f"[TERMINAL] {alias}: stdout reader stopped")
            await self.disconnect_terminal(alias)

    async def _cwd_poller(self, alias: str):
        """CWD polling disabled — use Set Work Dir button in center panel instead.
        Previously injected echo commands into stdin which corrupted terminal display.
        """
        pass  # Disabled: stdin injection pollutes the terminal

    async def handle_terminal_input(self, alias: str, data: str):
        """Write user input to the shell's stdin. asyncssh expects str, not bytes."""
        entry = self._terminal.get(alias)
        if entry and entry["process"]:
            try:
                # data is already a str from websocket.receive_text()
                w = entry["process"].stdin.write(data)
                if w is not None and hasattr(w, '__await__'):
                    await w
            except Exception as e:
                logger.error(f"[TERMINAL] {alias}: stdin write error: {e}")

    async def disconnect_terminal(self, alias: str):
        entry = self._terminal.pop(alias, None)
        if entry:
            logger.info(f"[TERMINAL] {alias}: Disconnecting terminal")
            try:
                entry["process"].stdin.close()
            except Exception:
                pass
            try:
                entry["process"].close()
            except Exception:
                pass


# Global instance
ws_manager = WebSocketManager()
