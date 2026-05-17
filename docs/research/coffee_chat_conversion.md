# Coffee Chat Conversion Intelligence

> Research compiled 2026-05-17 for REF-30 (coming) — the future
> `parse_reply` and `generate_followup` AI functions.
> Cite this doc when prompts encode patterns described here.

---

## Source quality disclaimer (read first)

**Direct Reddit fetches were blocked** during research (`reddit.com`,
mirror sites, and `fishbowlapp.com` all returned 403/blocked
responses to WebFetch). All "Reddit-cited" claims below are
**secondary citations** — career-coaching blogs, recruiter LinkedIn
articles, and aggregator sites that quote Reddit threads. The
quotes themselves are real, but the recruiter/job-seeker identities
are typically anonymized and the original thread context is one
hop removed.

**Three tiers of evidence** are flagged inline:
- **[recruiter-direct]** — a named recruiter writing under their
  own byline (LinkedIn Pulse, Medium, etc.). Highest credibility for
  recruiter-perspective claims.
- **[secondary]** — career-coaching blog quoting a Reddit
  thread or anonymous recruiter. Probably true but one degree of
  separation.
- **[marketing]** — content from a SaaS/coaching company with
  obvious sales motive. Useful for surfacing patterns; take
  specific numbers with salt.

**Numerical claims** (response rates, etc.) are flagged
**[uncited]** when no underlying study is named, **[blog-claim]**
when from a marketing source, and **[anecdote]** when from a
single first-person account.

---

## 1. Executive summary

Five takeaways that hold across nearly every credible source:

