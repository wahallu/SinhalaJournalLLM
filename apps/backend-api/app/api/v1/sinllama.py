"""
SinLLaMA Playground endpoints.

POST /chat   — raw base-model generation (no task adapter, no persistence)
GET  /health — is the inference server reachable right now

Proxies straight to the inference server's "base" task so the playground
exercises the merged model with every LoRA adapter disabled. The server's
address (SINLLAMA_API_URL) is read from settings here and never returned
to the caller — clients only ever see this backend's own base URL.
"""

from fastapi import APIRouter

from app.core.model_gateway import ModelGatewayError
from app.models.sinllama_loader import SinLlamaUnavailable, sinllama_generate, sinllama_health
from app.schemas.sinllama import PlaygroundRequest, PlaygroundResponse

router = APIRouter(prefix="/sinllama", tags=["SinLLaMA Playground"])


@router.post("/chat", response_model=PlaygroundResponse)
async def playground_chat(payload: PlaygroundRequest):
    """Send a prompt straight to the base model — grammar/headline/style/summarizer adapters are not used."""
    try:
        data = await sinllama_generate(payload.prompt, "base")
    except SinLlamaUnavailable as exc:
        raise ModelGatewayError(str(exc)) from exc
    return PlaygroundResponse(
        response=data["response"],
        input_tokens=data.get("input_tokens"),
        output_tokens=data.get("output_tokens"),
        max_cap_used=data.get("max_cap_used"),
    )


@router.get("/health")
async def playground_health():
    """Whether the inference server is reachable — never exposes its address."""
    return {"available": await sinllama_health()}
