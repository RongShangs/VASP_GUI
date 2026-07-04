"""VASP output log streaming and energy data extraction.

Streams vasp.out to WebSocket and extracts OSZICAR energy data for charting.
"""
import asyncio
import logging
import re
from typing import AsyncIterator, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class EnergyPoint:
    step: int
    energy: float
    free_energy: float
    temperature: float
    delta_e: float = 0.0
    step_type: str = "electronic"  # "electronic" | "ionic_header"


class LogStreamer:
    """Stream VASP output log to WebSocket and extract energy data."""

    # Regex for OSZICAR electronic step lines
    OSZICAR_PATTERN = re.compile(
        r'^\s*(?P<step>\d+)\s+T=\s*(?P<T>[\d.]+)\s+E=\s*(?P<E>[\d.E+\-]+)'
        r'\s+F=\s*(?P<F>[\d.E+\-]+)\s+E0=\s*(?P<E0>[\d.E+\-]+)'
        r'\s+EK=\s*(?P<EK>[\d.E+\-]+)\s+SP=\s*(?P<SP>[\d.E+\-]+)'
        r'\s+SK=\s*(?P<SK>[\d.E+\-]+)'
    )

    # Regex for ion step separators
    IONIC_STEP_PATTERN = re.compile(r'^\s*-+\s*ion\s+step\s+\d+\s*-+', re.IGNORECASE)

    def __init__(self, ssh_manager=None):
        self._ssh = ssh_manager
        self._prev_energy: Optional[float] = None
        self._chart_queue: asyncio.Queue = asyncio.Queue()

    @property
    def chart_queue(self) -> asyncio.Queue:
        return self._chart_queue

    async def stream_to_ws(
        self,
        alias: str,
        log_path: str,
        websocket,
    ) -> None:
        """Stream vasp.out content to a WebSocket.

        Each line is sent as text to the WebSocket.
        OSZICAR energy lines are parsed and put into chart_queue.
        """
        self._prev_energy = None
        try:
            process = await self._ssh.create_process(
                alias, f"tail -f -n 0 {log_path}"
            )
            async for line in process.stdout:
                line_str = line if isinstance(line, str) else line.decode("utf-8", errors="replace")

                # Send raw line to WebSocket (for terminal display)
                try:
                    await websocket.send_text(line_str.rstrip("\n"))
                except Exception:
                    break  # WebSocket closed

                # Try to extract energy data
                point = self._parse_line(line_str)
                if point:
                    await self._chart_queue.put({
                        "step": point.step,
                        "energy": point.energy,
                        "free_energy": point.free_energy,
                        "temperature": point.temperature,
                        "delta_e": point.delta_e,
                        "step_type": point.step_type,
                    })

        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Log streaming error for {log_path}: {e}")

    def _parse_line(self, line: str) -> Optional[EnergyPoint]:
        """Parse an OSZICAR energy line from log output."""
        # Check for ionic step header
        if self.IONIC_STEP_PATTERN.match(line):
            # Return None — the frontend handles ionic steps differently
            return None

        m = self.OSZICAR_PATTERN.match(line)
        if not m:
            return None

        energy = float(m.group("E"))
        delta = energy - self._prev_energy if self._prev_energy is not None else 0.0
        self._prev_energy = energy

        return EnergyPoint(
            step=int(m.group("step")),
            energy=energy,
            free_energy=float(m.group("F")),
            temperature=float(m.group("T")),
            delta_e=delta,
            step_type="electronic",
        )

    async def tail_file(
        self, alias: str, log_path: str, lines: int = 50
    ) -> list[str]:
        """Read the last N lines of a file (for initial state)."""
        try:
            _, stdout, _ = await self._ssh.execute(
                alias,
                f"tail -n {lines} {log_path} 2>/dev/null || true",
                timeout=10,
            )
            return stdout.split("\n") if stdout else []
        except Exception:
            return []