1. **Specificity is the single highest-impact lever.** Generic
   templates ("Hope this message finds you well", "I noticed your
   profile") underperform consistently. Messages that reference a
   specific post, project, transition, or shared affiliation get
   replies. [recruiter-direct, secondary]

2. **"Pick your brain" is universally cringe.** Recruiters call it
   out by name. So is "I'd love to learn more." Both signal: you
   want something, you haven't done your homework, and you're
   probably mass-sending. [recruiter-direct]

3. **Length is a signal of effort done backward.** Long messages
   read as desperate or AI-templated. ~100 words / under 300
   characters is the consensus target. [blog-claim]

4. **The single biggest conversion pattern: shared affiliation.**
   Alumni connections are repeatedly cited as 60-80% reply rates
   (though most of those numbers come from coaching blogs).
   University, former employer, hometown, language — any genuine
   commonality that's verifiable. [blog-claim, anecdote]

5. **"Coffee chat" as a wrapper for "give me a job" is detected
   instantly and burns the contact.** Recruiters openly resent
   "fake coffee chat" requests where someone asks for "advice"
   but clearly wants a referral. The conversion path is: genuine
   curiosity first → demonstrated interest → if-and-only-if it
   comes up naturally, mention the job. [recruiter-direct]

A sixth takeaway, less consistent but worth flagging:

6. **Follow-up converts more than the first message does.** Multiple
   sources cite single follow-ups (week later, brief, no pressure)
   as moving 20-30% of cold outreach into actual conversations.
   Multi-message aggressive follow-up backfires. [blog-claim,
   recruiter-direct]

---

## 2. What works — patterns that lift response rate

### 2.1 Shared affiliation as the opener

**Pattern:** Lead with a verifiable commonality. School, former
employer, conference, hometown, mutual connection. Don't bury it
in paragraph 2.

**Why it works:** Three layers — (a) trust ("they're like me"),
(b) it proves you actually looked at their profile, (c) it gives
the recipient a cheap reason to feel obligated to respond.

**Concrete example** [Pursue Networking, [blog-claim]]:
> "Hi [Name], fellow [University] alum here! I'm currently
> [your situation]... I'd love to learn about your path from
> [University] to [their current role]—particularly your
> transition into [their industry/company]. Would you have 20-30
> minutes for a virtual coffee chat in the next couple weeks?"

**Claimed reply rate:** "Alumni connections have 60-80% response
rates" [Pursue Networking, [blog-claim]]. No underlying study
provided.

Cross-confirm from [recruiter-direct] DJ Chung: "When possible,
try sourcing alumni from your school or past employers to give
you a point of commonality you can reference in your outreach."

### 2.2 Specific signal from the recipient's profile

**Pattern:** Reference one concrete thing they did — a post they
wrote, a project they shipped, a role transition, a certification.
Not their company in general. Not their seniority. One specific
thing.

**Why it works:** Filters out the volume of "I noticed your
profile" messages, which is the most-cited generic phrasing in
recruiter complaints.

**Concrete example** [Kondo, [secondary]]:
> "Hi Sarah,
>
> I noticed your presentation on sustainable marketing strategies
> at last month's Digital Marketing Summit. Your insights about
> eco-conscious consumer behavior really resonated with my
> experience at GreenTech Solutions.
>
> I recently applied for the Marketing Specialist role at your
> company and would love to learn more about the team's current
> priorities. Would you be open to a brief conversation this
> week?"

**Counter-pattern called out** [Kondo, [secondary]]: "I noticed
your profile and wanted to connect" — "vague statements signal
you're mass-messaging."

### 2.3 Engage with their content BEFORE messaging

**Pattern:** Like, comment, share a recent post first. Wait a few
days. Then DM, referencing the comment or post.

**Claimed lift:** "Engaging with their content first increases
success to 40-50% [from 15%]" [Pursue Networking, [blog-claim]].
Specific multiplier is unattributed, but the directional claim
appears in multiple sources.

### 2.4 Time-boxed, low-friction ask

**Pattern:** Specify the time commitment in the ask. "15 minutes,"
"20-30 minutes," "a quick call." Avoid "coffee" or "lunch" or
"hour-long" or anything ambiguous.

**Why it works:** Recruiters' top-stated complaint is that meetings
scheduled for 30 minutes "go on...and on...and on" [Kristen Fife,
recruiter, [recruiter-direct]]. Pre-committing to 15-20 minutes
lowers the perceived cost.

**Concrete example** [Hannah Zhang, [recruiter-direct]]:
> "Hi [name], I'm a [your latest role] with # years of experience
> in [industry or expertise] and am interested in the [role at
> company]. [Mention any connections.] Could I have 15min of your
> time to ask a few questions? I'm generally free Friday
> afternoons if that's helpful."

### 2.5 Don't make them do the work — propose times

**Pattern:** Instead of "Are you available?", propose two specific
time slots. Then flexibility-hedge.

**Why it works:** Removes the back-and-forth tax. The recipient
either picks one or counter-proposes — both fast.

**Concrete example** [DJ Chung, [recruiter-direct]]:
> "Would Wednesday between 2–4 pm or Thursday 1–3 pm work for
> you? If not, are there any times that you'd be available? If
> our schedules don't line up for coffee, would a phone call
> work? I'm free on weekdays any time after 8 pm."

### 2.6 Genuine curiosity over transactional intent

**Pattern:** Ask about their career path, their day-to-day, what
they wish they'd known. Don't open with "I want a referral."

**Why it works** [Nicole Lainez, recruiter, Medium [recruiter-direct]]:
> "Coffee chats are curiosity framed by structure... good coffee
> chats aren't about sounding smart or knowing every detail about
> the firm."

**The conversion mechanic she observed:** From 30 cold messages
she sent during her own job search, 5 turned into coffee chats. 3
went "particularly well." Of those 3, **2 turned into referrals**
and one contact offered to mention her to recruiters despite a
"no-referral" policy. The referrals came from authenticity in the
chat, not from asking.

### 2.7 One specific ask, surgically placed

**Pattern:** One ask per message. Not "could we chat AND would you
refer me AND can you intro me to your manager."

**Why it fails when violated** [Pursue Networking, [blog-claim]]:
"Multiple concurrent asks (job, referral, introduction
simultaneously)" listed as anti-pattern.

