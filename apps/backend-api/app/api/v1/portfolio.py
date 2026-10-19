"""Public portfolio endpoints: documents, team contact links and the contact form."""

import time
from collections import defaultdict, deque

from fastapi import APIRouter, HTTPException, Request, status

from app.core.config import get_settings
from app.core.email import EmailDeliveryError, send_contact_email
from app.core.rate_limit import client_ip, hash_ip
from app.repositories import portfolio_document_repository, team_contact_repository
from app.schemas.contact import ContactMessage
from app.schemas.portfolio_document import PortfolioDocument
from app.schemas.team_contact import TeamContact

router = APIRouter(prefix="/portfolio", tags=["Portfolio"])

_CONTACT_WINDOW_SECONDS = 3600
# Per-process and in memory: enough to stop one visitor flooding the inbox.
# It resets on restart and is not shared across instances, which is fine
# for a contact form on a single Render service.
_contact_sends: dict[str, deque[float]] = defaultdict(deque)


@router.get("/documents", response_model=list[PortfolioDocument])
async def list_documents() -> list[PortfolioDocument]:
    rows = await portfolio_document_repository.list_public()
    return [PortfolioDocument(**row) for row in rows]


@router.get("/team-contacts", response_model=list[TeamContact])
async def list_team_contacts() -> list[TeamContact]:
    rows = await team_contact_repository.list_all()
    return [TeamContact(**row) for row in rows]


def _check_contact_limit(request: Request) -> None:
    now = time.monotonic()
    sends = _contact_sends[hash_ip(client_ip(request))]
    while sends and now - sends[0] > _CONTACT_WINDOW_SECONDS:
        sends.popleft()
    if len(sends) >= get_settings().CONTACT_MESSAGES_PER_HOUR:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many messages from this connection. Please try again later.",
        )
    sends.append(now)


@router.post("/contact", status_code=status.HTTP_202_ACCEPTED)
async def send_contact(payload: ContactMessage, request: Request) -> dict[str, bool]:
    # A filled honeypot is a bot. Answer as if it worked so it learns nothing.
    if payload.website:
        return {"ok": True}

    _check_contact_limit(request)
    try:
        await send_contact_email(payload.name, str(payload.email), payload.message)
    except EmailDeliveryError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Your message could not be sent right now. Please email us directly.",
        )
    return {"ok": True}
