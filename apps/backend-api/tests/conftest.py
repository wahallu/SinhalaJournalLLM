"""
Shared test fixtures.

Two autouse fixtures keep the suite hermetic — offline, deterministic, and
independent of any real backing service:

- fake_supabase replaces the Supabase client with an in-memory fake so the
  suite runs with no network and no real database. The fake implements just
  the PostgREST query chain the repositories use: table().insert/select()
  .eq/order/range/limit/maybe_single().execute().
- offline_model_provider forces the deterministic mock model provider and
  patches every known binding of the SinLlama health probe — both the
  function-local lookup in model_gateway.gateway_status() and the
  module-level import in app.api.v1.sinllama — so the health-check code
  paths those two modules expose can't reach the research GPU box or the
  ngrok tunnel in .env. A new module that imports sinllama_health at module
  level needs its own patch line added to this fixture.
"""

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from app.core.config import get_settings


def _matches_or(row: dict, expression: str) -> bool:
    """
    Evaluate a PostgREST or() expression against one row.

    Only `column.ilike.*term*` clauses are supported — that is all the admin
    user search emits. An unrecognized clause raises rather than being
    skipped, so a test relying on an unimplemented operator fails loudly
    instead of passing because the filter matched everything.
    """
    for clause in expression.split(","):
        column, _, rest = clause.partition(".")
        operator, _, pattern = rest.partition(".")
        if operator != "ilike":
            raise NotImplementedError(f"Fake or() supports ilike only, got {clause!r}")
        needle = pattern.strip("*").lower()
        if needle in str(row.get(column) or "").lower():
            return True
    return False


class _FakeQuery:
    def __init__(self, store: dict[str, list[dict]], table: str):
        self._store = store
        self._table = table
        self._operation = "select"
        self._payload: dict | None = None
        self._filters: list[tuple[str, object]] = []
        self._gte_filters: list[tuple[str, object]] = []
        self._order_desc = True
        self._range: tuple[int, int] | None = None
        self._limit: int | None = None
        self._single = False
        self._count = None
        self._or: str | None = None

    # ── builders ──
    def insert(self, record: dict):
        self._operation = "insert"
        self._payload = record
        return self

    def update(self, record: dict):
        self._operation = "update"
        self._payload = record
        return self

    def delete(self):
        self._operation = "delete"
        return self

    def or_(self, expression: str):
        """
        PostgREST or() — only the `col.ilike.*term*` form the admin user
        search uses is interpreted. Anything else is ignored rather than
        silently filtering nothing, so a test using an unsupported operator
        fails loudly instead of passing for the wrong reason.
        """
        self._or = expression
        return self

    def select(self, *_cols, count: str | None = None):
        self._operation = "select"
        self._count = count
        return self

    def eq(self, column: str, value):
        self._filters.append((column, value))
        return self

    def gte(self, column: str, value):
        self._gte_filters.append((column, value))
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

        if self._operation == "update":
            updated = []
            for row in rows:
                if all(str(row.get(c)) == str(v) for c, v in self._filters):
                    row.update(self._payload)
                    updated.append(row)
            return SimpleNamespace(data=updated, count=None)

        if self._operation == "delete":
            removed = [r for r in rows if all(str(r.get(c)) == str(v) for c, v in self._filters)]
            remaining = [r for r in rows if r not in removed]
            self._store[self._table] = remaining
            return SimpleNamespace(data=removed, count=None)

        result = list(rows)
        for column, value in self._filters:
            result = [r for r in result if str(r.get(column)) == str(value)]
        for column, value in self._gte_filters:
            result = [r for r in result if str(r.get(column) or "") >= str(value)]
        if self._or:
            result = [r for r in result if _matches_or(r, self._or)]
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
    Force the deterministic mock provider for every test, and stub out every
    binding of the SinLlama health probe so /api/v1/meta, /health/model, and
    /api/v1/sinllama/health can't reach the network either.

    config.Settings loads apps/backend-api/.env, where MODEL_PROVIDER points
    at the research GPU server. Without this override the suite makes real
    network calls: slow, non-deterministic, and dependent on whether the GPU
    box happens to be up.

    sinllama_health is defined in app.models.sinllama_loader and reached
    through two different kinds of import, which need two different patches:

    - model_gateway.gateway_status() looks it up via `from
      app.models.sinllama_loader import sinllama_health` INSIDE its own
      function body, so it re-resolves the name from
      app.models.sinllama_loader on every call — patching
      app.core.model_gateway.sinllama_health has no effect (confirmed: that
      module never binds the name at module level, and even force-setting it
      there is shadowed by the function-local import). The patch has to
      target app.models.sinllama_loader, where the name is actually defined.
    - app.api.v1.sinllama imports the name at module level, which binds its
      own `sinllama_health` in that module's namespace once, at import time.
      Patching app.models.sinllama_loader never touches that copy, so the
      route handler keeps holding the real function unless
      app.api.v1.sinllama.sinllama_health is patched separately.

    Any future module that imports sinllama_health at module level will need
    its own patch line added here too.
    """

    async def _offline_sinllama_health() -> bool:
        return False

    monkeypatch.setenv("MODEL_PROVIDER", "mock")
    monkeypatch.setenv("MODEL_FALLBACK", "false")
    monkeypatch.setattr(
        "app.models.sinllama_loader.sinllama_health", _offline_sinllama_health
    )
    monkeypatch.setattr(
        "app.api.v1.sinllama.sinllama_health", _offline_sinllama_health
    )
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
