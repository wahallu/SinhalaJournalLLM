# Portfolio tabs, milestones and link-based documents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the SinAi portfolio the SLIIT guideline tabs, a real milestones timeline and documents supplied as admin-managed links, and drop the Google Workspace Marketplace constraints, without changing the site's look.

**Architecture:** The portfolio stays a Next.js static export with a one-page home; the header tabs scroll to existing sections and a scroll-spy highlights the current tab. Documents keep flowing from the FastAPI `portfolio_documents` table to the public `GET /portfolio/documents`; a row can now be just an https link (or have no link yet), created and edited from the admin panel through a new JSON endpoint.

**Tech Stack:** Next.js 16 / React 19 / Tailwind 4 / GSAP (portfolio), FastAPI + Supabase + pytest (backend-api), React 19 + Vite + `node --test` (web-app admin).

**Spec:** `docs/superpowers/specs/2026-10-11-portfolio-tabs-milestones-document-links-design.md`

All paths are relative to the repo root `/Users/nisalfonseka/Documents/GitHub/Research/SinhalaJournalLLM`. Shell blocks show the `cd` they need.

## Global Constraints

- Keep Next.js 16 static export (`output: "export"`), GSAP timeline and the current visual design; add **no new pages**.
- Header tabs, in order and exact labels: **Home, Domain, Milestones, Documents, Presentations, About us, Contact us**, then **Try SinAi** (external, unchanged).
- A document link is stored and rendered only if it is `https://` with a host, at most **500 characters**, with no whitespace. Empty means "pending" (no link yet). `http:`, `javascript:`, `data:` and relative paths are rejected.
- Admin API stays under `/api/v1/admin/portfolio-documents`; the multipart upload endpoint is left untouched. Public `GET /api/v1/portfolio/documents` keeps its path.
- Phone is stored as `071 076 7697` with `tel:+94710767697`.
- Content-honesty rule (`apps/portfolio/AGENTS.md` section 7): no invented numbers, claims or testimonials. Milestone copy uses only what the project owner supplied plus facts already in the repo.
- `apps/portfolio/AGENTS.md` warns this is not the Next.js you know: use only `next/link`, `next/navigation` (`usePathname`) and patterns already present in the app.
- Do **not** delete `public/documents/*.pdf`, `public/assets/aiexpo/IMG_*`, or `public/supervisors & team members/` in this plan; that is a manual step after the owner confirms the links.
- Commit steps below create commits only because you approved this plan. Each commit message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

Failure modes the spec implies that no single task's happy path covers, most likely first:

1. **A pending (link-less) row must flow end to end**: public API returns nulls for the file fields, the portfolio shows "Pending" instead of a broken link, the admin table shows a Pending badge, and deleting it must not call storage. (Task 2 tests, Task 3 helper tests, Task 4 preview check.)
2. **A hostile or malformed link must never be stored or rendered**: `javascript:`, `http:`, relative paths, spaces, `https://` with no host, 501+ characters. (Task 1 validator tests, Task 2 endpoint tests, Task 4 preview check with a `javascript:` row.)
3. **Editing an existing uploaded row**: changing or clearing its link via PATCH must leave `file_path` intact so a later delete still removes the stored object. (Task 2 test.)
4. **Backend offline or library empty**: `#documents` and `#presentations` must still exist so the header tabs scroll somewhere, and the visitor sees a clear message, not a blank gap. (Task 4 preview check with the API stopped and with an empty list.)
5. **Active tab correctness**: sections nested inside others (`documents` inside `library`), the pinned timeline, an anchor jump landing a section at about 80px, and routes other than `/` (`/project-scope` highlights Domain; `/research` highlights nothing). (Task 6 preview checks.)

## File Structure

| File | Responsibility |
|---|---|
| `apps/backend-api/migrations/2026-10-11-portfolio-document-links.sql` (create) | Make file columns nullable so a row can be only a link or pending. |
| `apps/backend-api/app/schemas/portfolio_document.py` (modify) | Link validator, optional file fields, link-create and update payloads. |
| `apps/backend-api/app/api/v1/admin/portfolio_documents.py` (modify) | `POST /link`, delete without storage for link rows. |
| `apps/backend-api/tests/test_portfolio_documents.py` (modify) | Tests for all of the above. |
| `apps/web-app/src/admin/documentLink.js` (create) + `.test.js` | Pure link parsing/host helpers used by the admin form and table. |
| `apps/web-app/src/admin/adminApi.js` (modify) | `createPortfolioDocumentLink`. |
| `apps/web-app/src/admin/pages/PortfolioDocuments.jsx` (modify) | Link field, Edit action, Pending badge. |
| `apps/portfolio/content/documents.ts` (modify) | Link-based document type and `openableUrl` guard; bundled list removed. |
| `apps/portfolio/components/DocumentLibrary.tsx` (modify) | Open/Pending cards, loading/error/empty states, always-present groups. |
| `apps/portfolio/content/timeline.ts` (modify) | New `STORYLINE`. |
| `apps/portfolio/content/navigation.ts` (create) | Header tab list and section-to-tab map. |
| `apps/portfolio/components/Navbar.tsx` (modify) | New tabs, Domain items, active-tab highlight. |
| `apps/portfolio/content/site.ts`, `app/layout.tsx`, `components/Footer.tsx`, `content/tools.ts`, `components/research/Build.tsx`, `app/{privacy,terms,support,research}/**/page.tsx` (modify), `app/docs-addon/` (delete), `components/ContactSection.tsx` (modify), `AGENTS.md` (modify) | Marketplace cleanup and contact phone. |

---

### Task 1: Backend link validator, schemas and migration

**Files:**
- Modify: `apps/backend-api/app/schemas/portfolio_document.py`
- Create: `apps/backend-api/migrations/2026-10-11-portfolio-document-links.sql`
- Test: `apps/backend-api/tests/test_portfolio_documents.py`

**Interfaces:**
- Produces: `normalize_document_link(value: str | None) -> str | None` (raises `ValueError`), `MAX_LINK_LENGTH = 500`, `PortfolioDocumentLinkCreate` (fields: `title`, `category`, `document_type`, `submitted_at`, `description`, `file_url`, `is_published`, `sort_order`), `PortfolioDocumentUpdate.file_url`, and `PortfolioDocument` with optional `file_name`, `file_url`, `mime_type`, `size_bytes`. Task 2 imports these.

- [ ] **Step 1: Write the failing validator tests**

In `apps/backend-api/tests/test_portfolio_documents.py`, change the import block at the top:

```python
from app.services.document_storage import InvalidDocument, validate_upload
```

to

```python
from app.schemas.portfolio_document import normalize_document_link
from app.services.document_storage import InvalidDocument, validate_upload
```

Append to the end of the file:

```python
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/backend-api && ./.venv/bin/python -m pytest tests/test_portfolio_documents.py -q`
Expected: collection error `ImportError: cannot import name 'normalize_document_link'`.

- [ ] **Step 3: Replace the schema module**

Replace the whole content of `apps/backend-api/app/schemas/portfolio_document.py` with:

```python
"""Public portfolio document metadata and admin mutation payloads."""

from datetime import date, datetime
from typing import Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, Field, field_validator


DocumentCategory = Literal["document", "presentation", "publication"]

MAX_LINK_LENGTH = 500


def normalize_document_link(value: str | None) -> str | None:
    """Return a clean https URL, or None for "no link yet" (pending).

    The link is shown to every visitor as an <a href>, so anything that is not
    a plain https address (javascript:, data:, http:, relative paths) is
    refused rather than stored.
    """
    if value is None:
        return None
    link = value.strip()
    if not link:
        return None
    if len(link) > MAX_LINK_LENGTH:
        raise ValueError(f"The link must be at most {MAX_LINK_LENGTH} characters.")
    if any(ch.isspace() for ch in link):
        raise ValueError("The link must not contain spaces.")
    parts = urlsplit(link)
    if parts.scheme.lower() != "https" or not parts.netloc:
        raise ValueError("The link must be a full https:// address.")
    return link


def _strip_required(value: str) -> str:
    stripped = value.strip()
    if not stripped:
        raise ValueError("This field cannot be blank.")
    return stripped


class PortfolioDocument(BaseModel):
    id: str
    title: str
    category: DocumentCategory
    document_type: str
    submitted_at: date | None = None
    description: str | None = None
    # Uploaded rows carry all four file fields; a link-only or pending row
    # carries none of them (file_url is None while the item is pending).
    file_name: str | None = None
    file_url: str | None = None
    mime_type: str | None = None
    size_bytes: int | None = None
    is_published: bool = True
    sort_order: int = 0
    created_at: datetime | None = None
    updated_at: datetime | None = None


class PortfolioDocumentLinkCreate(BaseModel):
    """A document that lives elsewhere (Drive, OneDrive, GitHub) and is linked."""

    title: str = Field(min_length=1, max_length=160)
    category: DocumentCategory
    document_type: str = Field(min_length=1, max_length=80)
    submitted_at: date | None = None
    description: str | None = Field(default=None, max_length=500)
    file_url: str | None = None
    is_published: bool = True
    sort_order: int = 0

    @field_validator("title", "document_type")
    @classmethod
    def _clean_text(cls, value: str) -> str:
        return _strip_required(value)

    @field_validator("file_url")
    @classmethod
    def _clean_link(cls, value: str | None) -> str | None:
        return normalize_document_link(value)


class PortfolioDocumentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    category: DocumentCategory | None = None
    document_type: str | None = Field(default=None, min_length=1, max_length=80)
    submitted_at: date | None = None
    description: str | None = Field(default=None, max_length=500)
    # Set a link, change it, or send "" / null to make the item pending again.
    file_url: str | None = None
    is_published: bool | None = None
    sort_order: int | None = None

    @field_validator("file_url")
    @classmethod
    def _clean_link(cls, value: str | None) -> str | None:
        return normalize_document_link(value)
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/backend-api && ./.venv/bin/python -m pytest tests/test_portfolio_documents.py -q`
Expected: all pass (the original 5 plus the new parametrized cases).

