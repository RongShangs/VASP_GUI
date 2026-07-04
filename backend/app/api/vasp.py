"""VASP file parsing and tag metadata API routes."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.services.auth_service import require_user
from app.services.vasp_parser import INCARParser, KPOINTSParser, POSCARParser, OSZICARParser
from app.services.vasp_tags import INCAR_TAG_REGISTRY, TagMeta
from app.models.user import User

router = APIRouter()


class IncarParseRequest(BaseModel):
    content: str


class OszicarParseRequest(BaseModel):
    content: str


@router.get("/tags")
async def get_tag_registry(user: User = Depends(require_user)):
    """Return the full INCAR tag metadata registry (100+ tags) with Chinese descriptions."""
    tags = {}
    for tag, meta in INCAR_TAG_REGISTRY.items():
        tags[tag] = {
            "tag": meta.tag,
            "type": meta.type,
            "default": meta.default,
            "options": meta.options,
            "option_descriptions": meta.option_descriptions,
            "min_val": meta.min_val,
            "max_val": meta.max_val,
            "unit": meta.unit,
            "category": meta.category,
            "description": meta.description,
            "advanced": meta.advanced,
            "dependencies": meta.dependencies,
        }
    # Return categories too
    categories = {}
    for tag, meta in INCAR_TAG_REGISTRY.items():
        cat = meta.category
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(tag)
    return {"tags": tags, "categories": categories}


@router.post("/parse/incar")
async def parse_incar(req: IncarParseRequest, user: User = Depends(require_user)):
    """Parse INCAR content and return structured parameters with tag metadata."""
    try:
        parser = INCARParser()
        params = parser.parse(req.content)
        result = []
        for key, value in params.items():
            meta = INCAR_TAG_REGISTRY.get(key)
            item = {
                "tag": key,
                "value": value,
                "description": meta.description if meta else "",
                "type": meta.type if meta else "str",
                "default": meta.default if meta else None,
                "options": meta.options if meta else None,
                "option_descriptions": meta.option_descriptions if meta else None,
                "min_val": meta.min_val if meta else None,
                "max_val": meta.max_val if meta else None,
                "unit": meta.unit if meta else "",
                "category": meta.category if meta else "未知",
                "advanced": meta.advanced if meta else False,
                "dependencies": meta.dependencies if meta else {},
                "is_changed": value != meta.default if meta else True,
            }
            result.append(item)
        return {"params": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"INCAR parse error: {str(e)}")


@router.post("/parse/poscar")
async def parse_poscar(req: IncarParseRequest, user: User = Depends(require_user)):
    """Parse POSCAR content and return structured structure data."""
    try:
        parser = POSCARParser()
        data = parser.parse(req.content)
        return {
            "comment": data.get("comment", ""),
            "lattice_vectors": data.get("lattice", []),
            "elements": data.get("elements", []),
            "counts": data.get("counts", []),
            "total_atoms": sum(data.get("counts", [])),
            "coordinate_type": data.get("coord_type", "Direct"),
            "coordinates": data.get("coords", []),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"POSCAR parse error: {str(e)}")


@router.post("/parse/kpoints")
async def parse_kpoints(req: IncarParseRequest, user: User = Depends(require_user)):
    """Parse KPOINTS content and return structured k-point settings."""
    try:
        parser = KPOINTSParser()
        data = parser.parse(req.content)
        return {
            "comment": data.get("comment", ""),
            "grid": data.get("grid", [1, 1, 1]),
            "shift": data.get("shift", [0, 0, 0]),
            "style": data.get("style", "G"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"KPOINTS parse error: {str(e)}")


@router.post("/parse/oszicar")
async def parse_oszicar(req: OszicarParseRequest, user: User = Depends(require_user)):
    """Parse OSZICAR content and return energy step data."""
    try:
        parser = OSZICARParser()
        steps = parser.parse(req.content)
        return {"steps": steps}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OSZICAR parse error: {str(e)}")
