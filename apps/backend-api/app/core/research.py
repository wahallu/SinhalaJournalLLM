"""
Anonymous identity for the research study.

The tool is going to university journalism students through a WhatsApp group,
so nearly every session is anonymous and there is no recruitment step at which
a participant code could be issued. Runs are grouped by a device id instead: a
UUID the browser generates on first visit, keeps in localStorage, and sends as
`X-Anon-Id`, with a per-session id in `X-Session-Id`.

Why not IP, which was the original suggestion
---------------------------------------------
IP fails in both directions at once here. Sri Lankan mobile carriers run CGNAT
and a university network is a single NAT address, so one IP over-merges an
entire class into one "participant". The same student moving from campus wifi
to 4G to home broadband under-merges into three. Grouping research data that
way produces clusters that look real and are not, which is worse than having no
grouping at all. `ip_hash` therefore keeps its existing job — rate limiting —
and nothing else.

What a device id is not
-----------------------
It is not a person. It does not survive a cleared browser or a private window,
and a shared newsroom machine merges everyone who uses it. It is good enough to
group one person's work session and no stronger claim should be made of it in
the writeup.
"""

import re
from dataclasses import dataclass

from fastapi import Request

from app.schemas.auth import AuthUser

# Opaque client-generated ids. Length-capped and character-restricted because
# these reach the database: a header is attacker-controlled, and "it is only
# an analytics field" is how junk ends up indexed. Anything not matching is
# dropped rather than rejected — a malformed header must never fail a
# journalist's grammar check.
_ID = re.compile(r"[A-Za-z0-9._-]{8,64}")

ANON_HEADER = "X-Anon-Id"
SESSION_HEADER = "X-Session-Id"


@dataclass(frozen=True)
class Actor:
    """Who made a request, for research grouping."""

    user_id: str | None
    anon_id: str | None
    session_id: str | None

    @property
    def is_known(self) -> bool:
        """True when the run can be attributed to somebody at all."""
        return bool(self.user_id or self.anon_id)

    def stamp(self) -> dict[str, str | None]:
        """The identity columns, ready to merge into a row."""
        return {
            "user_id": self.user_id,
            "anon_id": self.anon_id,
            "session_id": self.session_id,
        }


def _clean(raw: str | None) -> str | None:
    if not raw:
        return None
    raw = raw.strip()
    return raw if _ID.fullmatch(raw) else None


def actor_from(request: Request, user: AuthUser | None) -> Actor:
    """
    Resolve the caller.

    A signed-in user still carries their device id, so a student who signs in
    part-way through does not appear as two unrelated participants.
    """
    return Actor(
        user_id=user.id if user else None,
        anon_id=_clean(request.headers.get(ANON_HEADER)),
        session_id=_clean(request.headers.get(SESSION_HEADER)),
    )
