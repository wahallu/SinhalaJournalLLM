"""
Self-hosted signup, login, refresh and the emailed-link flows.

Replaces Supabase Auth. The behaviours pinned here are the ones where a
mistake is a security bug rather than a bug: not leaking which addresses are
registered, not letting a refresh token act as an access token, and making
emailed links single-use.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.core import security
from app.main import app

_PASSWORD = "CorrectHorse1"


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _signup(client, email=" New@Example.COM ", password=_PASSWORD):
    return await client.post("/api/v1/auth/signup", json={"email": email, "password": password})


# ── Signup ──

@pytest.mark.asyncio
async def test_signup_creates_credentials_and_profile(fake_supabase):
    async with _client() as c:
        response = await _signup(c)

    assert response.status_code == 201
    body = response.json()
    assert body["access_token"] and body["refresh_token"]
    assert body["user"]["email"] == "new@example.com"

    # Both rows, keyed by the same id — profiles is what the rest of the app
    # reads for role and status.
    [user] = fake_supabase.store["app_users"]
    [profile] = fake_supabase.store["profiles"]
    assert user["email"] == "new@example.com"   # trimmed and lowercased
    assert profile["id"] == user["id"]
    assert profile["role"] == "user"
    assert profile["status"] == "active"


@pytest.mark.asyncio
async def test_signup_never_stores_the_password(fake_supabase):
    async with _client() as c:
        await _signup(c)

    [user] = fake_supabase.store["app_users"]
    assert _PASSWORD not in user["password_hash"]
    assert user["password_hash"].startswith("$2")


@pytest.mark.asyncio
async def test_duplicate_signup_is_rejected(fake_supabase):
    async with _client() as c:
        await _signup(c, email="taken@example.com")
        second = await _signup(c, email="TAKEN@example.com")   # same address

    assert second.status_code == 409
    assert len(fake_supabase.store["app_users"]) == 1


@pytest.mark.asyncio
async def test_signup_rejects_a_password_over_the_bcrypt_limit(fake_supabase):
    async with _client() as c:
        response = await _signup(c, password="x" * 200)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_signup_rejects_a_too_short_password(fake_supabase):
    async with _client() as c:
        response = await _signup(c, password="short")
    assert response.status_code == 422


# ── Login ──

@pytest.mark.asyncio
async def test_login_succeeds_with_the_right_password(fake_supabase):
    async with _client() as c:
        await _signup(c, email="user@example.com")
        response = await c.post(
            "/api/v1/auth/login",
            json={"email": "user@example.com", "password": _PASSWORD},
        )

    assert response.status_code == 200
    assert response.json()["access_token"]


@pytest.mark.asyncio
async def test_login_is_case_insensitive_on_the_address(fake_supabase):
    async with _client() as c:
        await _signup(c, email="user@example.com")
        response = await c.post(
            "/api/v1/auth/login",
            json={"email": "USER@Example.com", "password": _PASSWORD},
        )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_wrong_password_and_unknown_user_are_indistinguishable(fake_supabase):
    """
    Both must answer identically, or the endpoint becomes a way to
    enumerate which addresses have accounts.
    """
    async with _client() as c:
        await _signup(c, email="real@example.com")
        wrong_password = await c.post(
            "/api/v1/auth/login",
            json={"email": "real@example.com", "password": "NotThePassword1"},
        )
        no_such_user = await c.post(
            "/api/v1/auth/login",
            json={"email": "ghost@example.com", "password": "NotThePassword1"},
        )

    assert wrong_password.status_code == no_such_user.status_code == 401
    assert wrong_password.json() == no_such_user.json()


@pytest.mark.asyncio
async def test_suspended_account_cannot_log_in(fake_supabase):
    async with _client() as c:
        await _signup(c, email="banned@example.com")
        fake_supabase.store["profiles"][0]["status"] = "suspended"
        response = await c.post(
            "/api/v1/auth/login",
            json={"email": "banned@example.com", "password": _PASSWORD},
        )
    assert response.status_code == 403


# ── Refresh ──

@pytest.mark.asyncio
async def test_refresh_returns_a_new_access_token(fake_supabase):
    async with _client() as c:
        signup = await _signup(c)
        refresh_token = signup.json()["refresh_token"]
        response = await c.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})

    assert response.status_code == 200
    assert response.json()["access_token"]


@pytest.mark.asyncio
async def test_an_access_token_cannot_be_used_to_refresh(fake_supabase):
    async with _client() as c:
        signup = await _signup(c)
        access = signup.json()["access_token"]
        response = await c.post("/api/v1/auth/refresh", json={"refresh_token": access})
    assert response.status_code == 401


# ── The token actually works against a protected route ──

@pytest.mark.asyncio
async def test_issued_token_authenticates_a_protected_endpoint(fake_supabase):
    async with _client() as c:
        signup = await _signup(c)
        token = signup.json()["access_token"]
        me = await c.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert me.status_code == 200
    assert me.json()["email"] == "new@example.com"
    assert me.json()["onboarding_completed_at"] is None


@pytest.mark.asyncio
async def test_onboarding_saves_newsroom_profile_and_marks_it_complete(fake_supabase):
    async with _client() as c:
        signup = await _signup(c)
        token = signup.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        response = await c.put(
            "/api/v1/auth/onboarding",
            headers=headers,
            json={
                "full_name": "  Nisal  ",
                "newsroom_roles": ["reporter", "editor"],
                "journalism_interests": ["politics", "fact-checking"],
            },
        )
        me = await c.get("/api/v1/auth/me", headers=headers)

    assert response.status_code == 200
    assert response.json()["full_name"] == "Nisal"
    assert response.json()["onboarding_completed_at"]
    assert me.json()["newsroom_roles"] == ["reporter", "editor"]
    assert me.json()["journalism_interests"] == ["politics", "fact-checking"]
    assert me.json()["onboarding_completed_at"]


@pytest.mark.asyncio
async def test_onboarding_rejects_unknown_roles(fake_supabase):
    async with _client() as c:
        signup = await _signup(c)
        token = signup.json()["access_token"]
        response = await c.put(
            "/api/v1/auth/onboarding",
            headers={"Authorization": f"Bearer {token}"},
            json={"newsroom_roles": ["administrator"]},
        )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_protected_endpoint_rejects_a_refresh_token(fake_supabase):
    async with _client() as c:
        signup = await _signup(c)
        refresh = signup.json()["refresh_token"]
        me = await c.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {refresh}"})
    assert me.status_code == 401


# ── Password reset ──

@pytest.mark.asyncio
async def test_forgot_password_answers_the_same_for_unknown_addresses(fake_supabase):
    """Another enumeration surface — the response cannot depend on whether
    the address exists."""
    async with _client() as c:
        await _signup(c, email="real@example.com")
        known = await c.post("/api/v1/auth/forgot-password", json={"email": "real@example.com"})
        unknown = await c.post("/api/v1/auth/forgot-password", json={"email": "ghost@example.com"})

    assert known.status_code == unknown.status_code == 202
    assert known.json() == unknown.json()


@pytest.mark.asyncio
async def test_reset_password_changes_the_password_and_spends_the_token(fake_supabase, monkeypatch):
    sent = {}

    async def _capture(to, token):
        sent["token"] = token

    monkeypatch.setattr("app.api.v1.auth.send_password_reset_email", _capture)

    async with _client() as c:
        await _signup(c, email="reset@example.com")
        await c.post("/api/v1/auth/forgot-password", json={"email": "reset@example.com"})

        reset = await c.post(
            "/api/v1/auth/reset-password",
            json={"token": sent["token"], "password": "BrandNewPass9"},
        )
        assert reset.status_code == 200

        old = await c.post(
            "/api/v1/auth/login",
            json={"email": "reset@example.com", "password": _PASSWORD},
        )
        new = await c.post(
            "/api/v1/auth/login",
            json={"email": "reset@example.com", "password": "BrandNewPass9"},
        )

    assert old.status_code == 401
    assert new.status_code == 200


@pytest.mark.asyncio
async def test_a_reset_link_cannot_be_used_twice(fake_supabase, monkeypatch):
    sent = {}

    async def _capture(to, token):
        sent["token"] = token

    monkeypatch.setattr("app.api.v1.auth.send_password_reset_email", _capture)

    async with _client() as c:
        await _signup(c, email="once@example.com")
        await c.post("/api/v1/auth/forgot-password", json={"email": "once@example.com"})
        first = await c.post(
            "/api/v1/auth/reset-password",
            json={"token": sent["token"], "password": "FirstChange1"},
        )
        second = await c.post(
            "/api/v1/auth/reset-password",
            json={"token": sent["token"], "password": "SecondChange1"},
        )

    assert first.status_code == 200
    assert second.status_code == 400


@pytest.mark.asyncio
async def test_reset_with_a_bogus_token_is_refused(fake_supabase):
    async with _client() as c:
        response = await c.post(
            "/api/v1/auth/reset-password",
            json={"token": security.generate_url_token(), "password": "WhateverPass1"},
        )
    assert response.status_code == 400


# ── Email verification ──

@pytest.mark.asyncio
async def test_verify_email_marks_the_account_verified(fake_supabase, monkeypatch):
    sent = {}

    async def _capture(to, token):
        sent["token"] = token

    monkeypatch.setattr("app.api.v1.auth.send_verification_email", _capture)

    async with _client() as c:
        await _signup(c, email="verify@example.com")
        response = await c.post("/api/v1/auth/verify-email", json={"token": sent["token"]})

    assert response.status_code == 200
    assert fake_supabase.store["app_users"][0]["email_verified"] is True


# ── Google sign-in ──
#
# What Google's ID token actually verifies to is core/security's concern
# (see test_security.py); verify_google_id_token is stubbed here so these
# focus on what /auth/google does with the claims — create-vs-link, the
# unverified-email refusal, and suspension.

def _google_claims(email="new@example.com", email_verified=True, name="New User"):
    return {"email": email, "email_verified": email_verified, "name": name}


@pytest.mark.asyncio
async def test_google_sign_in_creates_an_account(fake_supabase, monkeypatch):
    monkeypatch.setattr("app.core.security.verify_google_id_token", lambda _cred: _google_claims())

    async with _client() as c:
        response = await c.post("/api/v1/auth/google", json={"credential": "whatever"})

    assert response.status_code == 200
    body = response.json()
    assert body["access_token"] and body["refresh_token"]
    assert body["user"]["email"] == "new@example.com"
    assert body["user"]["email_verified"] is True

    [user] = fake_supabase.store["app_users"]
    [profile] = fake_supabase.store["profiles"]
    assert user["password_hash"] is None  # no password was ever set
    assert user["email_verified"] is True  # Google already vouched for it
    assert profile["id"] == user["id"]
    assert profile["full_name"] == "New User"


@pytest.mark.asyncio
async def test_google_sign_in_links_an_existing_account_by_email(fake_supabase, monkeypatch):
    async with _client() as c:
        await _signup(c, email="shared@example.com")

    monkeypatch.setattr(
        "app.core.security.verify_google_id_token",
        lambda _cred: _google_claims(email="shared@example.com"),
    )
    async with _client() as c:
        response = await c.post("/api/v1/auth/google", json={"credential": "whatever"})

    assert response.status_code == 200
    # Signed into the same account rather than creating a second one.
    assert len(fake_supabase.store["app_users"]) == 1
    assert fake_supabase.store["app_users"][0]["email_verified"] is True


@pytest.mark.asyncio
async def test_google_sign_in_rejects_an_unverified_email(fake_supabase, monkeypatch):
    monkeypatch.setattr(
        "app.core.security.verify_google_id_token",
        lambda _cred: _google_claims(email_verified=False),
    )
    async with _client() as c:
        response = await c.post("/api/v1/auth/google", json={"credential": "whatever"})

    assert response.status_code == 401
    assert fake_supabase.store.get("app_users", []) == []


@pytest.mark.asyncio
async def test_google_sign_in_rejects_an_invalid_credential(fake_supabase, monkeypatch):
    def _raise(_cred):
        raise security.InvalidGoogleToken("Invalid Google credential")

    monkeypatch.setattr("app.core.security.verify_google_id_token", _raise)
    async with _client() as c:
        response = await c.post("/api/v1/auth/google", json={"credential": "garbage"})

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_suspended_account_cannot_sign_in_with_google(fake_supabase, monkeypatch):
    async with _client() as c:
        await _signup(c, email="banned@example.com")
    fake_supabase.store["profiles"][0]["status"] = "suspended"

    monkeypatch.setattr(
        "app.core.security.verify_google_id_token",
        lambda _cred: _google_claims(email="banned@example.com"),
    )
    async with _client() as c:
        response = await c.post("/api/v1/auth/google", json={"credential": "whatever"})

    assert response.status_code == 403
