"""Public document listing and admin upload management."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.core import security
from app.main import app
from app.schemas.portfolio_document import normalize_document_link
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


@pytest.mark.parametrize(
    "raw, expected",
    [
        (None, None),
        ("", None),
        ("   ", None),
        (
            "https://drive.google.com/file/d/abc/view",
            "https://drive.google.com/file/d/abc/view",
        ),
        ("  https://example.com/a.pdf  ", "https://example.com/a.pdf"),
        ("HTTPS://Example.com/a.pdf", "HTTPS://Example.com/a.pdf"),
    ],
)
def test_normalize_document_link_accepts_https_or_blank(raw, expected):
    assert normalize_document_link(raw) == expected


@pytest.mark.parametrize(
    "raw",
    [
        "http://example.com/a.pdf",
        "javascript:alert(1)",
        "data:text/html;base64,AAAA",
        "/documents/a.pdf",
        "ftp://example.com/a.pdf",
        "https://",
        "https:example.com",
        "https://exa mple.com/a.pdf",
        "https://example.com/" + "a" * 500,
    ],
)
def test_normalize_document_link_rejects_everything_else(raw):
    with pytest.raises(ValueError):
        normalize_document_link(raw)


LINK = "https://drive.google.com/file/d/abc123/view"


def _link_payload(**overrides):
    payload = {
        "title": "Project charter",
        "category": "document",
        "document_type": "Group",
        "file_url": LINK,
    }
    payload.update(overrides)
    return payload


def _stored_row(**overrides):
    row = {
        "id": "doc-1",
        "title": "Proposal",
        "category": "document",
        "document_type": "Group",
        "submitted_at": None,
        "description": None,
        "file_name": "proposal.pdf",
        "file_path": "stored.pdf",
        "file_url": "https://files.example/stored.pdf",
        "mime_type": "application/pdf",
        "size_bytes": 123,
        "is_published": True,
        "sort_order": 0,
        "created_at": "2026-10-04T00:00:00Z",
        "updated_at": "2026-10-04T00:00:00Z",
    }
    row.update(overrides)
    return row


async def _request(method: str, url: str, **kwargs):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        return await client.request(method, url, **kwargs)


@pytest.mark.asyncio
async def test_admin_can_add_a_link_document(fake_supabase):
    response = await _request(
        "POST",
        "/api/v1/admin/portfolio-documents/link",
        headers=_auth(),
        json=_link_payload(submitted_at="2026-03-13", sort_order=2, description=" Charter "),
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["file_url"] == LINK
    assert body["file_name"] is None
    assert body["size_bytes"] is None
    row = fake_supabase.store["portfolio_documents"][0]
    assert row["file_path"] is None
    assert row["description"] == "Charter"
    assert row["created_by"] == ADMIN_ID
    assert fake_supabase.store["audit_log"][0]["action"] == "portfolio_document.create"


@pytest.mark.asyncio
async def test_admin_can_add_a_pending_document_without_a_link(fake_supabase):
    payload = _link_payload(title="Final document")
    del payload["file_url"]

    response = await _request(
        "POST",
        "/api/v1/admin/portfolio-documents/link",
        headers=_auth(),
        json=payload,
    )

    assert response.status_code == 201, response.text
    assert response.json()["file_url"] is None
    assert fake_supabase.store["portfolio_documents"][0]["file_url"] is None


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "bad_link",
    [
        "http://example.com/a.pdf",
        "javascript:alert(1)",
        "data:text/html;base64,AAAA",
        "/documents/a.pdf",
        "https://",
        "https://exa mple.com/a.pdf",
        "https://example.com/" + "a" * 500,
    ],
)
async def test_admin_link_rejects_unsafe_or_invalid_links(fake_supabase, bad_link):
    response = await _request(
        "POST",
        "/api/v1/admin/portfolio-documents/link",
        headers=_auth(),
        json=_link_payload(file_url=bad_link),
    )

    assert response.status_code == 422
    assert fake_supabase.store.get("portfolio_documents", []) == []


@pytest.mark.asyncio
async def test_admin_link_rejects_a_blank_title(fake_supabase):
    response = await _request(
        "POST",
        "/api/v1/admin/portfolio-documents/link",
        headers=_auth(),
        json=_link_payload(title="   "),
    )

    assert response.status_code == 422
    assert fake_supabase.store.get("portfolio_documents", []) == []


@pytest.mark.asyncio
async def test_link_endpoint_requires_an_admin(fake_supabase):
    response = await _request(
        "POST",
        "/api/v1/admin/portfolio-documents/link",
        json=_link_payload(),
    )

    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_admin_can_change_then_clear_a_link_and_keep_the_stored_file(fake_supabase):
    fake_supabase.store["portfolio_documents"] = [_stored_row()]

    changed = await _request(
        "PATCH",
        "/api/v1/admin/portfolio-documents/doc-1",
        headers=_auth(),
        json={"file_url": LINK},
    )
    assert changed.status_code == 200, changed.text
    assert changed.json()["file_url"] == LINK

    cleared = await _request(
        "PATCH",
        "/api/v1/admin/portfolio-documents/doc-1",
        headers=_auth(),
        json={"file_url": ""},
    )
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["file_url"] is None

    # The stored object is still tracked, so a later delete can remove it.
    assert fake_supabase.store["portfolio_documents"][0]["file_path"] == "stored.pdf"


@pytest.mark.asyncio
async def test_admin_patch_rejects_an_unsafe_link(fake_supabase):
    fake_supabase.store["portfolio_documents"] = [_stored_row()]

    response = await _request(
        "PATCH",
        "/api/v1/admin/portfolio-documents/doc-1",
        headers=_auth(),
        json={"file_url": "javascript:alert(1)"},
    )

    assert response.status_code == 422
    assert fake_supabase.store["portfolio_documents"][0]["file_url"] == (
        "https://files.example/stored.pdf"
    )


@pytest.mark.asyncio
async def test_deleting_a_link_row_does_not_touch_storage(monkeypatch, fake_supabase):
    fake_supabase.store["portfolio_documents"] = [
        _stored_row(
            id="link-1",
            file_name=None,
            file_path=None,
            file_url=LINK,
            mime_type=None,
            size_bytes=None,
        )
    ]
    calls = []

    async def fake_delete(path):
        calls.append(path)

    monkeypatch.setattr(
        "app.api.v1.admin.portfolio_documents.document_storage.delete_public_document",
        fake_delete,
    )

    response = await _request(
        "DELETE", "/api/v1/admin/portfolio-documents/link-1", headers=_auth()
    )

    assert response.status_code == 204
    assert calls == []
    assert fake_supabase.store["portfolio_documents"] == []


@pytest.mark.asyncio
async def test_deleting_an_uploaded_row_removes_its_stored_file(monkeypatch, fake_supabase):
    fake_supabase.store["portfolio_documents"] = [_stored_row()]
    calls = []

    async def fake_delete(path):
        calls.append(path)

    monkeypatch.setattr(
        "app.api.v1.admin.portfolio_documents.document_storage.delete_public_document",
        fake_delete,
    )

    response = await _request(
        "DELETE", "/api/v1/admin/portfolio-documents/doc-1", headers=_auth()
    )

    assert response.status_code == 204
    assert calls == ["stored.pdf"]


@pytest.mark.asyncio
async def test_public_list_includes_link_and_pending_rows(fake_supabase):
    fake_supabase.store["portfolio_documents"] = [
        _stored_row(
            id="linked",
            file_name=None,
            file_path=None,
            file_url=LINK,
            mime_type=None,
            size_bytes=None,
            sort_order=0,
        ),
        _stored_row(
            id="pending",
            title="Final document",
            file_name=None,
            file_path=None,
            file_url=None,
            mime_type=None,
            size_bytes=None,
            sort_order=1,
        ),
    ]

    response = await _request("GET", "/api/v1/portfolio/documents")

    assert response.status_code == 200
    rows = {row["id"]: row for row in response.json()}
    assert rows["linked"]["file_url"] == LINK
    assert rows["pending"]["file_url"] is None
    assert rows["pending"]["size_bytes"] is None
