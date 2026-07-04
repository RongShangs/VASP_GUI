"""VASP GUI Web - FastAPI Application Entry Point."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager

from app.config import config_loader, get_config
from app.database import init_db
from app.utils.logger import setup_logging
from app.api import api_router
from app.ws.console import router as console_ws_router
from app.ws.chart import router as chart_ws_router
from app.ws.status import router as status_ws_router
from app.ws.progress import router as progress_ws_router
from app.ws.manager import ws_manager as terminal_manager

# Path to frontend build output
FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    cfg = config_loader.config
    setup_logging(level=cfg.logging.level, log_file=cfg.logging.file)
    init_db()
    print(f"VASP GUI Web v2.0.0 starting on http://{cfg.web.host}:{cfg.web.port}")
    print(f"Admin user: {cfg.admin.username}")
    yield
    # Shutdown
    from app.services.ssh_manager import ssh_manager
    await ssh_manager.disconnect_all()


app = FastAPI(
    title="VASP GUI Web",
    description="VASP科学计算可视化Web平台",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — permissive in dev, restrict in production
cfg = get_config()
cors_origins = getattr(cfg, 'cors_origins', None) or ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins if isinstance(cors_origins, list) else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# REST API routes
app.include_router(api_router)

# WebSocket routes
app.include_router(console_ws_router, prefix="/ws/console")
app.include_router(chart_ws_router, prefix="/ws/chart")
app.include_router(status_ws_router, prefix="/ws/status")
app.include_router(progress_ws_router, prefix="/ws/progress")

# Terminal WebSocket (bidirectional, handled by manager)
from fastapi import WebSocket, WebSocketDisconnect

@app.websocket("/ws/terminal/{alias}")
async def terminal_ws(websocket: WebSocket, alias: str):
    await terminal_manager.connect_terminal(alias, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            print(f"[WS-IN] {alias}: received {len(data)} bytes: {repr(data[:200])}", flush=True)
            await terminal_manager.handle_terminal_input(alias, data)
    except WebSocketDisconnect:
        print(f"[WS-IN] {alias}: WebSocket disconnected", flush=True)
        await terminal_manager.disconnect_terminal(alias)


# ---- Serve frontend static files (single-port deployment) ----
if FRONTEND_DIST.exists() and (FRONTEND_DIST / "index.html").exists():
    # Mount static assets at /assets
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve React SPA - all non-API routes return index.html."""
        file_path = FRONTEND_DIST / full_path
        if full_path and file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(FRONTEND_DIST / "index.html"))

    @app.get("/")
    async def serve_root():
        return FileResponse(str(FRONTEND_DIST / "index.html"))
else:
    @app.get("/")
    def root():
        return {
            "service": "VASP GUI Web",
            "version": "2.0.0",
            "status": "running (frontend not built)",
            "hint": "Run: cd frontend && npm run build"
        }


if __name__ == "__main__":
    import uvicorn
    uc = get_config()
    uvicorn.run("main:app", host=uc.web.host, port=uc.web.port, reload=True)
