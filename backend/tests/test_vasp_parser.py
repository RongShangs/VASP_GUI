"""Tests for VASP file parsers."""
import pytest
from app.services.vasp_parser import (
    INCARParser, KPOINTSParser, POSCARParser, OSZICARParser,
    DOSCARParser, EIGENVALParser, OUTCARParser,
)


class TestINCARParser:
    def test_parse_basic(self):
        content = "ENCUT = 400\nISIF = 2\nLWAVE = .TRUE.\nPREC = Normal\n"
        params = INCARParser.parse(content)
        assert params["ENCUT"] == 400
        assert params["ISIF"] == 2
        assert params["LWAVE"] is True
        assert params["PREC"] == "Normal"

    def test_parse_float_list(self):
        content = "KPOINTS = 4 4 4\nMAGMOM = 2.0*1\n"
        params = INCARParser.parse(content)
        assert params["KPOINTS"] == [4.0, 4.0, 4.0]

    def test_to_string(self):
        params = {"ENCUT": 400, "LWAVE": False, "SYSTEM": "test"}
        result = INCARParser.to_string(params)
        assert "ENCUT = 400" in result
        assert "LWAVE = .FALSE." in result


class TestKPOINTSParser:
    def test_parse_monkhorst(self):
        content = "Auto\n0\nM\n4 4 4\n0 0 0\n"
        data = KPOINTSParser.parse(content)
        assert data["grid"] == [4, 4, 4]
        assert data["style"] == "M"

    def test_to_string(self):
        result = KPOINTSParser.to_string({"style": "G", "grid": [2, 2, 2], "shift": [0, 0, 0]})
        assert "2 2 2" in result


class TestPOSCARParser:
    def test_parse(self):
        content = """Si
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
        data = POSCARParser.parse(content)
        assert data["comment"] == "Si"
        assert data["elements"] == ["Si"]
        assert data["counts"] == [2]
        assert len(data["coords"]) == 2
        assert data["coord_type"] == "Direct"


class TestOSZICARParser:
    def test_parse(self):
        content = """      1 T=   300.0 E=  -123.45678 F=  -123.45700 E0=  -123.45690
      2 T=   300.0 E=  -123.46789 F=  -123.46800 E0=  -123.46795
"""
        steps = OSZICARParser.parse(content)
        assert len(steps) == 2
        assert abs(steps[0]["energy"] + 123.45678) < 0.001
        assert steps[0]["step"] == 1

    def test_ionic_boundaries(self):
        content = """      1 T=   300.0 E=  -1.0 F=  -1.0
------ ion step   2 ------
      1 T=   300.0 E=  -2.0 F=  -2.0
"""
        boundaries = OSZICARParser.find_ionic_boundaries(content)
        assert len(boundaries) == 1
        assert boundaries[0]["ion_step"] == 2


class TestDOSCARParser:
    def test_parse(self):
        # DOSCAR: NEDOS=3, E_Fermi=5.0, NIONS=1
        content = """  3  0.0   5.0   0.0   1   0   0
h2
h3
h4
 -5.0  0.5  0.3  10.0  8.0
  0.0  1.0  0.8  12.0  9.0
  5.0  0.2  0.1   3.0  2.0
"""
        data = DOSCARParser.parse(content)
        assert data["nedos"] == 3
        assert abs(data["e_fermi"] - 5.0) < 0.01
        assert data["nions"] == 1
        assert len(data["tdos"]) == 3


class TestEIGENVALParser:
    def test_parse(self):
        # EIGENVAL: 6 header lines (0-5), then kpoint blocks
        content = """line1
line2
line3
line4
line5
  8  2  2
 0.0 0.0 0.0 1.0
 1  -1.0  1.0
 2   2.0  0.0
 0.5 0.0 0.0 1.0
 1  -0.5  1.0
 2   2.5  0.0
"""
        data = EIGENVALParser.parse(content)
        assert data["n_kpoints"] == 2
        assert data["n_bands"] == 2
        assert len(data["kpoints"]) == 2
        assert len(data["bands"]) == 2
        assert len(data["bands"][0]) == 2


class TestOUTCARParser:
    def test_extract_energy(self):
        content = """FREE ENERGIE OF THE ION-ELECTRON SYSTEM (eV)
---------------------------------------------------
  free  energy   TOTEN  =       -123.45678 eV
  energy  without entropy =       -123.45600
  energy(sigma->0) =       -123.45555
"""
        energy = OUTCARParser.extract_final_energy(content)
        assert energy is not None
        # Energy extracted should be close to the TOTEN/sigma→0 value
        assert abs(energy + 123.456) < 0.01

    def test_convergence(self):
        content = "reached required accuracy - stopping structural energy minimisation"
        meta = OUTCARParser.parse_metadata(content)
        assert meta["converged"] is True
