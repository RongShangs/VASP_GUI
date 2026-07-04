"""Parameter validators for VASP inputs."""
import re
from typing import Any

def validate_int(value: Any, min_val: int | None = None, max_val: int | None = None) -> int | None:
    try:
        v = int(value)
        if min_val is not None and v < min_val:
            return None
        if max_val is not None and v > max_val:
            return None
        return v
    except (ValueError, TypeError):
        return None

def validate_float(value: Any, min_val: float | None = None, max_val: float | None = None) -> float | None:
    try:
        v = float(value)
        if min_val is not None and v < min_val:
            return None
        if max_val is not None and v > max_val:
            return None
        return v
    except (ValueError, TypeError):
        return None

def validate_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.upper() in (".TRUE.", "T", "TRUE", "YES", "1")
    return bool(value)

def validate_enum(value: Any, options: list) -> Any:
    if value in options:
        return value
    return None
