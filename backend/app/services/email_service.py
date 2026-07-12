import logging
import secrets
import string
import re
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

def _generate_path() -> str:
    return ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(10))


def send_email(to_email: str, subject: str, html: str, from_email: str) -> tuple[bool, str | None]:
    try:
        import resend
        from app.core.config import settings
        resend.api_key = settings.RESEND_API_KEY

        r = resend.Emails.send({
            "from": from_email,
            "to": [to_email],
            "subject": subject,
            "html": html,
        })
        return True, None
    except Exception as e:
        logger.exception("Failed to send email to %s", to_email)
        return False, str(e)


def prepare_tracked_html(html_body: str, campaign_id: str, recipient_id: str, links: list[dict[str, str]], base_url: str) -> str:
    pixel_url = f"{base_url}/track/open/{recipient_id}.png"
    tracked = html_body.replace("</body>", f'<img src="{pixel_url}" width="1" height="1" alt="" style="display:none"/></body>')

    for link in links:
        redirect_url = f"{base_url}/track/click/{link['redirect_path']}"
        tracked = tracked.replace(link["original_url"], redirect_url)

    return tracked
