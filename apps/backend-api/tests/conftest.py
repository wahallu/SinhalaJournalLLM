"""
Shared test fixtures.

Replaces the Supabase client with an in-memory fake so the suite runs with no
network and no real database. The fake implements just the PostgREST query
chain the repositories use: table().insert/select().eq/order/range/limit/
maybe_single().execute().
"""

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest


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

    # Force offline mock provider for all tests
    monkeypatch.setenv("MODEL_PROVIDER", "mock")
    # Avoid picking up real Groq keys during local tests
    monkeypatch.setenv("GROQ_STYLE_API_KEY", "")
    monkeypatch.setenv("GROQ_API_KEY", "")

    from app.core.config import get_settings
    get_settings.cache_clear()
    return fake
