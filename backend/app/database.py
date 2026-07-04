"""SQLAlchemy engine and session configuration."""
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from typing import Generator

DB_DIR = Path(__file__).resolve().parent.parent / "data"
DB_DIR.mkdir(parents=True, exist_ok=True)
DATABASE_URL = f"sqlite:///{DB_DIR / 'vasp_gui.db'}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False}, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db() -> None:
    """Create all tables and seed admin user."""
    from app.models import user, server, job, preset  # noqa: F401
    Base.metadata.create_all(bind=engine)
    seed_admin_user()

def seed_admin_user() -> None:
    """Create admin user from config.yaml if not in DB.

    Password sync strategy:
    - If admin user doesn't exist in DB, create it with config.yaml password
    - If admin user exists, ONLY update if config.yaml password is non-empty
      and different from current DB password. This avoids churning the hash
      every startup (hash_password uses random salt).
    """
    from app.config import get_config
    from app.services.auth_service import hash_password, verify_password
    cfg = get_config()
    db = SessionLocal()
    try:
        from app.models.user import User
        existing = db.query(User).filter(User.username == cfg.admin.username).first()
        pwd = (cfg.admin.password or "").strip()
        if existing is None:
            admin = User(
                username=cfg.admin.username,
                password_hash=hash_password(pwd),
                is_active=True,
            )
            db.add(admin)
            db.commit()
            print(f'  [DB] Created admin user: {cfg.admin.username} (password: {"set" if pwd else "not set"})')
        elif pwd and not verify_password(pwd, existing.password_hash):
            # Only update when config has a non-empty password that differs from DB
            existing.password_hash = hash_password(pwd)
            db.commit()
            print(f'  [DB] Updated admin password from config.yaml')
    finally:
        db.close()
