"""Full, user-scoped History → Reopen payloads."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.core import security
from app.main import app

USER_ID = "11111111-1111-1111-1111-111111111111"
OTHER_ID = "22222222-2222-2222-2222-222222222222"


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def _auth() -> dict[str, str]:
    return {"Authorization": f"Bearer {security.create_access_token(USER_ID)}"}


@pytest.fixture(autouse=True)
def _profile(fake_supabase):
    fake_supabase.store["profiles"] = [{
        "id": USER_ID,
        "email": "journalist@sinai.lk",
        "role": "user",
        "status": "active",
    }]
    return fake_supabase


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("tool", "table", "row", "output_key", "expected"),
    [
        (
            "grammar", "grammar_corrections",
            {"original_text": "a" * 600, "corrected_text": "corrected full text",
             "corrections": [{"position": 0, "original": "a", "corrected": "b", "rule": "spelling"}],
             "correction_count": 1, "suggestions": []},
            "corrected", "corrected full text",
        ),
        (
            "rewriter", "style_rewrites",
            {"original_text": "b" * 700, "rewritten_text": "rewritten full text", "style": "editorial"},
            "rewritten", "rewritten full text",
        ),
        (
            "summarizer", "summaries",
            {"original_text": "c" * 800, "summary_text": "complete summary", "length": "short"},
            "summary", "complete summary",
        ),
    ],
)
async def test_reopen_returns_full_input_and_output(
    fake_supabase, tool, table, row, output_key, expected
):
    fake_supabase.store[table] = [{
        "id": "run-1", "user_id": USER_ID,
        "created_at": "2026-08-12T00:00:00Z", **row,
    }]

    async with _client() as client:
        response = await client.get(f"/api/v1/history/{tool}/run-1", headers=_auth())

    assert response.status_code == 200
    body = response.json()
    input_column = "original_text"
    assert body["input"] == row[input_column]
    assert len(body["input"]) > 240
    assert body["output"][output_key] == expected


@pytest.mark.asyncio
async def test_headline_reopen_includes_prompt_image_and_all_candidates(fake_supabase):
    fake_supabase.store["headline_generations"] = [{
        "id": "headline-1", "user_id": USER_ID,
        "article_text": "full headline article " * 30,
        "headlines": ["one", "two", "three"],
        "count": 3, "requested_count": 5, "category": "Politics", "length": "long",
        "adapter": "headline_sinllama_v19",
        "visual_prompt": "A complete English visual prompt",
        "image_url": "https://res.cloudinary.com/demo/image/upload/history.png",
        "image_model": "gpt-image-2",
        "created_at": "2026-08-12T00:00:00Z",
    }]

    async with _client() as client:
        response = await client.get(
            "/api/v1/history/headlines/headline-1", headers=_auth()
        )

    assert response.status_code == 200
    body = response.json()
    assert body["input"] == "full headline article " * 30
    assert len(body["input"]) > 240
    assert body["output"]["headlines"] == ["one", "two", "three"]
    assert body["output"]["visual_prompt"] == "A complete English visual prompt"
    assert body["output"]["image_url"].startswith("https://res.cloudinary.com/")
    assert body["settings"] == {
        "count": 5,
        "category": "Politics",
        "headlineLength": "long",
        "headlineModel": "headline_sinllama_v19",
    }


@pytest.mark.asyncio
async def test_reopen_cannot_read_another_users_row(fake_supabase):
    fake_supabase.store["summaries"] = [{
        "id": "private", "user_id": OTHER_ID,
        "original_text": "private input", "summary_text": "private output",
        "length": "short", "created_at": "2026-08-12T00:00:00Z",
    }]

    async with _client() as client:
        response = await client.get(
            "/api/v1/history/summarizer/private", headers=_auth()
        )

    assert response.status_code == 404
