"""Async SFTP file operations manager for asyncssh >= 2.14.

asyncssh SFTPClient API reference (no read/write — use get/put/open):
- get(path)        → bytes         (download file)
- put(path, data)  → None          (upload file)
- listdir(path)    → list[str]     (list filenames only)
- scandir(path)    → list[SFTPName] (list with attrs, if supported)
- stat(path)       → SFTPAttrs     (file metadata)
- mkdir / rmdir / remove / rename / exists / isdir / isfile
"""
import asyncio
import stat
import logging
from typing import Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class FileInfo:
    name: str
    path: str
    type: str  # "file" | "dir"
    size: int = 0
    mtime: str | None = None


class SFTPManager:
    """Async SFTP operations wrapper using correct asyncssh API."""

    def __init__(self, ssh_manager):
        self._ssh = ssh_manager

    async def _get_sftp(self, alias: str):
        conn_info = self._ssh.get_connection(alias)
        if not conn_info or not conn_info.conn:
            raise ValueError(f"Not connected to server: {alias}")
        return await conn_info.conn.start_sftp_client()

    # ── directory listing ──────────────────────────────────────────

    async def list_dir(self, alias: str, path: str) -> list[FileInfo]:
        sftp = await self._get_sftp(alias)
        try:
            entries: list[FileInfo] = []

            # Try scandir first (returns SFTPName objects with attrs)
            names: list[str] = []
            try:
                raw = await sftp.scandir(path)
                for entry in (raw or []):
                    filename = getattr(entry, 'filename', None) or str(entry)
                    names.append(filename)
                    entry_path = self._join(path, filename)
                    if hasattr(entry, 'attrs') and entry.attrs:
                        is_dir = stat.S_ISDIR(entry.attrs.permissions)
                        fsize = entry.attrs.size or 0
                        fmtime = str(entry.attrs.mtime) if entry.attrs.mtime else None
                    elif hasattr(entry, 'longname') and entry.longname and entry.longname.startswith('d'):
                        is_dir = True
                        fsize = 0
                        fmtime = None
                    else:
                        is_dir = False
                        fsize = 0
                        fmtime = None
                    entries.append(FileInfo(
                        name=filename, path=entry_path,
                        type="dir" if is_dir else "file",
                        size=fsize, mtime=fmtime))
            except Exception:
                # Fallback: listdir returns plain filename strings
                names = await sftp.listdir(path)
                for filename in names:
                    entry_path = self._join(path, filename)
                    try:
                        st = await sftp.stat(entry_path)
                        is_dir = stat.S_ISDIR(st.permissions)
                        fsize = st.size if st.size else 0
                        fmtime = str(st.mtime) if st.mtime else None
                    except Exception:
                        # Can't stat — guess by extension
                        is_dir = '.' not in filename or filename.startswith('.')
                        fsize = 0
                        fmtime = None
                    entries.append(FileInfo(
                        name=filename, path=entry_path,
                        type="dir" if is_dir else "file",
                        size=fsize, mtime=fmtime))

            entries.sort(key=lambda x: (0 if x.type == "dir" else 1, x.name.lower()))
            return entries
        finally:
            sftp.exit()
            await sftp.wait_closed()

    # ── file read / write ──────────────────────────────────────────

    async def read_file(self, alias: str, path: str, max_size_mb: int = 50) -> tuple[str, int]:
        """Read text file content. Uses get() then decode."""
        data = await self._get_raw(alias, path, max_size_mb)
        try:
            content = data.decode("utf-8")
        except UnicodeDecodeError:
            content = data.decode("latin-1")
        return content, len(data)

    async def read_file_bytes(self, alias: str, path: str, max_size_mb: int = 200) -> bytes:
        """Read file as raw bytes for download."""
        return await self._get_raw(alias, path, max_size_mb)

    async def _get_raw(self, alias: str, path: str, max_size_mb: int) -> bytes:
        sftp = await self._get_sftp(alias)
        f = None
        try:
            # Check size first
            try:
                st = await sftp.stat(path)
                if st.size and st.size > max_size_mb * 1024 * 1024:
                    raise ValueError(
                        f"File too large ({st.size / 1024 / 1024:.1f} MB > {max_size_mb} MB limit)")
            except ValueError:
                raise
            except Exception:
                pass  # stat may fail; proceed anyway

            # asyncssh >= 2.15: use open() + read(), NOT get()
            # 'rb' → binary read, returns bytes
            f = await sftp.open(path, 'rb')
            data = await f.read()
            if isinstance(data, str):
                data = data.encode('utf-8')
            if len(data) > max_size_mb * 1024 * 1024:
                raise ValueError(
                    f"File too large ({len(data) / 1024 / 1024:.1f} MB > {max_size_mb} MB limit)")
            return data
        finally:
            if f:
                await f.close()
            sftp.exit()
            await sftp.wait_closed()

    async def write_file(self, alias: str, path: str, content: str) -> None:
        """Write text content to remote file."""
        await self._put_raw(alias, path, content.encode("utf-8"))

    async def write_file_bytes(self, alias: str, path: str, data: bytes) -> None:
        """Write raw bytes to remote file."""
        await self._put_raw(alias, path, data)

    async def _put_raw(self, alias: str, path: str, data: bytes) -> None:
        sftp = await self._get_sftp(alias)
        f = None
        try:
            # asyncssh >= 2.15: use open('wb') + write(), NOT put()
            f = await sftp.open(path, 'wb')
            await f.write(data)
        finally:
            if f:
                await f.close()
            sftp.exit()
            await sftp.wait_closed()

    # ── directory operations ───────────────────────────────────────

    async def mkdir(self, alias: str, path: str) -> None:
        sftp = await self._get_sftp(alias)
        try:
            await sftp.mkdir(path)
        finally:
            sftp.exit()
            await sftp.wait_closed()

    async def rename(self, alias: str, old_path: str, new_path: str) -> None:
        """Rename/move a file or directory."""
        sftp = await self._get_sftp(alias)
        try:
            await sftp.rename(old_path, new_path)
        finally:
            sftp.exit()
            await sftp.wait_closed()

    async def delete(self, alias: str, path: str, is_dir: bool = False) -> None:
        sftp = await self._get_sftp(alias)
        try:
            if is_dir:
                await sftp.rmdir(path)
            else:
                await sftp.remove(path)
        finally:
            sftp.exit()
            await sftp.wait_closed()

    async def file_info(self, alias: str, path: str) -> Optional[FileInfo]:
        sftp = await self._get_sftp(alias)
        try:
            st = await sftp.stat(path)
            is_dir = stat.S_ISDIR(st.permissions)
            return FileInfo(
                name=path.rsplit("/", 1)[-1],
                path=path,
                type="dir" if is_dir else "file",
                size=st.size if st.size else 0,
                mtime=str(st.mtime) if st.mtime else None,
            )
        except Exception:
            return None
        finally:
            sftp.exit()
            await sftp.wait_closed()

    # ── helpers ────────────────────────────────────────────────────

    @staticmethod
    def _join(base: str, name: str) -> str:
        return f"{base.rstrip('/')}/{name}" if base != "/" else f"/{name}"
