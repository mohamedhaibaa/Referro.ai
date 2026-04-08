# Referoo API Guide
### For founders — how to run, test, and understand every endpoint

---

## 1. How to Start Everything

You need two terminal windows open.

**Terminal 1 — Backend**
```bash
cd /Users/haiba/Documents/Mind/Referoo.ai/backend
python3 -m uvicorn app.main:app --reload --port 8000
```
You should see:
```
INFO: Application startup complete.
```

**Terminal 2 — Frontend**
```bash
cd /Users/haiba/Documents/Mind/Referoo.ai/frontend
npm run dev
```
You should see:
```
VITE ready in ...ms  ➜  Local: http://localhost:8080/
```

**No Docker needed.** The database lives on Azure — both services connect to it automatically via the `.env` files.

---

## 2. How to Confirm Everything is Running

| Check | URL | Expected result |
|---|---|---|
| Backend alive | http://localhost:8000/health | `{"status": "ok"}` |
| Interactive API docs | http://localhost:8000/docs | A webpage with all endpoints listed |
| Frontend (full app) | http://localhost:8080 | Login page loads |

---

## 3. The Interactive Docs Page (http://localhost:8000/docs)

This is the most important tool for testing. FastAPI auto-generates it from the code.

**How to use it:**
1. Go to http://localhost:8000/docs
2. Register first (see Section 4 below)
3. Copy the `access_token` from the response
4. Click the **Authorize** button (top right, lock icon)
5. Paste the token — now all protected endpoints work
6. Click any endpoint → **Try it out** → fill the fields → **Execute**
7. See the real response from Azure Postgres live

---

## 4. Auth Endpoints

All auth endpoints live at `/api/v1/auth/`.
These do **not** require a token.

---

### `POST /api/v1/auth/register`
**What it does:** Creates a new user account and returns a JWT token.
Writes a new row to the `users` table in Azure Postgres.

**Request body:**
```json
{
  "email": "you@example.com",
  "password": "YourPassword123",
  "name": "Your Name"
}
```

**Success response (201):**
```json
{
  "data": {
    "access_token": "eyJhbGci...",
    "token_type": "bearer",
    "user": {
      "id": "ca38267b-2594-408b-89ec-ec3be9cea5c8",
      "email": "you@example.com",
      "name": "Your Name"
    }
  },
  "error": null
}
```

**How to confirm it hit Azure:** Copy the `id` UUID. Go to the Azure Portal → Postgres → `users` table — you'll see the row.

**Error cases:**
- `400 Email already registered` — that email exists, use a different one or login instead

---

### `POST /api/v1/auth/login`
**What it does:** Verifies credentials, returns a fresh JWT token.
Does NOT write anything to the database — read-only.

**Request body:**
```json
{
  "email": "you@example.com",
  "password": "YourPassword123"
}
```

**Success response (200):** Same shape as register above.

**Error cases:**
- `401 Invalid email or password` — wrong credentials

---

### `POST /api/v1/auth/logout`
**What it does:** Returns `204 No Content`. Nothing happens server-side.
JWT tokens are stateless — the frontend just deletes the token from localStorage.

**No body needed.**

---

## 5. Jobs Endpoints

All jobs endpoints live at `/api/v1/jobs/`.
**All require a token** (pass as `Authorization: Bearer <token>` header).
Every job is scoped to the logged-in user — you can never see another user's jobs.

---

### `GET /api/v1/jobs`
**What it does:** Returns all your jobs, newest first. Excludes soft-deleted jobs.
Reads from the `jobs` table filtered by your user ID.

**No request body.**

**Success response (200):**
```json
{
  "data": [
    {
      "id": "da6ab518-7973-45e0-bb00-06dd6ef45818",
      "title": "Software Engineer",
      "company": "Microsoft",
      "companyLogoUrl": null,
      "url": "https://careers.microsoft.com/123",
      "description": null,
      "status": "Interested",
      "fitScore": null,
      "workMode": null,
      "roleFamily": null,
      "dueDate": null,
      "progress": 0,
      "createdAt": "2026-03-12T14:16:09.117502",
      "updatedAt": "2026-03-12T14:16:09.117510"
    }
  ],
  "meta": { "total": 1 },
  "error": null
}
```

**How to confirm it works:** Create a job (below), then call this — your job should appear.

---

### `POST /api/v1/jobs`
**What it does:** Creates a new job. Also auto-creates a `job_milestones` row for that job (10 checkbox flags, all false by default). Status always starts as `"Interested"`.

