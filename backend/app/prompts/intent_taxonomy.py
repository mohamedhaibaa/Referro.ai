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
