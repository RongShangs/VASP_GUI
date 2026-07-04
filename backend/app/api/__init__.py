"""API Router aggregation."""
from fastapi import APIRouter
from app.api import auth, servers, files, jobs, config, presets, status, postprocess, vasp

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(servers.router, prefix="/servers", tags=["servers"])
api_router.include_router(files.router, prefix="/files", tags=["files"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
api_router.include_router(config.router, prefix="/config", tags=["config"])
api_router.include_router(presets.router, prefix="/presets", tags=["presets"])
api_router.include_router(status.router, prefix="/status", tags=["status"])
api_router.include_router(postprocess.router, prefix="/postprocess", tags=["postprocess"])
api_router.include_router(vasp.router, prefix="/vasp", tags=["vasp"])
