"""Logging configuration."""
import logging
import sys
from pathlib import Path

def setup_logging(level: str = "INFO", log_file: str = "vasp_gui.log"):
    fmt = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S")
    root = logging.getLogger()
    root.setLevel(getattr(logging, level.upper(), logging.INFO))
    # Console handler
    ch = logging.StreamHandler(sys.stdout)
    ch.setFormatter(fmt)
    root.addHandler(ch)
    # File handler
    log_path = Path(__file__).resolve().parent.parent.parent / log_file
    fh = logging.FileHandler(log_path, encoding="utf-8")
    fh.setFormatter(fmt)
    root.addHandler(fh)
    return root
