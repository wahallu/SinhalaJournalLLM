"""
Plan catalog schemas.

`PlanLimits` is the security boundary for the one free-form column in this
feature. `plans.limits` is jsonb, so without a strict model an admin typo —
"requests_per_dayy" — would store silently and the quota would then read as
unlimited forever. extra="forbid" turns that into a 400 at write time, which
is the same argument settings_registry.py makes for its own whitelist.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator, model_validator

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

# Currencies the pricing fields accept. A closed set, not free text: the code
# is rendered next to an amount on a public page, and "Rs" vs "LKR" vs a typo
# is the difference between a price a reader trusts and one they do not.
CURRENCIES = ("LKR", "USD", "EUR", "GBP", "INR", "AUD")

BILLING_PERIODS = ("monthly", "yearly", "one_off")

# How many monthly payments an annual price is compared against.
MONTHS_PER_YEAR = 12

# Schemes a plan's call-to-action may point at.
#
# A whitelist, not a blocklist. cta_href is rendered as an <a href> on
# /plans, which is PUBLIC, so a "javascript:" value there is stored XSS
# against every visitor. Admin-only is not a sufficient defence on its own:
# one compromised admin account should not be able to reach every anonymous
# visitor. A leading "/" is allowed for an in-app destination.
_SAFE_CTA_SCHEMES = ("https://", "http://", "mailto:")


def _validate_cta_href(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    lowered = cleaned.lower()
    if cleaned.startswith("/") and not cleaned.startswith("//"):
        # In-app path. "//" excluded: it is protocol-relative, i.e. offsite.
        return cleaned
    if any(lowered.startswith(scheme) for scheme in _SAFE_CTA_SCHEMES):
        return cleaned
    raise ValueError(
        "cta_href must start with https://, http://, mailto:, or / "
        f"(got {cleaned[:32]!r})"
    )


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

    # ── Pricing ──
    # Minor units (cents / සත) as integers, never floats: 2500.00 has no exact
    # binary representation and money that drifts by a cent is money someone
    # has to reconcile by hand. StrictInt so 2500.5 is a 422, not a silent
    # truncation to 2500.
    price_cents: StrictInt | None = Field(default=None, ge=0)
    annual_price_cents: StrictInt | None = Field(default=None, ge=0)
    currency: str = "LKR"
    billing_period: Literal["monthly", "yearly", "one_off"] = "monthly"

    # The card's call-to-action. Both unset means no button renders, which is
    # the right default for a tier with nowhere to send people yet.
    cta_label: str | None = Field(default=None, max_length=40)
    cta_href: str | None = Field(default=None, max_length=512)

    @field_validator("cta_href")
    @classmethod
    def _safe_href(cls, value: str | None) -> str | None:
        return _validate_cta_href(value)

    @field_validator("cta_label")
    @classmethod
    def _blank_label_is_none(cls, value: str | None) -> str | None:
        return value.strip() or None if value else None

    @field_validator("currency")
    @classmethod
    def _known_currency(cls, value: str) -> str:
        code = (value or "").strip().upper()
        if code not in CURRENCIES:
            raise ValueError(f"currency must be one of: {', '.join(CURRENCIES)}")
        return code

    @model_validator(mode="after")
    def _annual_price_is_a_discount(self):
        """
        The annual price is rendered as a saving against twelve monthly
        payments. One that is higher would draw a negative discount and
        misprice the plan on a page anyone can read.
        """
        if (
            self.annual_price_cents is not None
            and self.price_cents
            and self.annual_price_cents > self.price_cents * MONTHS_PER_YEAR
        ):
            raise ValueError(
                "annual_price_cents must not exceed twelve monthly payments "
                f"({self.price_cents * MONTHS_PER_YEAR})"
            )
        return self

    @model_validator(mode="after")
    def _cta_is_complete(self):
        if self.cta_label and not self.cta_href:
            raise ValueError(
                "cta_href is required when cta_label is set — a labelled "
                "button that goes nowhere is the dead button this replaces"
            )
        return self


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
    cta_label: str | None = None
    cta_href: str | None = None
    price_cents: StrictInt | None = Field(default=None, ge=0)
    annual_price_cents: StrictInt | None = Field(default=None, ge=0)
    currency: str | None = None
    billing_period: Literal["monthly", "yearly", "one_off"] | None = None

    @field_validator("currency")
    @classmethod
    def _known_currency(cls, value: str | None) -> str | None:
        if value is None:
            return None
        code = value.strip().upper()
        if code not in CURRENCIES:
            raise ValueError(f"currency must be one of: {', '.join(CURRENCIES)}")
        return code

    @field_validator("cta_href")
    @classmethod
    def _safe_href(cls, value: str | None) -> str | None:
        return _validate_cta_href(value)


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


# ── Upgrade requests ──────────────────────────────────────────────────────
#
# There is no payment gateway. An upgrade is a request the user raises after
# paying by bank transfer, which an admin confirms. Nothing here implies a
# charge was taken automatically, and only the admin review moves a plan.

UpgradeStatus = Literal["pending", "approved", "declined", "cancelled"]


class UpgradeRequestCreate(BaseModel):
    """What a user submits after making the transfer."""

    model_config = ConfigDict(extra="forbid")

    plan_id: str
    # The reference from their bank slip — the only thing tying a payment in
    # the account to this request, so it cannot be blank.
    payment_reference: str = Field(min_length=1, max_length=120)
    note: str | None = Field(default=None, max_length=1000)

    @field_validator("payment_reference", "note")
    @classmethod
    def _trimmed(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("must not be blank")
        return cleaned


class UpgradeReview(BaseModel):
    """An admin's decision. Deliberately cannot set 'pending' or 'cancelled'
    — reopening a decided request, or cancelling on the user's behalf, are
    not review outcomes."""

    model_config = ConfigDict(extra="forbid")

    status: Literal["approved", "declined"]
    reviewer_note: str | None = Field(default=None, max_length=1000)


class UpgradeRequest(BaseModel):
    id: str
    user_id: str
    plan_id: str
    from_plan_id: str | None = None
    status: UpgradeStatus
    payment_reference: str | None = None
    note: str | None = None
    reviewer_note: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime | None = None
    # Joined for the admin table, so one request row is actionable without a
    # second lookup per row.
    user_email: str | None = None
    plan_name: str | None = None
    from_plan_name: str | None = None


class BankDetails(BaseModel):
    """
    Where a user sends the money.

    Free text by necessity — a bank name and account number are not a closed
    set — which is exactly why it does NOT go through settings_registry:
    that registry documents its refusal to accept free-form strings. This is
    stored as one validated blob under its own admin endpoint instead, the
    same shape of decision as PlanLimits.
    """

    model_config = ConfigDict(extra="forbid")

    bank_name: str = Field(default="", max_length=120)
    account_name: str = Field(default="", max_length=120)
    account_number: str = Field(default="", max_length=64)
    branch: str = Field(default="", max_length=120)
    instructions: str = Field(default="", max_length=2000)

    @property
    def is_complete(self) -> bool:
        """Whether there is enough here to actually send money."""
        return bool(self.bank_name and self.account_name and self.account_number)
