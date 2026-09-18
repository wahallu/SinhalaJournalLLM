"""
HTTP caching for GET responses: Cache-Control policy plus ETag revalidation.

Two jobs:

1. **Say who may cache what.** Public, identical-for-everyone reads (/meta,
   the plan catalog) get a short shared max-age so a CDN or the browser can
   answer them without reaching this service. Everything else under /api is
   marked `private, no-cache`: most of it is per-user, and a CDN in front of
   the API that cached one user's /history and served it to the next would
   be a data leak, not a performance bug. A route that sets its own
   Cache-Control (the streams set no-store) is left alone.

2. **Skip re-sending unchanged bodies.** Every buffered JSON GET gets a weak
   ETag over its body. A client that sends it back in If-None-Match receives
   a bodiless 304 instead — the dashboard re-polls history and stats on every
   visit, and most of those polls return exactly what it already has.

The ETag is computed on the uncompressed body, so this middleware must sit
INSIDE the compression middleware (added to the app before it).

It also hands compression one whole body. The `@app.middleware("http")`
error handler in main.py is a BaseHTTPMiddleware, which re-emits every
response as a stream of chunks; without coalescing here, the compressor saw
`more_body` on even a 20-byte /health reply and gzipped it as a stream,
defeating its own minimum_size. Real streams (NDJSON) are passed straight
through.
"""

import hashlib

from app.core.compression import STREAMING_CONTENT_TYPES
from starlette.datastructures import Headers, MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

# path → Cache-Control. Exact matches only: /plans is public, /plans/me is not.
PUBLIC_POLICIES: dict[str, str] = {
    # Feature flags and defaults live behind runtime_settings' 30s TTL, so a
    # 30s cache here does not widen how stale a flag change can be.
    "/api/v1/meta": "public, max-age=30, stale-while-revalidate=60",
    "/api/v1/plans": "public, max-age=60, stale-while-revalidate=300",
    "/health": "no-store",
    "/health/ready": "no-store",
    "/health/model": "no-store",
}
DEFAULT_API_POLICY = "private, no-cache"

# Bodies larger than this are streamed through without an ETag rather than
# held in memory to hash.
_MAX_ETAG_BODY = 2 * 1024 * 1024


def _policy_for(path: str) -> str | None:
    if path in PUBLIC_POLICIES:
        return PUBLIC_POLICIES[path]
    if path.startswith("/api/"):
        return DEFAULT_API_POLICY
    return None


def _etag_matches(if_none_match: str, etag: str) -> bool:
    candidates = [tag.strip() for tag in if_none_match.split(",")]
    bare = etag.removeprefix("W/")
    return "*" in candidates or any(tag.removeprefix("W/") == bare for tag in candidates)


class HttpCacheMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        is_read = scope["method"] in ("GET", "HEAD")
        policy = _policy_for(scope["path"]) if is_read else None
        if_none_match = Headers(scope=scope).get("if-none-match")

        start: Message | None = None
        eligible = False
        chunks: list[bytes] = []
        size = 0
        passthrough = False

        async def send_wrapper(message: Message) -> None:
            nonlocal start, eligible, size, passthrough

            if message["type"] == "http.response.start":
                headers = MutableHeaders(raw=message["headers"])
                if policy and "cache-control" not in headers:
                    headers["Cache-Control"] = policy
                content_type = headers.get("content-type", "")
                if content_type.startswith(STREAMING_CONTENT_TYPES):
                    passthrough = True
                    await send(message)
                    return
                eligible = (
                    is_read
                    and message["status"] == 200
                    and content_type.startswith("application/json")
                    and "etag" not in headers
                    and "no-store" not in headers.get("cache-control", "")
                )
                start = message
                return

            if passthrough:
                await send(message)
                return

            chunks.append(message.get("body", b""))
            size += len(chunks[-1])
            more = message.get("more_body", False)

            if size > _MAX_ETAG_BODY:
                # Too big to buffer — give up on the ETag and flush what we have.
                passthrough = True
                await send(start)
                await send({"type": "http.response.body", "body": b"".join(chunks), "more_body": more})
                chunks.clear()
                return
            if more:
                return

            body = b"".join(chunks)
            if not eligible:
                await send(start)
                await send({"type": "http.response.body", "body": body})
                return

            etag = 'W/"' + hashlib.blake2b(body, digest_size=12).hexdigest() + '"'
            headers = MutableHeaders(raw=start["headers"])
            headers["ETag"] = etag

            if if_none_match and _etag_matches(if_none_match, etag):
                # 304 carries the validators and caching headers but no body.
                del headers["content-length"]
                if "content-type" in headers:
                    del headers["content-type"]
                await send({**start, "status": 304, "headers": headers.raw})
                await send({"type": "http.response.body", "body": b""})
                return

            await send(start)
            await send({"type": "http.response.body", "body": body})

        await self.app(scope, receive, send_wrapper)
