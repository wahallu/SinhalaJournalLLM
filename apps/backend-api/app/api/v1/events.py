"""
Research telemetry: which suggestions journalists took.

POST /events/suggestions — batch record shown / accepted / rejected

Separate from the tool endpoints on purpose. These writes are advisory, must
never slow a correction down, and carry no inference cost, so they should not
inherit the tools' rate limiting or feature gating.
"""

import logging

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from app.core.deps import optional_user
from app.core.research import actor_from
from app.repositories.events_repository import MAX_EVENTS, record_events
from app.schemas.auth import AuthUser

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/events", tags=["Research"])


class SuggestionEvent(BaseModel):
    """One decision a journalist made about one proposed change."""

    run_id: str | None = Field(default=None, description="The grammar run this belongs to")
    tool: str = Field(default="grammar", max_length=32)
    kind: str = Field(description="correction | suggestion")
    action: str = Field(description="shown | accepted | rejected")
    original: str | None = Field(default=None, max_length=400)
    proposed: str | None = Field(default=None, max_length=400)
    rule: str | None = Field(default=None, max_length=200)
    position: int | None = None
    adapter: str | None = Field(default=None, max_length=128)


class SuggestionEventBatch(BaseModel):
    events: list[SuggestionEvent] = Field(default_factory=list, max_length=MAX_EVENTS)


class EventAck(BaseModel):
    recorded: int


# The database has CHECK constraints on both columns; validating here too means
# a typo from the client is dropped quietly instead of raising a constraint
# error inside a fire-and-forget write nobody is watching.
_KINDS = {"correction", "suggestion"}
_ACTIONS = {"shown", "accepted", "rejected"}


@router.post("/suggestions", response_model=EventAck)
async def record_suggestion_events(
    request: Request,
    payload: SuggestionEventBatch,
    user: AuthUser | None = Depends(optional_user),
):
    """
    Record what the journalist did with the changes the model proposed.

    Always returns 200. A rejected batch would tell a client something it
    cannot act on, and retry storms over research telemetry are not worth the
    risk to the request path that matters.
    """
    actor = actor_from(request, user)
    stamp = actor.stamp()

    rows = [
        {
            **stamp,
            "run_id": event.run_id,
            "tool": event.tool,
            "kind": event.kind,
            "action": event.action,
            "original": event.original,
            "proposed": event.proposed,
            "rule": event.rule,
            "position": event.position,
            "adapter": event.adapter,
        }
        for event in payload.events
        if event.kind in _KINDS and event.action in _ACTIONS
    ]

    written = await record_events(rows)
    return EventAck(recorded=written)
