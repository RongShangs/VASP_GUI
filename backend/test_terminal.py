"""Standalone test: verify SSH shell process can send/receive data.
Usage: cd backend && python test_terminal.py
"""
import asyncio
import sys
sys.path.insert(0, '.')

async def test():
    from app.services.ssh_manager import ssh_manager
    from app.database import init_db, SessionLocal
    from app.models.server import ServerNode
    from app.services.crypto_utils import decrypt_password
    from app.config import config_loader

    print("=== Terminal Diagnostic Test ===\n")

    # 1. Load config and database
    cfg = config_loader.load()
    init_db()

    # Check servers in database (web UI stores them here)
    db = SessionLocal()
    try:
        db_servers = db.query(ServerNode).all()
        print(f"Database: {len(db_servers)} server(s)")
        for s in db_servers:
            print(f"  - {s.alias} ({s.username}@{s.host}:{s.port})")
    finally:
        db.close()

    if not db_servers:
        print("ERROR: No servers in database! Add a server through the web UI first.")
        return

    server = db_servers[0]
    alias = server.alias

    # Decrypt password
    password = None
    if server.encrypted_password:
        try:
            password = decrypt_password(server.encrypted_password)
        except Exception as e:
            print(f"Warning: Could not decrypt password: {e}")
            password = None
    print(f"\nTesting: {alias} ({server.username}@{server.host}:{server.port})")

    # 2. Connect SSH
    print("\n[1] Connecting SSH...")
    try:
        await ssh_manager.connect(
            alias, server.host, server.port,
            server.username, password, server.key_file_path
        )
        print("    ✓ SSH connected")
    except Exception as e:
        print(f"    ✗ SSH failed: {e}")
        return

    # 3. Test simple command
    print("\n[2] Testing simple command execution...")
    try:
        exit_code, stdout, stderr = await ssh_manager.execute(alias, "echo hello && whoami && pwd", timeout=10)
        print(f"    exit={exit_code}")
        print(f"    stdout: {stdout}")
        print(f"    stderr: {stderr}")
    except Exception as e:
        print(f"    ✗ Command failed: {e}")
        return

    # 4. Test shell process
    print("\n[3] Starting interactive shell (bash -l)...")
    try:
        conn = ssh_manager.get_connection(alias)
        process = await conn.conn.create_process('bash -l', term_type='xterm-256color')
        print(f"    ✓ Process created")

        # Read initial output for 3 seconds
        async def read_output():
            buf = ''
            try:
                while True:
                    data = await asyncio.wait_for(process.stdout.read(4096), timeout=1.0)
                    if not data:
                        break
                    # data may be str or bytes depending on asyncssh version
                    buf += data if isinstance(data, str) else data.decode('utf-8', errors='replace')
            except asyncio.TimeoutError:
                pass
            return buf

        initial = await read_output()
        print(f"    Initial output ({len(initial)} bytes):")
        print(f"    --- BEGIN ---")
        print(initial[:500])
        print(f"    --- END ---")

        # 5. Send a command — asyncssh stdin.write() expects str, NOT bytes
        print("\n[4] Sending 'ls' command...")
        w = process.stdin.write('ls\r')
        if w is not None and hasattr(w, '__await__'):
            print("    (awaiting write...)")
            await w
            print("    ✓ write completed (was awaitable)")
        else:
            print(f"    write() returned: {type(w).__name__}")

        # Wait for response
        await asyncio.sleep(1)
        response = await read_output()
        print(f"    Response ({len(response)} bytes):")
        print(f"    --- BEGIN ---")
        print(response[:500])
        print(f"    --- END ---")

        # 6. Clean up
        process.stdin.close()
        process.close()
        print("\n[5] Test complete ✓")

    except Exception as e:
        print(f"    ✗ Shell test failed: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return

    # Disconnect
    await ssh_manager.disconnect(alias)
    print("Disconnected.")

if __name__ == '__main__':
    asyncio.run(test())
