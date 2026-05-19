"""REF-32 (DD-12): Shared reply-handling playbook.

Single source of truth for per-category conversion patterns.
Imported by:
  - backend/app/prompts/ref_system_prompt.py (initial draft
    generation — AI is primed for the reply scenarios that will
    eventually land)
  - backend/app/prompts/followup_generator.py (REF-32 per-category
    follow-up draft generation — primary consumer)

Avoids drift between the two prompts. Source material:
  - REF_SYSTEM_PROMPT §6 (the original meeting-funnel table)
  - /docs/research/coffee_chat_conversion.md §4 (categories)
  - /docs/research/coffee_chat_conversion.md §5 (patterns)

Categories align 1:1 with backend/app/prompts/intent_taxonomy.py.
The 9 draftable categories + yes_to_coffee_chat + uncategorized
all appear; REF-31's draft buttons skip yes_to_coffee_chat
(handled by the scheduling bridge in PostReplyView) but the
playbook lists it for prompt completeness.
"""

CONVERSION_PATTERNS = """\
## Meeting-Funnel Moves (per-reply playbook)

When a referrer replies, classify the intent, then pick the right
pivot. Every pivot funnels toward a 15-minute coffee chat.

### yes_to_coffee_chat — "Sure, happy to chat"
Real positive — the chat is committed. Don't let momentum die.
**Pivot:** Propose 2 specific times IMMEDIATELY. Offer to send the
calendar hold. Speed matters — 20-30% of "yes" responses never
schedule, and the gap between yes and a booked invite is the
biggest single dropoff point.

### send_resume — "Send me your resume"
Soft positive. The default trajectory if you just send the resume
is it disappears into the void. **Pivot:** Send the resume AND
anchor a meeting in the SAME message. After the resume is sent,
the only options for them are pick a time or actively decline.
Pattern: "Attached. Quick one — would 15 min Tue 4pm or Thu 2pm
be easier? Faster to walk you through why I'm a fit than this
thread can do."

### im_slammed — "I'm pretty slammed right now"
Genuinely busy OR polite-deflection — indistinguishable. **Pivot:**
Take-away + specific future anchor. Don't ask "when's a good time?"
— propose it. Use the send-a-hold-you-cancel mechanic; inverting
the friction lifts yes rates because they only have to actively
decline.
Pattern: "Totally get it. If it opens up next week, Tue 4 or Thu 2?
I'll send a hold, you cancel if it doesn't work."

### tell_me_more — "Tell me more about what you're looking for"
Genuinely interested but gate-keeping their time — they want the
essay so they don't have to do a coffee chat. **Pivot:** Refuse the
email essay, pull back to a coffee chat. Lower effort for them,
higher conversion for you.
Pattern: "Easier on a 15-min coffee chat than over text. Tue 4 or Thu 2?"
**Nuance:** if the reply ALSO offers specific lanes of help
(e.g., "I can advise on X / Y / Z — which do you want?"), engage
with at least one lane briefly, THEN pull to coffee chat. Don't ignore
offered help — engaging shows you actually read what they wrote
and respects their time.

### send_job_link — "Send me the job link / What req?"
Positive signal — they want to look it up. **Pivot:** Send the
link AND ask for the meeting in the same reply. The user pastes
the actual job URL at copy time — your draft just leaves a clear
marker like "[paste job link here]" for them to fill in.
Pattern: "[paste job link here]. Quick one — would 15 min Tue
4pm or Thu 2pm work to talk through it? Faster than
thread-trading."
**DO NOT** write "the req number is X" or "the link is Y" — those
read as the AI making things up. The user is the one with the
actual link / req. Leave a clear placeholder for them to fill in
at copy time.

### apply_through_portal — "Apply through our portal"
Three sub-types: real ATS-only policy, polite no, or filter test
(applicants who follow through get noticed). **Pivot:** Apply
same-day. Reply confirming you applied (req number if available).
The applying-and-confirming loop converts the policy and filter
cases into actual interviews. Polite-no cases stay no — accept
gracefully.
Pattern: "Just submitted via the portal — req [###]. Wanted to
flag it your way so it doesn't get buried. Open to a quick 15-min
if you have it."

### not_right_person — "Try [Name]"
Highest-value reply type. The warm hand-off lifts the new
outreach's reply rate dramatically. **Pivot:** Thank them and ask
if they'd mention you to [Name] OR cc [Name] in a short intro.
Don't just take the name and cold-message [Name] yourself — the
warm hand-off is the real gift.
Pattern: "Appreciate the redirect to [Name]. Would you be open to
a quick intro / cc them on a short note? Saves me a cold reach."

### maybe_later — "Reach out in a few weeks"
Soft positive with a real timer. Could be genuine ("we're paused
on hiring") or polite-no. **Pivot:** Specific future anchor —
don't leave it vague. Pin a real date. **NEVER** say "I'll reach
back in N weeks" — that's the lazy default that leaves the ball
in their court and almost always dies.
Pattern: "Putting Thursday the [date] at 2pm in your calendar.
Kill it if it doesn't work."
The user fills in the actual date at copy time. Your draft leaves
[date] as a clear marker. The mechanic: pin the specific day,
offer the easy escape ("kill it if..."), inverting who has to
act.

### soft_no — "Not a fit right now"
Mostly real. The genuine close. **Pivot:** Graceful close + door
open. Don't argue, don't pitch again. Keeps the relationship
intact for future opportunities.
Pattern: "All good. Appreciate you taking a look. If anything
opens on the team later, I'll be here."

### uncategorized — couldn't classify confidently
Don't guess at the intent. **Pivot:** Generic warm bump that
proposes a quick coffee chat without pretending to know what they meant.
Pattern: "Hey [first], following up on my note — let me know what
works for you. Happy to jump on a quick 15 min if useful."

---

## Core principles, encoded

- Never let the referrer hold the calendar. Always propose two
  specific times and offer to send the invite.
- 15 minutes is the magic anchor. Never longer, never vaguer.
- Mini-yes ladder. Each reply advances one step: vague interest,
  specific time, invite sent, meeting held.
- Take-away paradox. "No pressure either way" raises yes rates.
- Permission-based. "Mind if I send a calendar hold so we don't
  lose this?" beats "let me know when you're free."
- Engage with what was said. Never ignore content the referrer
  offered (specific lanes of help, timing constraints, mentioned
  colleagues). Acknowledge before pivoting.
"""
