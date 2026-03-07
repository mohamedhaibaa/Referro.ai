# Service Bus Message Schemas

These are the exact JSON payloads published to each Azure Service Bus queue.
Both the API (publisher) and Worker (consumer) must use these exact shapes.
Do not change these without updating both sides.

---

## job-parsing

Published by: `POST /jobs`
Consumed by: Worker `job_parsing.py`

```json
{
  "workflow_run_id": "uuid",
  "user_id": "uuid",
  "job_id": "uuid",
  "url": "https://www.linkedin.com/jobs/view/..."
}
```

---

## contact-discovery

Published by: `POST /jobs/{id}/contacts/discover`
Consumed by: Worker `contact_discovery.py`

```json
{
  "workflow_run_id": "uuid",
  "user_id": "uuid",
  "job_id": "uuid"
}
```

---

## outreach-generation

Published by: `POST /jobs/{id}/outreach/generate`
Consumed by: Worker `outreach_generation.py`

```json
{
  "workflow_run_id": "uuid",
  "user_id": "uuid",
  "job_id": "uuid",
  "contact_id": "uuid"
}
```

---

## follow-up-generation

Published by: `POST /jobs/{id}/follow-up/generate`
Consumed by: Worker `follow_up_generation.py`

```json
{
  "workflow_run_id": "uuid",
  "user_id": "uuid",
  "job_id": "uuid",
  "outreach_message_id": "uuid"
}
```

---

## flash-card-generation

Published by: `POST /jobs/{id}/flash-cards/generate`
Consumed by: Worker `flash_card_generation.py`

```json
{
  "workflow_run_id": "uuid",
  "user_id": "uuid",
  "job_id": "uuid"
}
```

---

## pitch-deck-generation

Published by: `POST /jobs/{id}/pitch-deck/generate`
Consumed by: Worker `pitch_deck_generation.py`

```json
{
  "workflow_run_id": "uuid",
  "user_id": "uuid",
  "job_id": "uuid"
}
```
