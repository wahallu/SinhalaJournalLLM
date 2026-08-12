"""Permanent Cloudinary storage for generated headline images."""

import hashlib
import time
from urllib.parse import unquote, urlparse

import httpx

from app.core.config import get_settings

UPLOAD_TIMEOUT = 90.0
HISTORY_FOLDER = "sinai/history"


def is_configured() -> bool:
    return bool(get_settings().CLOUDINARY_URL.strip())


def _credentials() -> tuple[str, str, str]:
    raw = get_settings().CLOUDINARY_URL.strip()
    parsed = urlparse(raw)
    if parsed.scheme != "cloudinary" or not parsed.hostname or not parsed.username or not parsed.password:
        raise RuntimeError(
            "CLOUDINARY_URL must use cloudinary://API_KEY:API_SECRET@CLOUD_NAME."
        )
    return parsed.hostname, unquote(parsed.username), unquote(parsed.password)


async def upload_history_image(image_data: str, record_id: str) -> tuple[str, str]:
    """Upload a data URL/remote URL and return (secure_url, public_id)."""
    cloud_name, api_key, api_secret = _credentials()
    timestamp = int(time.time())
    public_id = record_id
    signed = {
        "folder": HISTORY_FOLDER,
        "public_id": public_id,
        "timestamp": timestamp,
    }
    signature_source = "&".join(f"{key}={signed[key]}" for key in sorted(signed))
    signature = hashlib.sha1(f"{signature_source}{api_secret}".encode()).hexdigest()
    payload = {
        "file": image_data,
        "api_key": api_key,
        "signature": signature,
        **signed,
    }
    endpoint = f"https://api.cloudinary.com/v1_1/{cloud_name}/image/upload"
    try:
        async with httpx.AsyncClient(timeout=UPLOAD_TIMEOUT) as client:
            response = await client.post(endpoint, data=payload)
    except httpx.HTTPError as exc:
        raise RuntimeError("Could not reach Cloudinary image storage.") from exc

    if response.status_code not in (200, 201):
        try:
            detail = response.json().get("error", {}).get("message")
        except Exception:
            detail = None
        raise RuntimeError(detail or f"Cloudinary rejected the image ({response.status_code}).")

    body = response.json()
    secure_url = body.get("secure_url")
    stored_public_id = body.get("public_id")
    if not secure_url or not stored_public_id:
        raise RuntimeError("Cloudinary returned no permanent image URL.")
    return secure_url, stored_public_id
