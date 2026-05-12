"""User context block for Ref AI calls.

Future home of resume parsing and onboarding-answer formatting.
When these features ship, this module will export a function that
returns a formatted string block to be injected into the Ref context.

For now, returns None so ref_context.py falls back to the
"Not provided yet" placeholder.
"""


def build_user_context_block() -> None:
    """TODO: Accept user model + resume + onboarding answers,
    return a formatted string block for the Ref context.

    Expected sections (when implemented):
    - Resume summary (skills, experience, education)
    - Onboarding answers (why this company, what they want next,
      preferred meeting format, stated gender for pet-name selection)
    """
    return None
