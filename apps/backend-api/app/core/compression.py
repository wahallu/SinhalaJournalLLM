"""
Response compression that leaves streams alone.

Sinhala is three bytes per character in UTF-8 and every tool response echoes
the article back, so JSON bodies are large and compress well (typically
4-6x). Starlette's GZipMiddleware does the compressing.

What it must NOT touch is the NDJSON streams (Optimize, image generation).
Gzip holds output back in its window until it has enough to emit a block, so
a compressed stream reaches the browser in lumps rather than stage by stage —
the progress UI would sit frozen and then jump. Starlette only exempts
text/event-stream, so the exemption is widened here, keyed on content type
rather than path so a new streaming endpoint is covered automatically.
"""

from starlette.datastructures import Headers
from starlette.middleware.gzip import GZipMiddleware, GZipResponder, IdentityResponder
from starlette.types import ASGIApp, Message, Receive, Scope, Send

STREAMING_CONTENT_TYPES = ("text/event-stream", "application/x-ndjson")


class _StreamAwareGZipResponder(GZipResponder):
    async def send_with_compression(self, message: Message) -> None:
        if message["type"] == "http.response.start":
            content_type = Headers(raw=message["headers"]).get("content-type", "")
            await super().send_with_compression(message)
            if content_type.startswith(STREAMING_CONTENT_TYPES):
                self.content_type_is_excluded = True
            return
        await super().send_with_compression(message)


class CompressionMiddleware(GZipMiddleware):
    """GZip for buffered responses over `minimum_size`; streams pass through."""

    def __init__(self, app: ASGIApp, minimum_size: int = 1000, compresslevel: int = 6) -> None:
        # Level 6, not Starlette's 9: past 6 the CPU cost climbs steeply for
        # a percent or two of size, and this runs on every response.
        super().__init__(app, minimum_size=minimum_size, compresslevel=compresslevel)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = Headers(scope=scope)
        if "gzip" in headers.get("Accept-Encoding", ""):
            responder = _StreamAwareGZipResponder(
                self.app, self.minimum_size, compresslevel=self.compresslevel
            )
        else:
            responder = IdentityResponder(self.app, self.minimum_size)
        await responder(scope, receive, send)
