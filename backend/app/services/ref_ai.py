"""REF-17: Sync AI client for Ref draft generation and revision.

The worker uses an async AI Foundry client; the backend API is sync,
so this module provides a synchronous httpx call to the same Azure
OpenAI endpoint.
"""
import json
import logging
from typing import Optional

import httpx

from app.core.config import settings
from sqlalchemy.orm import Session

from app.db.models.job import Contact, RefChatMessage
from app.db.models.user import User
from app.prompts.ref_context import build_ref_context
from app.prompts.ref_system_prompt import REF_SYSTEM_PROMPT
from app.prompts.user_context import build_user_context, render_user_context_block

logger = logging.getLogger(__name__)

DEPLOYMENT = "gpt-4o-mini"
API_VERSION = "2024-02-01"
_TIMEOUT = 30.0


def _call_ai_foundry(system_prompt: str, user_message: str) -> str:
    """Synchronous call to Azure AI Foundry. Returns raw content string."""
    endpoint = settings.AI_FOUNDRY_ENDPOINT.rstrip("/")
    url = (
        f"{endpoint}/openai/deployments/{DEPLOYMENT}"
        f"/chat/completions?api-version={API_VERSION}"
    )
    headers = {
        "api-key": settings.AI_FOUNDRY_API_KEY,
        "Content-Type": "application/json",
    }
    payload = {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        "temperature": 0.7,
    }
    resp = httpx.post(url, headers=headers, json=payload, timeout=_TIMEOUT)
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def _parse_ref_response(raw: str) -> dict:
    """Parse the JSON response from Ref. Tolerant of markdown fences."""
    text = raw.strip()
    if text.startswith("```"):
        # Strip ```json ... ``` fencing
        lines = text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        logger.warning("Failed to parse Ref AI response as JSON: %s", text[:200])
        return {"chat": text}


def generate_initial_draft(
    contact: Contact,
    job: "object",
    user: User,
    chat_history: list[RefChatMessage],
    db: Session,
) -> dict:
    """Generate the first outreach draft for a contact.

    Returns {"chat": str, "draft": str, "play": str}.
    Falls back to a simple template on AI failure.

    REF-33a: db parameter threaded through so build_user_context
    can JOIN user_profiles. Rich context flows into the prompt
    when the user has uploaded a resume; thin-context behavior
    (the "Resume not yet provided" marker) is unchanged for
    users without a profile row.
    """
    user_context = render_user_context_block(build_user_context(user, db))
    context = build_ref_context(contact, job, user, chat_history, user_context)

    first = (contact.full_name or "there").split(" ")[0]
    instruction = (
        f"The user just confirmed that {first} accepted their LinkedIn connection request. "
        f"Generate the first outreach message (LinkedIn DM, under 300 characters) for {first}. "
        "Pick the best play from your playbook based on the referrer's profile. "
        "Return JSON with chat, draft, and play keys."
    )
    user_message = f"{context}\n\n## Your task\n{instruction}"

    try:
        raw = _call_ai_foundry(REF_SYSTEM_PROMPT, user_message)
        parsed = _parse_ref_response(raw)
        if "draft" not in parsed or "chat" not in parsed:
            raise ValueError("Missing required keys in AI response")
        return parsed
    except Exception:
        logger.exception("Ref AI draft generation failed, using fallback")
        return _fallback_draft(contact)


def revise_draft(
    contact: Contact,
    job: "object",
    user: User,
    chat_history: list[RefChatMessage],
    current_draft: str,
    user_instruction: str,
    edit_number: int,
    db: Session,
) -> dict:
    """Revise an existing draft based on the user's instruction.

    Returns {"chat": str, "draft": str}.
    Falls back to echoing the instruction on AI failure.

    REF-33a: db threaded through (see generate_initial_draft).
    """
    user_context = render_user_context_block(build_user_context(user, db))
    context = build_ref_context(contact, job, user, chat_history, user_context)

    instruction = (
        f"The user wants to tweak the current outreach draft. This is edit #{edit_number}.\n\n"
        f"Current draft:\n\"{current_draft}\"\n\n"
        f"User's instruction: \"{user_instruction}\"\n\n"
        "Revise the draft according to their instruction. Keep it under 300 characters (LinkedIn DM). "
        "Return JSON with chat and draft keys."
    )
    user_message = f"{context}\n\n## Your task\n{instruction}"

    try:
        raw = _call_ai_foundry(REF_SYSTEM_PROMPT, user_message)
        parsed = _parse_ref_response(raw)
        if "draft" not in parsed or "chat" not in parsed:
            raise ValueError("Missing required keys in AI response")
        return parsed
    except Exception:
        logger.exception("Ref AI draft revision failed, using fallback")
        return {
            "chat": "Tightened it up.",
            "draft": user_instruction,
        }


