"""
Request correlation and log formatting.

A 500 in the logs used to be untraceable to the report that prompted it:
nothing tied a log line to a request, and nothing the client received named
the failure. `X-Request-ID` closes that loop — an inbound id is honoured so a
proxy's trace survives, one is generated otherwise, every log line emitted
while handling the request carries it, and it comes back on the response
(including error responses) so a user can quote it.

The id is carried in a ContextVar rather than passed down through call
signatures. Everything here is async and single-task per request, so the
context follows the await chain without every repository and service growing
a parameter it does not otherwise need.
"""

import json
import logging
import uuid
from contextvars import ContextVar

from starlette.types import ASGIApp, Message, Receive, Scope, Send

REQUEST_ID_HEADER = "x-request-id"

_request_id: ContextVar[str | None] = ContextVar("request_id", default=None)


def get_request_id() -> str | None:
    """The current request's id, or None outside a request."""
    return _request_id.get()


class RequestIdFilter(logging.Filter):
    """Attaches `request_id` to every record so formatters can use it."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = _request_id.get() or "-"
        return True


class JsonFormatter(logging.Formatter):
    """
    One JSON object per line.

    Used in production, where logs are ingested by machine. Development keeps
    the readable formatter — JSON in a terminal is a downgrade for the person
    reading it.
    """

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", "-"),
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def configure_logging(*, json_logs: bool) -> None:
    """
    Install the request-id filter and pick a formatter.

    Attached to the root handlers rather than replacing them, so uvicorn's own
    handlers keep working and only gain the correlation field.
    """
    root = logging.getLogger()
    if not root.handlers:
        logging.basicConfig(level=logging.INFO)

    formatter = (
        JsonFormatter()
        if json_logs
        else logging.Formatter(
            "%(asctime)s %(levelname)-8s [%(request_id)s] %(name)s: %(message)s"
        )
    )
    request_filter = RequestIdFilter()
    for handler in root.handlers:
        handler.setFormatter(formatter)
        handler.addFilter(request_filter)

    # uvicorn installs its own handlers; without the filter they raise a
    # KeyError on %(request_id)s the first time they format a record.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        for handler in logging.getLogger(name).handlers:
            handler.setFormatter(formatter)
            handler.addFilter(request_filter)


class RequestIdMiddleware:
    """
    Pure-ASGI middleware binding a request id for the life of the request.

    Written against the raw ASGI interface rather than BaseHTTPMiddleware
    because BaseHTTPMiddleware runs the handler in a separate task, and a
    ContextVar set there does not propagate back — the id would be missing
    from exactly the error paths it exists to correlate.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = {k.decode("latin-1").lower(): v for k, v in scope.get("headers", [])}
        inbound = headers.get(REQUEST_ID_HEADER)
        request_id = _sanitize(inbound.decode("latin-1")) if inbound else uuid.uuid4().hex

        token = _request_id.set(request_id)

        async def send_with_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                # Set on the raw header list so it is present on every
                # response, including the ones Starlette builds for
                # unhandled exceptions.
                message.setdefault("headers", [])
                message["headers"].append(
                    (REQUEST_ID_HEADER.encode("latin-1"), request_id.encode("latin-1"))
                )
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        finally:
            _request_id.reset(token)


def _sanitize(value: str) -> str:
    """
    Keep an inbound id only if it is short and plainly printable.

    It is attacker-controlled and ends up in log lines and a response header,
    so anything else gets a fresh id rather than a sanitized version of
    whatever was sent — a newline here would be log injection.
    """
    cleaned = value.strip()
    if not cleaned or len(cleaned) > 64:
        return uuid.uuid4().hex
    if not all(c.isalnum() or c in "-_" for c in cleaned):
        return uuid.uuid4().hex
    return cleaned


class SecurityHeadersMiddleware:
    """
    Response headers that cost nothing and close off whole bug classes.

    No CSP: this service returns JSON, never HTML, so a policy here would
    protect nothing while being one more thing to keep in step with the
    frontend's own headers.
    """

    def __init__(self, app: ASGIApp, *, hsts: bool = False) -> None:
        self.app = app
        self.hsts = hsts

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                message.setdefault("headers", [])
                extra = [
                    (b"x-content-type-options", b"nosniff"),
                    (b"x-frame-options", b"DENY"),
                    (b"referrer-policy", b"strict-origin-when-cross-origin"),
                ]
                if self.hsts:
                    # Production only. Sent over plain HTTP in development it
                    # would pin localhost to HTTPS in the developer's browser.
                    extra.append(
                        (b"strict-transport-security", b"max-age=31536000; includeSubDomains")
                    )
                message["headers"].extend(extra)
            await send(message)

        await self.app(scope, receive, send_with_headers)
