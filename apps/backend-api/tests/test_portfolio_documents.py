"""Public document listing and admin upload management."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.core import security
from app.main import app
from app.services.document_storage import InvalidDocument, validate_upload

ADMIN_ID = "22222222-2222-2222-2222-222222222222"


def _auth() -> dict[str, str]:
    return {"Authorization": f"Bearer {security.create_access_token(ADMIN_ID)}"}


@pytest.fixture(autouse=True)
def _admin(fake_supabase):
    fake_supabase.store["profiles"] = [
        {
            "id": ADMIN_ID,
            "email": "admin@sinai.lk",
            "role": "admin",
            "status": "active",
            "category_id": None,
            "created_at": "2026-01-01T00:00:00Z",
        }
    ]
    return fake_supabase


@pytest.mark.asyncio
async def test_public_list_only_returns_published_documents(fake_supabase):
    fake_supabase.store["portfolio_documents"] = [
        {
            "id": "visible",
            "title": "Research paper",
            "category": "publication",
            "document_type": "Group",
            "submitted_at": "2026-09-03",
            "description": None,
            "file_name": "paper.pdf",
            "file_path": "paper.pdf",
            "file_url": "https://files.example/paper.pdf",
            "mime_type": "application/pdf",
            "size_bytes": 123,
            "is_published": True,
            "sort_order": 0,
            "created_at": "2026-10-04T00:00:00Z",
            "updated_at": "2026-10-04T00:00:00Z",
        },
        {
            "id": "draft",
            "title": "Draft",
            "category": "document",
            "document_type": "Group",
            "submitted_at": None,
            "description": None,
            "file_name": "draft.pdf",
            "file_path": "draft.pdf",
            "file_url": "https://files.example/draft.pdf",
            "mime_type": "application/pdf",
            "size_bytes": 456,
            "is_published": False,
            "sort_order": 1,
            "created_at": "2026-10-04T00:00:00Z",
            "updated_at": "2026-10-04T00:00:00Z",
        },
    ]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/portfolio/documents")

    assert response.status_code == 200
    assert [row["id"] for row in response.json()] == ["visible"]


@pytest.mark.asyncio
async def test_admin_can_upload_a_pdf(monkeypatch, fake_supabase):
    async def fake_upload(filename, content):
        assert filename == "proposal.pdf"
        assert content == b"%PDF-test"
        return "stored.pdf", "https://files.example/stored.pdf", "application/pdf"

    monkeypatch.setattr(
        "app.api.v1.admin.portfolio_documents.document_storage.upload_public_document",
        fake_upload,
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/admin/portfolio-documents",
            headers=_auth(),
            data={
                "title": "Project proposal",
                "category": "document",
                "document_type": "Group",
                "submitted_at": "2026-03-13",
                "is_published": "true",
                "sort_order": "2",
            },
            files={"file": ("proposal.pdf", b"%PDF-test", "application/pdf")},
        )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["title"] == "Project proposal"
    assert body["file_url"] == "https://files.example/stored.pdf"
    assert fake_supabase.store["portfolio_documents"][0]["created_by"] == ADMIN_ID
    assert fake_supabase.store["audit_log"][0]["action"] == "portfolio_document.create"


@pytest.mark.asyncio
async def test_admin_upload_rejects_unsupported_file(monkeypatch):
    # Match the concrete exception the endpoint handles.
    async def invalid_document(filename, content):
        raise InvalidDocument("Upload a PDF, Word document, or PowerPoint file.")

    monkeypatch.setattr(
        "app.api.v1.admin.portfolio_documents.document_storage.upload_public_document",
        invalid_document,
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/admin/portfolio-documents",
            headers=_auth(),
            data={
                "title": "Executable",
                "category": "document",
                "document_type": "Group",
            },
            files={"file": ("bad.exe", b"MZ", "application/octet-stream")},
        )

    assert response.status_code == 400
    assert "PDF" in response.json()["detail"]


def test_document_validator_rejects_an_extension_only_fake():
    with pytest.raises(InvalidDocument, match="contents"):
        validate_upload("not-really-a-document.pdf", b"MZ executable")


def test_document_validator_accepts_pdf_signature():
    suffix, mime = validate_upload("paper.PDF", b"%PDF-1.7\nbody")
    assert suffix == ".pdf"
    assert mime == "application/pdf"
