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
from app.db.models.job import Contact, RefChatMessage
from app.db.models.user import User
from app.prompts.ref_context import build_ref_context
from app.prompts.ref_system_prompt import REF_SYSTEM_PROMPT
from app.prompts.user_context import build_user_context_block

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
) -> dict:
    """Generate the first outreach draft for a contact.

    Returns {"chat": str, "draft": str, "play": str}.
    Falls back to a simple template on AI failure.
    """
    user_context = build_user_context_block()
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
) -> dict:
    """Revise an existing draft based on the user's instruction.

    Returns {"chat": str, "draft": str}.
    Falls back to echoing the instruction on AI failure.
    """
    user_context = build_user_context_block()
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
