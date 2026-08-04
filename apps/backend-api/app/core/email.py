"""
Outbound transactional email over SMTP.

Used for password-reset and address-verification links, which Supabase Auth
used to send. Configured for Gmail: host smtp.gmail.com, port 587, STARTTLS,
and an App Password rather than the account password (Gmail requires 2FA to
be on before it will issue one). Free Gmail allows roughly 500 messages a
day, which is ample here and would not be for a real product.

With SMTP_HOST unset the message is logged instead of sent. That is what
local development and the test suite want: signup and reset still complete,
and the link is visible in the log.
"""

import logging
from email.message import EmailMessage

import aiosmtplib

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class EmailDeliveryError(Exception):
    """The message could not be handed to the SMTP server."""


def _build(to: str, subject: str, body: str) -> EmailMessage:
    settings = get_settings()
    message = EmailMessage()
    message["From"] = settings.SMTP_FROM or settings.SMTP_USER
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)
    return message


async def send_email(to: str, subject: str, body: str) -> None:
    """
    Deliver one message.

    Raises:
        EmailDeliveryError: on any SMTP failure. Callers decide what that
            means — signup treats it as non-fatal (the account exists and
            verification can be resent), while a reset request stays silent
            about it so the response cannot be used to probe for
            registered addresses.
    """
    settings = get_settings()

    if not settings.SMTP_HOST:
        logger.info(
            "SMTP not configured — not sending %r to %s. Body:\n%s",
            subject, to, body,
        )
        return

    try:
        await aiosmtplib.send(
            _build(to, subject, body),
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER or None,
            password=settings.SMTP_PASSWORD or None,
            start_tls=True,
            timeout=15,
        )
    except Exception as exc:
        # Never log the password, and never log the full body of a message
        # that contains a single-use link.
        logger.warning("SMTP delivery to %s failed: %s", to, exc)
        raise EmailDeliveryError(str(exc)) from exc


# ── Message templates ──
# Plain text on purpose: it renders everywhere, cannot leak layout bugs into
# a security-relevant message, and keeps Gmail's spam heuristics happier
# than a bare HTML message from a consumer address would.

async def send_verification_email(to: str, token: str) -> None:
    link = f"{get_settings().APP_BASE_URL}/verify-email?token={token}"
    ttl = get_settings().EMAIL_TOKEN_TTL_MINUTES
    await send_email(
        to,
        "Confirm your SinAi email address",
        "Welcome to SinAi.\n\n"
        f"Confirm this address by opening the link below within {ttl} minutes:\n\n"
        f"{link}\n\n"
        "If you did not create a SinAi account, you can ignore this message.\n",
    )


async def send_password_reset_email(to: str, token: str) -> None:
    link = f"{get_settings().APP_BASE_URL}/reset-password?token={token}"
    ttl = get_settings().EMAIL_TOKEN_TTL_MINUTES
    await send_email(
        to,
        "Reset your SinAi password",
        "A password reset was requested for this address.\n\n"
        f"Set a new password using the link below within {ttl} minutes:\n\n"
        f"{link}\n\n"
        "If you did not request this, no action is needed — your password "
        "has not changed.\n",
    )
