"""
Runtime settings: the registry whitelist, validation, and the layering of
stored values over defaults.

Validation is the security-relevant half. An open key/value write endpoint
would be arbitrary config injection, so anything not in the registry, or of
the wrong shape, must be refused before it reaches the database.
"""

import pytest

from app.core import runtime_settings
from app.core.settings_registry import REGISTRY, validate


@pytest.fixture(autouse=True)
def _clear_cache():
    runtime_settings.invalidate()
    yield
    runtime_settings.invalidate()


# ── Registry shape ──

def test_registry_covers_the_documented_keys():
    expected = {
        "model.provider",
        "model.fallback_enabled",
        "features.grammar",
        "features.headlines",
        "features.rewriter",
        "features.summarizer",
        "defaults.tone",
        "defaults.length",
        "defaults.headline_count",
        "adapters.grammar",
        "adapters.headline",
        "adapters.style",
        "adapters.summarizer",
        "grammar.ensemble_size",
        "limits.anon_per_hour",
    }
    assert set(REGISTRY) == expected


def test_no_secret_or_url_is_settable():
    """
    Secrets and service URLs must never be DB-editable. A settable inference
    URL would let one compromised admin account redirect every article to a
    host they control.
    """
    forbidden = ("key", "secret", "url", "token", "password", "salt")
    for key in REGISTRY:
        assert not any(word in key.lower() for word in forbidden), key


def test_every_entry_has_a_description():
    """The admin UI renders these; a blank one ships an unlabelled control."""
    for key, spec in REGISTRY.items():
        assert spec.description.strip(), key


# ── Validation ──

def test_unknown_key_is_rejected():
    with pytest.raises(ValueError, match="Unknown setting"):
        validate("model.secret_backdoor", "x")


def test_enum_rejects_value_outside_the_set():
    with pytest.raises(ValueError):
        validate("model.provider", "gpt4")


def test_enum_accepts_allowed_value():
    assert validate("model.provider", "mock") == "mock"


def test_bool_rejects_a_string():
    with pytest.raises(ValueError):
        validate("features.grammar", "yes")


def test_bool_accepts_a_bool():
    assert validate("features.grammar", False) is False


def test_int_rejects_below_range():
    with pytest.raises(ValueError):
        validate("limits.anon_per_hour", -1)


def test_int_rejects_above_range():
    with pytest.raises(ValueError):
        validate("defaults.headline_count", 99)


def test_int_rejects_a_bool():
    """bool is a subclass of int in Python; it must not slip through."""
    with pytest.raises(ValueError):
        validate("limits.anon_per_hour", True)


def test_int_accepts_in_range():
    assert validate("defaults.headline_count", 7) == 7


# ── Layering ──

@pytest.mark.asyncio
async def test_unset_key_falls_back_to_default():
    value = await runtime_settings.get("defaults.headline_count")
    assert value == REGISTRY["defaults.headline_count"].default


@pytest.mark.asyncio
async def test_stored_value_overrides_the_default(fake_supabase):
    fake_supabase.store["app_settings"] = [
        {"key": "defaults.headline_count", "value": 3, "updated_at": "2026-01-01T00:00:00Z"},
    ]
    runtime_settings.invalidate()
    assert await runtime_settings.get("defaults.headline_count") == 3


@pytest.mark.asyncio
async def test_get_all_merges_stored_over_defaults(fake_supabase):
    fake_supabase.store["app_settings"] = [
        {"key": "features.grammar", "value": False, "updated_at": "2026-01-01T00:00:00Z"},
    ]
    runtime_settings.invalidate()
    values = await runtime_settings.get_all()

    assert values["features.grammar"] is False
    assert values["features.headlines"] is True  # untouched default
    assert set(values) == set(REGISTRY)


@pytest.mark.asyncio
async def test_cache_is_reused_until_invalidated(fake_supabase):
    fake_supabase.store["app_settings"] = [
        {"key": "features.grammar", "value": False, "updated_at": "2026-01-01T00:00:00Z"},
    ]
    runtime_settings.invalidate()
    assert await runtime_settings.get("features.grammar") is False

    # Change the store without invalidating — the cached value must persist.
    fake_supabase.store["app_settings"][0]["value"] = True
    assert await runtime_settings.get("features.grammar") is False

    runtime_settings.invalidate()
    assert await runtime_settings.get("features.grammar") is True


@pytest.mark.asyncio
async def test_unreadable_settings_fall_back_to_defaults(monkeypatch):
    """
    A settings-table outage must not take the product down. Defaults are a
    safe posture: every tool enabled, provider as configured in env.
    """
    async def _boom():
        raise RuntimeError("supabase down")

    monkeypatch.setattr("app.repositories.settings_repository.load_all", _boom)
    runtime_settings.invalidate()

    assert await runtime_settings.get("features.grammar") is True
