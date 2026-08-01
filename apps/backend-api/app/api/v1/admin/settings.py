"""
Admin settings API.

Reads and writes the runtime configuration whitelist. Both routes are behind
`require_admin`, every write is validated against the registry, and every
successful write is audited and invalidates the cache so the change takes
effect immediately in this process.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from app.core import runtime_settings
from app.core.deps import require_admin
from app.core.rate_limit import client_ip, hash_ip
from app.core.settings_registry import REGISTRY, validate
from app.repositories import audit_repository, settings_repository
from app.schemas.auth import AuthUser

router = APIRouter(prefix="/admin/settings", tags=["Admin"])


class SettingValue(BaseModel):
    """One setting, described well enough for the UI to render a control."""

    key: str
    value: object
    default: object
    kind: str
    group: str
    description: str
    choices: list[str] | None = None
    minimum: int | None = None
    maximum: int | None = None
    # "adapter" keys only — which task's adapter list the UI should offer.
    task: str | None = None
    is_overridden: bool


class SettingUpdate(BaseModel):
    value: object


@router.get("", response_model=list[SettingValue])
async def list_settings(_admin: AuthUser = Depends(require_admin)) -> list[SettingValue]:
    """
    Every settable key with its current value and its spec.

    The UI builds itself from this rather than a hardcoded list, so a key
    added server-side shows up without a frontend change.
    """
    current = await runtime_settings.get_all()
    stored = await settings_repository.load_all()

    return [
        SettingValue(
            key=key,
            value=current[key],
            default=spec.default,
            kind=spec.kind,
            group=spec.group,
            description=spec.description,
            choices=list(spec.choices) if spec.choices else None,
            minimum=spec.minimum,
            maximum=spec.maximum,
            task=spec.task,
            is_overridden=key in stored,
        )
        for key, spec in REGISTRY.items()
    ]


@router.patch("/{key:path}", response_model=SettingValue)
async def update_setting(
    key: str,
    payload: SettingUpdate,
    request: Request,
    admin: AuthUser = Depends(require_admin),
) -> SettingValue:
    """Change one setting. Validated, audited, and applied immediately."""
    try:
        value = validate(key, payload.value)
    except ValueError as exc:
        # The admin's own input, so the reason is safe to return.
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    previous = await runtime_settings.get(key)

    await settings_repository.upsert(key, value, actor_id=admin.id)
    runtime_settings.invalidate()

    await audit_repository.record(
        admin,
        "setting.update",
        target_type="setting",
        target_id=key,
        before={key: previous},
        after={key: value},
        ip_hash=hash_ip(client_ip(request)),
    )

    spec = REGISTRY[key]
    return SettingValue(
        key=key,
        value=value,
        default=spec.default,
        kind=spec.kind,
        group=spec.group,
        description=spec.description,
        choices=list(spec.choices) if spec.choices else None,
        minimum=spec.minimum,
        maximum=spec.maximum,
        task=spec.task,
        is_overridden=True,
    )
