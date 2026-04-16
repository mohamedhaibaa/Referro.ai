# REF-PRICING: Contact Discovery Cost Optimization — Teach-Back

## Why This Was Built

Unit economics on the original $28 flat-rate plan showed a ~$30/month loss per heavy user. The main cost driver was the posts scraper ($0.10 per discovery run × many runs per month). Combined with no usage limits, the product was not viable at scale. This ticket redesigns the cost structure to guarantee 60%+ margins at every tier.

---

## What Changed

### 1. Posts Scraper Removed
`apimaestro/linkedin-profile-posts` is no longer called. It was costing $0.02 per profile × 5 profiles = $0.10 per discovery run. User research showed that the education + experience data from the employee scraper provides sufficient context for personalized outreach. Posts may return as a Closer-tier premium feature in v2.

**Cost impact:** Saves $0.10 per campaign.

### 2. Progressive Disclosure (3 → 6 → 9)
Contact discovery now reveals contacts in batches of 3 rather than all 5 at once.

**How it works:**
- Batch 1 (1 credit): One Apify call fetches 12 profiles, scores all, assigns batch_number (1/2/3) by rank, saves all to DB. Returns top 3 contacts.
- Batch 2 (free): Served directly from DB — no Apify call, instant response.
- Batch 3 (free): Same as batch 2.
- Total contacts shown: up to 9 per campaign.

**Why 12 profiles in one call, not 4 per batch:**
The spec originally said "scrape 4 per batch." However, `harvestapi~linkedin-company-employees` does not support reliable offset pagination. Fetching all 12 in one call avoids pagination issues entirely, is actually cheaper (12 vs 25 profiles previously), and batches 2+3 become instant DB reads instead of slow Apify calls.

**+1 buffer rationale:**
Each batch shows 3 contacts but 4 are scraped (the extra one acts as a buffer in case 1 profile fails the active-employment filter). With a 10-15% filter failure rate, this guarantees 3 shown contacts from 4 scraped.

Wait — actually in the current implementation we scrape 12 total, and assign batch_number based on rank after scoring. There's no per-batch buffer since we score all 12 and rank them. Contacts that fail the active filter are simply excluded before scoring.

### 3. Revisit Action (0.5 credit)
After all 3 batches are exhausted (9 contacts shown), users can click "Find 9 more contacts" to start a new round. This:
- Costs 0.5 credits
- Runs a fresh Apify search (may return the same or different employees depending on LinkedIn's ranking)
- De-duplicates against existing contacts for that job by linkedin_url
- Assigns a new round_number (2, 3, etc.) so batches are tracked per round

### 4. Credit System (data model)
No billing integration built yet — just the internal tracking infrastructure.

**Data model:**
- `users.credits_remaining` (Numeric 6,1) — current balance, supports half-credits
- `users.credits_total` (Numeric 6,1) — total granted in current period
- `users.plan_tier` (String 20) — trial/warmup/grind/closer
- `credit_transactions` table — full audit log (amount, type, job_id, timestamp)

**Credit flows:**
- Signup → grant 3.0 (plan_grant transaction)
- New campaign (batch 1) → deduct 1.0 (campaign transaction)
- Batches 2 + 3 → free, no transaction
- Revisit → deduct 0.5 (revisit transaction)

**Where credit checks happen:** Backend API layer, not the worker. The API deducts credits before publishing to the queue. If the queue publish fails, the credit is already spent (known limitation for v1).

**Tier allocations (for reference):**
- Trial: 3 credits
- Warm-Up ($19/mo): 20 credits
- Grind ($39/mo): 60 credits
- Closer ($79/mo): 200 credits (fair use) + free revisits
- Top-up: 10 credits per pack

---

## Cost Per Job (Economics)

| Scenario | Apify employee scraper | Credits used | Total cost |
|----------|----------------------|--------------|------------|
| 1 campaign, 1 batch | 12 profiles × $0.22/1k = $0.0026 | 1 credit | ~$0.003 |
| 1 campaign, all 3 batches | $0.0026 (same call) | 1 credit | ~$0.003 |
| 1 revisit | $0.0026 | 0.5 credit | ~$0.003 |

Revenue per credit at $19 Warm-Up plan: $19/20 = $0.95/credit. Margin per campaign: >99%.

---

## Future Optimization Note

When monthly Apify spend reaches ~$200, consider caching company employee pools in Redis with a 7-day TTL. This would allow batch 1 of a revisit to be served from cache rather than making a new Apify call, further reducing per-run costs.

---

## How It Connects to Existing Components

- `WorkflowRun lifecycle` — batch 1 still follows queued→running→completed. Batches 2/3 bypass the queue entirely.
- `contacts.py API` — now handles two code paths: async (batch 1, publish to queue) and sync (batch 2/3, DB read).
- `contact_discovery.py worker` — reads `round_number` from payload, assigns `batch_number` to each contact, saves all 9 at once.
- `Sidebar` — displays live credit balance via `GET /credits/me`.
- `auth.py` — grants 3 credits on every new signup.
