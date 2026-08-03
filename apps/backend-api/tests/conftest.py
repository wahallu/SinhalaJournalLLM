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

from app.core import runtime_settings
from app.core.config import get_settings
from app.models.sinllama_loader import SinLlamaUnavailable


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


def _matches_all(row: dict, eq_filters, gte_filters, or_expr) -> bool:
    """
    Whether a row satisfies every filter on the query.

    Shared by select, update and delete on purpose. update/delete previously
    applied only `eq`, silently ignoring `gte` and `or_` — and with no `eq`
    at all, `all([])` is True, so a `.delete().gte("created_at", cutoff)`
    matched EVERY row. A retention-prune test would have passed while
    production emptied the table.
    """
    for column, value in eq_filters:
        if str(row.get(column)) != str(value):
            return False
    for column, value in gte_filters:
        if not str(row.get(column) or "") >= str(value):
            return False
    if or_expr and not _matches_or(row, or_expr):
        return False
    return True


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
        self._on_conflict: str = "id"

    # ── builders ──
    def insert(self, record: dict):
        self._operation = "insert"
        self._payload = record
        return self

    def upsert(self, record: dict, on_conflict: str | None = None):
        self._operation = "upsert"
        self._payload = record
        self._on_conflict = on_conflict or "id"
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
            # An explicitly supplied id is honoured, the way Postgres honours
            # one rather than overriding it with the column default. Signup
            # depends on this: it inserts a profiles row keyed to the id of
            # the app_users row it just created, and a fake that reassigned
            # that id would leave the two tables silently unlinked while the
            # insert still appeared to succeed.
            record = {
                "id": str(uuid.uuid4()),
                "created_at": datetime.now(timezone.utc).isoformat(),
                **self._payload,
            }
            rows.append(record)
            # A copy, like a real PostgREST response — returning the stored
            # dict lets a caller mutate the store by accident and hides
            # aliasing bugs that only appear against the real client.
            return SimpleNamespace(data=[dict(record)], count=None)

        if self._operation == "upsert":
            conflict_key = self._on_conflict
            target = self._payload.get(conflict_key)
            for row in rows:
                if row.get(conflict_key) == target:
                    row.update(self._payload)
                    return SimpleNamespace(data=[dict(row)], count=None)
            record = {**self._payload}
            record.setdefault("id", str(uuid.uuid4()))
            record.setdefault("created_at", datetime.now(timezone.utc).isoformat())
            rows.append(record)
            return SimpleNamespace(data=[dict(record)], count=None)

        if self._operation == "update":
            updated = []
            for row in rows:
                if _matches_all(row, self._filters, self._gte_filters, self._or):
                    row.update(self._payload)
                    updated.append(dict(row))
            return SimpleNamespace(data=updated, count=None)

        if self._operation == "delete":
            removed = [
                r for r in rows
                if _matches_all(r, self._filters, self._gte_filters, self._or)
            ]
            self._store[self._table] = [r for r in rows if r not in removed]
            return SimpleNamespace(data=[dict(r) for r in removed], count=None)

        # Copy rows out, the way a real PostgREST response would arrive as
        # freshly parsed JSON. Returning the stored dicts by reference would
        # let a caller mutate the store by accident, and would hide aliasing
        # bugs that only appear against the real HTTP client.
        result = [
            dict(r) for r in rows
            if _matches_all(r, self._filters, self._gte_filters, self._or)
        ]
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

    # User-scoped reads build a PostgREST client from the caller's JWT.
    # Without this the suite would open real HTTP connections to Supabase.
    # The fake ignores the token, so RLS itself is NOT exercised here — that
    # is covered by the explicit user_id filters and, in a real database, by
    # the policies in schema.sql.
    async def _get_fake_user_client(_jwt: str):
        return fake

    monkeypatch.setattr("app.core.user_client.user_postgrest", _get_fake_user_client)
    # A test that exercises a persistence failure trips the circuit breaker;
    # reset it so later tests still reach the fake store.
    monkeypatch.setattr("app.repositories.base._circuit_open_until", 0.0)
    return fake


