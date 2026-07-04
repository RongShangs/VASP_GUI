"""JobRecord model."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from app.database import Base

class JobRecord(Base):
    __tablename__ = "jobs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(String(64), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    server_id = Column(Integer, ForeignKey("servers.id"), nullable=True)
    server_alias = Column(String(100), nullable=True)
    project_name = Column(String(255), nullable=False)
    project_path = Column(String(500), nullable=True)
    calc_type = Column(String(100), nullable=False)
    status = Column(String(50), default="submitted")
    remote_pid = Column(Integer, nullable=True)
    vasp_command = Column(String(100), default="vasp_std")
    np = Column(Integer, default=4)
    submitted_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    exit_code = Column(Integer, nullable=True)
    energy_final = Column(Float, nullable=True)
    error_message = Column(String(2000), nullable=True)
