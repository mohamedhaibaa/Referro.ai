"""REF-30: shared taxonomy for parse_reply intent categories.

Importable from both ref_ai.py (for response validation in the AI
service) and ref_chat.py (for the chat router's per-state response
emission and validation). Avoids cross-imports between service and
route modules.

Source: /docs/research/coffee_chat_conversion.md §4 (Common reply
types — categorization for parse_reply). Labels in INTENT_TO_LABEL
are user-facing — they appear in the chat classification chip.
"""

INTENT_CATEGORIES: list[str] = [
    "yes_to_coffee_chat",
    "send_resume",
    "im_slammed",
    "tell_me_more",
    "send_job_link",
    "apply_through_portal",
    "not_right_person",
    "maybe_later",
    "soft_no",
    "uncategorized",
]

INTENT_TO_LABEL: dict[str, str] = {
    "yes_to_coffee_chat":   "They want a coffee chat",
    "send_resume":          "They want your resume",
    "im_slammed":           "They're slammed right now",
    "tell_me_more":         "They want more info first",
    "send_job_link":        "They want the job link",
    "apply_through_portal": "They want you to apply via portal",
    "not_right_person":     "They redirected you to someone else",
    "maybe_later":          "They want you to follow up later",
    "soft_no":              "Soft no",
    "uncategorized":        "Couldn't classify confidently",
}

VALID_CONFIDENCE_LEVELS: set[str] = {"low", "med", "high"}


# REF-31: Ref's Voice-1 message per category — replaces REF-30's generic
# "Saved their reply. Classified as: ..." text. The classification chip
# (REF-30) still emits above this; the chip = AI's call, the text = Ref's
# recommendation. Different signals (DQ-E).
INTENT_TO_REF_TEXT: dict[str, str] = {
    "yes_to_coffee_chat":   "We're in! Let's lock the time before momentum dies.",
    "send_resume":          "Nice — they want the resume. Send it AND anchor a meeting in the same message, so it doesn't disappear into the void.",
    "im_slammed":           "They're busy. Take-away play: propose a specific future time so they don't have to volunteer their schedule.",
    "tell_me_more":         "They're gate-keeping with an essay request. Pull back to a quick call — easier for both of you.",
    "send_job_link":        "Positive signal. Send the link AND ask for the meeting in the same reply.",
    "apply_through_portal": "Apply the same day. Reply confirming you applied. Then check back in 5-7 days.",
    "not_right_person":     "Helpful redirect. The biggest gift here is a warm intro — ask them to mention you to the right person.",
    "maybe_later":          "Don't leave it vague. Pin a specific future date so it doesn't drift.",
    "soft_no":              "All good. Graceful close with the door cracked open keeps the relationship intact.",
    "uncategorized":        "Saved their reply. The classifier wasn't confident — pick what fits.",
}


# REF-31: per-category draft template emitted when user clicks the
# "Draft <pattern>" button. Each template uses {first} / {company} /
# {user_first} / {redirect_target_name} placeholders, filled via
# fill_template() below.
#
# yes_to_coffee_chat omitted — that category has no draft button (bridges
# to PostReplyView's scheduling picker instead).
#
# Source: /docs/research/coffee_chat_conversion.md §5 patterns.
INTENT_TO_DRAFT_TEMPLATE: dict[str, str] = {
    "send_resume": (
        "Attached. Quick one — would 15 min Tue 4pm or Thu 2pm be easier? "
        "Faster to walk you through why I'm a fit than this thread can do. "
        "Either way, appreciate it."
    ),
    "im_slammed": (
        "Totally get it. If it opens up next week, Tue 4 or Thu 2? "
        "I'll send a hold, you cancel if it doesn't work."
    ),
    "tell_me_more": (
        "Easier on a 15-min call than over text. Tue 4 or Thu 2?"
    ),
    "send_job_link": (
        "[paste job URL]. Quick one — would 15 min Tue 4pm or Thu 2pm "
        "work to chat through it? Faster than thread-trading."
    ),
    "apply_through_portal": (
        "Just submitted via the portal — req [###]. Wanted to flag it your "
        "way so it doesn't get buried. Open to a quick 15-min if you have it."
    ),
    "not_right_person": (
        "Appreciate the redirect to {redirect_target_name}. Would you be "
        "open to a quick intro / cc them on a short note? Saves me a cold "
        "reach."
    ),
    "maybe_later": (
        "Putting Thursday the [date] at 2pm in your calendar. Kill it if it "
        "doesn't work."
    ),
    "soft_no": (
        "All good. Appreciate you taking a look. If anything opens on the "
        "team later, I'll be here."
    ),
    "uncategorized": (
        "Hey {first}, following up on my note — let me know what works for you."
    ),
}


# REF-31: mapping from the action_kind suffix (after "draft_reply_") to the
# intent_category whose template should be used. Lets a single server handler
# dispatch on the suffix without re-encoding intent names.
DRAFT_ACTION_SUFFIX_TO_INTENT: dict[str, str] = {
    "send_and_anchor":         "send_resume",
    "send_a_hold":             "im_slammed",
    "easier_on_call":          "tell_me_more",
    "link_plus_meeting":       "send_job_link",
    "confirmed_applied":       "apply_through_portal",
    "warm_intro":              "not_right_person",
    "specific_future_anchor":  "maybe_later",
    "graceful_close":          "soft_no",
    "generic":                 "uncategorized",
}


def fill_template(template: str, contact, user, extracted_data: dict | None = None) -> str:
    """REF-31: interpolate {first}, {company}, {user_first},
    {redirect_target_name} placeholders. Missing values get sensible
    fallbacks rather than literal "{first}" strings.

    Templates without placeholders pass through str.format() unchanged.
    Uses getattr so this module doesn't import SQLAlchemy models — keeps
    the dependency direction clean (taxonomy ← consumers, not vice versa).
    """
    first = (getattr(contact, "full_name", None) or "there").split(" ")[0]
    company = getattr(contact, "company", None) or "the team"
    user_first = (getattr(user, "name", None) or "").split(" ")[0] if user else ""
    extracted = extracted_data or {}
    redirect = (extracted.get("redirect_target_name") or "").strip() or "the person you mentioned"
    return template.format(
        first=first,
        company=company,
        user_first=user_first,
        redirect_target_name=redirect,
    )