def _build_contact_summary_for_classification(contact: Contact, job: "object") -> str:
    """REF-30: tight contact+job summary for the classifier prompt.
    Smaller than build_ref_context — no chat history needed for classification."""
    first = (contact.full_name or "there").split(" ")[0]
    return (
        f"## Contact\n"
        f"- Name: {contact.full_name or 'Unknown'} (first: {first})\n"
        f"- Title: {contact.title or 'Unknown'}\n"
        f"- Company: {contact.company or 'Unknown'}\n\n"
        f"## Job\n"
        f"- Title: {getattr(job, 'title', 'Unknown')}\n"
        f"- Company: {getattr(job, 'company', 'Unknown')}\n"
    )


def _call_ai_foundry_with_temp(system_prompt: str, user_message: str, temperature: float = 0.7) -> str:
    """REF-30: variant of _call_ai_foundry with configurable temperature.
    Classification wants 0.2 (deterministic); generation stays at 0.7.
    Kept as a separate function so the existing _call_ai_foundry contract
    doesn't change (no behavior shift for generate_initial_draft / revise_draft)."""
    endpoint = settings.AI_FOUNDRY_ENDPOINT.rstrip("/")
    url = (
        f"{endpoint}/openai/deployments/{DEPLOYMENT}"
        f"/chat/completions?api-version={API_VERSION}"
    )
    headers = {"api-key": settings.AI_FOUNDRY_API_KEY, "Content-Type": "application/json"}
    payload = {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        "temperature": temperature,
    }
    resp = httpx.post(url, headers=headers, json=payload, timeout=_TIMEOUT)
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def parse_reply(
    contact: Contact,
    job: "object",
    user: User,
    reply_text: str,
) -> dict:
    """REF-30: classify the contact's reply into one of 10 intent categories.

    Returns:
        {
          "intent_category": str,   # one of INTENT_CATEGORIES; "uncategorized" if uncertain
          "confidence": str,        # "low" | "med" | "high"
          "extracted_data": dict,   # category-specific; {} if none
          "chat_message": str,      # Ref's Voice-1 acknowledgment (fallback)
          "reasoning": str,         # short rationale, surfaced in raw_ai_response only
        }

    Failure mode: any exception (AI down, timeout, invalid JSON, missing keys,
    unknown intent value) returns the uncategorized-low fallback. The handler
    still saves the reply text + sets replied_at — the classification is
    best-effort metadata.

    Token / cost (gpt-4o-mini): ~$0.0004/call. Temperature 0.2 for determinism.
    """
    from app.prompts.intent_taxonomy import INTENT_CATEGORIES, VALID_CONFIDENCE_LEVELS
    from app.prompts.reply_classifier import REPLY_CLASSIFIER_SYSTEM_PROMPT

    contact_summary = _build_contact_summary_for_classification(contact, job)
    user_message = (
        f"{contact_summary}\n\n"
        f"## Contact's reply\n<reply>\n{reply_text}\n</reply>\n\n"
        "Classify and return JSON."
    )

    try:
        raw = _call_ai_foundry_with_temp(
            REPLY_CLASSIFIER_SYSTEM_PROMPT,
            user_message,
            temperature=0.2,
        )
        parsed = _parse_ref_response(raw)
        for key in ("intent_category", "confidence", "chat_message"):
            if key not in parsed:
                raise ValueError(f"Missing required key in parse_reply response: {key}")
        # Coerce unknown enum values to uncategorized/low rather than trust the AI blindly.
        if parsed["intent_category"] not in INTENT_CATEGORIES:
            logger.warning(
                "parse_reply returned unknown intent_category=%r; coercing to uncategorized",
                parsed["intent_category"],
            )
            parsed["intent_category"] = "uncategorized"
            parsed["confidence"] = "low"
        if parsed["confidence"] not in VALID_CONFIDENCE_LEVELS:
            parsed["confidence"] = "low"
        parsed.setdefault("extracted_data", {})
        parsed.setdefault("reasoning", "")
        return parsed
    except Exception:
        logger.exception("parse_reply failed, using uncategorized fallback")
        return {
            "intent_category": "uncategorized",
            "confidence": "low",
            "extracted_data": {},
            "chat_message": (
                "Saved their reply. The classifier wasn't confident — "
                "pick what fits."
            ),
            "reasoning": "AI classification failed; defaulted to uncategorized.",
        }


