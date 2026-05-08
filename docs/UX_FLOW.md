# Referro UX Flow

**A walkthrough of the product experience, from first URL paste to landed offer — including every path that doesn't end in an offer — and the design thinking behind each moment.**

---

## Audience for this document

This is written for four readers:

- **The UX designer** thinking about polish and consistency
- **The cofounder** needing a shared mental model of how the product flows
- **The investor** evaluating whether the product thinking is coherent
- **Future me** trying to remember why a decision was made three months from now

---

## The core product promise

**Land jobs through people, not portals.**

Every design decision in Referro is subordinate to that sentence. When users submit a job URL, they're not applying — they're building a plan to reach the humans inside that company who can vouch for them. The entire product is about making that motion feel inevitable rather than exhausting.

---

## Part 1 — The full happy path

Let's follow a user named Mo who wants to land a role at Apple. He pastes the LinkedIn job URL on the Home page.

### Moment 1 — Home

Mo sees a simple composed page: his name greets him, there's an input field for a LinkedIn URL, and a credit indicator. That's it.

**Why so sparse:** The home page isn't a dashboard. It's a runway. Dashboards invite users to browse and defer action. Runways invite users to act. Mo isn't here to review — he's here to start something.

He pastes the URL and submits.

### Moment 2 — Referroing

A full-page overlay takes over everything except the sidebar. The word "Referroing" pulses letter-by-letter in large serif. Small rotating stage text shifts through phases:

- "Scraping the job..."
- "Parsing details..."
- "Finding your company..."
- "Finding your contacts..."
- "Ranking by fit..."
- "Almost there..."

Below, three dots pulse softly. A small CTA in the corner says "keep working →" — suggesting Mo can do other things while this runs.

**Why this moment matters:** Under the hood, two distinct workflows run — job parsing, then contact discovery. The naïve UX would be: show a loader → navigate to the Room → show another loader → show contacts. Two waiting moments, each with their own anxiety.

We chain them into a single cohesive moment called "Referroing." The technology is two systems, but the experience is one motion. Users perceive ~45 seconds of anticipation instead of two confusing stages.

The stage text rotating through six phases is deliberate. It's not a progress bar (users hate those — they always lie), it's a narration. Users know what's happening, feel informed, and can see the system working on their behalf. It's the same emotional pattern as watching a restaurant kitchen cook your order through a pass-through window.

### Moment 3 — Landing in the Room

Referroing ends. Mo arrives in the Room — a page dedicated to this single job. Header shows the title, company, and a stage pill ("Ready to reach out"). Below: "Pick your contacts" with three contact cards already rendered.

Each card shows a photo, name, title, relevance badge (High fit / Medium fit / Low fit), a tag explaining the connection (same university, mutual interests, etc.), and a "View on LinkedIn" link.

**Why three contacts, not one, not ten:** One contact is a single point of failure — if they ghost, Mo's dead. Ten is paralysis — Mo will spend a week researching and contact nobody. Three creates forward motion. Behavioral science calls this the "Goldilocks zone" for decision-making. Three is also a story: the chosen ones, a portfolio, a team.

There's a "Regenerate" button if the three aren't right. Under the hood, the contact discovery worker goes back to LinkedIn to find three more — up to nine unique profiles across three batches. After that, "regenerate" becomes "revisit" — the pool refreshes.

### Moment 4 — Selection

Mo clicks checkmarks on his three favorites. A "Confirm Selection" button appears at the bottom right. Badge: "3/3 selected."

The selection mechanic is intentional friction. We could autocontact everyone. But asking Mo to choose creates ownership. These aren't leads a machine chose for him — they're people he chose to engage. When one replies, Mo will remember choosing them. That memory matters three weeks later.

He clicks Confirm. The page transitions to Phase 2.

### Moment 5 — Phase 2

Same Room, but now the three contact cards look different. Each shows a status badge: "Not contacted." The title changes to reflect that this is now about action, not selection.

Mo clicks the first card — Mary Ishaq, Technical Expert at Apple.

### Moment 6 — The Contact Popup

A modal overlay. Behind it, the Room blurs. Sidebar stays crisp. The popup itself: Mary's photo, name, title, current lifecycle state ("Not contacted"), then a small visual state timeline (5 dots: Not contacted → Outreach → Replied → Meeting → Outcome) with the first dot highlighted.

Below: a single "Draft message" button with a small ✨ badge reading "placeholder — real AI generation coming soon." A secondary link underneath: "Or send a pitch deck →"

