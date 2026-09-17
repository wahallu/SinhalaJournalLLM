"""
Personal usage — what the Profile page's Usage tab reads.

Distinct from schemas/admin.py's analytics shapes, which aggregate across
every account. This is one user's own history.
"""

from datetime import date

from pydantic import BaseModel

from app.schemas.plan import QuotaState


class DailyUsagePoint(BaseModel):
    """One cell of the heatmap."""

    day: date
    requests: int


class UsageSummary(BaseModel):
    today: QuotaState | None
    week_requests: int
    active_days: int
    series: list[DailyUsagePoint]