def _empty_parse_result() -> dict:
    """REF-33a: all-empty parse_resume fallback."""
    return {
        "skills": [],
        "experience_years": None,
        "experience_summary": "",
        "education": "",
        "job_titles_history": [],
        "raw_ai_response": None,
    }


def parse_resume(raw_text: str, file_meta: dict | None = None) -> dict:
    """REF-33a: extract structured profile fields from resume text.

    Returns:
        {
          "skills": list[str],
          "experience_years": int | None,
          "experience_summary": str,
          "education": str,
          "job_titles_history": list[str],
          "raw_ai_response": dict | None,
        }

    Failure mode: returns all-empty fields (the upload endpoint
    still succeeds with parse_failed=true so the user can manually
    PATCH via the settings page). Same defensive posture as
    parse_reply.

    Token / cost (gpt-4o-mini): ~$0.0009/call. Temperature 0.2.
    """
    from app.prompts.resume_parser import RESUME_PARSER_SYSTEM_PROMPT

    if not raw_text or not raw_text.strip():
        logger.info("parse_resume: empty input, returning empty fields")
        return _empty_parse_result()

    # Truncate at 20K chars to bound token cost on absurdly long
    # inputs (8-page resumes still fit comfortably).
    user_message = (
        f"## Resume text\n<resume>\n{raw_text[:20000]}\n</resume>\n\n"
        "Extract and return JSON."
    )

    try:
        raw = _call_ai_foundry_with_temp(
            RESUME_PARSER_SYSTEM_PROMPT,
            user_message,
            temperature=0.2,
        )
        parsed = _parse_ref_response(raw)
        for key in ("skills", "experience_years", "experience_summary",
                    "education", "job_titles_history"):
            if key not in parsed:
                raise ValueError(f"Missing required key in parse_resume response: {key}")
        return {
            "skills": parsed["skills"] if isinstance(parsed["skills"], list) else [],
            "experience_years": parsed["experience_years"] if isinstance(parsed["experience_years"], int) else None,
            "experience_summary": str(parsed["experience_summary"] or ""),
            "education": str(parsed["education"] or ""),
            "job_titles_history": parsed["job_titles_history"] if isinstance(parsed["job_titles_history"], list) else [],
            "raw_ai_response": parsed,
        }
    except Exception:
        logger.exception("parse_resume failed, returning empty fields")
        return _empty_parse_result()


def _build_contact_summary_for_followup(contact: Contact, job: "object") -> str:
    """REF-32: contact + job summary for follow-up generation.

    Heavier than _build_contact_summary_for_classification (gives
    the AI bio + past positions so it can write contextual drafts);
    lighter than build_ref_context (no chat history — that comes in
    via the explicit initial_outreach_text parameter, per DD-3).
    """
    from app.prompts.ref_context import _extract_profile_highlights

    first = (contact.full_name or "there").split(" ")[0]
    highlights = (
        _extract_profile_highlights(contact.profile_data)
        if contact.profile_data
        else {}
    )

    lines = [
        "## Recruiter / contact",
        f"- Name: {contact.full_name or 'Unknown'} (first: {first})",
        f"- Title: {contact.title or 'Unknown'}",
        f"- Company: {contact.company or 'Unknown'}",
    ]
    if contact.location:
        lines.append(f"- Location: {contact.location}")
    if contact.university:
        lines.append(f"- University: {contact.university}")
    if highlights.get("bio"):
        lines.append(f"- Bio: {highlights['bio']}")
    if highlights.get("education"):
        # Take the first/most-recent only — concise context, not a full transcript.
        edu = highlights["education"][0]
        edu_str = edu.get("school") or "Unknown"
        if edu.get("degree"):
            edu_str = f"{edu['degree']}, {edu_str}"
        lines.append(f"- Top education: {edu_str}")
    if highlights.get("positions"):
        lines.append("- Past/current positions:")
        for pos in highlights["positions"][:3]:
            title = pos.get("title") or "Unknown role"
            company = pos.get("company") or "Unknown company"
            lines.append(f"  - {title} at {company}")

    lines.append("")
    lines.append("## Job posting")
    lines.append(f"- Title: {getattr(job, 'title', 'Unknown')}")
    lines.append(f"- Company: {getattr(job, 'company', 'Unknown')}")
    if getattr(job, "role_family", None):
        lines.append(f"- Role family: {job.role_family}")
    if getattr(job, "work_mode", None):
        lines.append(f"- Work mode: {job.work_mode}")
    # REF-32 iteration: deliberately OMITTING job.description here.
    # The JD's required-skills list (e.g. "Strong Python, Java, REST APIs")
    # leaks into the AI's view of the USER when the recruiter asks about
    # background — the AI conflates "role requires" with "user has" and
    # fabricates skill claims. Keep the role categorical only; the
    # recruiter's reply text is the source of truth for what they asked.

    return "\n".join(lines)


