"""Portfolio contact form: validation, honeypot, rate limit, delivery."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.v1 import portfolio
from app.core import email as email_module
from app.core.email import EmailDeliveryError
from app.main import app

URL = "/api/v1/portfolio/contact"
VALID = {"name": "Kamal", "email": "kamal@example.com", "message": "Hello, I would like a demo."}


@pytest.fixture(autouse=True)
def _reset_limit():
    portfolio._contact_sends.clear()
    yield
    portfolio._contact_sends.clear()


@pytest.fixture
def sent(monkeypatch):
    calls = []

    async def fake_send(to, subject, text_body, html_body, reply_to=None):
        calls.append({"to": to, "subject": subject, "text": text_body, "html": html_body, "reply_to": reply_to})

    monkeypatch.setattr(email_module, "send_email", fake_send)
    return calls


async def _post(body):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        return await client.post(URL, json=body)


@pytest.mark.asyncio
async def test_sends_to_contact_inbox_with_reply_to_visitor(sent):
    resp = await _post(VALID)
    assert resp.status_code == 202
    assert len(sent) == 1
    assert sent[0]["to"] == "nisalfonseka@gmail.com"
    assert sent[0]["reply_to"] == "kamal@example.com"
    assert "Hello, I would like a demo." in sent[0]["text"]


@pytest.mark.asyncio
async def test_visitor_input_is_html_escaped(sent):
    resp = await _post({**VALID, "message": "<script>alert(1)</script> hi there"})
    assert resp.status_code == 202
    assert "<script>" not in sent[0]["html"]
    assert "&lt;script&gt;" in sent[0]["html"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "body",
    [
        {**VALID, "email": "not-an-email"},
        {**VALID, "message": "short"},
        {**VALID, "name": ""},
        {**VALID, "name": "Kamal\r\nBcc: x@example.com"},
    ],
)
async def test_rejects_invalid_input(sent, body):
    resp = await _post(body)
    assert resp.status_code == 422
    assert sent == []


@pytest.mark.asyncio
async def test_honeypot_is_accepted_but_not_sent(sent):
    resp = await _post({**VALID, "website": "http://spam.example"})
    assert resp.status_code == 202
    assert sent == []


@pytest.mark.asyncio
async def test_rate_limited_per_ip(sent):
    for _ in range(5):
        assert (await _post(VALID)).status_code == 202
    assert (await _post(VALID)).status_code == 429
    assert len(sent) == 5


@pytest.mark.asyncio
async def test_delivery_failure_returns_502(monkeypatch):
    async def failing(*args, **kwargs):
        raise EmailDeliveryError("smtp down")

    monkeypatch.setattr(email_module, "send_email", failing)
    resp = await _post(VALID)
    assert resp.status_code == 502
