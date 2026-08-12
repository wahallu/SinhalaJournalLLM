"""Authorization coverage for the billable image generation endpoint."""

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
    async def fake_generate_image(prompt: str) -> str:
        assert prompt == "A news photograph"
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
    assert response.json() == {
        "image_data": "data:image/png;base64,aGVsbG8=",
        "prompt": "A news photograph",
        "model": "gpt-image-2",
        "stored": False,
    }


@pytest.mark.asyncio
async def test_admin_can_generate_with_reference_image(monkeypatch):
    reference = b"RIFF\x08\x00\x00\x00WEBPtest"

    async def fake_edit_image(prompt, image_bytes, image_mime, image_filename):
        assert prompt == "Use this car in a night-time news scene"
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
    assert response.json()["image_data"] == "data:image/png;base64,ZWRpdGVk"
    assert response.json()["model"] == "gpt-image-2"


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

    async def fake_generate_image(prompt: str) -> str:
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
    assert response.json()["image_data"].startswith("https://res.cloudinary.com/")
    assert response.json()["stored"] is True
    saved = fake_supabase.store["headline_generations"][0]
    assert saved["visual_prompt"] == "A news photograph"
    assert saved["image_url"] == response.json()["image_data"]
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