**Why a modal and not a separate page:** Job search is a series of focused tasks. Each contact is its own sub-quest. Navigating away from the Room would break the sense of holding this job in your working memory. A modal focuses attention without losing context — when Mo dismisses it, he's still in the Room, still seeing his other two contacts.

**Why blur the background:** Not decoration. The blur is a reading affordance. When users open the modal, their eyes need to focus on the modal content. A blurred Room stays visible as spatial context but stops competing for attention.

**Why the sidebar stays crisp:** Navigation shouldn't disappear just because Mo is in a task. If he needs to leave, the exit should be visible.

### Moment 7 — Drafting

Mo clicks "Draft message." A textarea appears pre-filled with a stub placeholder (real AI generation comes later). He edits it. The system auto-saves every keystroke (debounced). No save button — if Mo closes the popup, the draft persists.

There's a Copy button to copy the message to clipboard. There's a "Mark sent" button for when he's actually pasted it into LinkedIn and sent it.

**Why manual copy-paste instead of API-send:** LinkedIn doesn't have a public API for sending messages. More importantly, Mo as a human sending his own message from his own account is more authentic than an AI-sounding cold DM from a SaaS tool. Referro drafts the ammo; Mo fires the gun.

**Why auto-save with no button:** Save buttons are an anti-pattern in 2026. Users trust that their work is preserved. A save button implies the opposite — that if you forget, you lose. We never want Mo to have that anxiety mid-draft.

He copies, pastes into LinkedIn, sends. Back in Referro: "Mark sent." State advances. Timeline's second dot lights up.

### Moment 8 — The waiting game

For a few days, nothing happens. Mo returns to check. Popup shows "Sent" state, with three options:

- **They replied** — progresses to next stage
- **Send follow-up** — creates a second draft
- **No reply yet** — implicit, no action needed

Below, an accordion shows the message he sent (collapsed, click to expand). Another small timeline of activity: "Sent initial message — 3 days ago."

**Why show the original message when he comes back:** He'll forget what he wrote. Every serious communication tool — email, Slack, Messages — shows the conversation. Referro does the same. Mo should see exactly what Mary saw, because his follow-up strategy depends on what came before.

### Moment 9 — Follow-up

No reply after 4 days. Mo clicks "Send follow-up." Textarea opens with a fresh placeholder. He writes something short. Copies, sends on LinkedIn, marks sent.

There's a cap of two follow-ups total. After follow-up 2 sent with no reply, Mo's options are "Mark replied" or (eventually) recording an outcome of "Lost touch."

**Why two follow-ups, not unlimited:** Unlimited would enable Mo to spam Mary. Zero would mean most contacts never convert. Two is the social norm. Any sophisticated salesperson will tell you the same. Past two, the follow-ups start to damage the relationship rather than build it.

### Moment 10 — Reply

Mary replies on LinkedIn ("Happy to chat — are you free Tuesday?"). Mo comes back to Referro and clicks "They replied."

State advances to "Replied." The popup redraws. New view: three buttons — "Schedule coffee chat," "Schedule interview," "Record outcome." Below: the activity timeline is now richer, showing "They replied — just now" on top.

**Why three options at this stage:** Reality is messy. Most contacts go through a coffee chat first, but some leapfrog straight to an interview. Some reply with "Sorry, I can't help" and become outcomes. We let Mo match reality, not force him into our sequence.

### Moment 11 — Coffee chat scheduled

Mo clicks "Schedule coffee chat." A date picker opens. He picks Tuesday 3pm. Confirms. State advances.

