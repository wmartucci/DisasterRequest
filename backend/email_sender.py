"""Sends password reset emails through an SMTP server (Gmail by default).

Settings come from .env:
    SMTP_HOST      default smtp.gmail.com
    SMTP_PORT      default 587 (STARTTLS)
    SMTP_USER      the Gmail address that sends the mail
    SMTP_PASSWORD  a Gmail App Password (16 letters), NOT the normal account password
    MAIL_FROM      optional; defaults to SMTP_USER

If SMTP_USER or SMTP_PASSWORD is missing, the link is printed to the uvicorn
terminal instead, so the reset flow can still be tested without email set up.
"""
import logging
import os
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

logger = logging.getLogger("uvicorn.error")  # shows up in the uvicorn terminal

APP_NAME = "Disaster Response"
LINK_LIFETIME = "1 hour"  # keep in sync with expires_at DEFAULT in schema.sql


def _settings():
    # Read at send time (not import time) so .env changes apply after a restart
    # no matter which module loaded first.
    user = os.environ.get("SMTP_USER", "").strip()
    return {
        "host": os.environ.get("SMTP_HOST", "smtp.gmail.com").strip(),
        "port": int(os.environ.get("SMTP_PORT", "587")),
        "user": user,
        # Google shows App Passwords as "abcd efgh ijkl mnop"; the spaces aren't part of it.
        "password": os.environ.get("SMTP_PASSWORD", "").replace(" ", ""),
        "sender": os.environ.get("MAIL_FROM", "").strip() or user,
    }


def build_reset_message(to_email, link, sender):
    msg = EmailMessage()
    msg["Subject"] = f"Reset your {APP_NAME} password"
    msg["From"] = formataddr((APP_NAME, sender))
    msg["To"] = to_email

    # Plain-text version (shown by mail apps that don't render HTML)
    msg.set_content(
        f"Someone asked to reset the password for your {APP_NAME} account.\n\n"
        f"To choose a new password, open this link:\n{link}\n\n"
        f"The link works once and expires in {LINK_LIFETIME}.\n\n"
        "If you didn't ask for this, you can ignore this email. "
        "Your password won't change.\n"
    )

    # HTML version
    msg.add_alternative(f"""\
<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f6f8f8;font-family:'Segoe UI',Arial,sans-serif;color:#0b0f10;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #d5dde0;border-radius:16px;padding:28px;">
      <p style="margin:0 0 6px;color:#0f766e;font-size:11px;font-weight:700;letter-spacing:2px;">ACCOUNT HELP</p>
      <h1 style="margin:0 0 12px;font-size:22px;">Reset your password</h1>
      <p style="margin:0 0 20px;line-height:1.6;">
        Someone asked to reset the password for your {APP_NAME} account.
        Click the button below to choose a new one.
      </p>
      <p style="margin:0 0 20px;">
        <a href="{link}" style="display:inline-block;padding:11px 17px;border-radius:9px;background:#5eead4;color:#071b1a;font-weight:700;text-decoration:none;">
          Choose a new password
        </a>
      </p>
      <p style="margin:0 0 12px;color:#55646a;font-size:14px;line-height:1.6;">
        The link works once and expires in {LINK_LIFETIME}. If the button doesn't work, copy this address into your browser:
      </p>
      <p style="margin:0 0 20px;font-size:13px;word-break:break-all;"><a href="{link}" style="color:#0f766e;">{link}</a></p>
      <p style="margin:0;color:#55646a;font-size:14px;line-height:1.6;">
        If you didn't ask for this, you can ignore this email. Your password won't change.
      </p>
    </div>
  </body>
</html>
""", subtype="html")
    return msg


def send_password_reset_email(to_email, link):
    """Send the reset link. Never raises: failures are logged (without the token)."""
    s = _settings()

    if not s["user"] or not s["password"]:
        # Dev fallback: no SMTP settings in .env
        print("SMTP not configured; PASSWORD RESET LINK:", link)
        return

    msg = build_reset_message(to_email, link, s["sender"])
    try:
        with smtplib.SMTP(s["host"], s["port"], timeout=15) as smtp:
            smtp.starttls(context=ssl.create_default_context())
            smtp.login(s["user"], s["password"])
            refused = smtp.send_message(msg)  # {address: (code, reason)} for recipients the server refused
        if refused:
            logger.error("Password reset email refused by %s for %s", s["host"], refused)
        else:
            # Accepted by Gmail is not the same as delivered: the receiving mail
            # server can still bounce it or file it as spam (school filters often do).
            logger.info("Password reset email accepted by %s for delivery to %s", s["host"], to_email)
    except smtplib.SMTPAuthenticationError:
        logger.error(
            "Password reset email NOT sent: Gmail rejected SMTP_USER/SMTP_PASSWORD. "
            "Use a Google App Password, not your normal password."
        )
    except Exception as exc:  # network down, wrong host/port, etc.
        logger.error("Password reset email NOT sent to %s: %s", to_email, exc)