- [ ] **Step 5: Write the migration**

Create `apps/backend-api/migrations/2026-10-11-portfolio-document-links.sql`:

```sql
-- A portfolio document may now be just a link (the file is hosted elsewhere),
-- or have no link yet ("pending"). Rows uploaded through Supabase Storage keep
-- every column they have today.
--
-- Rolling back means deleting link-only rows first; the NOT NULL constraints
-- cannot be restored while any row has a NULL file column.

alter table portfolio_documents
    alter column file_name drop not null,
    alter column file_path drop not null,
    alter column file_url drop not null,
    alter column mime_type drop not null,
    alter column size_bytes drop not null;

alter table portfolio_documents
    drop constraint if exists portfolio_documents_size_bytes_check;

alter table portfolio_documents
    add constraint portfolio_documents_size_bytes_check
    check (size_bytes is null or (size_bytes > 0 and size_bytes <= 26214400));
```

- [ ] **Step 6: Commit**

```bash
cd /Users/nisalfonseka/Documents/GitHub/Research/SinhalaJournalLLM
git add apps/backend-api/app/schemas/portfolio_document.py apps/backend-api/migrations/2026-10-11-portfolio-document-links.sql apps/backend-api/tests/test_portfolio_documents.py
git commit -m "feat(backend): allow portfolio documents to be links or pending" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Backend admin link endpoints

**Files:**
- Modify: `apps/backend-api/app/api/v1/admin/portfolio_documents.py`
- Test: `apps/backend-api/tests/test_portfolio_documents.py`

**Interfaces:**
- Consumes: `PortfolioDocumentLinkCreate`, `PortfolioDocumentUpdate.file_url`, optional file fields (Task 1).
- Produces: `POST /api/v1/admin/portfolio-documents/link` (JSON body = `PortfolioDocumentLinkCreate`, 201 with `PortfolioDocument`), `PATCH /{id}` accepting `file_url`, `DELETE /{id}` that skips storage when `file_path` is null. Task 3's `createPortfolioDocumentLink` calls the POST.

- [ ] **Step 1: Write the failing tests**

Append to `apps/backend-api/tests/test_portfolio_documents.py`:

```python
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
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd apps/backend-api && ./.venv/bin/python -m pytest tests/test_portfolio_documents.py -q`
Expected: the new link, patch and delete tests FAIL (405/404 for `/link`, `KeyError`/`TypeError` for delete with `file_path` None). The public-list test may already pass after Task 1.

- [ ] **Step 3: Implement the endpoints**

In `apps/backend-api/app/api/v1/admin/portfolio_documents.py`:

Replace the schema import block

```python
from app.schemas.portfolio_document import (
    DocumentCategory,
    PortfolioDocument,
    PortfolioDocumentUpdate,
)
```

with

```python
from app.schemas.portfolio_document import (
    DocumentCategory,
    PortfolioDocument,
    PortfolioDocumentLinkCreate,
    PortfolioDocumentUpdate,
)
```

Insert this endpoint directly after the `upload_document` function (before `@router.patch("/{document_id}", ...)`):

```python
@router.post("/link", response_model=PortfolioDocument, status_code=status.HTTP_201_CREATED)
async def create_link_document(
    payload: PortfolioDocumentLinkCreate,
    request: Request,
    admin: AuthUser = Depends(require_admin),
) -> PortfolioDocument:
    """Add a document that is hosted elsewhere, or a placeholder with no link yet."""
    row = {
        "title": payload.title,
        "category": payload.category,
        "document_type": payload.document_type,
        "submitted_at": payload.submitted_at.isoformat() if payload.submitted_at else None,
        "description": payload.description.strip() if payload.description else None,
        "file_name": None,
        "file_path": None,
        "file_url": payload.file_url,
        "mime_type": None,
        "size_bytes": None,
        "is_published": payload.is_published,
        "sort_order": payload.sort_order,
        "created_by": admin.id,
    }

    created = await portfolio_document_repository.create(row)

    await audit_repository.record(
        admin,
        "portfolio_document.create",
        target_type="portfolio_document",
        target_id=created["id"],
        after=row,
        ip_hash=hash_ip(client_ip(request)),
    )
    return PortfolioDocument(**created)
```

In `delete_document`, replace

```python
    try:
        await document_storage.delete_public_document(before["file_path"])
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The stored file could not be deleted. Nothing was changed.",
        ) from exc
```

with

```python
    # Link-only and pending rows have no stored object to remove.
    if before.get("file_path"):
        try:
            await document_storage.delete_public_document(before["file_path"])
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="The stored file could not be deleted. Nothing was changed.",
            ) from exc
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd apps/backend-api && ./.venv/bin/python -m pytest tests/test_portfolio_documents.py -q`
Expected: all pass.

- [ ] **Step 5: Run the whole backend suite for regressions**

Run: `cd apps/backend-api && ./.venv/bin/python -m pytest -q`
Expected: no new failures versus the baseline (note any pre-existing failures in the report rather than "fixing" them).

- [ ] **Step 6: Commit**

```bash
cd /Users/nisalfonseka/Documents/GitHub/Research/SinhalaJournalLLM
git add apps/backend-api/app/api/v1/admin/portfolio_documents.py apps/backend-api/tests/test_portfolio_documents.py
git commit -m "feat(backend): add link-based portfolio documents to the admin API" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Admin UI for links

**Files:**
- Create: `apps/web-app/src/admin/documentLink.js`
- Test: `apps/web-app/src/admin/documentLink.test.js`
- Modify: `apps/web-app/src/admin/adminApi.js:93-108`
- Modify: `apps/web-app/src/admin/pages/PortfolioDocuments.jsx`

**Interfaces:**
- Consumes: `POST /admin/portfolio-documents/link`, `PATCH /admin/portfolio-documents/{id}` with `file_url` (Task 2).
- Produces: `parseDocumentLink(raw) -> { value: string | null, error: string | null }`, `linkHost(raw) -> string | null`, `createPortfolioDocumentLink(body)`.

- [ ] **Step 1: Write the failing helper tests**

Create `apps/web-app/src/admin/documentLink.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_LINK_LENGTH, linkHost, parseDocumentLink } from './documentLink.js';

test('a blank link is valid and means pending', () => {
  assert.deepEqual(parseDocumentLink(''), { value: null, error: null });
  assert.deepEqual(parseDocumentLink('   '), { value: null, error: null });
  assert.deepEqual(parseDocumentLink(null), { value: null, error: null });
  assert.deepEqual(parseDocumentLink(undefined), { value: null, error: null });
});

test('an https link is accepted and trimmed', () => {
  assert.deepEqual(
    parseDocumentLink('  https://drive.google.com/file/d/abc/view  '),
    { value: 'https://drive.google.com/file/d/abc/view', error: null },
  );
});

test('anything that is not a full https address is rejected', () => {
  for (const bad of [
    'http://example.com/a.pdf',
    'javascript:alert(1)',
    'data:text/html;base64,AAAA',
    '/documents/a.pdf',
    'ftp://example.com/a.pdf',
    'https://',
    'https:example.com',
    'drive.google.com/file/d/abc',
  ]) {
    const result = parseDocumentLink(bad);
    assert.equal(result.value, null, bad);
    assert.ok(result.error, bad);
  }
});

test('spaces and over-long links are rejected', () => {
  assert.ok(parseDocumentLink('https://exa mple.com/a.pdf').error);
  assert.ok(parseDocumentLink(`https://example.com/${'a'.repeat(MAX_LINK_LENGTH)}`).error);
});