@pytest.fixture(autouse=True)
def offline_model_provider(monkeypatch, fake_supabase):
    """
    Force the deterministic mock provider for every test, and stub out every
    binding of the SinLlama health probe and adapter listing so
    /api/v1/meta, /health/model, /api/v1/sinllama/health and
    /api/v1/comparison/adapters can't reach the network either — all four
    became reachable without a session once the dashboard's public status
    widget started depending on them.

    config.Settings loads apps/backend-api/.env, where MODEL_PROVIDER points
    at the research GPU server. Without this override the suite makes real
    network calls: slow, non-deterministic, and dependent on whether the GPU
    box happens to be up.

    sinllama_health and sinllama_get_comparison_adapters are defined in
    app.models.sinllama_loader and each reached through two different kinds
    of import, which need two different patches per function:

    - model_gateway.gateway_status() looks up sinllama_health via `from
      app.models.sinllama_loader import sinllama_health` INSIDE its own
      function body, so it re-resolves the name from
      app.models.sinllama_loader on every call — patching
      app.core.model_gateway.sinllama_health has no effect (confirmed: that
      module never binds the name at module level, and even force-setting it
      there is shadowed by the function-local import). The patch has to
      target app.models.sinllama_loader, where the name is actually defined.
    - app.api.v1.sinllama and app.api.v1.comparison each import their
      function at module level, which binds its own copy in that module's
      namespace once, at import time. Patching app.models.sinllama_loader
      never touches those copies, so the route handlers keep holding the
      real functions unless app.api.v1.sinllama.sinllama_health and
      app.api.v1.comparison.sinllama_get_comparison_adapters are patched
      separately.

    Any future module that imports either function at module level will need
    its own patch line added here too.
    """

    async def _offline_sinllama_health() -> bool:
        return False

    async def _offline_comparison_adapters() -> dict:
        raise SinLlamaUnavailable("Comparison server unreachable in tests")

    monkeypatch.setenv("MODEL_PROVIDER", "mock")
    monkeypatch.setenv("MODEL_FALLBACK", "false")
    # Self-hosted auth refuses to sign or verify without a key, by design.
    # A fixed test key keeps token tests deterministic; it is never a real one.
    monkeypatch.setenv("JWT_SECRET", "test-only-signing-key-not-used-anywhere-real")
    # No SMTP in tests — the mailer logs instead of dialling out.
    monkeypatch.setenv("SMTP_HOST", "")

    # Since Phase 3 the gateway reads the provider from runtime settings, not
    # env. The registry's default is captured from env at import time, which
    # is BEFORE monkeypatch.setenv above runs — so the env override alone no
    # longer forces mock. Seed the settings store instead, which exercises the
    # real layering code rather than bypassing it. Tests that need different
    # settings simply overwrite this key in their own fixture.
    fake_supabase.store["app_settings"] = [
        {"key": "model.provider", "value": "mock", "updated_at": "2026-01-01T00:00:00Z"},
        {"key": "model.fallback_enabled", "value": False, "updated_at": "2026-01-01T00:00:00Z"},
    ]
    runtime_settings.invalidate()

    monkeypatch.setattr(
        "app.models.sinllama_loader.sinllama_health", _offline_sinllama_health
    )
    monkeypatch.setattr(
        "app.api.v1.sinllama.sinllama_health", _offline_sinllama_health
    )
    monkeypatch.setattr(
        "app.models.sinllama_loader.sinllama_get_comparison_adapters",
        _offline_comparison_adapters,
    )
    monkeypatch.setattr(
        "app.api.v1.comparison.sinllama_get_comparison_adapters",
        _offline_comparison_adapters,
    )
    get_settings.cache_clear()
    runtime_settings.invalidate()
    yield
    get_settings.cache_clear()
    runtime_settings.invalidate()
