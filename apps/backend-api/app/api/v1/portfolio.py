"""Public, read-only portfolio endpoints."""

from fastapi import APIRouter

from app.repositories import portfolio_document_repository
from app.schemas.portfolio_document import PortfolioDocument

router = APIRouter(prefix="/portfolio", tags=["Portfolio"])


@router.get("/documents", response_model=list[PortfolioDocument])
async def list_documents() -> list[PortfolioDocument]:
    rows = await portfolio_document_repository.list_public()
    return [PortfolioDocument(**row) for row in rows]