def generate_followup(
    contact: Contact,
    job: "object",
    user_context: "object",  # UserContext (avoid circular import at top)
    recruiter_reply_text: str,
    intent_category: str,
    extracted_data: dict,
    initial_outreach_text: Optional[str] = None,
) -> dict:
    """REF-32: write a contextual coffee-chat conversion follow-up.

    Returns:
        {
          "draft_text": str,   # message text user will copy + send
          "play": str,         # pattern name for ai_meta logging
          "reasoning": str,    # rationale for offline eval
        }

    Raises on ANY failure (AI down, JSON parse error, missing keys,
    empty draft_text). Caller is responsible for the REF-31 static
    template fallback — keeps the failure path explicit and out of
    the pure state machine.

    Per DD-5: temperature 0.7 (drafting is creative work).
    Per DD-9: initial_outreach_text may be None for legacy contacts;
    the prompt handles None defensively.

    Token / cost (gpt-4o-mini): ~$0.0005/call.
    """
    from app.prompts.followup_generator import FOLLOWUP_GENERATOR_SYSTEM_PROMPT
    from app.prompts.user_context import render_user_context_block

    contact_summary = _build_contact_summary_for_followup(contact, job)
    user_block = render_user_context_block(user_context)
    extracted_json = json.dumps(extracted_data) if extracted_data else "{}"

    parts = [
        contact_summary,
        "",
        "## User context",
        user_block,
        "",
        f"## Recruiter's reply\n<reply>\n{recruiter_reply_text}\n</reply>",
        "",
        "## Classification",
        f"- intent_category: {intent_category}",
        f"- extracted_data: {extracted_json}",
    ]
    if initial_outreach_text:
        parts.extend([
            "",
            "## User's initial outreach (what they sent first)",
            f"<initial>\n{initial_outreach_text}\n</initial>",
        ])
    else:
        parts.extend([
            "",
            "## User's initial outreach",
            "(not available — write fresh without referencing prior outreach)",
        ])
    parts.extend(["", "Now write the draft. Return JSON."])
    user_message = "\n".join(parts)

    raw = _call_ai_foundry_with_temp(
        FOLLOWUP_GENERATOR_SYSTEM_PROMPT,
        user_message,
        temperature=0.7,
    )
    parsed = _parse_ref_response(raw)
    for key in ("draft_text", "play", "reasoning"):
        if key not in parsed:
            raise ValueError(f"Missing required key in generate_followup response: {key}")
    if not str(parsed["draft_text"]).strip():
        raise ValueError("generate_followup returned empty draft_text")
    return parsed


def _fallback_draft(contact: Contact) -> dict:
    """Template fallback when AI is unavailable."""
    first = (contact.full_name or "there").split(" ")[0]
    company = contact.company or "the team"
    draft = (
        f"Hi {first},\n\n"
        f"Came across your work at {company} and noticed you've been there for a while. "
        "I'm exploring opportunities in a similar space and would love to hear how "
        "you got into the team.\n\n"
        "Would you be open to a quick 15-minute chat?\n\n"
        "Thanks!"
    )
    return {
        "chat": (
            "Let's go. Time to send the outreach. Here's what "
            "I'd open with, tell me what to tweak, or hit \"Looks "
            "fire\" if it's good."
        ),
        "draft": draft,
        "play": "Fallback template (AI unavailable)",
    }
