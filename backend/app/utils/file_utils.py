"""File utility functions."""
import re

BINARY_EXTENSIONS = {".WAVECAR", ".CHGCAR", ".CHG", ".ELFCAR", ".PARCHG",
                     ".LOCPOT", ".AECCAR0", ".AECCAR1", ".AECCAR2",
                     ".wav", ".bin", ".dat", ".tar", ".gz", ".zip", ".7z"}
LARGE_FILE_THRESHOLD_MB = 50

def is_likely_binary(filename: str, size_bytes: int = 0) -> bool:
    ext = "." + filename.split(".")[-1] if "." in filename else ""
    if ext.upper() in BINARY_EXTENSIONS:
        return True
    if size_bytes > LARGE_FILE_THRESHOLD_MB * 1024 * 1024:
        return True
    return False

def get_vasp_file_type(filename: str) -> str:
    mapping = {
        "INCAR": "incar", "KPOINTS": "kpoints", "POSCAR": "poscar",
        "POTCAR": "potcar", "OUTCAR": "outcar", "OSZICAR": "oszicar",
        "vasprun.xml": "vasprun", "WAVECAR": "binary", "CHGCAR": "binary",
        "CONTCAR": "poscar",
    }
    return mapping.get(filename, "text")
