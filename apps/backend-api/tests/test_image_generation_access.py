"""Authorization coverage for the billable image generation endpoint."""

import json

import pytest
from httpx import ASGITransport, AsyncClient

from app.core import security
from app.main import app

USER_ID = "11111111-1111-1111-1111-111111111111"
ADMIN_ID = "22222222-2222-2222-2222-222222222222"
ENDPOINT = "/api/v1/image/generate"


def _auth(user_id: str) -> dict[str, str]:
    token = security.create_access_token(user_id)
    return {"Authorization": f"Bearer {token}"}


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def _terminal(response) -> dict:
    """The last NDJSON line of a streamed image response.

    The endpoint answers with heartbeats followed by one terminal event, so a
    successful generation is no longer a single JSON body -- see
    app/api/v1/image_generation.py for why it has to stream."""
    lines = [line for line in response.text.splitlines() if line.strip()]
    assert lines, "expected at least one NDJSON line"
    return json.loads(lines[-1])


def _heartbeats(response) -> list[dict]:
    lines = [line for line in response.text.splitlines() if line.strip()]
    return [json.loads(line) for line in lines[:-1]]


@pytest.fixture(autouse=True)
def _profiles(fake_supabase):
    fake_supabase.store["profiles"] = [
        {
            "id": USER_ID,
            "email": "user@sinai.lk",
            "role": "user",
            "status": "active",
            "category_id": None,
            "created_at": "2026-01-01T00:00:00Z",
        },
        {
            "id": ADMIN_ID,
            "email": "admin@sinai.lk",
            "role": "admin",
            "status": "active",
            "category_id": None,
            "created_at": "2026-01-01T00:00:00Z",
        },
    ]
    return fake_supabase


@pytest.mark.asyncio
async def test_anonymous_user_cannot_generate_images():
    async with _client() as client:
        response = await client.post(ENDPOINT, json={"prompt": "A news photograph"})

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_regular_user_cannot_generate_images():
    async with _client() as client:
        response = await client.post(
            ENDPOINT,
            json={"prompt": "A news photograph"},
            headers=_auth(USER_ID),
        )

    assert response.status_code == 403
    assert response.json()["detail"] == "Administrator access required."


@pytest.mark.asyncio
async def test_admin_can_generate_images(monkeypatch):
    async def fake_generate_image(prompt: str, model: str | None = None) -> str:
        assert prompt == "A news photograph"
        assert model == "gpt-image-2"  # the registry default
        return "data:image/png;base64,aGVsbG8="

    monkeypatch.setattr(
        "app.api.v1.image_generation.generate_image",
        fake_generate_image,
    )

    async with _client() as client:
        response = await client.post(
            ENDPOINT,
            json={"prompt": "A news photograph"},
            headers=_auth(ADMIN_ID),
        )

    assert response.status_code == 200
    assert _terminal(response) == {
        "status": "done",
        "image_data": "data:image/png;base64,aGVsbG8=",
        "prompt": "A news photograph",
        "model": "gpt-image-2",
        "stored": False,
    }
    # The first byte is what the platform's 30-second rule measures, and it
    # goes out before OpenAI is called at all.
    assert _heartbeats(response)[0] == {"status": "working", "model": "gpt-image-2"}


@pytest.mark.asyncio
async def test_admin_can_generate_with_reference_image(monkeypatch):
    reference = b"RIFF\x08\x00\x00\x00WEBPtest"

    async def fake_edit_image(prompt, image_bytes, image_mime, image_filename, model=None):
        assert prompt == "Use this car in a night-time news scene"
        assert model == "gpt-image-2"
        assert image_bytes == reference
        assert image_mime == "image/webp"
        assert image_filename == "reference.webp"
        return "data:image/png;base64,ZWRpdGVk"

    monkeypatch.setattr("app.api.v1.image_generation.edit_image", fake_edit_image)

    async with _client() as client:
        response = await client.post(
            ENDPOINT,
            data={"prompt": "Use this car in a night-time news scene"},
            files={"image": ("car.webp", reference, "image/webp")},
            headers=_auth(ADMIN_ID),
        )

    assert response.status_code == 200
    assert _terminal(response)["image_data"] == "data:image/png;base64,ZWRpdGVk"
    assert _terminal(response)["model"] == "gpt-image-2"


@pytest.mark.asyncio
async def test_reference_image_type_is_verified_from_file_content(monkeypatch):
    called = False

    async def fake_edit_image(*_args, **_kwargs):
        nonlocal called
        called = True
        return "data:image/png;base64,bm90LXJlYWNoZWQ="

    monkeypatch.setattr("app.api.v1.image_generation.edit_image", fake_edit_image)

    async with _client() as client:
        response = await client.post(
            ENDPOINT,
            data={"prompt": "Use this reference"},
            files={"image": ("fake.png", b"this is not an image", "image/png")},
            headers=_auth(ADMIN_ID),
        )

    assert response.status_code == 415
    assert "valid PNG, JPG, JPEG, or WEBP" in response.json()["detail"]
    assert called is False


@pytest.mark.asyncio
async def test_admin_image_is_uploaded_and_attached_to_own_headline(monkeypatch, fake_supabase):
    fake_supabase.store["headline_generations"] = [{
        "id": "headline-1",
        "user_id": ADMIN_ID,
        "article_text": "full article",
        "headlines": ["headline"],
        "created_at": "2026-08-12T00:00:00Z",
    }]

    async def fake_generate_image(prompt: str, model: str | None = None) -> str:
        return "data:image/png;base64,aGVsbG8="

    async def fake_upload(image_data: str, record_id: str):
        assert record_id == "headline-1"
        assert image_data.startswith("data:image/png;base64,")
        return "https://res.cloudinary.com/demo/image/upload/headline-1.png", "sinai/history/headline-1"

    monkeypatch.setattr("app.api.v1.image_generation.generate_image", fake_generate_image)
    monkeypatch.setattr("app.api.v1.image_generation.is_configured", lambda: True)
    monkeypatch.setattr("app.api.v1.image_generation.upload_history_image", fake_upload)

    async with _client() as client:
        response = await client.post(
            ENDPOINT,
            json={"prompt": "A news photograph", "history_id": "headline-1"},
            headers=_auth(ADMIN_ID),
        )

    assert response.status_code == 200
    terminal = _terminal(response)
    assert terminal["image_data"].startswith("https://res.cloudinary.com/")
    assert terminal["stored"] is True
    saved = fake_supabase.store["headline_generations"][0]
    assert saved["visual_prompt"] == "A news photograph"
    assert saved["image_url"] == terminal["image_data"]
    assert saved["image_model"] == "gpt-image-2"


@pytest.mark.asyncio
async def test_admin_cannot_attach_image_to_another_users_history(monkeypatch, fake_supabase):
    fake_supabase.store["headline_generations"] = [{
        "id": "someone-elses-run",
        "user_id": USER_ID,
        "article_text": "private article",
        "headlines": ["private headline"],
        "created_at": "2026-08-12T00:00:00Z",
    }]
    called = False

    async def fake_generate_image(prompt: str) -> str:
        nonlocal called
        called = True
        return "data:image/png;base64,aGVsbG8="

    monkeypatch.setattr("app.api.v1.image_generation.generate_image", fake_generate_image)
    monkeypatch.setattr("app.api.v1.image_generation.is_configured", lambda: True)

    async with _client() as client:
        response = await client.post(
            ENDPOINT,
            json={"prompt": "A news photograph", "history_id": "someone-elses-run"},
            headers=_auth(ADMIN_ID),
        )

    assert response.status_code == 404
    assert called is False
