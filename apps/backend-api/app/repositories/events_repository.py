"""
Which corrections and spelling suggestions journalists actually took.

This is the highest-value signal the study can collect. Input/output text says
what the model did, not whether it was right, and establishing that costs
hand-labelling thousands of rows. An accept or reject click is ground truth the
moment it happens: a rejected dictionary flag is a measured false positive, and
a reverted correction is the over-correction failure this project spent v17-v18
removing.
"""

import asyncio
import logging
from typing import Any

from app.repositories import base

logger = logging.getLogger(__name__)

TABLE = "suggestion_events"

# One paste of a long article can produce a lot of corrections, and the client
# batches them. Cap the write so a malformed or hostile client cannot turn a
# single request into an unbounded insert.
MAX_EVENTS = 200


async def record_events(events: list[dict[str, Any]]) -> int:
    """
    Write a batch of research events, returning how many actually landed.

    One insert for the whole batch rather than one per event: a long article
    can produce a hundred corrections, and a round trip each would make the
    telemetry slower than the correction it is reporting on.

    Deliberately does NOT go through `insert_record`, which returns a synthetic
    record when the database is unreachable. That is right for an inference
    result the user is waiting on, and wrong here — it would report a row as
    written when nothing was stored, and a research count that silently
    overstates itself is worse than no count.

    Never raises. Losing an event must not fail the request that produced it.
    """
    if not events:
        return 0
    batch = events[:MAX_EVENTS]
    try:
        client = await base.get_supabase()
        await asyncio.wait_for(
            client.table(TABLE).insert(batch).execute(),
            timeout=base.WRITE_TIMEOUT_SECONDS,
        )
        return len(batch)
    except Exception:
        logger.warning(
            "Suggestion-event batch of %d dropped — telemetry only, continuing",
            len(batch),
            exc_info=True,
        )
        return 0
