"""Authentication API routes."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from app.database import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, RefreshRequest
from app.services.auth_service import hash_password, verify_password, create_access_token, decode_access_token, require_user, get_current_user

router = APIRouter()


class ChangePasswordRequest(BaseModel):
    current_password: str = ""
    new_password: str = Field(..., min_length=1)


class ChangeUsernameRequest(BaseModel):
    new_username: str = Field(..., min_length=1, max_length=100)


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    from app.config import get_config
    cfg = get_config()

    user = db.query(User).filter(User.username == req.username).first()

    # Auto-create admin user if not in DB yet (race condition safety)
    if not user and req.username == cfg.admin.username:
        pwd = (cfg.admin.password or "").strip()
        user = User(
            username=cfg.admin.username,
            password_hash=hash_password(pwd),
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not verify_password(req.password, user.password_hash):
        # Allow login with empty password if admin has not set one
        if cfg.admin.password and cfg.admin.password.strip():
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    access_token = create_access_token(data={"sub": user.username})
    return TokenResponse(access_token=access_token)


@router.post("/register", response_model=dict)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == req.username).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")
    user = User(username=req.username, password_hash=hash_password(req.password), email=req.email)
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "username": user.username}


@router.put("/change-password")
def change_password(
    req: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    """Change password for the currently logged-in user."""
    from app.config import get_config
    cfg = get_config()

    # If admin has set a config password, verify current password
    if cfg.admin.password and cfg.admin.password.strip():
        if not verify_password(req.current_password, current_user.password_hash):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

    # Update password in database
    current_user.password_hash = hash_password(req.new_password)
    db.commit()

    # Also update config.yaml for admin user
    if current_user.username == cfg.admin.username:
        cfg.admin.password = req.new_password
        from app.config import config_loader
        config_loader.save(cfg)

    return {"ok": True, "message": "Password changed successfully"}


@router.put("/change-username")
def change_username(
    req: ChangeUsernameRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    """Change username for the currently logged-in user."""
    # Check if new username already exists
    existing = db.query(User).filter(User.username == req.new_username).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")

    from app.config import get_config
    cfg = get_config()

    old_username = current_user.username
    current_user.username = req.new_username
    db.commit()

    # Also update config.yaml for admin user
    if old_username == cfg.admin.username:
        cfg.admin.username = req.new_username
        from app.config import config_loader
        config_loader.save(cfg)

    return {"ok": True, "username": req.new_username}


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(req: RefreshRequest):
    payload = decode_access_token(req.refresh_token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    username = payload.get("sub")
    access_token = create_access_token(data={"sub": username})
    return TokenResponse(access_token=access_token)


@router.get("/require-password")
def require_password():
    """Check if admin has set a password. If not, login is not required."""
    from app.config import get_config
    cfg = get_config()
    return {"require_password": bool(cfg.admin.password and cfg.admin.password.strip())}


@router.get("/me")
def get_me(user: User = Depends(require_user)):
    return {"id": user.id, "username": user.username, "email": user.email}
