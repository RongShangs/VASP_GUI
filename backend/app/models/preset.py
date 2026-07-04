"""Preset model for VASP calculation templates."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from app.database import Base

class Preset(Base):
    __tablename__ = "presets"
    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    category = Column(String(50), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(String(500), nullable=True)
    incar_params = Column(Text, nullable=True)  # JSON string
    kpoints_params = Column(Text, nullable=True)  # JSON string
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
