"""
Outbound transactional email over SMTP.

Used for password-reset and address-verification links, which Supabase Auth
used to send. Configured for Brevo: host smtp-relay.brevo.com, port 587,
STARTTLS, authenticated with an SMTP key (not the account password).

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


def _build(to: str, subject: str, text_body: str, html_body: str) -> EmailMessage:
    settings = get_settings()
    message = EmailMessage()
    message["From"] = settings.SMTP_FROM or settings.SMTP_USER
    message["To"] = to
    message["Subject"] = subject
    # set_content() + add_alternative() makes this multipart/alternative:
    # the plain-text part stays as a fallback (old clients, spam filters
    # that weight HTML-only mail worse) while HTML-capable clients render
    # the branded version below.
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")
    return message


async def send_email(to: str, subject: str, text_body: str, html_body: str) -> None:
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
            subject, to, text_body,
        )
        return

    try:
        await aiosmtplib.send(
            _build(to, subject, text_body, html_body),
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


# ── Brand template ──
# Table layout, inline styles, no external stylesheet, no @font-face: this
# has to render in Outlook desktop, which paints HTML mail with Word's
# engine and ignores flexbox/grid and most webfonts. Colors and type come
# straight from apps/web-app/src/index.css (--color-brand-*, --color-ink-*)
# so the email reads as the same product as the app, not a bolt-on.

_FONT_STACK = (
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, "
    "Arial, sans-serif"
)
_LOGO_URL = "https://chat.sin-ai.app/logo.png"

_BRAND_600 = "#cd191a"
_INK_900 = "#1d1819"
_INK_600 = "#5b5656"
_INK_400 = "#a6a2a2"
_INK_200 = "#e4e2e2"
_CANVAS = "#f5f4f4"


def _render_html(
    *,
    preheader: str,
    heading: str,
    body_lines: list[str],
    cta_label: str,
    cta_url: str,
    footnote: str,
) -> str:
    paragraphs = "".join(
        f'<p style="margin:0 0 16px;font-size:15px;line-height:1.6;'
        f'color:{_INK_600};">{line}</p>'
        for line in body_lines
    )
    return f"""\
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{heading}</title>
  </head>
  <body style="margin:0;padding:0;background-color:{_CANVAS};font-family:{_FONT_STACK};">
    <!-- Preheader: shown by mail clients next to the subject, hidden in the body -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">{preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:{_CANVAS};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(22,17,18,0.08);">
            <tr>
              <td style="background-color:{_BRAND_600};padding:28px 32px;text-align:center;">
                <img src="{_LOGO_URL}" alt="SinAi" width="36" height="36" style="display:inline-block;vertical-align:middle;border:0;" />
                <span style="display:inline-block;vertical-align:middle;margin-left:10px;font-size:20px;font-weight:700;color:#ffffff;">SinAi</span>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px 8px;">
                <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:{_INK_900};">{heading}</h1>
                {paragraphs}
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:8px;background-color:{_BRAND_600};">
                      <a href="{cta_url}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">{cta_label}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:{_INK_400};word-break:break-all;">
                  Or paste this link into your browser:<br />
                  <a href="{cta_url}" style="color:{_BRAND_600};">{cta_url}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 28px;border-top:1px solid {_INK_200};">
                <p style="margin:0;font-size:12px;line-height:1.6;color:{_INK_400};">{footnote}</p>
              </td>
            </tr>
          </table>
          <p style="margin:20px 0 0;font-size:12px;color:{_INK_400};">SinAi &middot; sin-ai.app</p>
        </td>
      </tr>
    </table>
  </body>
</html>
"""


async def send_verification_email(to: str, token: str) -> None:
    link = f"{get_settings().APP_BASE_URL}/verify-email?token={token}"
    ttl = get_settings().EMAIL_TOKEN_TTL_MINUTES
    html = _render_html(
        preheader="Confirm your email to finish setting up SinAi.",
        heading="Confirm your email address",
        body_lines=[
            "Welcome to SinAi — your Sinhala writing assistant.",
            f"Confirm this address to activate your account. This link "
            f"expires in {ttl} minutes.",
        ],
        cta_label="Confirm email",
        cta_url=link,
        footnote="If you did not create a SinAi account, you can safely ignore this message.",
    )
    text = (
        "Welcome to SinAi.\n\n"
        f"Confirm this address by opening the link below within {ttl} minutes:\n\n"
        f"{link}\n\n"
        "If you did not create a SinAi account, you can ignore this message.\n"
    )
    await send_email(to, "Confirm your SinAi email address", text, html)


async def send_password_reset_email(to: str, token: str) -> None:
    link = f"{get_settings().APP_BASE_URL}/reset-password?token={token}"
    ttl = get_settings().EMAIL_TOKEN_TTL_MINUTES
    html = _render_html(
        preheader="Reset your SinAi password.",
        heading="Reset your password",
        body_lines=[
            "A password reset was requested for this address.",
            f"Set a new password using the button below. This link expires "
            f"in {ttl} minutes.",
        ],
        cta_label="Reset password",
        cta_url=link,
        footnote="If you did not request this, no action is needed — your password has not changed.",
    )
    text = (
        "A password reset was requested for this address.\n\n"
        f"Set a new password using the link below within {ttl} minutes:\n\n"
        f"{link}\n\n"
        "If you did not request this, no action is needed — your password "
        "has not changed.\n"
    )
    await send_email(to, "Reset your SinAi password", text, html)
