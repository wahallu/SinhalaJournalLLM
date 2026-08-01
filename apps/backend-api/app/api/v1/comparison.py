from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, List

from app.core.deps import require_admin
from app.core.model_gateway import ModelGatewayError
from app.schemas.auth import AuthUser
from app.models.sinllama_loader import (
    SinLlamaUnavailable,
    sinllama_get_comparison_adapters,
    sinllama_run_comparison,
)

router = APIRouter(prefix="/comparison", tags=["Model Comparison"])

# Research tooling. Admin-only since Phase 4 — these calls reach the GPU box
# directly and have no per-user quota of their own.


class CompareRequestSchema(BaseModel):
    input_text: str
    adapters: List[str]
    task: str = "grammar"
    style: Optional[str] = None
    reference_text: Optional[str] = None


@router.get("/adapters")
async def get_comparison_adapters(_admin: AuthUser = Depends(require_admin)):
    """Get list of dynamically available adapters for comparison from the model server."""
    try:
        return await sinllama_get_comparison_adapters()
    except SinLlamaUnavailable as exc:
        raise ModelGatewayError(str(exc)) from exc


@router.post("/compare")
async def run_model_comparison(
    payload: CompareRequestSchema,
    _admin: AuthUser = Depends(require_admin),
):
    """Run comparative evaluation on selected adapters."""
    try:
        # Create robust version-agnostic dictionary
        data = {
            "input_text": payload.input_text,
            "adapters": payload.adapters,
            "task": payload.task,
            "style": payload.style,
            "reference_text": payload.reference_text,
        }
        return await sinllama_run_comparison(data)
    except SinLlamaUnavailable as exc:
        raise ModelGatewayError(str(exc)) from exc
