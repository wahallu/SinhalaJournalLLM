"""
Runtime configuration: stored overrides layered over registry defaults.

Values are cached for a short TTL rather than read per request. Both the TTL
and explicit invalidation are needed: `invalidate()` clears only this
process, and production runs several instances, so the TTL is what carries a
change to the others. Thirty seconds is the tradeoff between a snappy
dashboard and hammering the database on every inference call.

If the settings table cannot be read the registry defaults are used, so a
storage blip degrades to documented behaviour instead of taking the product
down.
"""

import logging
import time
from typing import Any

from app.core.settings_registry import REGISTRY
from app.repositories import settings_repository

logger = logging.getLogger(__name__)

_TTL_SECONDS = 30.0

_cache: dict[str, Any] | None = None
_cached_at: float = 0.0


def invalidate() -> None:
    """Drop the cache so the next read reloads. Called after every write."""
    global _cache, _cached_at
    _cache = None
    _cached_at = 0.0


def _defaults() -> dict[str, Any]:
    return {key: spec.default for key, spec in REGISTRY.items()}


async def get_all() -> dict[str, Any]:
    """Every registry key with its effective value."""
    global _cache, _cached_at

    if _cache is not None and (time.monotonic() - _cached_at) < _TTL_SECONDS:
        return _cache

    values = _defaults()
    try:
        stored = await settings_repository.load_all()
    except Exception:
        # Serve defaults for THIS call but do not cache them. Caching a
        # failure would pin registry defaults for the full TTL — silently
        # re-enabling disabled tools and switching the provider back — long
        # after the database recovered.
        logger.exception("Could not read app_settings — using defaults for this request")
        return values

    # Only known keys are applied. A row for a key that has since been removed
    # from the registry is ignored rather than resurrecting dead config.
    for key, value in stored.items():
        if key in values:
            values[key] = value

    # dict(values) so callers cannot mutate the cache through the returned
    # reference.
    _cache = values
    _cached_at = time.monotonic()
    return dict(values)


async def get(key: str) -> Any:
    """The effective value for one key."""
    return (await get_all())[key]
