"""VASP calculation parameter schemas."""
from pydantic import BaseModel

class IncarParam(BaseModel):
    tag: str
    value: str | int | float | bool | list | None
    type: str  # enum, int, float, bool, str, list

class KpointsData(BaseModel):
    style: str = "M"  # M (Monkhorst-Pack) | G (Gamma) | L (Line-mode)
    grid: list[int] = [1, 1, 1]
    shift: list[float] = [0.0, 0.0, 0.0]

class CalcPreset(BaseModel):
    key: str
    category: str
    name: str
    description: str = ""
    incar_params: dict = {}
    kpoints_params: dict = {}
