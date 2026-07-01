"""
Headline Generator API endpoints.
"""

from fastapi import APIRouter

from app.schemas.headline import HeadlineRequest, HeadlineResponse
from app.services.headline.headline_service import generate_headline

router = APIRouter(prefix="/headlines", tags=["Headline"])


@router.post("/generate", response_model=HeadlineResponse)
async def generate_headlines_endpoint(payload: HeadlineRequest):
    """
    Generate multiple headline variants from the input Sinhala text.
    """
    headlines = generate_headline(payload.text, payload.count)
    return HeadlineResponse(headlines=headlines)
