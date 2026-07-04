"""Pytest configuration and fixtures."""
import pytest
import sys
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


@pytest.fixture
def sample_incar():
    return """SYSTEM = Test
ENCUT = 400
ISIF = 2
NSW = 60
LWAVE = .TRUE.
PREC = Normal
"""


@pytest.fixture
def sample_poscar():
    return """Si diamond
1.0
 5.43 0.00 0.00
 0.00 5.43 0.00
 0.00 0.00 5.43
Si
2
Direct
 0.00 0.00 0.00
 0.25 0.25 0.25
"""
