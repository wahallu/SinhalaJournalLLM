"""Plan catalog: limits validation and catalog CRUD."""

import pytest
from pydantic import ValidationError

from app.schemas.plan import MAX_HEADLINE_COUNT, PlanLimits, TOOL_NAMES


def test_limits_reject_unknown_keys():
    """
    An admin typo must not store silently.

    `plans.limits` is jsonb, so without extra="forbid" a misspelled
    "requests_per_dayy" would be accepted and the quota would read as
    unlimited forever — a silent removal of the cap.
    """
    with pytest.raises(ValidationError):
        PlanLimits(requests_per_dayy=50)


def test_limits_reject_unknown_tool():
    with pytest.raises(ValidationError):
        PlanLimits(tools=["grammar", "telepathy"])


def test_limits_accept_every_known_tool():
    limits = PlanLimits(tools=list(TOOL_NAMES))
    assert limits.tools == list(TOOL_NAMES)


def test_limits_reject_headline_count_above_registry_max():
    """Above the registry's own defaults.headline_count bound is rejected,
    not silently capped — the admin should see their input refused."""
    with pytest.raises(ValidationError):
        PlanLimits(max_headline_count=MAX_HEADLINE_COUNT + 1)


def test_limits_reject_negative_requests():
    with pytest.raises(ValidationError):
        PlanLimits(requests_per_day=-1)


def test_limits_all_optional():
    limits = PlanLimits()
    assert limits.requests_per_day is None
    assert limits.tools is None
    assert limits.max_headline_count is None


@pytest.mark.parametrize("value", [None, 0])
def test_none_and_zero_are_unlimited(value):
    assert PlanLimits(requests_per_day=value).is_unlimited is True


def test_a_positive_limit_is_not_unlimited():
    assert PlanLimits(requests_per_day=1).is_unlimited is False
