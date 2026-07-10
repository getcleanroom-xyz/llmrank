"""Campaign template rendering and response mapping."""
import re
from app.models.models import Campaign, User

_TEMPLATE_RE = re.compile(r'\{\{(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)\}\}')


def campaign_to_response(c: Campaign) -> dict:
    return {
        "id": str(c.id),
        "name": c.name,
        "subject": c.subject,
        "audience_type": c.audience_type.value if c.audience_type else "",
        "status": c.status.value if c.status else "",
        "schedule_type": c.schedule_type.value if c.schedule_type else "",
        "cron_expr": c.cron_expr,
        "scheduled_at": c.scheduled_at.isoformat() if c.scheduled_at else None,
        "last_sent_at": c.last_sent_at.isoformat() if c.last_sent_at else None,
        "next_send_at": c.next_send_at.isoformat() if c.next_send_at else None,
        "total_recipients": c.total_recipients,
        "sent_count": c.sent_count,
        "opened_count": c.opened_count,
        "clicked_count": c.clicked_count,
        "created_by": str(c.created_by),
        "created_at": c.created_at.isoformat() if c.created_at else "",
        "updated_at": c.updated_at.isoformat() if c.updated_at else "",
        "template_vars": c.template_vars,
    }


def build_sample_vars(admin: User, template_vars: list[dict] | None) -> dict[str, str]:
    ctx = {"display_name": admin.display_name, "email": admin.email}
    if template_vars:
        for v in template_vars:
            key = v.get("key", "").strip()
            if key and key not in ctx:
                ctx[key] = v.get("default_value", v.get("default", f"[{v.get('label', key)}]"))
    return ctx


def build_recipient_vars(user: User | None, email: str, template_vars: list[dict] | None) -> dict[str, str]:
    name = user.display_name if user else email.split("@")[0]
    ctx = {"display_name": name, "email": email, "name": name}
    if template_vars:
        for v in template_vars:
            key = v.get("key", "").strip()
            if key and key not in ctx:
                ctx[key] = v.get("default_value", v.get("default", ""))
    return ctx


def apply_template_vars(html_body: str, ctx: dict[str, str]) -> str:
    def _replacer(m: re.Match) -> str:
        return ctx.get(m.group(1).strip(), "")
    return _TEMPLATE_RE.sub(_replacer, html_body)