**Request body:**
```json
{
  "url": "https://careers.google.com/jobs/123",
  "title": "Software Engineer",
  "company": "Google"
}
```
Only `url` is required. `title` and `company` can be empty strings (the AI worker will fill them in later).

**Success response (201):**
```json
{
  "data": {
    "id": "da6ab518-...",
    "title": "Software Engineer",
    "company": "Google",
    "status": "Interested",
    "progress": 0,
    ...
  },
  "error": null
}
```

**How to confirm it hit Azure:** Note the `id`. Call `GET /api/v1/jobs` — it should appear. The database also has a matching row in `job_milestones`.

---

### `GET /api/v1/jobs/{job_id}`
**What it does:** Returns a single job by ID.
Returns `404` if the job doesn't exist or belongs to another user.

**URL example:** `GET /api/v1/jobs/da6ab518-7973-45e0-bb00-06dd6ef45818`

**Success response (200):** Same shape as a single item in the list above.

---

### `PATCH /api/v1/jobs/{job_id}`
**What it does:** Updates one or more fields on a job. Only send the fields you want to change.

**Request body (all fields optional):**
```json
{
  "status": "Applied",
  "title": "Senior Software Engineer",
  "company": "Google",
  "due_date": "2026-04-01",
  "progress": 30,
  "fit_score": "High",
  "work_mode": "remote",
  "role_family": "Engineering"
}
```

**Valid status values:**
`Interested` → `Applied` → `Outreach Sent` → `Replied` → `Meeting Booked` → `Interviewing` → `Offer` → `Rejected` → `Withdrawn`

**Success response (200):** Returns the full updated job.

**How to confirm it works:** Patch the status to `"Applied"`, then GET the job — `status` field should show `"Applied"` in the response and in Azure.

---

### `DELETE /api/v1/jobs/{job_id}`
**What it does:** Soft-deletes the job. Sets `is_deleted = true` in the database — the row is NOT actually removed, it just stops appearing in all queries.

**No request body.**

**Success response:** `204 No Content` (empty body).

**How to confirm it works:** After deleting, call `GET /api/v1/jobs` — the job should be gone from the list. But the row still exists in Azure Postgres with `is_deleted = true`.

---

## 6. Dashboard Endpoint

### `GET /api/v1/dashboard`
**What it does:** Returns a summary of all your jobs grouped by status, plus counts for key milestones. Used to power the dashboard page.

**No request body.**

**Success response (200):**
```json
{
  "data": {
    "totalJobs": 5,
    "byStatus": {
      "Interested": 2,
      "Applied": 1,
      "Outreach Sent": 1,
      "Interviewing": 1
    },
    "outreachSent": 2,
    "meetings": 1,
    "offers": 0,
    "user": {
      "id": "ca38267b-...",
      "email": "you@example.com",
      "name": "Your Name"
    }
  },
  "error": null
}
```

**How the counts work:**
- `outreachSent` = jobs in `"Outreach Sent"` + `"Replied"` status
- `meetings` = jobs in `"Meeting Booked"` + `"Interviewing"` status
- `offers` = jobs in `"Offer"` status

**How to confirm it works:** Create 2-3 jobs, set them to different statuses via PATCH, then call this endpoint — `byStatus` should reflect what you set.

---

## 7. Stub Endpoints (Not Yet Implemented)

These endpoints exist and respond, but contain no real logic yet. They are placeholders that will be connected to Azure Service Bus + AI Foundry as the worker gets built. They all return empty data but with correct HTTP status codes.

