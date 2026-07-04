"""Job schemas."""
from pydantic import BaseModel
from datetime import datetime

class JobSubmitRequest(BaseModel):
    server_alias: str
    project_path: str
    calc_type: str
    vasp_command: str = "vasp_std"
    np: int = 4
    incar_params: dict | None = None
    kpoints_params: dict | None = None

class JobSubmitResponse(BaseModel):
    job_id: str
    status: str = "submitted"

class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    remote_pid: int | None = None
    calc_type: str = ""
    project_path: str = ""
    submitted_at: datetime | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    exit_code: int | None = None
    energy_final: float | None = None
    error_message: str | None = None

class EnergyStep(BaseModel):
    step: int
    energy: float
    free_energy: float | None = None
    temperature: float | None = None
    delta_e: float | None = None
    step_type: str = "electronic"  # electronic | ionic
