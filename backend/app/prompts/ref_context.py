"""Build the context block injected after the Ref system prompt.

Assembles everything the AI needs to know about the referrer, the job,
and the user into a single structured string.  Called once per AI request.
"""
import json
from typing import Any, Optional

from app.db.models.job import Contact, RefChatMessage
from app.db.models.user import User


def _safe(value: Any, fallback: str = "Unknown") -> str:
    if value is None:
        return fallback
    return str(value).strip() or fallback


def _tenure_str(months: Optional[int]) -> str:
    if not months:
        return "Unknown"
    years = months // 12
    remaining = months % 12
    if years and remaining:
        return f"{years}y {remaining}mo"
    if years:
        return f"{years}y"
    return f"{remaining}mo"


def _extract_profile_highlights(profile_data_raw: Optional[str]) -> dict:
    """Pull useful fields from the raw Apify profile JSON.

    Defensive: returns empty dict on any parse failure.
    Fields we look for: bio/summary, languages, certifications,
    education history, past positions.
    """
    if not profile_data_raw:
        return {}
    try:
        data = json.loads(profile_data_raw) if isinstance(profile_data_raw, str) else profile_data_raw
    except (json.JSONDecodeError, TypeError):
        return {}

    highlights: dict = {}

    summary = data.get("summary") or data.get("about") or data.get("bio")
    if summary:
        highlights["bio"] = str(summary)[:500]

    languages = data.get("languages")
    if languages and isinstance(languages, list):
        highlights["languages"] = [str(l) for l in languages[:10]]

    certs = data.get("certifications")
    if certs and isinstance(certs, list):
        cert_names = []
        for c in certs[:5]:
            if isinstance(c, dict):
                cert_names.append(c.get("name") or c.get("title") or str(c))
            else:
                cert_names.append(str(c))
        highlights["certifications"] = cert_names

    education = data.get("education") or data.get("schools")
    if education and isinstance(education, list):
        edu_items = []
        for e in education[:3]:
            if isinstance(e, dict):
                edu_items.append({
                    "school": e.get("schoolName") or e.get("school") or e.get("name"),
                    "degree": e.get("degree") or e.get("degreeName"),
                    "field": e.get("fieldOfStudy") or e.get("field"),
                })
            else:
                edu_items.append({"school": str(e)})
        highlights["education"] = edu_items

    positions = data.get("positions") or data.get("experience") or data.get("currentPositions")
    if positions and isinstance(positions, list):
        past = []
        for p in positions[:5]:
            if isinstance(p, dict):
                past.append({
                    "title": p.get("title") or p.get("position"),
                    "company": p.get("companyName") or p.get("company"),
                    "duration": p.get("duration") or p.get("timePeriod"),
                })
            else:
                past.append({"title": str(p)})
        highlights["positions"] = past

    return highlights


def build_ref_context(
    contact: Contact,
    job: "Any",
    user: User,
    chat_history: list[RefChatMessage],
    user_context_block: Optional[str] = None,
) -> str:
    """Return the context string appended as a user message alongside the
    system prompt.  Structured so the AI can reference specific fields."""

    sections: list[str] = []

    # --- Referrer (contact) ---
    profile_highlights = _extract_profile_highlights(contact.profile_data)

    referrer_lines = [
        "## Referrer Profile",
        f"- Name: {_safe(contact.full_name)}",
        f"- Current title: {_safe(contact.title)}",
        f"- Company: {_safe(contact.company)}",
        f"- Location: {_safe(contact.location)}",
        f"- University: {_safe(contact.university)}",
        f"- Tenure at company: {_tenure_str(contact.tenure_months)}",
        f"- LinkedIn: {_safe(contact.linkedin_url, 'Not available')}",
    ]

    if profile_highlights.get("bio"):
        referrer_lines.append(f"- Bio/summary: {profile_highlights['bio']}")
    if profile_highlights.get("languages"):
        referrer_lines.append(f"- Languages: {', '.join(profile_highlights['languages'])}")
    if profile_highlights.get("certifications"):
        referrer_lines.append(f"- Certifications: {', '.join(profile_highlights['certifications'])}")
    if profile_highlights.get("education"):
        for edu in profile_highlights["education"]:
            school = edu.get("school") or "Unknown"
            degree = edu.get("degree") or ""
            field = edu.get("field") or ""
            parts = [school]
            if degree:
                parts.append(degree)
            if field:
                parts.append(field)
            referrer_lines.append(f"- Education: {', '.join(parts)}")
    if profile_highlights.get("positions"):
        referrer_lines.append("- Past/current positions:")
        for pos in profile_highlights["positions"]:
            title = pos.get("title") or "Unknown role"
            company = pos.get("company") or "Unknown company"
            duration = pos.get("duration") or ""
            line = f"  - {title} at {company}"
            if duration:
                line += f" ({duration})"
            referrer_lines.append(line)

    sections.append("\n".join(referrer_lines))

    # --- Job ---
    job_lines = [
        "## Job Posting",
        f"- Title: {_safe(job.title)}",
        f"- Company: {_safe(job.company)}",
        f"- Location: {_safe(job.location)}",
        f"- Work mode: {_safe(job.work_mode)}",
        f"- Role family: {_safe(job.role_family)}",
    ]
    if job.description:
        desc = str(job.description)[:1500]
        job_lines.append(f"- Description (truncated):\n{desc}")
    sections.append("\n".join(job_lines))

    # --- User ---
    user_lines = [
        "## User (the person sending the outreach)",
        f"- Name: {_safe(user.name)}",
    ]
    if user_context_block:
        user_lines.append(user_context_block)
    else:
        user_lines.append("- Resume: Not provided yet")
        user_lines.append("- Onboarding answers: Not provided yet")
    sections.append("\n".join(user_lines))

    # --- Chat history ---
    if chat_history:
        history_lines = ["## Conversation so far"]
        for msg in chat_history:
            role_label = "Ref" if msg.role == "ref" else "User"
            content = msg.content or {}
            if msg.kind == "text":
                text = content.get("text", "")
                history_lines.append(f"[{role_label}]: {text}")
            elif msg.kind == "draft_card":
                text = content.get("text", "")
                history_lines.append(f"[Ref draft]: {text}")
            elif msg.kind == "action":
                action = content.get("action", "")
                history_lines.append(f"[User action]: {action}")
            # intel_card and action_buttons are UI chrome, skip them
        sections.append("\n".join(history_lines))

    return "\n\n".join(sections)
