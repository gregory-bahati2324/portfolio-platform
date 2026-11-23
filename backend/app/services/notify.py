import logging
import smtplib
from email.message import EmailMessage

from app.core.config import get_settings

log = logging.getLogger("app.notify")


def smtp_configured() -> bool:
    return bool(get_settings().smtp_host)


def send_email(to: str, subject: str, body: str, reply_to: str | None = None) -> bool:
    """Best-effort email. Returns True if handed to the SMTP server; never raises."""
    s = get_settings()
    if not s.smtp_host:
        log.info("email skipped (SMTP not configured)")
        return False
    try:
        msg = EmailMessage()
        msg["Subject"], msg["To"] = subject, to
        msg["From"] = s.notify_email_from or s.smtp_user or s.notify_email_to
        if reply_to:
            msg["Reply-To"] = reply_to
        msg.set_content(body)
        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=10) as smtp:
            smtp.starttls()
            if s.smtp_user:
                smtp.login(s.smtp_user, s.smtp_password)
            smtp.send_message(msg)
        return True
    except Exception:
        log.exception("email failed")
        return False


def notify_new_inquiry(reference: str, name: str, email: str, message: str) -> None:
    """Runs after the inquiry is committed; failure never affects the stored inquiry."""
    s = get_settings()
    if not (s.smtp_host and s.notify_email_to):
        log.info("inquiry notification skipped (SMTP not configured)", extra={"path": reference})
        return
    send_email(s.notify_email_to, f"New project inquiry {reference} from {name}", f"Reference: {reference}\nName: {name}\nEmail: {email}\n\n{message}\n", reply_to=email)