### 2.8 Send timing (weaker evidence)

**Claimed best window:** "Tuesday-Thursday, midweek afternoon"
[Hannah Zhang, [recruiter-direct]; cross-cited in multiple
[blog-claim] sources]. Specific recruiter advice: "I can meet any
time on Monday, Wednesday and Thursday, and any time before 12pm
on Tuesday" [secondary, anonymous].

Lower confidence than the content patterns — flagged as the kind
of advice that gets repeated without underlying data.

### 2.9 Personalize the follow-up too

**Pattern:** A single follow-up 7-10 days later, with a tiny new
hook — a recent post they wrote, a relevant company news item, a
brief restatement of the specific ask.

**Concrete example** [Hannah Zhang, [recruiter-direct]]:
"If ignored, send a follow-up offering to submit 2-3 quick
questions via email, emphasizing there's no pressure."

The "no pressure" / "totally understand" phrasing is the
"take-away" technique — paradoxically lifts yes rates by removing
the social burden of refusing.

---

## 3. What doesn't work — patterns that kill the response rate

### 3.1 "I'd love to pick your brain"

**The single most-flagged anti-pattern across every credible source.**

**Why** [secondary, citing r/datascience]: "On Reddit communities
like r/datascience, professionals are increasingly frustrated by
'fake coffee chat' requests where someone asks for 'advice' but
clearly just wants a job referral, and they actually prefer a
concise, honest request over a vague 'I'd like to pick your
brain' message that hides a hidden agenda."

[Pursue Networking, [blog-claim]] flags it as "cringey and
overused."

[recruiter-direct, Kondo via Reddit citation]: "Recruiters receive
dozens and dozens of new messages every day in their inbox, so
generic requests stand out in the wrong way."

### 3.2 "Hope this message finds you well"

**Why** [Kondo "Avoid AI Spam", [secondary]]: "Generic greeting
signaling low effort." Reads as AI-template-y because actually
nobody talks like that.

More red-flag openers from the same source:
- "I hope this message finds you in good health and high spirits"
  ("Overly formal phrasing nobody uses conversationally")
