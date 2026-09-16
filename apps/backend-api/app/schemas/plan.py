"""
Plan catalog schemas.

`PlanLimits` is the security boundary for the one free-form column in this
feature. `plans.limits` is jsonb, so without a strict model an admin typo —
"requests_per_dayy" — would store silently and the quota would then read as
unlimited forever. extra="forbid" turns that into a 400 at write time, which
is the same argument settings_registry.py makes for its own whitelist.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

# The tool names passed to enforce_plan_quota at each call site. Defined here
# rather than imported from the routers, which would be a cycle;
# tests/test_plan_quota.py asserts the two stay in step.
TOOL_NAMES: tuple[str, ...] = (
    "grammar",
    "headlines",
    "rewriter",
    "summarizer",
    "optimize",
)

# Matches the upper bound on defaults.headline_count in settings_registry.py.
MAX_HEADLINE_COUNT = 10


class PlanLimits(BaseModel):
    """
    What a plan permits.

    Every field is optional and an omitted field means unconstrained, so an
    empty `{}` is a valid, fully permissive plan.
    """

    model_config = ConfigDict(extra="forbid")

    # None or 0 both mean unlimited. Two spellings because a JSON document
    # written by hand tends to use one or the other, and refusing either
    # would be a trap rather than a safeguard.
    requests_per_day: int | None = Field(default=None, ge=0)
    tools: list[str] | None = None
    max_headline_count: int | None = Field(default=None, ge=1, le=MAX_HEADLINE_COUNT)

    @field_validator("tools")
    @classmethod
    def _known_tools(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        unknown = sorted(set(value) - set(TOOL_NAMES))
        if unknown:
            raise ValueError(
                f"unknown tool(s): {', '.join(unknown)}. "
                f"Valid tools: {', '.join(TOOL_NAMES)}"
            )
        return value

    @property
    def is_unlimited(self) -> bool:
        """True when no daily cap applies — covers both None and 0."""
        return not self.requests_per_day


class PlanBase(BaseModel):
    slug: str = Field(pattern=r"^[a-z0-9-]{1,40}$")
    name: str = Field(min_length=1, max_length=60)
    description: str = ""
    badge: str | None = Field(default=None, max_length=24)
    features: list[str] = Field(default_factory=list)
    limits: PlanLimits = Field(default_factory=PlanLimits)
    sort_order: int = 0
    is_visible: bool = True


class PlanCreate(PlanBase):
    is_default: bool = False


class PlanUpdate(BaseModel):
    """Every field optional — a PATCH changes only what it names."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=60)
    description: str | None = None
    badge: str | None = Field(default=None, max_length=24)
    features: list[str] | None = None
    limits: PlanLimits | None = None
    sort_order: int | None = None
    is_visible: bool | None = None
    is_default: bool | None = None


class Plan(PlanBase):
    id: str
    is_default: bool = False
    archived_at: datetime | None = None


class PlanAssignment(BaseModel):
    """Body of PATCH /admin/users/{id}/plan. None clears the assignment."""

    plan_id: str | None = None


class QuotaState(BaseModel):
    """What a client needs to explain a 429 — or show usage before one."""

    used: int
    limit: int | None
    resets_at: datetime
    plan_slug: str
    plan_name: str