New view: "Coffee chat scheduled." Buttons: "Mark completed," "Reschedule," "Prep for this," "Record outcome." The "Prep for this" button navigates to a Coffee Chat Prep page (currently stubbed — eventually AI-generated questions, talking points, recap of Mary's background).

**Why "Prep for this" and not auto-open on state change:** User agency. Maybe Mo wants to prep today. Maybe he wants to prep Monday night. We don't decide for him. The button is visible when prep is relevant; he clicks when he's ready.

### Moment 12 — Coffee chat happens

Mo has the chat. Returns to the popup. Clicks "Mark completed."

State advances. Buttons narrow: "Schedule interview" or "Record outcome." The chat went well — Mary offered to introduce him to the hiring manager. Mo schedules an interview.

Behind the scenes, the job-level stage pill on the Jobs page has been evolving: from "Outreach Sent" → "In Conversation" → "Coffee Chat" → now "Interview Stage." Mo's other two contacts may be at different stages. The pill always reflects his most-progressed contact.

**Why the pill aggregates across contacts:** A job isn't "at" one stage — it's at the furthest stage any contact has reached. If Mary is interviewing, even if Neil and Luis haven't replied, the job is meaningfully in "Interview Stage."

### Moment 13 — Interview

Interview scheduled. Mo prepares. Interview happens. He comes back, marks "Interview completed."

Now only one button: "Record outcome." This is the terminal moment. No more scheduling. No more waiting. A decision has happened — Mo just has to report what.

### Moment 14 — The Offer

Mo clicks "Record outcome." A small nested dialog opens. It presents four choices relevant to this state:

- Got the offer 🎉
- Rejected
- Lost touch
- Withdrew

No default selection. The Confirm button is disabled until Mo picks.

**Why no default:** Recording an outcome is emotionally loaded. If the system pre-selects "Got the offer" it feels presumptuous. If it pre-selects "Rejected" it feels pessimistic. The respectful move is to ask Mo to choose. The extra click is a feature, not a bug.

Mo picks "Got the offer 🎉" and clicks Confirm.

### Moment 15 — Landed 🎉

The popup transforms. Gradient background fades in — cream to gold. A 🎉 emoji pulses at the top. Huge serif headline: "You landed it!" Subtitle: "Thanks to Mary — she helped you get there."

Confetti fires in brand colors (gold, coral, cream) from both bottom corners of the screen.

Below the headline, two buttons:

- **Close** (primary, dark)
- **Share on LinkedIn** (secondary, with LinkedIn icon and coral accent)

Mo clicks Share. A new tab opens to LinkedIn's composer, pre-filled with:

> "Just landed my role as Enterprise Technical Consultant at Apple 🎉
>
> Instead of applying cold, I reached out to Mary directly — and here we are. Built my pipeline with Referro.
>
> Land jobs through people, not portals."

**Why the celebration is BIG, not subtle:** This is the emotional peak of the entire product. Everything — the URL paste, the drafting, the waiting, the coffee chat, the interview — leads here. If Referro's "win" moment feels like a checkbox ticked, we've missed the thing. The confetti isn't child-like; it's cathartic.

**Why the LinkedIn share button:** This is Referro's viral loop. Mo just had a life-changing moment. He's emotional, grateful, and public about it. Asking him to share isn't manipulative — it's natural behavior amplified by one button. Every landed offer becomes a testimonial. Every testimonial seeds the next user.

**Why it's a suggestion, not required:** Some users are private. Some jobs are sensitive. Referro never forces the share — it offers it. The Close button is the primary action, not Share. We're respectful of the moment.

**Why the celebration fires only once per contact:** Reopening the contact later should show a calm "Landed" state, not re-fire confetti. The emotional impact needs to be a singular memory, not a recurring loop. localStorage tracks which contacts have been celebrated.

---

## Part 2 — The unhappy paths

Real life doesn't deliver offers on the first contact. Here's what Referro does when things go sideways.

### Path A — Nothing responds, ever

Mo sends an initial message to Mary. No reply in 5 days. Sends follow-up 1. No reply in 5 more days. Sends follow-up 2. Still nothing in a week.

After follow-up 2 sent, Mo's only meaningful action is to acknowledge the contact went cold. He clicks "Record outcome." The dialog shows state-appropriate options. In the sent-but-no-reply state, he only sees:

- Withdrew (I chose to stop)
- Lost touch (went cold after messaging)

He picks "Lost touch." State becomes `outcome_lost_touch`. Popup now shows a calm, muted view — no celebration, no alarm. Just "Lost touch" and an "Undo outcome" link in case he was wrong.

**Why "Lost touch" and not "Ghosted":** Semantic clarity. "Ghosted" implies a single behavior; "Lost touch" describes what actually happened across all the different ways contacts go silent. It also carries less judgment — real people get busy and don't always mean to ghost. We don't want Mo cursing Mary when she might have had a death in the family.

**Why the muted treatment:** When one contact path closes, the world hasn't ended. Mo still has two other contacts at Apple. The UI should match — quiet, not catastrophic. The muted banner in Phase 2 ("This path has closed") only appears if ALL three contacts close out without an offer.

### Path B — Reply, then ghost

Mary replies once. Mo clicks "They replied." He messages to schedule a coffee chat. She goes silent for a week.

Mo reopens the popup. It's still in "Replied" state — Referro doesn't auto-decay states. But now Mo has three outcome options:

- Withdrew
- Not the right person (she redirected or said she can't help)
- Lost touch

He picks "Lost touch." Muted outcome.

**Why state-aware outcomes:** The outcomes possible at "Replied" are different from the outcomes possible at "Interview completed." At Replied, there's no offer to be gotten or rejected from. The dialog shows only semantically valid choices. Forcing a "Rejected" option here would make no sense — rejected from what?

### Path C — Coffee chat happens, dead end

Coffee chat goes well, but Mary doesn't have influence on hiring. She wishes Mo luck but can't do more.

Mo clicks "Mark completed" on the coffee chat, then "Record outcome." Options at this state:

- Not a fit (chat happened, nothing more to go on)
- Lost touch
- Withdrew

He picks "Not a fit." State becomes `outcome_not_a_fit`. Contact closes.

**Why "Not a fit" is distinct from "Rejected":** Rejection is formal — an interview ended with "no." Not a fit is informal — a coffee chat revealed no path forward. The words track the reality. When Mo shows this to a therapist or a friend months from now, "Not a fit" doesn't carry the sting of "rejected."

### Path D — Interview gets cancelled

Mo schedules an interview. Two days before, HR calls — they paused the role. No interview happening.

Mo clicks "Record outcome" from the "Interview scheduled" state. Options:

- Withdrew (I pulled out)
- Company cancelled (they cancelled)
- Lost touch (rescheduled forever, never happened)

He picks "Company cancelled." The outcome reflects that the loss wasn't personal — it was external circumstance.

**Why "Company cancelled" as a separate outcome:** Companies pulling roles is increasingly common. Treating it as "Rejected" would be inaccurate and demoralizing — Mo wasn't rejected. Treating it as "Withdrew" would be untrue — he didn't pull out. A dedicated outcome captures reality.

### Path E — Interview happens, rejected

Interview was good but didn't close. Rejection email arrives.

Mo clicks "Record outcome" from "Interview completed." Options expand here because it's the terminal decision state:

- Got the offer 🎉
- Rejected
- Lost touch
- Withdrew

He picks "Rejected." State becomes `outcome_rejected`. Popup shows a calm closed view. No celebration. "Undo outcome" is available if the rejection was provisional.

**Why no special consolation screen:** Users don't need a product to tell them rejection hurts — they already know. A "Sorry this didn't work out!" screen would feel patronizing. Calm silence respects the moment. Referro is there to help with the next contact, not dwell on this one.

### Path F — Mo withdraws

At any point, Mo might decide he doesn't want the job anymore. "Withdrew" is available from every state. No explanation needed. Contact closes with the appropriate outcome.

**Why "Withdrew" is always available:** User agency. Pulling out of a process is a valid life choice. Referro doesn't trap users into completing flows. The same logic that makes us not auto-send messages makes us respect when users want to stop.

### Path G — Pitch deck instead

Back at the "Not contacted" state. Mo sees the "Draft message" button but also a small link below: "Or send a pitch deck →"

He clicks. Navigates to a Pitch Deck page (currently stubbed — eventually will generate a visual, unhinged, attention-grabbing slide deck about Mo tailored to this role).

**Why pitch decks are an alternative, not a follow-up:** Real user experience tells us pitch decks grab attention way better than cold messages. But they're not for everyone or every contact. Some people respond to text, some to visuals. Giving Mo the choice at the "Not contacted" moment matches reality — he should pick his weapon, not have us dictate.

**Why the link is subordinate to "Draft message":** Most users still start with a message. Pitch deck is the alternative for users who know about it and want it. The hierarchy respects user expectations while enabling discovery.

---

## Part 3 — Undo: the unsung hero

Every state in Referro has an "Undo" button. If Mo accidentally clicks "Mark sent" when he hadn't actually sent the message yet, one click reverts. If he prematurely recorded an outcome of "Rejected" and then got an offer two days later, one click reverts.

**Why undo everywhere:**

- Users make mistakes. Software that punishes them feels hostile.
- Fear of mistakes causes hesitation. Hesitation is the enemy of momentum.
- The cost of implementing undo is small (one PATCH call to clear a timestamp). The emotional cost of not having it is large.

Undo is one-step-back only. Not a full history stack. This keeps the UI simple — "Undo your last thing" is unambiguous.

---

## Part 4 — Why the design choices matter

Let me step back and explain the big patterns.

### The 3-contact cap

Job search behavior is notoriously irrational. Users will spend three weeks researching "the perfect person to contact" and never reach out. Or they'll blast messages to 50 people and be embarrassed by the quality of each.

Capping at 3 forces **commitment with manageable risk**. Three is enough that one ghost doesn't kill the search. Three is few enough that Mo will write real, specific messages to each.

This is behavioral design borrowing from sales science. Top recruiters say your "top 3 targets this week" is the right frame. It's concrete, manageable, and creates accountability.

### The single loading moment (Referroing)

Users experience wait time as friction. Every loader is a place they might abandon. The chained workflow (parsing → contact discovery) could have shown two loaders. Instead, we show one. Same total wait, half the perceived friction.

This also reinforces a brand moment: "Referroing" is a verb Referro owns. Users develop language around the product. "I'm Referroing a job at Stripe" becomes shorthand. Products with verbs of their own are products users evangelize.

### The modal-over-blurred-Room pattern

Job search is spatial. Each job is its own world. Each contact inside a job is a sub-world. The modal-over-blurred pattern captures this hierarchy visually — Mo is always aware of where he is.

This beats the alternative of separate routes (which feel like context switches) and inline panels (which dilute focus).

### State-aware outcomes

A one-size-fits-all outcome dialog would have offered "Got offer / Rejected / Withdrew / Ghosted" at every state. That's incoherent. You can't be rejected from a coffee chat that didn't happen. You can't get an offer from a contact who never replied.

By making outcomes state-specific, we:

- Match how users actually talk about their job search
- Avoid semantically invalid options
- Create a more honest data model for product analytics later

### The activity timeline

Users forget. In three weeks, Mo won't remember whether he sent follow-up 1 on a Monday or a Thursday, or whether Mary's coffee chat was before or after his interview with someone else. The timeline is a memory aid.

It's placed below the action buttons (not above) because it's reference information, not call-to-action. Users look at it when they're pausing to plan, not when they're pushing forward.

### The celebration

Startups under-invest in the "win" moment. Most products treat a user's biggest success as a status update. This is a mistake.

When Mo lands a job, he's in the emotional peak of a multi-week journey. The product should match that energy. The confetti, the serif headline, the personal "Thanks to Mary" line — these aren't gimmicks. They're respecting the size of the moment.

They also convert. Celebrations become social media posts become user referrals. Most users will naturally screenshot or share this moment. The LinkedIn share button just makes what they'd already do easier.

### The LinkedIn share button (viral loop)

SaaS companies obsess over growth loops. Referro's is built into its core user experience: every happy ending becomes marketing.

The copy matters:

> "Instead of applying cold, I reached out to Mary directly — and here we are. Built my pipeline with Referro."

This doesn't sound like a sponsored post. It sounds like a real story from a real person. Because it is. The copy is designed to read as authentic success, not as promotion.

The share button appears once, at peak emotion. We don't hound users to share later. We don't pop up reminders. We trust that the moment is enough — and if it isn't, we won't guilt them into sharing.

---

## Part 5 — What this product is not

Equally important: knowing what Referro intentionally doesn't do.

**Referro is not an auto-applier.** Users don't submit to job portals through us. We send them to do the actual outreach on LinkedIn.

**Referro is not a CRM.** We don't track pipelines with dozens of deals. We track one job at a time, with three contacts max.

**Referro is not a resume builder.** (Not yet.) Our core loop is about reaching out, not writing resumes.

**Referro is not a cold-email tool.** We're specifically about warm, personalized outreach through the user's own LinkedIn account. No bulk sending. No automation of the send itself.

**Referro is not a job board.** We don't recommend roles. We help users execute on roles they've already chosen.

The surface area we refuse to expand into is as important as what we build. Each "not" is a focused choice.

---

## Closing

Every moment in this flow was chosen, not defaulted to. That's what separates products that feel inevitable from products that feel assembled.

The test: if a user walks through the happy path — pastes a URL, picks three contacts, drafts, sends, follows up, gets a coffee chat, interviews, lands an offer, celebrates — and at no point feels friction or confusion, we've succeeded.

We're not there yet. But we're close enough that the shape is visible.

---

*This document is living. Update it when the product evolves. Decisions made today may look obvious or wrong in six months — write down the reasoning either way.*
