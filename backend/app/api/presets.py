"""Preset/template API routes."""
from fastapi import APIRouter, Depends, Query
from app.services.template_manager import TemplateManager

router = APIRouter()

@router.get("")
def list_presets(category: str | None = Query(None), search: str | None = Query(None)):
    if search:
        return TemplateManager.search_templates(search)
    if category:
        return TemplateManager.get_templates_by_category(category)
    return TemplateManager.get_all_templates()

@router.get("/categories")
def list_categories():
    return TemplateManager.get_categories()

@router.get("/{key}")
def get_preset(key: str):
    tmpl = TemplateManager.get_template(key)
    if not tmpl:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Preset not found")
    return tmpl