- "I'm impressed by your profile" ("Vague praise applicable to
  anyone")
- "Your work is inspiring" ("Empty compliment lacking
  substance")

### 3.3 Generic mass-message templates

**Example flagged** [Meyer hiring manager, [recruiter-direct]]:
Candidates replying to job posts with just "Interested" — "creates
unnecessary inbox clutter."

**Example flagged** [secondary, r/cscareerquestions]: "Templated
messages like 'I'm interested in XYZ role' don't help candidates
stand out after reviewing hundreds of applicants."

**Why** [recruiter-direct, anonymous via Kondo]: "If you're sending
a message about a job you're not qualified for, you may not get
much of a response."

### 3.4 Asking for CV review before applying

**Specifically flagged** [Meyer hiring manager, [recruiter-direct]]:
Candidates "send a message asking to review their CV" instead of
applying through the link. "Creates delays while manager reviews,
during which faster applicants advance."

His preferred guidance: "if the position interests you and you
have the basic qualifications, apply directly through the link"
first; the LinkedIn message should come AFTER, confirming you've
applied.

### 3.5 Asking to "book time" prematurely

**Specifically flagged** [Meyer hiring manager, [recruiter-direct]]:
Candidates asking to "book time with them to discuss their fit to
the position." Hiring managers are already overbooked.

### 3.6 Long messages / wall of text

**Why** [multiple, [blog-claim]]: "Long paragraphs overwhelm
busy recruiters and often go unread"; mobile preview cuts at
~150 characters.

**Anti-target** [Kondo, [secondary]]: "Bible-length messages."

### 3.7 AI-template tells (specific markers)

From [Kondo "Avoid AI Spam", [secondary]], the canonical AI-message
red flags:

- "hop on a call sometime" — vague, high-commitment
- "discuss synergies" — jargon-heavy, impersonal
- "I'm sure it would be beneficial for both of us" — generic value
  proposition
- "So excited to connect with you today!! 🚀✨😊" — multiple
  exclamations + emoji clusters = automation overcompensation
- Disjointed structure without conversational flow
- Stilted transitions (intro → pitch with no bridge)
- Formal "Best regards" closings on cold outreach
- Brackets like `{your name}` left unfilled (real-world AI slips)

A real recruiter slip-up flagged in the wild: a recruiter post
that ended with "Let me know if you need any modifications! 🚀"
— a verbatim GPT signoff [secondary, Avani Brahmbhatt on Medium].

### 3.8 Misalignment with their actual role

[secondary, anonymous recruiter quoted in multiple aggregators]:
Candidates receive recruiter messages about being "a great fit for
this job installing garage doors" when their profile says "Master
Electrician at the top." The same anti-pattern applies in reverse
— job-seekers messaging recruiters about a role they're not
qualified for kill the conversation.

### 3.9 Multi-aggressive follow-up

**Why** [multiple, [blog-claim]]: "Sending multiple messages will
not increase your chances and can actually hurt your impression."

The standard prescription: ONE polite follow-up, 7-10 days later,
then stop. Three+ follow-ups read desperate.

---

## 4. Common reply types — categorization for parse_reply

The most important section for REF-30. These are the categories
the `parse_reply` AI function will need to classify incoming
recruiter/hiring-manager replies into. For each: typical
phrasings, what it really means, and what successful conversion
follow-ups look like.

### 4.1 "Sure, send me your resume"

**Typical phrasings:**
- "Sure, send your resume over."
- "Happy to take a look — send me your CV."
- "Send it to me and I'll forward it to the team."

**What it actually means:** Soft positive. The recruiter is
genuinely open but hasn't committed to anything. The default
trajectory is: you send resume → it disappears into the void.

**Successful conversion follow-up:** Send the resume AND anchor a
meeting in the SAME message. The pattern is to make it harder for
them to bounce back to "just send the resume" because you've
already sent it; now the only options are pick a time or actively
decline. [Pattern documented in Referro's own system prompt
inspired by closer playbooks; cross-confirmed by Hannah Zhang's
"more often than not — people offered to refer me by the end of
the call"]

**Reference phrasing** (synthesized from playbook patterns; flag
as constructed, not a cited example):
> "Attached. Quick one — would 15 min Tue 4pm or Thu 2pm be
> easier? Faster to walk you through why I'm a fit than this
> thread can do. Either way, appreciate it."

### 4.2 "I'm pretty slammed right now" / "things are crazy"

**Typical phrasings:**
- "I'm pretty slammed right now"
- "Things are crazy at the moment"
- "Reach back out in a few weeks"
- "Catch me later this quarter"

**What it actually means:** Genuinely busy AND polite-deflection
indistinguishable. Recruiters and hiring managers have 40+ open
reqs simultaneously [career coach quoted in multiple [blog-claim]
sources]; this is often true. But it's also a script for
"interested but won't commit."

**Successful conversion follow-up:** Take-away + specific future
anchor. Don't ask "when's a good time?" — propose it.

**Pattern** [synthesized from systemic-closer playbooks; flag as
constructed]:
> "Totally get it. If it opens up next week, Tue 4 or Thu 2?
> I'll send a hold, you cancel if it doesn't work."

The "send a hold, you cancel" mechanic is documented as raising
yes rates by inverting the friction — they don't have to
volunteer their time, they only have to actively decline.

### 4.3 "Tell me more about what you're looking for"

**Typical phrasings:**
- "Can you tell me more about your background?"
- "What kind of role are you looking for?"
- "Send me a quick summary of what you do"

**What it actually means:** Genuinely interested but trying to
gate-keep their time. They want the essay so they don't have to
do a call. This is a fork: write the essay (high effort, lower
conversion) OR pull back to a call (lower effort for them, higher
conversion for you).

**Successful conversion follow-up:** Refuse the email essay,
pull to a call.

**Pattern** [synthesized; flag as constructed]:
> "Easier on a 15-min call than over text. Tue 4 or Thu 2?"

### 4.4 "Send me the job link" / "What req?"

**Typical phrasings:**
- "Which posting are you looking at?"
- "Send me the req number"
- "What role specifically?"

**What it actually means:** Positive signal — they want to look it
up. But the inflection matters: are they trying to forward your
resume internally, or filter you out by checking your
qualifications?

**Successful conversion follow-up:** Send the link AND propose a
chat in the same reply, framing the chat as faster than them
reading the JD.

### 4.5 "Apply through our portal / careers page"

**Typical phrasings:**
- "Best to apply through our careers page."
- "Send to careers@..."
- "Submit via the portal and I'll flag it."
- "We require all candidates go through the formal process."

**What it actually means:** Mixed. Three sub-types:
- (a) **Real policy.** Larger companies have ATS-only intake. The
  recruiter physically can't shortcut you. "Flag it" is a real
  offer here.
- (b) **Polite no.** "Apply through portal" with no offer to
  "flag" is a graceful deflection. Most won't follow up.
- (c) **Test.** Some recruiters use this as a filter — applicants
  who actually follow through get noticed, ones who don't get
  filtered.

**Successful conversion follow-up:** Apply the same day. Then reply
referencing the application ("Just submitted, ref number XYZ").
Follow up ~5-7 days later asking if it landed. The
applying-and-confirming-back loop converts (a) and (c) into actual
interviews. (b) usually stays a no — accept it gracefully.

[Meyer hiring manager, [recruiter-direct]] explicitly states he'll
engage with "messages confirming you've applied" — strongest direct
support for this loop.

### 4.6 "Not the right person — try [someone else]"

**Typical phrasings:**
- "I'm not on that team — try [Name]"
- "Reach out to [Name], they handle that"
- "I'd point you to our recruiter [Name]"

**What it actually means:** Genuine helpful redirect. This is one
of the highest-value reply types because the warm intro lifts the
new outreach's reply rate dramatically (no specific number, but
universally agreed direction).

**Successful conversion follow-up:** Thank them, then ask if
they'd be willing to mention you to [Name] OR cc [Name] in a
short intro. Don't just take the name and cold-message [Name]
yourself — the warm hand-off is the real gift.

### 4.7 "Maybe in a few weeks" / "Reach back out later"

**Typical phrasings:**
- "Things are quiet right now — try back in [month]"
- "Maybe later in the quarter"
- "Reach out in 3-4 weeks"

**What it actually means:** Soft positive with a real timer.
Could be genuine ("we're paused on hiring") or polite-no
("vague-future = no but trying to be nice").

**Successful conversion follow-up:** Specific future anchor —
don't leave it vague. Pattern: "Putting Thursday the 24th at 2pm
in your calendar. Kill it if it doesn't work."

The pattern is documented in closer / sales playbooks. Less
directly cited in coffee-chat sources but the analog is strong.

### 4.8 Soft no / "Not a fit"

**Typical phrasings:**
- "I don't think there's a fit right now"
- "Not the right time"
- "Our team isn't hiring at the moment"
- "We've moved forward with other candidates"

**What it actually means:** Mostly real. The genuine close.

**Successful conversion follow-up:** Graceful close + future door
open. Don't argue, don't pitch again. The cited recruiter consensus
is that a graceful no-pressure close keeps the relationship intact
for future opportunities.

**Pattern** [synthesized]:
> "All good. Appreciate you taking a look. If anything opens on
> the team later, I'll be here."

### 4.9 "Yes to coffee chat" / "Happy to chat"

**Typical phrasings:**
- "Sure, happy to chat"
- "Yes — when works?"
- "Let's set something up"

**What it actually means:** Real positive. The chat is committed.

**Successful conversion follow-up:** Don't let momentum die.
Propose 2 specific times immediately. Don't wait.

**Critical anti-pattern:** [Pursue Networking, [blog-claim]]
"20-30% of people who initially say yes never actually schedule" —
the gap between "yes" and a booked calendar invite is the largest
single point of dropoff. Speed is the fix.

### 4.10 Ghost / no reply

**Typical phrasing:** [silence]

**What it means:** Either (a) busy and your message sank in the
inbox, (b) saw it, judged it generic, ignored, (c) saw it, found
it irrelevant.

**Successful conversion follow-up:** ONE follow-up, 7-10 days
later, with a NEW signal — a recent post they wrote, a new piece
of company news, a tweaked angle. Never "just bumping this." Never
restate the original message.

**Pattern** [Kondo, [secondary]; cross-confirmed by Hannah Zhang
[recruiter-direct]]:
> "Hi [Name], I wanted to follow up on my message from last
> week... I completely understand if you're swamped right now —
> no pressure at all!"

After the single follow-up: stop. Multi-touch beyond two reads as
desperate.

---

## 5. Follow-up scripts that converted deflections

This section is thinner than I'd like — Reddit-anonymous "I sent
X and got a coffee chat" stories are hard to find via secondary
citation. The best-documented patterns:

### 5.1 The "send-and-anchor" for "send me your resume"

**Documented in:** [Hannah Zhang, [recruiter-direct]; closer
playbooks]. Send the resume in the same message that proposes a
specific 15-min time, framed as faster than thread-trading.

**Real-world report:** Nicole Lainez [Medium, [recruiter-direct]]
described that from 5 chats she landed through cold outreach,
recruiters "more often than not — offered to refer me by the end
of the call" — the conversion happened on the call, not in the
email thread.

### 5.2 The "specific future anchor" for "later"

Convert "maybe in a few weeks" into a specific date. This is the
calendar-mechanic pattern: "Putting Thursday the 24th at 2pm in
your calendar. Kill it if it doesn't work."

**Not directly cited** in coffee-chat literature; carries over from
sales/closer playbooks where it's well-documented. Flag for
product validation.

### 5.3 The "applied-and-confirming" loop for portal deflection

**Documented in:** [Meyer hiring manager, [recruiter-direct]].
Apply same-day → reply confirming application → ~5-7 day check-in.
The hiring manager explicitly stated he'll engage with messages
confirming application.

### 5.4 The "added a new signal" for ghost follow-up

**Documented in:** [Kondo, [secondary]]; [Hannah Zhang,
[recruiter-direct]]. New signal = a recent post they wrote, a
company news item, a different angle on the ask. Never "just
checking in" or "bumping this."

### 5.5 The "take-away" softener for hesitation

Phrases like "no pressure either way" or "totally fine if not"
remove the social burden of refusal and paradoxically lift yes
rates. The mechanism is documented in negotiation and influence
literature broadly; in coffee-chat-specific sources it appears as
"emphasizing there's no pressure" [Hannah Zhang, [recruiter-direct]].

---

## 6. Voice/tone characteristics — what reads genuine

Concrete linguistic markers that separate human from AI-template:

### 6.1 Reads human

- **Contractions:** "I'm" not "I am", "won't" not "will not",
  "you've" not "you have"
- **Specific particulars:** named projects, real dates, real
  numbers, real signal from the recipient's profile
- **Hedges that feel natural:** "if you have a sec," "no pressure
  if not," "totally fine if the timing's off"
- **Short paragraphs:** 1-3 sentences each, mobile-readable
- **Question marks that invite a 1-tap reply:** "Worth 15 min?"
  rather than "Would you be open to a brief discussion at your
  convenience"
- **Mild informality:** "Hey," "Quick one," "Just so you know"
- **A single emoji used sparingly when it lands**: 🔥 or 👋 in the
  right spot. Zero is fine. Multiple is automation.

### 6.2 Reads AI-template

[Kondo "Avoid AI Spam", [secondary]] markers:

- **Formal openers nobody actually uses:** "Hope this message finds
  you well", "I hope this message finds you in good health and
  high spirits", "Greetings"
- **Vague compliments:** "I'm impressed by your profile", "Your
  work is inspiring"
- **Jargon:** "synergies", "leverage", "circle back", "low-hanging
  fruit", "ecosystem"
- **Em dashes (long ones):** Reads AI. Use commas or parentheses.
- **Multiple exclamation points and emoji clusters:**
  "🚀✨😊!!" overcompensation tell
- **"Let me know if you need any modifications":** Verbatim GPT
  signoff that has shown up in published recruiter messages
  [secondary, Avani Brahmbhatt on Medium]
- **"hop on a call sometime":** Vague, no time-box
- **"discuss synergies":** Death sentence
- **Sign-offs like "Best regards" on cold outreach:** Too formal,
  reads templated
- **Brackets left unfilled:** `{your name}`, `[company]` — literal
  template artifacts that ship in real messages [secondary]
- **Disjointed structure:** intro → pitch with no conversational
  bridge

### 6.3 The two-voice rule (Ref's design)

Worth restating from Referro's existing system prompt
(`/docs/ref-system-prompt-v1.md`): the chat-with-user voice is
warm and casual; the drafted-outreach voice is surgical and
professional. They never bleed. Most generic LinkedIn outreach
fails because it tries to be both at once — friendly buddy +
sales pitch — and lands as neither.

---

## 7. Open questions / where the data was thin

Be honest about what's not well-grounded:

1. **Reply rate numbers are largely uncited.** The "60-80% for
   alumni," "30%+ with relevance," "5-10% per Reddit" claims come
   from marketing blogs or anonymized anecdotes. No academic /
   structured study surfaced. Treat all percentages as directional,
   not load-bearing.

2. **First-person "I sent X and it converted Y" stories are rare
   in published form.** Most live deep in Reddit comment threads
   that I couldn't directly fetch. The richest single source was
   Nicole Lainez's Medium piece (recruiter's own job search). If
   the user has time to mine specific Reddit threads, this section
   could be tripled.

3. **"Coffee chat" vs. "informational interview" vs. "quick call"
   framing differences.** No direct A/B data; the sources I found
   treat them as roughly interchangeable. Worth testing in Ref's
   own outreach if traffic permits.

4. **Geographic / cultural variance.** All sources are
   US/Anglo-LinkedIn-centric. Outreach norms in other markets
   (UK, EU, India, LATAM) are not covered.

5. **Specific timing claims** ("Tuesday 4pm beats Wednesday
   10am"). Repeated across sources, no underlying data. Likely
   directional but not study-grade.

6. **Conversion-of-deflections section (§5) is thinner than I'd
   want.** The patterns are real but mostly extrapolated from
   adjacent literature (sales closing playbooks) rather than
   coffee-chat-specific accounts. This is the section the user
   most wanted, and it's the section where source quality is
   weakest. Worth a targeted second pass — possibly direct browsing
   of r/cscareerquestions threads by the user.

7. **Recruiter vs. hiring-manager response differences.** Largely
   conflated in the sources. Anecdotally hiring managers respond
   to more targeted/personal outreach and recruiters respond to
   higher-volume but still personalized; not formally measured in
   anything I found.

8. **Follow-up cadence beyond the first.** Most sources only cover
   "one follow-up at 7-10 days" and then "stop." The longer
   sequence — Day 0, Day 5-7, Day 12-14 (per Ref's own playbook in
   `/docs/ref-system-prompt-v1.md` §7) — isn't validated against
   external data. Source for that pattern is unclear; may have
   been founder intuition. Worth checking.

---

## Sources cited

**Recruiter-direct (highest credibility):**
- [Kristen Fife — The Informational Interview](https://www.linkedin.com/pulse/informational-interview-kristen-fife-purple-squirrel-hunter)
- [Nicole Lainez — Recruiting Diaries: What Coffee Chats Taught Me About Networking](https://medium.com/@nicolelaine/recruiting-diaries-what-coffee-chats-taught-me-about-networking-d82134f5fe18)
- [Meyer (hiring manager) — Why I Didn't Answer Your LinkedIn Message](https://www.linkedin.com/pulse/im-hiring-manager-why-i-didnt-answer-your-linkedin-message-meyer)
- [Hannah Zhang — 5 Tips to Actually Get Coffee Chats](https://www.linkedin.com/posts/hannahzhang0_5-tips-to-actually-get-coffee-chats-activity-7318249319466229760-FcZx)
- [DJ Chung — Actual Messages You Can Send to Get Referred](https://www.linkedin.com/pulse/actual-messages-you-can-send-get-referred-tech-company-dj-chung)

**Secondary (career-coaching content, Reddit-cited):**
- [Kondo — The Dos and Don'ts of LinkedIn Messaging for Job Seekers](https://www.trykondo.com/blog/linkedin-messaging-job-seekers)
- [Kondo — How to Write LinkedIn Messages That Don't Sound Like AI Spam](https://www.trykondo.com/blog/linkedin-messages-avoid-ai-spam)
- [Kondo — 7 LinkedIn Message Templates to Recruiters](https://www.trykondo.com/blog/linkedin-recruiter-message-templates)
- [Pursue Networking — Coffee Chat Request Scripts](https://pursuenetworking.com/blog/linkedin-coffee-chat-templates/)
- [Avani Brahmbhatt — The LinkedIn AI Crisis](https://medium.com/@avanib28264/let-me-know-if-you-need-any-modifications-the-linkedin-ai-crisis-163748c04c1b)

**Marketing-blog (lower credibility, useful for surfacing patterns):**
- [Caffeinated Kyle — Cold Message LinkedIn for a Job](https://caffeinatedkyle.com/cold-message-linkedin-job/)
- [LobsTR — Reach Out to Recruiter on LinkedIn](https://www.lobstr.io/blog/how-to-reach-out-to-a-recruiter-on-linkedin)
- [Skylead — Best LinkedIn Cold Messages](https://skylead.io/blog/linkedin-cold-message/)
- [The Muse — Best Cold Outreach LinkedIn Messages](https://www.themuse.com/advice/best-cold-outreach-linkedin-message)

**Reference / related:**
- [Fast Company — Recruiters Explain Which Types of Messages They Actually Reply To](https://www.fastcompany.com/40440903/recruiters-explain-which-types-of-messages-they-actually-reply-to) (couldn't fetch; URL preserved for user review)
- [Fishbowl — Recruiters: do you take coffee chats with random people](https://www.fishbowlapp.com/post/recruiters-do-you-take-on-coffee-chats-or-informational-interviews-with-random-people-on-linkedin-ive-taken-a-few-but) (couldn't fetch; URL preserved)
- [The Beginner's Guide to Coffee Chats — Rebecca McLaren](https://www.linkedin.com/pulse/beginners-guide-coffee-chats-networking-linkedin-rebecca-mclaren)
- [How to Ask for an Informational Interview — The Muse](https://www.themuse.com/advice/how-to-ask-for-an-informational-interview-and-get-a-yes)
- [r/cscareerquestions — Does cold emailing/LinkedIn messages work in 2024](https://www.reddit.com/r/cscareerquestions/comments/1f5uvc9/does_cold_emailinglinkedin_messages_work_in_2024/) (couldn't fetch; URL preserved for user review)
