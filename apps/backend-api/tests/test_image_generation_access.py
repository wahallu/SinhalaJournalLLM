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
    }
