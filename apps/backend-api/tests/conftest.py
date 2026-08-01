"""
Shared test fixtures.

Two autouse fixtures keep the suite hermetic — offline, deterministic, and
independent of any real backing service:

- fake_supabase replaces the Supabase client with an in-memory fake so the
  suite runs with no network and no real database. The fake implements just
  the PostgREST query chain the repositories use: table().insert/select()
  .eq/order/range/limit/maybe_single().execute().
- offline_model_provider forces the deterministic mock model provider and
  stubs out the SinLlama health probe, so no test depends on network access,
  the research GPU box, or the ngrok tunnel in .env being reachable.
"""

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from app.core.config import get_settings


class _FakeQuery:
    def __init__(self, store: dict[str, list[dict]], table: str):
        self._store = store
        self._table = table
        self._operation = "select"
        self._payload: dict | None = None
        self._filters: list[tuple[str, object]] = []
        self._order_desc = True
        self._range: tuple[int, int] | None = None
        self._limit: int | None = None
        self._single = False
        self._count = None

    # ── builders ──
    def insert(self, record: dict):
        self._operation = "insert"
        self._payload = record
        return self

    def select(self, *_cols, count: str | None = None):
        self._operation = "select"
        self._count = count
        return self

    def eq(self, column: str, value):
        self._filters.append((column, value))
        return self

    def order(self, _column: str, desc: bool = False):
        self._order_desc = desc
        return self

    def range(self, start: int, end: int):
        self._range = (start, end)
        return self

    def limit(self, n: int):
        self._limit = n
        return self

    def maybe_single(self):
        self._single = True
        return self

    # ── execution ──
    async def execute(self):
        rows = self._store.setdefault(self._table, [])

        if self._operation == "insert":
            record = {
                **self._payload,
                "id": str(uuid.uuid4()),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            rows.append(record)
            return SimpleNamespace(data=[record], count=None)

        result = list(rows)
        for column, value in self._filters:
            result = [r for r in result if str(r.get(column)) == str(value)]
        result.sort(key=lambda r: r.get("created_at") or "", reverse=self._order_desc)
        total = len(result)
        if self._range is not None:
            start, end = self._range
            result = result[start:end + 1]
        if self._limit is not None:
            result = result[: self._limit]
        if self._single:
            return SimpleNamespace(data=result[0] if result else None, count=None)
        return SimpleNamespace(
            data=result,
            count=total if self._count == "exact" else None,
        )


class FakeSupabase:
    def __init__(self):
        self.store: dict[str, list[dict]] = {}

    def table(self, name: str) -> _FakeQuery:
        return _FakeQuery(self.store, name)


@pytest.fixture(autouse=True)
def fake_supabase(monkeypatch):
    """Route all repository calls to an in-memory store."""
    fake = FakeSupabase()

    async def _get_fake():
        return fake

    monkeypatch.setattr("app.repositories.base.get_supabase", _get_fake)
    # A test that exercises a persistence failure trips the circuit breaker;
    # reset it so later tests still reach the fake store.
    monkeypatch.setattr("app.repositories.base._circuit_open_until", 0.0)
    return fake


@pytest.fixture(autouse=True)
def offline_model_provider(monkeypatch):
    """
    Force the deterministic mock provider for every test, and stub out the
    SinLlama health probe so /api/v1/meta and /health/model can't reach the
    network either.

    config.Settings loads apps/backend-api/.env, where MODEL_PROVIDER points
    at the research GPU server. Without this override the suite makes real
    network calls: slow, non-deterministic, and dependent on whether the GPU
    box happens to be up.

    Forcing MODEL_PROVIDER alone doesn't stop gateway_status() (called by
    both endpoints above) from calling the real sinllama_health(), which
    does an unconditional httpx GET regardless of which provider is active.
    gateway_status() looks up that name via `from app.models.sinllama_loader
    import sinllama_health` INSIDE its own function body, so it re-resolves
    the name from app.models.sinllama_loader on every call — patching
    app.core.model_gateway.sinllama_health has no effect (confirmed: that
    module never binds the name at module level, and even force-setting it
    there is shadowed by the function-local import). The patch has to target
    app.models.sinllama_loader, where the name is actually defined.
    """

    async def _offline_sinllama_health() -> bool:
        return False

    monkeypatch.setenv("MODEL_PROVIDER", "mock")
    monkeypatch.setenv("MODEL_FALLBACK", "false")
    monkeypatch.setattr(
        "app.models.sinllama_loader.sinllama_health", _offline_sinllama_health
    )
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