test('linkHost shows the host without www, or null with no valid link', () => {
  assert.equal(linkHost('https://www.example.com/a.pdf'), 'example.com');
  assert.equal(linkHost('https://drive.google.com/file/d/abc/view'), 'drive.google.com');
  assert.equal(linkHost(''), null);
  assert.equal(linkHost(null), null);
  assert.equal(linkHost('javascript:alert(1)'), null);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/web-app && node --test src/admin/documentLink.test.js`
Expected: FAIL, `Cannot find module './documentLink.js'`.

- [ ] **Step 3: Implement the helper**

Create `apps/web-app/src/admin/documentLink.js`:

```js
/**
 * Link rules for portfolio documents. These mirror the backend validator
 * (apps/backend-api/app/schemas/portfolio_document.py), so the form can
 * explain a problem before the request is sent. The backend stays the
 * authority.
 */

export const MAX_LINK_LENGTH = 500;

/**
 * Empty input is valid and means "no link yet" (the item shows as Pending).
 *
 * @param {unknown} raw
 * @returns {{ value: string | null, error: string | null }}
 */
export function parseDocumentLink(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { value: null, error: null };

  if (text.length > MAX_LINK_LENGTH) {
    return { value: null, error: `The link must be at most ${MAX_LINK_LENGTH} characters.` };
  }
  if (/\s/.test(text)) {
    return { value: null, error: 'The link must not contain spaces.' };
  }
  // A regex first: `new URL('https:example.com')` is accepted leniently.
  if (!/^https:\/\//i.test(text)) {
    return { value: null, error: 'The link must be a full https:// address.' };
  }
  try {
    const url = new URL(text);
    if (!url.hostname) throw new Error('no host');
  } catch {
    return { value: null, error: 'The link must be a full https:// address.' };
  }
  return { value: text, error: null };
}

/**
 * Host shown in the admin table, or null when there is no valid link.
 *
 * @param {unknown} raw
 * @returns {string | null}
 */
export function linkHost(raw) {
  const { value } = parseDocumentLink(raw);
  if (!value) return null;
  return new URL(value).hostname.replace(/^www\./, '');
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/web-app && node --test src/admin/documentLink.test.js`
Expected: 5 tests pass.

- [ ] **Step 5: Add the API call**

In `apps/web-app/src/admin/adminApi.js`, directly after `uploadPortfolioDocument`:

```js
export function uploadPortfolioDocument(formData) {
  return request('/admin/portfolio-documents', { method: 'POST', formData });
}
```

add:

```js
export function createPortfolioDocumentLink(body) {
  return request('/admin/portfolio-documents/link', { method: 'POST', body });
}
```

(`uploadPortfolioDocument` stays; the page just stops using it.)

- [ ] **Step 6: Rewrite the admin page**

Replace the whole content of `apps/web-app/src/admin/pages/PortfolioDocuments.jsx` with:

```jsx
import { useEffect, useState } from 'react';
import { ExternalLink, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import {
  createPortfolioDocumentLink,
  deletePortfolioDocument,
  listPortfolioDocuments,
  updatePortfolioDocument,
} from '../adminApi';
import ConfirmDialog from '../ConfirmDialog';
import { linkHost, parseDocumentLink } from '../documentLink';

const INPUT = `w-full px-3 py-2 text-[13px] rounded-md border bg-background text-foreground
  placeholder:text-muted-foreground focus:outline-none focus:ring-2`;

const INITIAL = {
  title: '',
  category: 'document',
  document_type: 'Group',
  submitted_at: '',
  description: '',
  file_url: '',
  sort_order: 0,
  is_published: true,
};

function toForm(row) {
  return {
    title: row.title,
    category: row.category,
    document_type: row.document_type,
    submitted_at: row.submitted_at || '',
    description: row.description || '',
    file_url: row.file_url || '',
    sort_order: row.sort_order ?? 0,
    is_published: row.is_published,
  };
}

export default function PortfolioDocuments() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(INITIAL);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [dialogError, setDialogError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await listPortfolioDocuments();
        if (active) {
          setRows(data);
          setError(null);
        }
      } catch (err) {
        if (active) setError(err.message);
      }
    })();
    return () => { active = false; };
  }, [refreshKey]);

  const resetForm = () => {
    setForm(INITIAL);
    setEditingId(null);
  };

  const startEdit = (row) => {
    setForm(toForm(row));
    setEditingId(row.id);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (event) => {
    event.preventDefault();
    const link = parseDocumentLink(form.file_url);
    if (link.error) {
      setError(link.error);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const body = {
        title: form.title.trim(),
        category: form.category,
        document_type: form.document_type.trim(),
        submitted_at: form.submitted_at || null,
        description: form.description.trim() || null,
        file_url: link.value,
        is_published: form.is_published,
        sort_order: Number(form.sort_order) || 0,
      };
      if (editingId) {
        await updatePortfolioDocument(editingId, body);
      } else {
        await createPortfolioDocumentLink(body);
      }
      resetForm();
      setRefreshKey((key) => key + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const togglePublished = async (row) => {
    setBusy(true);
    setError(null);
    try {
      await updatePortfolioDocument(row.id, { is_published: !row.is_published });
      setRefreshKey((key) => key + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    setBusy(true);
    setDialogError(null);
    try {
      await deletePortfolioDocument(pendingDelete.id);
      if (editingId === pendingDelete.id) resetForm();
      setPendingDelete(null);
      setRefreshKey((key) => key + 1);
    } catch (err) {
      setDialogError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-[20px] font-semibold text-foreground">Portfolio documents</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Add links to the reports, presentations, and publications shown on sin-ai.app.
          Host each file anywhere (Google Drive, OneDrive, GitHub) and paste its public
          sharing link. Leave the link empty to show the item as Pending.
        </p>
      </header>

      {error && (
        <p role="alert" className="text-[13px] text-destructive bg-accent rounded-md px-4 py-3 mb-4">
          {error}
        </p>
      )}

      <form
        onSubmit={submit}
        className="rounded-lg border bg-card p-5 mb-6 grid gap-4 sm:grid-cols-2"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="sm:col-span-2">
          <p className="text-[13px] font-semibold text-card-foreground">
            {editingId ? 'Edit document' : 'Add a document'}
          </p>
        </div>

        <div>
          <label htmlFor="document-title" className="block text-[12px] font-semibold text-card-foreground mb-1.5">
            Title
          </label>
          <input
            id="document-title"
            required
            maxLength={160}
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            className={INPUT}
            style={{ borderColor: 'var(--input)' }}
          />
        </div>

        <div>
          <label htmlFor="document-link" className="block text-[12px] font-semibold text-card-foreground mb-1.5">
            Link <span className="font-normal text-muted-foreground">(empty = Pending)</span>
          </label>
          <input
            id="document-link"
            type="url"
            inputMode="url"
            maxLength={500}
            value={form.file_url}
            onChange={(event) => setForm({ ...form, file_url: event.target.value })}
            placeholder="https://drive.google.com/file/d/…"
            className={INPUT}
            style={{ borderColor: 'var(--input)' }}
          />
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            Must start with https:// and be viewable without signing in.
          </p>
        </div>

        <div>
          <label htmlFor="document-category" className="block text-[12px] font-semibold text-card-foreground mb-1.5">
            Section
          </label>
          <select
            id="document-category"
            value={form.category}
            onChange={(event) => setForm({ ...form, category: event.target.value })}
            className={INPUT}
            style={{ borderColor: 'var(--input)' }}
          >
            <option value="document">Documents</option>
            <option value="presentation">Presentations</option>
            <option value="publication">Publications</option>
          </select>
        </div>

        <div>
          <label htmlFor="document-type" className="block text-[12px] font-semibold text-card-foreground mb-1.5">
            Type label
          </label>
          <input
            id="document-type"
            required
            maxLength={80}
            value={form.document_type}
            onChange={(event) => setForm({ ...form, document_type: event.target.value })}
            placeholder="Group, Individual, Research paper…"
            className={INPUT}
            style={{ borderColor: 'var(--input)' }}
          />
        </div>

        <div>
          <label htmlFor="document-date" className="block text-[12px] font-semibold text-card-foreground mb-1.5">
            Submitted date
          </label>
          <input
            id="document-date"
            type="date"
            value={form.submitted_at}
            onChange={(event) => setForm({ ...form, submitted_at: event.target.value })}
            className={INPUT}
            style={{ borderColor: 'var(--input)' }}
          />
        </div>

        <div>
          <label htmlFor="document-order" className="block text-[12px] font-semibold text-card-foreground mb-1.5">
            Sort order
          </label>
          <input
            id="document-order"
            type="number"
            value={form.sort_order}
            onChange={(event) => setForm({ ...form, sort_order: event.target.value })}
            className={INPUT}
            style={{ borderColor: 'var(--input)' }}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="document-description" className="block text-[12px] font-semibold text-card-foreground mb-1.5">
            Description <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <textarea
            id="document-description"
            maxLength={500}
            rows={3}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            className={INPUT}
            style={{ borderColor: 'var(--input)' }}
          />
        </div>

        <div className="sm:col-span-2 flex items-center justify-between gap-4">
          <label className="flex items-center gap-2 text-[13px] text-card-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(event) => setForm({ ...form, is_published: event.target.checked })}
            />
            Publish on the portfolio
          </label>
          <div className="flex items-center gap-2">
            {editingId && (
              <button
                type="button"
                disabled={busy}
                onClick={resetForm}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-semibold
                  border text-card-foreground hover:bg-muted disabled:opacity-50 cursor-pointer"
                style={{ borderColor: 'var(--border)' }}
              >
                <X size={14} /> Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-semibold
                bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer transition-opacity"
            >
              {editingId ? <Save size={14} /> : <Plus size={14} />}
              {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add document'}
            </button>
          </div>
        </div>
      </form>

      <div className="rounded-lg border overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full min-w-[760px] text-[13px]">
          <thead className="bg-muted">
            <tr className="text-left text-muted-foreground">
              <th className="px-4 py-2.5 font-semibold">Title</th>
              <th className="px-4 py-2.5 font-semibold">Section</th>
              <th className="px-4 py-2.5 font-semibold">Date</th>
              <th className="px-4 py-2.5 font-semibold">Link</th>
              <th className="px-4 py-2.5 font-semibold">Published</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="bg-card">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No documents added yet.
                </td>
              </tr>
            ) : rows.map((row) => {
              const host = linkHost(row.file_url);
              return (
                <tr key={row.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-card-foreground">{row.title}</p>
                    <p className="text-[11.5px] text-muted-foreground mt-0.5">{row.document_type}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{row.category}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.submitted_at || '—'}</td>
                  <td className="px-4 py-3">
                    {host ? (
                      <span className="text-muted-foreground">{host}</span>
                    ) : (
                      <span className="rounded-full bg-muted px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => togglePublished(row)}
                      className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold cursor-pointer disabled:opacity-50 ${
                        row.is_published ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {row.is_published ? 'Published' : 'Draft'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(row)}
                        aria-label={`Edit ${row.title}`}
                        className="p-1.5 rounded-md text-muted-foreground hover:bg-muted cursor-pointer"
                      >
                        <Pencil size={14} />
                      </button>
                      {host && (
                        <a
                          href={row.file_url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open ${row.title}`}
                          className="p-1.5 rounded-md text-muted-foreground hover:bg-muted"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setPendingDelete(row)}
                        aria-label={`Delete ${row.title}`}
                        className="p-1.5 rounded-md text-destructive hover:bg-muted cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`Delete “${pendingDelete?.title}”?`}
        description="This removes the entry from the public portfolio. A file hosted elsewhere is not touched."
        current={pendingDelete?.file_url || 'Pending (no link)'}
        next="deleted"
        confirmLabel="Delete document"
        destructive
        busy={busy}
        error={dialogError}
        onConfirm={confirmDelete}
        onCancel={() => {
          setPendingDelete(null);
          setDialogError(null);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 7: Lint, test and build the admin app**

Run:
```bash
cd apps/web-app && npm test && npm run lint && npm run build
```
Expected: tests pass, no new lint errors in the changed files, build succeeds. If `lucide-react` lacks an icon name (`Pencil`, `Plus`, `Save`, `X`), the build names it; swap for the closest exported icon.

- [ ] **Step 8: Commit**

```bash
cd /Users/nisalfonseka/Documents/GitHub/Research/SinhalaJournalLLM
git add apps/web-app/src/admin/documentLink.js apps/web-app/src/admin/documentLink.test.js apps/web-app/src/admin/adminApi.js apps/web-app/src/admin/pages/PortfolioDocuments.jsx
git commit -m "feat(admin): manage portfolio documents by link, with edit and pending" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Portfolio document library

**Files:**
- Modify: `apps/portfolio/content/documents.ts`
- Modify: `apps/portfolio/components/DocumentLibrary.tsx`

**Interfaces:**
- Consumes: public `GET {API_BASE}/portfolio/documents` returning rows with nullable `file_url` (Task 2).
- Produces: section ids `library`, `documents`, `presentations`, `publications` (the header in Task 6 targets `#documents` and `#presentations`, which must always exist); `openableUrl(value)`.

- [ ] **Step 1: Replace the documents content module**

Replace the whole content of `apps/portfolio/content/documents.ts` with:

```ts
export type DocumentCategory = "document" | "presentation" | "publication";

export interface PortfolioDocument {
  id: string;
  title: string;
  category: DocumentCategory;
  document_type: string;
  submitted_at: string | null;
  description: string | null;
  /** Public link to the file, hosted anywhere. Null while the item is pending. */
  file_url: string | null;
  is_published: boolean;
  sort_order: number;
}

/**
 * The link to open, or null. Only plain https links are opened; anything
 * else (javascript:, data:, http:, relative paths) is treated as "no link
 * yet", even though the admin API already refuses to store such values.
 */
export function openableUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  return /^https:\/\/[^\s/]+\S*$/i.test(url) ? url : null;
}
```

- [ ] **Step 2: Replace the library component**

Replace the whole content of `apps/portfolio/components/DocumentLibrary.tsx` with:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FileText, Presentation, ScrollText } from "lucide-react";
import { Section, SectionHeader } from "@/components/ui";
import {
  openableUrl,
  type DocumentCategory,
  type PortfolioDocument,
} from "@/content/documents";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "https://backend.sin-ai.app/api/v1").replace(/\/+$/, "");

// Documents and Presentations always render, so the header tabs that point at
// #documents and #presentations have somewhere to land even when empty.
const GROUPS: Array<{
  category: DocumentCategory;
  id: string;
  label: string;
  icon: typeof FileText;
  alwaysShow: boolean;
  empty: string;
}> = [
  { category: "document", id: "documents", label: "Documents", icon: FileText, alwaysShow: true, empty: "No documents published yet." },
  { category: "presentation", id: "presentations", label: "Presentations", icon: Presentation, alwaysShow: true, empty: "No presentations published yet." },
  { category: "publication", id: "publications", label: "Publications", icon: ScrollText, alwaysShow: false, empty: "" },
];

type Status = "loading" | "ready" | "error";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export default function DocumentLibrary() {
  const [documents, setDocuments] = useState<PortfolioDocument[]>([]);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/portfolio/documents`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Document service returned ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) throw new Error("Unexpected document list");
        setDocuments(data);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("error");
      });
    return () => controller.abort();
  }, []);

  const sorted = useMemo(
    () => [...documents].sort((a, b) => a.sort_order - b.sort_order),
    [documents],
  );

  return (
    <Section id="library">
      <SectionHeader title="Research library" />

      {status === "loading" && (
        <p role="status" className="mb-8 text-base text-[#5f5c56]">
          Loading documents…
        </p>
      )}
      {status === "error" && (
        <p role="alert" className="mb-8 text-base text-[#5f5c56]">
          Documents are temporarily unavailable. Please try again later.
        </p>
      )}

      <div className="space-y-16">
        {GROUPS.map(({ category, id, label, icon: Icon, alwaysShow, empty }) => {
          const rows = sorted.filter((item) => item.category === category);
          if (!alwaysShow && rows.length === 0) return null;
          return (
            <section key={category} id={id} className="scroll-mt-28">
              <div className="mb-6 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-crimson-tint text-crimson">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <h3 className="font-display text-3xl font-bold text-black-main">{label}</h3>
              </div>
              {rows.length === 0 ? (
                status === "ready" && <p className="text-base text-[#5f5c56]">{empty}</p>
              ) : (
                <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {rows.map((item) => {
                    const href = openableUrl(item.file_url);
                    return (
                      <li key={item.id} className="flex min-h-64 flex-col rounded-3xl border border-line bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                        <div className="flex items-center justify-between gap-3">
                          <span className="rounded-full bg-panel-bg px-3 py-1 text-xs font-semibold text-[#5f5c56]">
                            {item.document_type}
                          </span>
                          {item.submitted_at && (
                            <span className="text-xs text-text-muted">{formatDate(item.submitted_at)}</span>
                          )}
                        </div>
                        <h4 className="mt-5 font-display text-xl font-bold leading-snug text-black-main">{item.title}</h4>
                        {item.description && (
                          <p className="mt-3 text-sm leading-relaxed text-[#5f5c56]">{item.description}</p>
                        )}
                        <div className="mt-auto flex items-center gap-3 pt-6">
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 rounded-full bg-black-main px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-crimson"
                            >
                              Open <ExternalLink aria-hidden="true" className="h-4 w-4" />
                            </a>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-line px-4 py-2 text-sm font-semibold text-[#5f5c56]">
                              Pending
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </Section>
  );
}
```

- [ ] **Step 3: Confirm nothing else used the removed exports**

Run: `cd apps/portfolio && grep -rn "BUNDLED_DOCUMENTS\|size_bytes\|file_name" app components content`
Expected: no output.

- [ ] **Step 4: Lint**

Run: `cd apps/portfolio && npx eslint components/DocumentLibrary.tsx content/documents.ts`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/nisalfonseka/Documents/GitHub/Research/SinhalaJournalLLM
git add apps/portfolio/content/documents.ts apps/portfolio/components/DocumentLibrary.tsx
git commit -m "feat(portfolio): show documents as links with pending and empty states" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

(Behavioural verification of this task happens in Task 8 against a mock API.)

---

### Task 5: Milestones content

**Files:**
- Modify: `apps/portfolio/content/timeline.ts:59-143`

**Interfaces:**
- Produces: `STORYLINE_PERIOD`, `STORYLINE: StoryItem[]` (same shape as before). `components/ui/timeline.tsx` reads both unchanged; `TIMELINE` (lines 1-57, used by `/research`) is untouched.

- [ ] **Step 1: Confirm the boundary**

Run: `cd apps/portfolio && sed -n 57,59p content/timeline.ts`
Expected: line 57 is `];`, line 58 is blank, line 59 is `/**`.

- [ ] **Step 2: Replace lines 59 to the end**

```bash
cd apps/portfolio
sed -i '' '59,$d' content/timeline.ts
cat >> content/timeline.ts <<'EOF'
/**
 * Homepage storyline, October 2025 to December 2026, in date order. Initiation,
 * implementation stage, final presentation and publication are from the
 * project owner; the proposal, PP1, PP2 and paper entries use the dates the
 * team recorded for those submissions; the Top 10 finalist entry is
 * documented in `components/AiExpo.tsx`. PP2's exact day is not recorded, so
 * it is ordered by month only.
 */
export interface StoryItem {
  id: string;
  when: string;
  title: string;
  content: string;
}

export const STORYLINE_PERIOD = "October 2025 — December 2026";

export const STORYLINE: StoryItem[] = [
  {
    id: "2025-10-initiation",
    when: "October 2025",
    title: "Initiation",
    content:
      "The research project is initiated and its initial scope for R26-SE-037 set out.",
  },
  {
    id: "2026-03-proposal",
    when: "March 2026",
    title: "Proposal",
    content:
      "Four individual proposal reports (12–13 March) and the proposal presentation (16 March).",
  },
  {
    id: "2026-04-implementation",
    when: "April 2026",
    title: "Implementation stage",
    content:
      "Building the four task components: grammar checker, headline generator, news summarizer and style rewriter.",
  },
  {
    id: "2026-05-pp1",
    when: "May 2026",
    title: "Progress Presentation 1 (PP1)",
    content:
      "Component status, architecture and the evaluation plan (11 May).",
  },
  {
    id: "2026-09-pp2",
    when: "September 2026",
    title: "Progress Presentation 2 (PP2)",
    content:
      "Updated datasets, four task adapters and product progress.",
  },
  {
    id: "2026-09-paper",
    when: "3 September 2026",
    title: "Research paper completed",
    content: "The SinhalaJournal-LLM research paper completed.",
  },
  {
    id: "2026-09-top10",
    when: "25 September 2026",
    title: "Top 10 finalist",
    content:
      "Reached the top 10 in the University AI Innovation category at the CodeBlast Hackathon Challenge 2026 (National AI Expo, Sri Lanka AI Week), SLT Auditorium, and received certificates.",
  },
  {
    id: "2026-10-final",
    when: "October 2026",
    title: "Final presentation",
    content: "Final project presentation.",
  },
  {
    id: "2026-12-publication",
    when: "December 2026",
    title: "Research publication",
    content: "Planned publication of the research.",
  },
];
EOF
```

- [ ] **Step 3: Typecheck and lint**

Run: `cd apps/portfolio && npx tsc --noEmit && npx eslint content/timeline.ts`
Expected: no errors. (`TIMELINE` is still exported, so `components/research/Build.tsx` is unaffected.)

- [ ] **Step 4: Commit**

```bash
cd /Users/nisalfonseka/Documents/GitHub/Research/SinhalaJournalLLM
git add apps/portfolio/content/timeline.ts
git commit -m "feat(portfolio): replace homepage milestones with the project phases" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Header tabs and active-tab highlight

**Files:**
- Create: `apps/portfolio/content/navigation.ts`
- Modify: `apps/portfolio/components/Navbar.tsx` (full replacement)

**Interfaces:**
- Consumes: section ids `hero`, `about`, `where`, `technologies`, `milestones`, `recognition`, `library`, `documents`, `presentations`, `publications`, `team`, `contact` on the home page (all exist; `documents`/`presentations` always render after Task 4); `SCOPE_SECTIONS` from `content/projectScope`.
- Produces: `NavLink`, `HOME_TAB`, `TABS`, `DOMAIN_TAB_ID`, `SECTION_TAB`.

- [ ] **Step 1: Create the navigation config**

Create `apps/portfolio/content/navigation.ts`:

```ts
/**
 * Header tabs, after the SLIIT project-website guideline: Home, Domain,
 * Milestones, Documents, Presentations, About us, Contact us. The Domain tab
 * is a dropdown built in the Navbar, so it sits between HOME_TAB and TABS.
 * Every target is a section of the one-page home (or /project-scope).
 */
export interface NavLink {
  id: string;
  label: string;
  href: string;
}

export const HOME_TAB: NavLink = { id: "home", label: "Home", href: "/#hero" };

export const DOMAIN_TAB_ID = "domain";

export const TABS: NavLink[] = [
  { id: "milestones", label: "Milestones", href: "/#milestones" },
  { id: "documents", label: "Documents", href: "/#documents" },
  { id: "presentations", label: "Presentations", href: "/#presentations" },
  { id: "about", label: "About us", href: "/#team" },
  { id: "contact", label: "Contact us", href: "/#contact" },
];

/**
 * Which tab each home-page section belongs to, for the active-tab highlight.
 * Sections that are not listed (for example #achievements) highlight no tab.
 */
export const SECTION_TAB: Record<string, string> = {
  hero: "home",
  about: "home",
  where: "home",
  technologies: "home",
  milestones: "milestones",
  recognition: "milestones",
  library: "documents",
  documents: "documents",
  presentations: "presentations",
  publications: "presentations",
  team: "about",
  contact: "contact",
};
```

- [ ] **Step 2: Replace the Navbar**

Replace the whole content of `apps/portfolio/components/Navbar.tsx` with:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, ChevronDown, Menu, X } from "lucide-react";
import { SITE } from "@/content/site";
import { SCOPE_SECTIONS } from "@/content/projectScope";
import { DOMAIN_TAB_ID, HOME_TAB, SECTION_TAB, TABS } from "@/content/navigation";

// The Domain items are sections of /project-scope, plus "Technologies used",
// which lives on the home page.
const DOMAIN_LINKS = [
  ...SCOPE_SECTIONS.map((s) => ({ label: s.label, href: `/project-scope#${s.id}` })),
  { label: "Technologies used", href: "/#technologies" },
];

// Vertical point, in px from the top of the viewport, sampled to decide
// whether the header is sitting over a dark or a light section.
const PROBE_Y = 36;

// A section counts as the current one once it reaches this line, just under
// the header. An anchor jump lands a section's top at about 80px.
const ACTIVE_PROBE_Y = 120;

/** True when the section under the header is marked data-nav-theme="dark". */
function isOverDark() {
  return Array.from(
    document.querySelectorAll<HTMLElement>('[data-nav-theme="dark"]'),
  ).some((el) => {
    const r = el.getBoundingClientRect();
    return r.top <= PROBE_Y && r.bottom > PROBE_Y;
  });
}

/**
 * Id of the header tab whose home-page section is under the active probe
 * line, or null. When sections nest (#documents inside #library) the
 * smallest one wins.
 */
function useScrollTab(enabled: boolean) {
  const [tab, setTab] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      let best: { tab: string; height: number } | null = null;
      for (const [sectionId, tabId] of Object.entries(SECTION_TAB)) {
        const el = document.getElementById(sectionId);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (
          r.top <= ACTIVE_PROBE_Y &&
          r.bottom > ACTIVE_PROBE_Y &&
          (!best || r.height < best.height)
        ) {
          best = { tab: tabId, height: r.height };
        }
      }
      setTab(best ? best.tab : null);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [enabled]);

  return tab;
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(true);
  const [scopeOpen, setScopeOpen] = useState(false);
  const scopeRef = useRef<HTMLDivElement>(null);

  const pathname = (usePathname() ?? "/").replace(/\/$/, "") || "/";
  const scrollTab = useScrollTab(pathname === "/");
  const activeTab =
    pathname === "/" ? scrollTab : pathname === "/project-scope" ? DOMAIN_TAB_ID : null;

  // Close the Domain menu on Escape or a click outside it.
  useEffect(() => {
    if (!scopeOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setScopeOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (!scopeRef.current?.contains(e.target as Node)) setScopeOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [scopeOpen]);

  // Track the tone of the section under the header.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setDark(isOverDark());
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Close the mobile menu with Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Only the pill carries a background; the header itself stays clear.
  const pill = dark
    ? "bg-black/30 ring-white/15 backdrop-blur-xl"
    : "bg-page-bg/70 ring-black/10 backdrop-blur-xl";
  const link = dark
    ? "text-white/80 hover:text-white"
    : "text-black-main/75 hover:text-black-main";
  const current = dark
    ? "bg-white/15 text-white"
    : "bg-black/5 text-black-main";
  const cta = dark
    ? "bg-white text-neutral-900 hover:bg-white/90"
    : "bg-black-main text-white hover:bg-crimson";
  const focus = dark ? "focus-visible:outline-white" : "focus-visible:outline-black-main";

  const tabClass = (id: string) =>
    `rounded-full px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 ${focus} ${
      activeTab === id ? current : link
    }`;
  const mobileClass = (id: string) =>
    `block rounded-2xl px-4 py-3 text-base font-medium transition-colors hover:bg-white/10 hover:text-white ${
      activeTab === id ? "bg-white/10 text-white" : "text-white/85"
    }`;

  return (
    // The header strip is see-through; only its pieces take clicks.
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50">
      <div className="mx-auto flex h-[72px] w-full max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          aria-label={`${SITE.brand} home`}
          className={`pointer-events-auto font-gwen text-[30px] font-light leading-none tracking-tight transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-4 ${focus} ${dark ? "text-white" : "text-black-main"}`}
        >
          SinAi
        </Link>

        <nav aria-label="Main" className="pointer-events-auto hidden items-center lg:flex">
          <div
            className={`flex items-center gap-1 rounded-full px-1 py-1 ring-1 transition-colors duration-300 ${pill}`}
          >
            <Link
              href={HOME_TAB.href}
              aria-current={activeTab === HOME_TAB.id ? "true" : undefined}
              className={tabClass(HOME_TAB.id)}
            >
              {HOME_TAB.label}
            </Link>

            <div
              ref={scopeRef}
              className="relative"
              onMouseEnter={() => setScopeOpen(true)}
              onMouseLeave={() => setScopeOpen(false)}
            >
              <button
                type="button"
                // Hover already opens it, so a click only ever opens (a
                // toggle would close it again); Escape or an outside click closes.
                onClick={() => setScopeOpen(true)}
                aria-expanded={scopeOpen}
                aria-controls="scope-menu"
                aria-current={activeTab === DOMAIN_TAB_ID ? "true" : undefined}
                className={`inline-flex items-center gap-1 ${tabClass(DOMAIN_TAB_ID)}`}
              >
                Domain
                <ChevronDown
                  aria-hidden="true"
                  className={`h-3.5 w-3.5 transition-transform ${scopeOpen ? "rotate-180" : ""}`}
                />
              </button>
              {scopeOpen && (
                // pt-2 bridges the gap so the menu stays open while the
                // pointer moves down into it.
                <div id="scope-menu" className="absolute left-0 top-full w-72 pt-2">
                  <ul className="overflow-hidden rounded-2xl border border-black/10 bg-white py-1 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.3)]">
                    {DOMAIN_LINKS.map((item) => (
                      <li key={item.href} className="border-b border-black/5 last:border-0">
                        <Link
                          href={item.href}
                          onClick={() => setScopeOpen(false)}
                          className="block px-4 py-3 text-[15px] font-medium text-black-main transition-colors hover:bg-crimson-tint hover:text-crimson"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {TABS.map((t) => (
              <Link
                key={t.id}
                href={t.href}
                aria-current={activeTab === t.id ? "true" : undefined}
                className={tabClass(t.id)}
              >
                {t.label}
              </Link>
            ))}
            <a
              href={SITE.appUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`ml-1 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${focus} ${cta}`}
            >
              Try SinAi
              <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </a>
          </div>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          className={`pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full ring-1 transition-colors focus-visible:outline-2 lg:hidden ${focus} ${pill} ${dark ? "text-white/90" : "text-black-main"}`}
        >
          {open ? (
            <X aria-hidden="true" className="h-5 w-5" />
          ) : (
            <Menu aria-hidden="true" className="h-5 w-5" />
          )}
        </button>
      </div>

      {open && (
        <nav
          id="mobile-menu"
          aria-label="Mobile"
          className="pointer-events-auto mx-3 rounded-3xl border border-white/15 bg-[#151515]/95 p-3 shadow-2xl backdrop-blur-2xl lg:hidden"
        >
          <ul className="flex flex-col">
            <li>
              <Link
                href={HOME_TAB.href}
                onClick={() => setOpen(false)}
                aria-current={activeTab === HOME_TAB.id ? "true" : undefined}
                className={mobileClass(HOME_TAB.id)}
              >
                {HOME_TAB.label}
              </Link>
            </li>
            <li>
              <Link
                href="/project-scope"
                onClick={() => setOpen(false)}
                aria-current={activeTab === DOMAIN_TAB_ID ? "true" : undefined}
                className={mobileClass(DOMAIN_TAB_ID)}
              >
                Domain
              </Link>
              <ul className="mb-1 ml-4 border-l border-white/10 pl-2">
                {DOMAIN_LINKS.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="block rounded-xl px-3 py-2 text-sm text-white/65 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
            {TABS.map((t) => (
              <li key={t.id}>
                <Link
                  href={t.href}
                  onClick={() => setOpen(false)}
                  aria-current={activeTab === t.id ? "true" : undefined}
                  className={mobileClass(t.id)}
                >
                  {t.label}
                </Link>
              </li>
            ))}
            <li className="mt-2 border-t border-white/10 pt-3">
              <a
                href={SITE.appUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-base font-medium text-neutral-900 transition-colors hover:bg-white/90"
              >
                Try SinAi
                <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
              </a>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `cd apps/portfolio && npx tsc --noEmit && npx eslint components/Navbar.tsx content/navigation.ts`
Expected: no errors. (The section-tracking effect calls `update()` synchronously like the existing theme effect; if the project's lint flags it, mirror how the theme effect passes rather than adding a disable comment.)

- [ ] **Step 4: Commit**

```bash
cd /Users/nisalfonseka/Documents/GitHub/Research/SinhalaJournalLLM
git add apps/portfolio/content/navigation.ts apps/portfolio/components/Navbar.tsx
git commit -m "feat(portfolio): guideline header tabs with active-tab highlight" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

(Behavioural verification of this task happens in Task 8.)

---

### Task 7: Marketplace cleanup and contact phone

**Files:**
- Modify: `apps/portfolio/content/site.ts` (full replacement)
- Modify: `apps/portfolio/app/layout.tsx:14-70`
- Modify: `apps/portfolio/components/Footer.tsx`
- Modify: `apps/portfolio/content/tools.ts:123-130`
- Modify: `apps/portfolio/components/research/Build.tsx:103`
- Modify: `apps/portfolio/app/privacy/page.tsx`, `app/terms/page.tsx`, `app/support/page.tsx`
- Modify: `apps/portfolio/app/research/page.tsx`, `app/research/{grammar-checker,headline-generator,news-summarizer,style-rewriter}/page.tsx`
- Modify: `apps/portfolio/components/ContactSection.tsx`
- Modify: `apps/portfolio/AGENTS.md`
- Delete: `apps/portfolio/app/docs-addon/`

**Interfaces:**
- Produces: `SITE.name = "SinAi"`, `SITE.docsAddonUrl`, `SITE.contactPhone`, `SITE.contactPhoneHref`.

- [ ] **Step 1: Replace `content/site.ts`**

Replace the whole content of `apps/portfolio/content/site.ts` with:

```ts
/**
 * Site-wide constants. Everything the pages link to or repeat verbatim lives
 * here so a URL or name changes in exactly one place.
 */
export const SITE = {
  name: "SinAi",
  brand: "SinAi",
  origin: "https://sin-ai.app",
  appUrl: "https://chat.sin-ai.app",
  repoUrl: "https://github.com/wahallu/SinhalaJournalLLM",
  docsUrl: "https://github.com/wahallu/SinhalaJournalLLM/tree/main/docs",
  extensionUrl:
    "https://github.com/wahallu/SinhalaJournalLLM/tree/main/apps/chrome-extension",
  docsAddonUrl:
    "https://github.com/wahallu/SinhalaJournalLLM/tree/main/apps/docs-addon",
  supportEmail: "support@sin-ai.app",
  // Shown as written; the tel: link uses the international form.
  contactPhone: "071 076 7697",
  contactPhoneHref: "tel:+94710767697",
  organisation: "SinAi Research & Engineering Group",
  projectCode: "R26-SE-037",
  researchTitle: "Sinhala Journal LLM",
} as const;

/** SinLlama is the base model the paper adapts; cite it wherever it is named. */
export const SINLLAMA = {
  name: "SinLlama",
  citation:
    "H. W. K. Aravinda et al., “SinLlama – a large language model for Sinhala”, MERCon 2025, pp. 617–622.",
  url: "https://doi.org/10.1109/MERCon67903.2025.11217094",
} as const;
```

(`purposeLead`, `purposeRest`, `purposeDetail` and `PURPOSE_REST` were read only inside this file.)

- [ ] **Step 2: Update `app/layout.tsx` metadata**

Replace everything from `export const metadata: Metadata = {` through the closing `};` of the `jsonLd` object (the block ending with `  },\n};` just before `export default function RootLayout`) with:

```tsx
const TITLE = "SinAi: AI Writing Assistant for Sinhala Journalism";
const DESCRIPTION =
  "SinAi is an AI writing assistant for Sinhala journalism. It checks grammar, suggests headlines, rewrites articles in five newspaper styles and summarizes long stories, built by the Sinhala Journal LLM research team (R26-SE-037).";

export const metadata: Metadata = {
  metadataBase: new URL("https://sin-ai.app"),
  title: TITLE,
  applicationName: "SinAi",
  description: DESCRIPTION,
  keywords: [
    "SinAi",
    "Sinhala LLM",
    "Sinhala Journal LLM",
    "Sinhala NLP",
    "Journalism AI",
    "Sinhala Grammar Checker",
    "Sinhala News Summarizer",
    "Sinhala Headline Generator",
    "Sri Lanka AI",
  ],
  authors: [{ name: "SinAi Research & Engineering Group" }],
  icons: {
    icon: "/brand/web-app-manifest-192x192.png",
    shortcut: "/brand/web-app-manifest-192x192.png",
    apple: "/brand/web-app-manifest-192x192.png",
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://sin-ai.app",
    siteName: "SinAi",
    images: [
      {
        url: "/brand/hero.png",
        width: 1200,
        height: 630,
        alt: "SinAi",
      },
    ],
    locale: "en_US",
    type: "website",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "SinAi",
  applicationCategory: "ProductivityApplication",
  operatingSystem: "Web, Google Docs, Chrome",
  description: DESCRIPTION,
  url: "https://sin-ai.app",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  creator: {
    "@type": "Organization",
    name: "SinAi Research & Engineering Group",
    url: "https://sin-ai.app",
  },
};
```

- [ ] **Step 3: Update the Footer**

In `apps/portfolio/components/Footer.tsx` replace

```tsx
/**
 * Site footer. Shared by every page, including the legal pages, so it keeps
 * the exact product name and the privacy / terms / support links that the
 * Google Workspace Marketplace review looks for.
 */
```

with

```tsx
/**
 * Site footer. Shared by every page, including the legal pages, so the
 * privacy / terms / support links are always one click away.
 */
```

and replace

```tsx
                <Link href="/docs-addon" className={linkClass}>
                  Google Docs add-on
                </Link>
```

with

```tsx
                <a
                  href={SITE.docsAddonUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  Google Docs add-on
                </a>
```

- [ ] **Step 4: Re-point the add-on call to action**

In `apps/portfolio/content/tools.ts` replace

```ts
      "Privacy policy and terms published for Google Workspace",
```

with

```ts
      "Covered by the SinAi privacy policy and terms",
```

and replace

```ts
    cta: { label: "About the add-on", href: "/docs-addon" },
```

with

```ts
    cta: {
      label: "View the add-on",
      href: "https://github.com/wahallu/SinhalaJournalLLM/tree/main/apps/docs-addon",
    },
```

In `apps/portfolio/components/research/Build.tsx` replace

```tsx
        <ButtonLink href="/docs-addon" variant="onDark">
```

with

```tsx
        <ButtonLink href={SITE.docsAddonUrl} variant="onDark">
```

- [ ] **Step 5: Remove the cross-links to the deleted add-on pages**

In `apps/portfolio/app/privacy/page.tsx` delete this block (the separator and link inside the "Back Link" row):

```tsx
          <span className="text-[#D9D7D0]">•</span>
          <Link
            href="/docs-addon/privacy"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#cd191a] hover:underline"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>SinAI Document Assistant Specific Policy</span>
          </Link>
```

In `apps/portfolio/app/terms/page.tsx` delete this block:

```tsx
          <span className="text-[#D9D7D0]">•</span>
          <Link
            href="/docs-addon/terms"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#cd191a] hover:underline"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>SinAI Document Assistant Specific Terms</span>
          </Link>
```

In `apps/portfolio/app/support/page.tsx` add `import { SITE } from "@/content/site";` after the `Footer` import, and replace

```tsx
              <Link
                href="/docs-addon"
                className="text-xs font-bold text-[#181818] hover:text-[#cd191a] inline-flex items-center gap-1 normal-case tracking-normal"
              >
                <span>View Full Add-on Landing Page</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
```

with

```tsx
              <a
                href={SITE.docsAddonUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-[#181818] hover:text-[#cd191a] inline-flex items-center gap-1 normal-case tracking-normal"
              >
                <span>View the add-on source</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
```

- [ ] **Step 6: Rename the site in the research page metadata**

In `apps/portfolio/app/research/page.tsx` replace

```tsx
  title: "Research and engineering | SinAI Document Assistant",
  description:
    "How SinAI Document Assistant was built:
```

with

```tsx
  title: "Research and engineering | SinAi",
  description:
    "How SinAi was built:
```

(keeping the rest of that description string unchanged), then run:

```bash
cd apps/portfolio
sed -i '' 's/| SinAI Document Assistant`/| SinAi`/' app/research/grammar-checker/page.tsx app/research/headline-generator/page.tsx app/research/news-summarizer/page.tsx app/research/style-rewriter/page.tsx
```

- [ ] **Step 7: Add the phone to the Contact section**

Replace the whole content of `apps/portfolio/components/ContactSection.tsx` with:

```tsx
import { GitBranch, Mail, MessageSquareText, Phone } from "lucide-react";
import { Section, SectionHeader } from "@/components/ui";
import { SITE } from "@/content/site";

export default function ContactSection() {
  return (
    <Section id="contact" tone="panel">
      <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
        <SectionHeader title="Contact" className="mb-0 lg:col-span-7" />
        <div className="grid gap-3 lg:col-span-5">
          <a
            href={`mailto:${SITE.supportEmail}`}
            className="group flex items-center justify-between rounded-2xl border border-line bg-white p-5 transition-colors hover:border-crimson"
          >
            <span className="flex items-center gap-3">
              <Mail aria-hidden="true" className="h-5 w-5 text-crimson" />
              <span>
                <span className="block text-sm font-semibold text-black-main">Email support</span>
                <span className="block text-sm text-[#5f5c56]">{SITE.supportEmail}</span>
              </span>
            </span>
            <MessageSquareText aria-hidden="true" className="h-5 w-5 text-text-muted group-hover:text-crimson" />
          </a>
          <a
            href={SITE.contactPhoneHref}
            className="group flex items-center justify-between rounded-2xl border border-line bg-white p-5 transition-colors hover:border-crimson"
          >
            <span className="flex items-center gap-3">
              <Phone aria-hidden="true" className="h-5 w-5 text-crimson" />
              <span>
                <span className="block text-sm font-semibold text-black-main">Call us</span>
                <span className="block text-sm text-[#5f5c56]">{SITE.contactPhone}</span>
              </span>
            </span>
          </a>
          <a
            href={SITE.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between rounded-2xl border border-line bg-white p-5 transition-colors hover:border-crimson"
          >
            <span className="flex items-center gap-3">
              <GitBranch aria-hidden="true" className="h-5 w-5 text-crimson" />
              <span>
                <span className="block text-sm font-semibold text-black-main">Source repository</span>
                <span className="block text-sm text-[#5f5c56]">SinhalaJournalLLM</span>
              </span>
            </span>
          </a>
        </div>
      </div>
    </Section>
  );
}
```

- [ ] **Step 8: Delete the add-on pages**

```bash
cd /Users/nisalfonseka/Documents/GitHub/Research/SinhalaJournalLLM
git rm -r apps/portfolio/app/docs-addon
```

- [ ] **Step 9: Update `AGENTS.md`**

In `apps/portfolio/AGENTS.md`:

Replace
```
│   │   │   ├── layout.tsx              # Marketplace-verified metadata (title, JSON-LD), fonts, root layout
```
with
```
│   │   │   ├── layout.tsx              # Site metadata (title, JSON-LD), fonts, root layout
```

Replace
```
│   │   │   └── privacy/ terms/ support/ docs-addon/   # Google Workspace Marketplace pages. Do not edit casually.
```
with
```
│   │   │   └── privacy/ terms/ support/   # Legal and support pages linked from the footer
```

Replace the whole rule 5 (the line starting `5. **Google Workspace Marketplace items.` through the paragraph ending `...raise it with the owner.`) with:

```
5. **Product name and add-on links.** The site, its `<title>` and the footer call the product **SinAi**. Google Workspace Marketplace verification is not a constraint (dropped October 2026): the `/docs-addon*` pages were removed and the add-on is linked to its source folder through `SITE.docsAddonUrl`. The privacy, terms and support pages remain because the web app has accounts.
```

- [ ] **Step 10: Verify no stale references remain**

Run:
```bash
cd apps/portfolio
grep -rn "docs-addon" app components content | grep -v "docsAddonUrl\|apps/docs-addon"
grep -rn "purposeLead\|purposeRest\|purposeDetail" app components content
grep -rn "SinAI Document Assistant" app components content
```
Expected: the first two print nothing. The third lists only legal/support body copy and metadata in `app/privacy`, `app/terms`, `app/support` that names the add-on as it is installed from the Marketplace; those are intentionally left. Anything else is a miss to fix.

- [ ] **Step 11: Typecheck and lint**

Run: `cd apps/portfolio && npx tsc --noEmit && npm run lint`
Expected: no errors from the changed files (`Link`/`ShieldCheck`/`FileText` are still used elsewhere in privacy/terms; if lint reports an unused import, remove it).

- [ ] **Step 12: Commit**

```bash
cd /Users/nisalfonseka/Documents/GitHub/Research/SinhalaJournalLLM
git add -A apps/portfolio
git commit -m "feat(portfolio): drop Marketplace constraints and add the contact phone" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Build, preview and end-to-end verification

**Files:** none modified, except a throwaway mock API script under the scratchpad directory (not committed).

- [ ] **Step 1: Mock API script**

Create `<scratchpad>/portfolio-mock-api.mjs` (use the session scratchpad directory):

```js
import http from "node:http";

const rows = [
  { id: "d1", title: "Proposal Document", category: "document", document_type: "Group",
    submitted_at: "2026-03-13", description: "Group proposal.", file_url: "https://drive.google.com/file/d/abc/view",
    is_published: true, sort_order: 0 },
  { id: "d2", title: "Final Document", category: "document", document_type: "Group",
    submitted_at: null, description: null, file_url: null, is_published: true, sort_order: 1 },
  { id: "d3", title: "Hostile row", category: "document", document_type: "Group",
    submitted_at: null, description: null, file_url: "javascript:alert(1)", is_published: true, sort_order: 2 },
  { id: "p1", title: "Progress Presentation 1", category: "presentation", document_type: "Group",
    submitted_at: "2026-05-11", description: null, file_url: "https://example.com/pp1.pdf", is_published: true, sort_order: 0 },
];

let mode = "rows"; // "rows" | "empty"
http
  .createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (req.url === "/mode/empty") { mode = "empty"; res.end("ok"); return; }
    if (req.url === "/mode/rows") { mode = "rows"; res.end("ok"); return; }
    if (req.url?.startsWith("/api/v1/portfolio/documents")) {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(mode === "rows" ? rows : []));
      return;
    }
    res.statusCode = 404;
    res.end();
  })
  .listen(4175, () => console.log("mock api on 4175"));
```

- [ ] **Step 2: Build the portfolio against the mock and start both servers**

```bash
cd apps/portfolio
NEXT_PUBLIC_API_BASE_URL=http://localhost:4175/api/v1 npm run build
```
Expected: build succeeds; `ls out | grep docs-addon` prints nothing.

Start the mock in the background: `node <scratchpad>/portfolio-mock-api.mjs`, then `preview_start` with name `portfolio-out` (serves `apps/portfolio/out` on 4174). Hard-reload the page (`fetch(location.href, {cache: 'reload'}); location.reload()`).

- [ ] **Step 3: Header, anchors and phone (desktop width ≥ 1024)**

Run in the page with `javascript_tool`:

```js
const labels = [...document.querySelectorAll('header nav[aria-label="Main"] > div > *')]
  .map((e) => e.textContent.trim());
const ids = ["hero","technologies","milestones","recognition","documents","presentations","team","contact"]
  .map((id) => [id, !!document.getElementById(id)]);
({ labels, ids,
   phone: document.querySelector('a[href="tel:+94710767697"]')?.textContent.trim() })
```
Expected: `labels` is `["Home","Domain","Milestones","Documents","Presentations","About us","Contact us","Try SinAi"]` (the Domain entry may include no extra text); every id `true`; phone text contains `071 076 7697`.

- [ ] **Step 4: Tabs scroll and the active tab follows**

For each of `milestones`, `documents`, `presentations`, `team`, `contact`: click the matching header link (or `document.getElementById(id).scrollIntoView()`), wait 1 s, then:

```js
document.querySelector('header [aria-current="true"]')?.textContent.trim()
```
Expected, in order: `Milestones`, `Documents`, `Presentations`, `About us`, `Contact us`. Scroll to the top: `Home`. Scroll to `#achievements`: no `aria-current` element.

- [ ] **Step 5: Milestones**

Scroll to `#milestones`, then:

```js
[...document.querySelectorAll('.js-milestone h3')].map((h) => h.textContent.trim())
```
Expected: `["Initiation","Proposal","Implementation stage","Progress Presentation 1 (PP1)","Progress Presentation 2 (PP2)","Research paper completed","Top 10 finalist","Final presentation","Research publication"]`. Take a screenshot of the timeline to check nothing overlaps.

- [ ] **Step 6: Documents states**

With the mock in `rows` mode, after the page has loaded:

```js
({
  open: [...document.querySelectorAll('#library a')].map((a) => a.href),
  pending: [...document.querySelectorAll('#library li span')].filter((s) => s.textContent.trim() === 'Pending').length,
  jsLinks: document.querySelectorAll('a[href^="javascript:"]').length,
})
```
Expected: `open` contains the Drive link and `https://example.com/pp1.pdf` and nothing else; `pending` is 2 (Final Document and the hostile row); `jsLinks` is 0; no Download buttons.

Empty list: `fetch('http://localhost:4175/mode/empty')`, reload; expect "No documents published yet." and "No presentations published yet." and both `#documents` / `#presentations` present.

API down: stop the mock, reload; expect the "Documents are temporarily unavailable" alert and `#documents`, `#presentations` still present.

- [ ] **Step 7: Domain route**

Navigate to `/project-scope`; expect `aria-current` on `Domain`. Open the Domain dropdown; expect six items ending in "Technologies used", whose click goes to `/#technologies`. Navigate to `/research`; expect no `aria-current`.

- [ ] **Step 8: Mobile**

`resize_window` to the mobile preset; open the menu; expect Home, Domain (with its six sub-items), Milestones, Documents, Presentations, About us, Contact us, Try SinAi. Reset the viewport to desktop afterwards.

- [ ] **Step 9: Rebuild normally and run the full suites**

```bash
cd apps/portfolio && npm run build && npm run lint
cd ../web-app && npm test && npm run lint && npm run build
cd ../backend-api && ./.venv/bin/python -m pytest -q
```
Expected: all green apart from any failures that already existed before this plan; report those explicitly. Stop the mock server.

- [ ] **Step 10: Memory note**

Update `/Users/nisalfonseka/.claude/projects/-Users-nisalfonseka-Documents-GitHub-Research/memory/portfolio-content-honesty.md` so its "Why" no longer cites Marketplace verification as a live constraint, and note that documents are link-based via admin. Keep the honesty rules themselves.

- [ ] **Step 11: Report**

Summarise to the owner: what changed, test/build results, and the manual steps that remain (apply the migration, deploy backend and admin, add the links, deploy the portfolio, then confirm before deleting `public/documents/*.pdf`, `public/assets/aiexpo/IMG_*` and `public/supervisors & team members/`).

---

## Self-review (spec coverage)

| Spec section | Task |
|---|---|
| 3 Header (tabs, Domain items, active tab) | 6 |
| 4 Milestones | 5 |
| 5.1 Migration | 1 |
| 5.2 Backend | 1, 2 |
| 5.3 Admin UI | 3 |
| 5.4 Portfolio library | 4 |
| 5.5 Rollout order | 8 (steps 11) |
| 6 Marketplace cleanup | 7 |
| 7 Contact | 7 (step 7) |
| 9 Verification | 1, 2, 3 (tests), 8 |
