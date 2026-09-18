"""
Response compression, HTTP caching headers, and the in-process TTL cache.
"""

import asyncio
import gzip
import json

import pytest
from fastapi import FastAPI
from fastapi.responses import JSONResponse, StreamingResponse
from httpx import ASGITransport, AsyncClient

from app.core.cache import TTLCache
from app.core.compression import CompressionMiddleware
from app.core.http_cache import HttpCacheMiddleware
from app.main import app


def _client(target=app) -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=target), base_url="http://test")


# ── Compression ──

def _mini_app() -> FastAPI:
    """A bare app with the production middleware order, and a large body."""
    mini = FastAPI()
    mini.add_middleware(HttpCacheMiddleware)
    mini.add_middleware(CompressionMiddleware, minimum_size=1000)

    @mini.get("/api/v1/big")
    async def big():
        return JSONResponse({"text": "සිංහල " * 2000})

    @mini.get("/api/v1/stream")
    async def stream():
        async def lines():
            for i in range(3):
                yield json.dumps({"stage": i, "pad": "x" * 2000}) + "\n"
        return StreamingResponse(lines(), media_type="application/x-ndjson")

    return mini


@pytest.mark.asyncio
async def test_large_json_is_gzipped():
    async with _client(_mini_app()) as client:
        r = await client.get("/api/v1/big", headers={"Accept-Encoding": "gzip"})
    assert r.status_code == 200
    assert r.headers["content-encoding"] == "gzip"
    # httpx decodes transparently; the wire size is what shrank.
    assert r.json()["text"].startswith("සිංහල")


@pytest.mark.asyncio
async def test_ndjson_stream_is_not_compressed():
    """Gzip would hold stream stages back until its window filled."""
    async with _client(_mini_app()) as client:
        r = await client.get("/api/v1/stream", headers={"Accept-Encoding": "gzip"})
    assert "content-encoding" not in r.headers
    assert len(r.text.strip().split("\n")) == 3


@pytest.mark.asyncio
async def test_small_responses_are_left_uncompressed():
    async with _client() as client:
        r = await client.get("/health", headers={"Accept-Encoding": "gzip"})
    assert "content-encoding" not in r.headers


# ── Cache-Control and ETag ──

@pytest.mark.asyncio
async def test_meta_is_publicly_cacheable_and_revalidates_with_304():
    async with _client() as client:
        first = await client.get("/api/v1/meta")
        assert first.status_code == 200
        assert first.headers["cache-control"].startswith("public, max-age=30")
        etag = first.headers["etag"]
        assert etag.startswith('W/"')

        second = await client.get("/api/v1/meta", headers={"If-None-Match": etag})
    assert second.status_code == 304
    assert second.content == b""
    assert second.headers["etag"] == etag


@pytest.mark.asyncio
async def test_stale_etag_gets_the_full_body():
    async with _client() as client:
        r = await client.get("/api/v1/meta", headers={"If-None-Match": 'W/"nope"'})
    assert r.status_code == 200
    assert r.json()["tasks"]


@pytest.mark.asyncio
async def test_per_user_api_responses_are_never_shared_cacheable():
    """A CDN in front of the API must never serve one user's data to another."""
    async with _client() as client:
        r = await client.get("/api/v1/history")  # 401 without a session
    assert r.headers["cache-control"] == "private, no-cache"


@pytest.mark.asyncio
async def test_health_is_not_cached():
    async with _client() as client:
        r = await client.get("/health")
    assert r.headers["cache-control"] == "no-store"


# ── TTLCache ──

@pytest.mark.asyncio
async def test_ttl_cache_serves_hits_without_reloading():
    cache = TTLCache("t-hit", ttl_seconds=60)
    calls = 0

    async def load():
        nonlocal calls
        calls += 1
        return calls

    assert await cache.get_or_load("k", load) == 1
    assert await cache.get_or_load("k", load) == 1
    cache.invalidate("k")
    assert await cache.get_or_load("k", load) == 2


@pytest.mark.asyncio
async def test_ttl_cache_single_flights_concurrent_misses():
    cache = TTLCache("t-flight", ttl_seconds=60)
    calls = 0

    async def slow_load():
        nonlocal calls
        calls += 1
        await asyncio.sleep(0.01)
        return "value"

    results = await asyncio.gather(*[cache.get_or_load("k", slow_load) for _ in range(10)])
    assert results == ["value"] * 10
    assert calls == 1


@pytest.mark.asyncio
async def test_ttl_cache_does_not_cache_failures():
    cache = TTLCache("t-fail", ttl_seconds=60)
    attempts = 0

    async def flaky():
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise RuntimeError("db blip")
        return "recovered"

    with pytest.raises(RuntimeError):
        await cache.get_or_load("k", flaky)
    assert await cache.get_or_load("k", flaky) == "recovered"


@pytest.mark.asyncio
async def test_ttl_cache_expires(monkeypatch):
    import app.core.cache as cache_module

    now = [1000.0]
    monkeypatch.setattr(cache_module.time, "monotonic", lambda: now[0])
    cache = TTLCache("t-exp", ttl_seconds=5)

    async def load():
        return now[0]

    assert await cache.get_or_load("k", load) == 1000.0
    now[0] += 6
    assert await cache.get_or_load("k", load) == 1006.0


# ── Plan cache invalidation ──

@pytest.mark.asyncio
async def test_plan_update_is_visible_immediately(fake_supabase):
    from app.repositories import plan_repository

    fake_supabase.store["plans"] = [{"id": "p1", "name": "Free", "is_default": True}]
    assert (await plan_repository.get("p1"))["name"] == "Free"
    await plan_repository.update("p1", {"name": "Starter"})
    assert (await plan_repository.get("p1"))["name"] == "Starter"


def test_gzip_roundtrip_sanity():
    # Guard that the Sinhala payloads this exists for actually compress well.
    body = json.dumps({"text": "සිංහල පුවත් ලිපිය " * 500}).encode()
    assert len(gzip.compress(body, 6)) < len(body) / 4
