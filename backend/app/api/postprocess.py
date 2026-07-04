"""Post-processing API routes — parse VASP output files for visualization.

Reads VASP output files (DOSCAR, EIGENVAL, OSZICAR, OUTCAR) from remote server
via SFTP, parses them, and returns structured JSON data for ECharts rendering.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.services.auth_service import require_user
from app.services.ssh_manager import ssh_manager
from app.services.sftp_manager import SFTPManager
from app.services.vasp_parser import (
    DOSCARParser, EIGENVALParser, OSZICARParser, OUTCARParser,
)
from app.models.user import User

router = APIRouter()
sftp = SFTPManager(ssh_manager)


class PostProcessRequest(BaseModel):
    server_alias: str
    project_path: str


# ── DOS ──────────────────────────────────────────────────────────

@router.post("/dos")
async def generate_dos(req: PostProcessRequest, user: User = Depends(require_user)):
    """Parse DOSCAR and return TDOS + PDOS data for ECharts."""
    try:
        file_path = f"{req.project_path.rstrip('/')}/DOSCAR"
        content, _ = await sftp.read_file(req.server_alias, file_path, max_size_mb=100)
        data = DOSCARParser.parse(content)
        return {"status": "ok", "data": data}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="DOSCAR not found in project directory")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DOS parse error: {str(e)}")


# ── Band Structure ───────────────────────────────────────────────

@router.post("/band")
async def generate_band(req: PostProcessRequest, user: User = Depends(require_user)):
    """Parse EIGENVAL and return band structure data for ECharts.

    Also tries to read OUTCAR for Fermi level and KPOINTS for k-path labels.
    """
    try:
        base = req.project_path.rstrip('/')
        # Read EIGENVAL
        content, _ = await sftp.read_file(req.server_alias, f"{base}/EIGENVAL", max_size_mb=100)
        data = EIGENVALParser.parse(content)

        # Try to get more accurate Fermi level from OUTCAR
        try:
            outcar_content, _ = await sftp.read_file(
                req.server_alias, f"{base}/OUTCAR", max_size_mb=100
            )
            # VASP reports E-fermi in OUTCAR
            import re
            m = re.search(r'E-fermi\s*:\s*([\d.\-E+]+)', outcar_content)
            if m:
                data["e_fermi"] = float(m.group(1))
        except Exception:
            pass  # Use estimated Fermi level from EIGENVAL

        # Try to extract k-path labels from KPOINTS (line-mode)
        try:
            kp_content, _ = await sftp.read_file(
                req.server_alias, f"{base}/KPOINTS", max_size_mb=10
            )
            kp_lines = [l.split("#")[0].strip() for l in kp_content.split("\n")]
            # Check if line-mode (4th line starts with L/l or contains reciprocal)
            if len(kp_lines) >= 4:
                style = kp_lines[2].strip().lower() if len(kp_lines) > 2 else ""
                if style.startswith("l"):
                    # Line-mode: extract high-symmetry point labels
                    labels = []
                    for line in kp_lines[3:]:
                        if not line:
                            break
                        parts = line.split()
                        if len(parts) >= 4:
                            labels.append(parts[3] if len(parts) > 3 else "")
                        else:
                            labels.append("")
                    data["kpath_labels"] = labels
        except Exception:
            pass

        if "kpath_labels" not in data:
            data["kpath_labels"] = []

        return {"status": "ok", "data": data}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Band parse error: {str(e)}")


# ── Energy Convergence ───────────────────────────────────────────

@router.post("/energy")
async def generate_energy(req: PostProcessRequest, user: User = Depends(require_user)):
    """Parse OSZICAR and return energy convergence data with ionic step markers."""
    try:
        file_path = f"{req.project_path.rstrip('/')}/OSZICAR"
        content, _ = await sftp.read_file(req.server_alias, file_path, max_size_mb=50)
        steps = OSZICARParser.parse(content)
        boundaries = OSZICARParser.find_ionic_boundaries(content)

        # Also read INCAR for NSW to determine total ionic steps
        nsw = None
        try:
            incar_content, _ = await sftp.read_file(
                req.server_alias, f"{req.project_path.rstrip('/')}/INCAR", max_size_mb=5
            )
            from app.services.vasp_parser import INCARParser
            incar = INCARParser.parse(incar_content)
            nsw = incar.get("NSW", None)
        except Exception:
            pass

        return {
            "status": "ok",
            "data": {
                "steps": steps,
                "ionic_boundaries": boundaries,
                "total_ionic_steps": len(boundaries),
                "nsw": nsw,
            },
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Energy parse error: {str(e)}")


# ── Optical Properties ───────────────────────────────────────────

@router.post("/optical")
async def generate_optical(req: PostProcessRequest, user: User = Depends(require_user)):
    """Parse OUTCAR for dielectric/optical data.

    Reads the dielectric tensor from OUTCAR if LEPSILON=True was used.
    For full optical spectra, vasprun.xml parsing with pymatgen is recommended.
    """
    try:
        file_path = f"{req.project_path.rstrip('/')}/OUTCAR"
        content, _ = await sftp.read_file(req.server_alias, file_path, max_size_mb=100)

        # Extract dielectric tensor
        dielectric = OUTCARParser.extract_dielectric(content)

        # Try to read vasprun.xml for frequency-dependent dielectric data
        freq_data = None
        try:
            import xml.etree.ElementTree as ET
            vasprun_path = f"{req.project_path.rstrip('/')}/vasprun.xml"
            xml_content, _ = await sftp.read_file(
                req.server_alias, vasprun_path, max_size_mb=200
            )
            root = ET.fromstring(xml_content)
            # Look for dielectric function in vasprun.xml
            ns = {"v": "http://www.xmlns.org/2001/XMLSchema-instance"}
            dielec_blocks = root.findall(".//dielectricfunction")
            if dielec_blocks:
                energies = []
                eps_real = []
                eps_imag = []
                for df in dielec_blocks:
                    for child in df:
                        tag = child.tag.lower()
                        if "energy" in tag:
                            energies.append(float(child.text or 0))
                        elif "real" in tag or "eps" in tag:
                            parts = (child.text or "").split()
                            if parts:
                                eps_real.append(float(parts[0]))
                        elif "imag" in tag:
                            parts = (child.text or "").split()
                            if parts:
                                eps_imag.append(float(parts[0]))
                if energies and eps_real:
                    freq_data = {
                        "energies": energies[:len(eps_real)],
                        "eps_real_avg": eps_real,
                        "eps_imag_avg": eps_imag if eps_imag else [0]*len(eps_real),
                    }
        except Exception:
            pass  # vasprun.xml parsing is best-effort

        return {
            "status": "ok",
            "data": {
                "dielectric_tensor": dielectric,
                "frequency_dependent": freq_data,
            },
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Optical parse error: {str(e)}")


# ── Export ────────────────────────────────────────────────────────

@router.post("/export")
async def export_data(req: dict, user: User = Depends(require_user)):
    """Export chart data in CSV or JSON format.

    Body: { server_alias, project_path, format: "csv"|"json", type: "dos"|"band"|"energy" }
    """
    export_format = req.get("format", "csv")
    export_type = req.get("type", "energy")
    server_alias = req.get("server_alias", "")
    project_path = req.get("project_path", "")

    try:
        base = project_path.rstrip('/')

        if export_type == "energy":
            content, _ = await sftp.read_file(server_alias, f"{base}/OSZICAR", max_size_mb=50)
            data = OSZICARParser.parse(content)
        elif export_type == "dos":
            content, _ = await sftp.read_file(server_alias, f"{base}/DOSCAR", max_size_mb=100)
            data = DOSCARParser.parse(content)
        elif export_type == "band":
            content, _ = await sftp.read_file(server_alias, f"{base}/EIGENVAL", max_size_mb=100)
            data = EIGENVALParser.parse(content)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown export type: {export_type}")

        if export_format == "json":
            return {"status": "ok", "format": "json", "data": data}

        # CSV export
        import io
        csv_buffer = io.StringIO()
        if export_type == "energy":
            csv_buffer.write("step,energy,free_energy,temperature,delta_e,ionic_step,step_type\n")
            for s in data:
                csv_buffer.write(
                    f"{s.get('step','')},{s.get('energy','')},{s.get('free_energy','')},"
                    f"{s.get('temperature','')},{s.get('delta_e','')},"
                    f"{s.get('ionic_step','')},{s.get('step_type','')}\n"
                )
        elif export_type == "dos":
            csv_buffer.write("energy,dos_up,dos_down,idos_up,idos_down\n")
            for d in data.get("tdos", []):
                csv_buffer.write(
                    f"{d.get('energy','')},{d.get('dos_up','')},{d.get('dos_down','')},"
                    f"{d.get('idos_up','')},{d.get('idos_down','')}\n"
                )
        elif export_type == "band":
            csv_buffer.write("band_idx,kpoint_idx,energy,occupancy\n")
            for ib, band in enumerate(data.get("bands", [])):
                for ik, e in enumerate(band):
                    occ = data["occupancies"][ib][ik] if ib < len(data.get("occupancies", [])) and ik < len(data["occupancies"][ib]) else 0
                    csv_buffer.write(f"{ib},{ik},{e},{occ}\n")

        return {"status": "ok", "format": "csv", "data": csv_buffer.getvalue()}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export error: {str(e)}")
