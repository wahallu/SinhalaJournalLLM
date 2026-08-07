"""
The circuit breaker must not turn one slow query into a site-wide outage.

Reported symptom: POST /auth/login returned 503 and every authenticated GET
returned 401, for one user, while a different account worked moments later.

Cause: the breaker is process-wide and used to open on the FIRST exception of
any kind. Authentication reads `profiles` through it (deps._resolve, and login
via get_profile), so a single cold-start timeout locked out every user for the
whole 60s cooldown. The "other account" worked because the cooldown had
expired, not because of anything about the account.

These pin the three properties that make that impossible to repeat:
one blip is survivable, a real outage is still caught, and an error that came
back FROM the database (a missing row, an RLS refusal) is never mistaken for
the database being down.
"""

import asyncio

import httpx
import pytest
from postgrest.exceptions import APIError

from app.repositories import base


@pytest.fixture(autouse=True)
def _reset_circuit():
    base._circuit_open_until = 0.0
    base._consecutive_failures = 0
    yield
    base._circuit_open_until = 0.0
    base._consecutive_failures = 0


def test_single_timeout_does_not_open_the_circuit():
    """The regression. One slow read must not log everyone out."""
    base._record_failure(asyncio.TimeoutError())
    assert not base._circuit_is_open()


def test_circuit_opens_only_after_sustained_failure():
    for _ in range(base.CIRCUIT_FAILURE_THRESHOLD - 1):
        base._record_failure(asyncio.TimeoutError())
    assert not base._circuit_is_open()

    base._record_failure(asyncio.TimeoutError())
    assert base._circuit_is_open()


def test_a_success_clears_the_failure_run():
    """Intermittent slowness must never accumulate into an outage."""
    for _ in range(base.CIRCUIT_FAILURE_THRESHOLD - 1):
        base._record_failure(asyncio.TimeoutError())
    base._record_success()
    base._record_failure(asyncio.TimeoutError())
    assert not base._circuit_is_open()


def test_api_errors_never_open_the_circuit():
    """
    An APIError means PostgREST replied — the database is reachable. Treating
    "no such row" as an outage is what made a single bad lookup contagious.
    """
    for _ in range(base.CIRCUIT_FAILURE_THRESHOLD * 3):
        base._record_failure(APIError({"message": "no rows", "code": "PGRST116"}))
    assert not base._circuit_is_open()
    assert base._consecutive_failures == 0


@pytest.mark.parametrize(
    "exc",
    [
        asyncio.TimeoutError(),
        TimeoutError(),
        httpx.ConnectError("refused"),
        httpx.ConnectTimeout("slow"),
        httpx.ReadTimeout("slow"),
        OSError("dns"),
    ],
)
def test_transport_faults_still_count(exc):
    """The breaker must keep working — it exists to stop paying dead-host cost."""
    for _ in range(base.CIRCUIT_FAILURE_THRESHOLD):
        base._record_failure(exc)
    assert base._circuit_is_open()
