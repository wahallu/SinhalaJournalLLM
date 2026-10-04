"""Admin document library for the public SinAI portfolio."""

from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status

from app.core.deps import require_admin
from app.core.rate_limit import client_ip, hash_ip
from app.repositories import audit_repository, portfolio_document_repository
from app.schemas.auth import AuthUser
from app.schemas.portfolio_document import (
    DocumentCategory,
    PortfolioDocument,
    PortfolioDocumentUpdate,
)
from app.services import document_storage

router = APIRouter(prefix="/admin/portfolio-documents", tags=["Admin"])


@router.get("", response_model=list[PortfolioDocument])
async def list_documents(
    _admin: AuthUser = Depends(require_admin),
) -> list[PortfolioDocument]:
    rows = await portfolio_document_repository.list_all()
    return [PortfolioDocument(**row) for row in rows]


@router.post("", response_model=PortfolioDocument, status_code=status.HTTP_201_CREATED)
async def upload_document(
    request: Request,
    title: str = Form(..., min_length=1, max_length=160),
    category: DocumentCategory = Form(...),
    document_type: str = Form(..., min_length=1, max_length=80),
    submitted_at: date | None = Form(None),
    description: str | None = Form(None, max_length=500),
    is_published: bool = Form(True),
    sort_order: int = Form(0),
    file: UploadFile = File(...),
    admin: AuthUser = Depends(require_admin),
) -> PortfolioDocument:
    content = await file.read(document_storage.MAX_FILE_BYTES + 1)
    try:
        file_path, file_url, mime_type = await document_storage.upload_public_document(
            file.filename, content
        )
    except document_storage.InvalidDocument as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The document could not be stored. Please try again.",
        ) from exc

    payload = {
        "title": title.strip(),
        "category": category,
        "document_type": document_type.strip(),
        "submitted_at": submitted_at.isoformat() if submitted_at else None,
        "description": description.strip() if description else None,
        "file_name": file.filename or "document",
        "file_path": file_path,
        "file_url": file_url,
        "mime_type": mime_type,
        "size_bytes": len(content),
        "is_published": is_published,
        "sort_order": sort_order,
        "created_by": admin.id,
    }

    try:
        created = await portfolio_document_repository.create(payload)
    except Exception:
        try:
            await document_storage.delete_public_document(file_path)
        except Exception:
            pass
        raise

    await audit_repository.record(
        admin,
        "portfolio_document.create",
        target_type="portfolio_document",
        target_id=created["id"],
        after={k: v for k, v in payload.items() if k != "file_path"},
        ip_hash=hash_ip(client_ip(request)),
    )
    return PortfolioDocument(**created)


@router.patch("/{document_id}", response_model=PortfolioDocument)
async def update_document(
    document_id: str,
    payload: PortfolioDocumentUpdate,
    request: Request,
    admin: AuthUser = Depends(require_admin),
) -> PortfolioDocument:
    before = await portfolio_document_repository.get(document_id)
    if before is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    changes = payload.model_dump(exclude_unset=True)
    if "submitted_at" in changes and changes["submitted_at"] is not None:
        changes["submitted_at"] = changes["submitted_at"].isoformat()
    changes["updated_at"] = datetime.now(timezone.utc).isoformat()
    after = await portfolio_document_repository.update(document_id, changes)
    if after is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    await audit_repository.record(
        admin,
        "portfolio_document.update",
        target_type="portfolio_document",
        target_id=document_id,
        before=before,
        after=changes,
        ip_hash=hash_ip(client_ip(request)),
    )
    return PortfolioDocument(**after)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    request: Request,
    admin: AuthUser = Depends(require_admin),
) -> None:
    before = await portfolio_document_repository.get(document_id)
    if before is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    try:
        await document_storage.delete_public_document(before["file_path"])
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The stored file could not be deleted. Nothing was changed.",
        ) from exc

    await portfolio_document_repository.delete(document_id)
    await audit_repository.record(
        admin,
        "portfolio_document.delete",
        target_type="portfolio_document",
        target_id=document_id,
        before=before,
        ip_hash=hash_ip(client_ip(request)),
    )