| Endpoint | Status | What it will do when built |
|---|---|---|
| `GET /api/v1/jobs/{id}/contacts` | Stub | List AI-discovered contacts for a job |
| `POST /api/v1/jobs/{id}/contacts/discover` | Stub (202) | Trigger AI to find contacts, returns `workflow_run_id` |
| `GET /api/v1/jobs/{id}/outreach` | Stub | List generated outreach messages |
| `POST /api/v1/jobs/{id}/outreach/generate` | Stub (202) | Trigger AI to write an outreach email |
| `PATCH /api/v1/jobs/{id}/outreach/{outreach_id}` | Stub | Mark a message as sent |
| `GET /api/v1/jobs/{id}/follow-up` | Stub | List scheduled follow-ups |
| `POST /api/v1/jobs/{id}/follow-up/generate` | Stub (202) | Trigger AI to write a follow-up |
| `GET /api/v1/jobs/{id}/flash-cards` | Stub | List AI interview prep cards |
| `POST /api/v1/jobs/{id}/flash-cards/generate` | Stub (202) | Trigger AI to generate flash cards |
| `GET /api/v1/jobs/{id}/pitch-deck` | Stub | Get Gamma pitch deck for a job |
| `POST /api/v1/jobs/{id}/pitch-deck/generate` | Stub (202) | Trigger Gamma to build a pitch deck |
| `GET /api/v1/jobs/{id}/notes` | Stub | Get notes for a job |
| `PATCH /api/v1/jobs/{id}/notes` | Stub | Save notes for a job |
| `GET /api/v1/jobs/{id}/activity` | Stub | Get activity timeline for a job |
| `POST /api/v1/attachments` | Stub | Upload a file to Azure Blob Storage |
| `GET /api/v1/attachments/files/{id}/download` | Stub | Get a pre-signed download URL |
| `GET /api/v1/inbox/actions` | Stub | Get action items for the inbox |
| `PATCH /api/v1/inbox/{id}/complete` | Stub | Mark inbox action as done |
| `PATCH /api/v1/inbox/{id}/snooze` | Stub | Snooze inbox action |
| `GET /api/v1/workflow-runs/{id}` | Stub | Poll async AI job status (queued/running/completed/failed) |

**The `202 Accepted` pattern:** When the frontend triggers an AI action (e.g. generate outreach), the backend will put a message on Azure Service Bus and immediately return `202 Accepted` with a `workflow_run_id`. The frontend then polls `GET /workflow-runs/{id}` every few seconds until status is `completed`, then fetches the result.

---

## 8. Full End-to-End Test Sequence

Use the `/docs` page at http://localhost:8000/docs or run these in your terminal. This sequence confirms data is actually flowing into Azure Postgres.

**Step 1 — Register**
```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@test.com","password":"Pass123","name":"Your Name"}'
```
Copy the `access_token` from the response. Set it as `TOKEN`:
```bash
TOKEN="eyJhbGci..."
```

**Step 2 — Create a job**
```bash
curl -X POST http://localhost:8000/api/v1/jobs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://careers.google.com/123","title":"SWE","company":"Google"}'
```
Copy the `id` from the response. Set it as `JOB_ID`:
```bash
JOB_ID="da6ab518-..."
```

**Step 3 — Move the job through statuses**
```bash
curl -X PATCH http://localhost:8000/api/v1/jobs/$JOB_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"Applied","progress":20}'
```

**Step 4 — Check the dashboard reflects it**
```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/v1/dashboard
```
You should see `"Applied": 1` in `byStatus`.

**Step 5 — Confirm auth guard works**
```bash
curl http://localhost:8000/api/v1/jobs
```
Should return `{"detail": "Not authenticated"}` — proves protected routes are enforced.

**Step 6 — Delete the job**
```bash
curl -X DELETE -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/v1/jobs/$JOB_ID
```
Returns `204`. Calling `GET /jobs` again shows empty list.

If all 6 steps work, the full auth + jobs + dashboard stack is confirmed working against Azure Postgres.

---

## 9. What Each Status Code Means

| Code | Meaning |
|---|---|
| `200 OK` | Success, body contains data |
| `201 Created` | Row written to database |
| `202 Accepted` | AI job queued on Service Bus (async) |
| `204 No Content` | Success, no body (logout, delete) |
| `400 Bad Request` | Invalid input (e.g. email already exists) |
| `401 Unauthorized` | No token, expired token, or wrong password |
| `404 Not Found` | Resource doesn't exist or belongs to another user |
| `500 Internal Server Error` | Bug or database connection issue — check backend logs |

---

## 10. Where Data Lives

| Data | Azure Service |
|---|---|
| Users, jobs, contacts, outreach, notes, all 16 tables | Azure Postgres — `referro-db.postgres.database.azure.com` |
| Uploaded resumes, exports, AI outputs | Azure Blob Storage — `referrostorage` account |
| AI task queue messages | Azure Service Bus — `referro-bus.servicebus.windows.net` |
| AI-generated content (outreach, flash cards, pitch decks) | Azure AI Foundry |
| Logs and telemetry | Azure Application Insights |

Nothing is stored locally on your machine. The `.env` files in `backend/` and `worker/` contain the connection strings — never commit these to git.
