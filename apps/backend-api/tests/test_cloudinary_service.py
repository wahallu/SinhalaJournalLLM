"""Signed, server-only Cloudinary upload used by headline history."""

import hashlib
from types import SimpleNamespace

import pytest

from app.services import cloudinary_service


class _Response:
    status_code = 200

    @staticmethod
    def json():
        return {
            "secure_url": "https://res.cloudinary.com/demo/image/upload/v1/sinai/history/run-1.png",
            "public_id": "sinai/history/run-1",
        }


class _Client:
    def __init__(self):
        self.endpoint = None
        self.payload = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def post(self, endpoint, *, data):
        self.endpoint = endpoint
        self.payload = data
        return _Response()


@pytest.mark.asyncio
async def test_upload_uses_signed_server_side_request(monkeypatch):
    client = _Client()
    monkeypatch.setattr(
        cloudinary_service,
        "get_settings",
        lambda: SimpleNamespace(CLOUDINARY_URL="cloudinary://key:secret@demo"),
    )
    monkeypatch.setattr(cloudinary_service.time, "time", lambda: 1234)
    monkeypatch.setattr(
        cloudinary_service.httpx,
        "AsyncClient",
        lambda **_kwargs: client,
    )

    url, public_id = await cloudinary_service.upload_history_image(
        "data:image/png;base64,aGVsbG8=", "run-1"
    )

    signature_source = "folder=sinai/history&public_id=run-1&timestamp=1234secret"
    assert client.endpoint == "https://api.cloudinary.com/v1_1/demo/image/upload"
    assert client.payload["api_key"] == "key"
    assert client.payload["signature"] == hashlib.sha1(signature_source.encode()).hexdigest()
    assert url.startswith("https://res.cloudinary.com/")
    assert public_id == "sinai/history/run-1"


def test_invalid_cloudinary_url_is_rejected(monkeypatch):
    monkeypatch.setattr(
        cloudinary_service,
        "get_settings",
        lambda: SimpleNamespace(CLOUDINARY_URL="https://example.com/not-cloudinary"),
    )

    with pytest.raises(RuntimeError, match="CLOUDINARY_URL"):
        cloudinary_service._credentials()
