# How to Use Swagger UI for Development

**URL:** http://localhost:8000/docs

Swagger UI is a live, interactive interface that sits on top of your backend API. Every endpoint in the codebase is listed here automatically — no Postman, no curl commands needed. You can send real requests, see real responses, and debug problems directly in the browser.

This document covers everything: the layout, authentication, every endpoint in the Referoo API, how to read responses, error handling, and a full development workflow.

---

## Table of Contents

1. [The Layout — What You're Looking At](#1-the-layout--what-youre-looking-at)
2. [Authentication — Doing This First is Non-Negotiable](#2-authentication--doing-this-first-is-non-negotiable)
3. [How to Use Any Endpoint](#3-how-to-use-any-endpoint)
4. [All Referoo Endpoints, One by One](#4-all-referoo-endpoints-one-by-one)
5. [Reading the Response](#5-reading-the-response)
6. [Understanding Every HTTP Status Code You'll See](#6-understanding-every-http-status-code-youll-see)
7. [The Schemas Section — Your Data Dictionary](#7-the-schemas-section--your-data-dictionary)
8. [The curl Command — Copy and Reuse](#8-the-curl-command--copy-and-reuse)
9. [The Full Development Loop](#9-the-full-development-loop)
10. [Common Mistakes and How to Fix Them](#10-common-mistakes-and-how-to-fix-them)

---

## 1. The Layout — What You're Looking At

When you open http://localhost:8000/docs you'll see:

```
┌─────────────────────────────────────────────────────┐
│  Referoo API            [Authorize 🔒]  /openapi.json│
├─────────────────────────────────────────────────────┤
│  ▼ auth                                             │
│     POST  /api/v1/auth/register                     │
│     POST  /api/v1/auth/login                        │
│     POST  /api/v1/auth/logout                       │
│  ▼ jobs                                             │
│     GET   /api/v1/jobs                              │
│     POST  /api/v1/jobs                              │
│     ...                                             │
├─────────────────────────────────────────────────────┤
│  Schemas                                            │
│     RegisterRequest / LoginRequest / CreateJobRequest│
│     ...                                             │
└─────────────────────────────────────────────────────┘
```

**Key elements:**

| Element | What it does |
|---|---|
| **Authorize button** (top right, lock icon) | Where you paste your JWT token to unlock protected endpoints |
| **Colored HTTP method badges** | `POST` = green, `GET` = blue, `PATCH` = orange, `DELETE` = red |
| **Each endpoint row** | Click to expand and see parameters, request body, and responses |
| **Schemas section** (bottom) | Shows the shape of every request/response object |
| **/openapi.json link** | The raw JSON spec — useful if you want to import into Postman |

---

## 2. Authentication — Doing This First is Non-Negotiable

Almost every endpoint in Referoo requires a valid JWT token. If you skip this step, every request will return `401 Unauthorized`.

### Step 1 — Register an account (first time only)

1. Click **`POST /api/v1/auth/register`** to expand it
2. Click **"Try it out"** (top right of the section)
3. Replace the placeholder JSON in the text box with:
   ```json
   {
     "email": "you@example.com",
     "password": "yourpassword",
     "name": "Your Name"
   }
   ```
   > **Note:** All three fields are required. Password has no minimum length enforced by the API, but keep it 8+ characters.
4. Click **"Execute"**
5. Scroll down to the **Response body** — you'll see:
   ```json
   {
     "data": {
       "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
       "token_type": "bearer",
       "user": {
         "id": "4ae1ab31-6b0b-40c4-8d1d-6a78500d20bb",
         "email": "you@example.com",
         "name": "Your Name"
       }
     },
     "error": null
   }
   ```
6. **Copy the `access_token` value** — the long `eyJ...` string

### Step 2 — Log in (returning sessions)

Same as above but use **`POST /api/v1/auth/login`** with just email and password:
```json
{
  "email": "you@example.com",
  "password": "yourpassword"
}
```
You'll get back the same token structure. Copy the `access_token`.

### Step 3 — Authorize in Swagger

1. Click the **"Authorize"** button at the very top right of the page
2. A dialog box appears with a field called `bearerAuth (http, Bearer)`
3. Paste your token in the **Value** field — just the raw token, no quotes, no "Bearer " prefix:
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
4. Click **"Authorize"** → **"Close"**

You'll notice the lock icons on each endpoint are now **closed/filled**. Every request from this point will automatically include `Authorization: Bearer <your_token>` in the headers.

> **Tokens expire after 60 minutes.** If you suddenly start getting 401 errors after things were working, your token expired. Login again, copy the new token, and re-authorize.

> **Refreshing the page clears your authorization.** Swagger doesn't persist your token between page reloads — you'll need to re-authorize each session.

---

## 3. How to Use Any Endpoint

Every endpoint follows the same pattern:

```
1. Click the endpoint row to expand it
2. Click "Try it out"
3. Fill in any path parameters, query parameters, or request body
4. Click "Execute"
5. Read the Response
```

### Path Parameters

These appear in the URL as `{job_id}`, `{action_id}`, etc. When you click "Try it out", they become input boxes you fill in.

Example — to get a specific job:
- Endpoint: `GET /api/v1/jobs/{job_id}`
- Fill in `job_id` with a real UUID like: `4ae1ab31-6b0b-40c4-8d1d-6a78500d20bb`
- Where do you get a real UUID? Run `GET /api/v1/jobs` first to list all jobs, then copy an `id` from that response.

### Request Body

POST and PATCH endpoints have a JSON text box. Swagger pre-fills it with a template showing every possible field. You edit the values directly.

Example — to create a job:
```json
{
  "url": "https://linkedin.com/jobs/view/12345",
  "title": "Software Engineer",
  "company": "Acme Corp"
}
```

### Query Parameters

Some GET endpoints accept filters as URL parameters. These appear as individual input boxes above the Execute button, not as JSON.

---

## 4. All Referoo Endpoints, One by One

### Auth

---

#### `POST /api/v1/auth/register`
Creates a new user account and returns a JWT token.

**Request body:**
```json
{
  "email": "you@example.com",
  "password": "yourpassword",
  "name": "Your Name"
}
```

**Success response (201):**
```json
{
  "data": {
    "access_token": "eyJ...",
    "token_type": "bearer",
    "user": { "id": "uuid", "email": "you@example.com", "name": "Your Name" }
  },
  "error": null
}
```

**Common errors:**
- `400 Bad Request` — `"Email already registered"` — that email is taken, use a different one or log in instead

---

#### `POST /api/v1/auth/login`
Authenticates an existing user and returns a fresh token.

**Request body:**
```json
{
  "email": "you@example.com",
  "password": "yourpassword"
}
```

**Success response (200):** Same structure as register.

**Common errors:**
- `401 Unauthorized` — `"Invalid email or password"` — wrong credentials

---

#### `POST /api/v1/auth/logout`
Stateless logout — just tells the client to drop the token. No request body needed.

**Success response:** `204 No Content` (empty body — this is correct, not an error)

---

### Jobs

---

#### `GET /api/v1/jobs`
Returns all jobs for the authenticated user.

No request body, no parameters needed.

**Success response (200):**
```json
[
  {
    "id": "uuid",
    "title": "Software Engineer",
    "company": "Acme Corp",
    "url": "https://...",
    "status": "applied",
    "progress": 40,
    "fit_score": "high",
    "work_mode": "remote",
    "role_family": "engineering",
    "due_date": "2026-04-01",
    "created_at": "2026-03-21T10:00:00Z"
  }
]
```

> **Tip:** Always run this first after logging in. Copy the `id` values — you'll need them for every other job endpoint.

---

#### `POST /api/v1/jobs`
Creates a new job entry. The URL is the only required field — title and company can be filled in manually or left for the AI worker to parse.

**Request body:**
```json
{
  "url": "https://linkedin.com/jobs/view/12345",
  "title": "Software Engineer",
  "company": "Acme Corp"
}
```

Minimal version (just the URL):
```json
{
  "url": "https://linkedin.com/jobs/view/12345"
}
```

**Success response (201):** The newly created job object with its generated `id`.

---

#### `GET /api/v1/jobs/{job_id}`
Returns a single job with full details.

**Path parameter:** `job_id` — UUID from `GET /api/v1/jobs`

---

#### `PATCH /api/v1/jobs/{job_id}`
Updates one or more fields on a job. All fields are optional — only send what you want to change.

**Path parameter:** `job_id`

**Request body (only include fields you want to update):**
```json
{
  "status": "interviewing",
  "progress": 70,
  "fit_score": "high",
  "work_mode": "hybrid",
  "role_family": "engineering",
  "due_date": "2026-04-15",
  "title": "Senior Software Engineer",
  "company": "Acme Corp"
}
```

Example — just update the status:
```json
{
  "status": "offer_received"
}
```

**Success response (200):** The updated job object.

---

#### `DELETE /api/v1/jobs/{job_id}`
Permanently deletes a job and all its related data.

**Path parameter:** `job_id`

**Success response:** `204 No Content`

> **Warning:** This is irreversible. Deleting a job also deletes its contacts, outreach messages, follow-ups, flash cards, notes, and activity log.

---

#### `GET /api/v1/jobs/{job_id}/milestones`
Returns the milestone checklist for a job — tracks how far along the application process is.

**Success response (200):**
```json
{
  "resume_tailored": false,
  "contact_selected": true,
  "outreach_sent": true,
  "follow_up_sent": false,
  "reply_received": false,
  "interview_scheduled": false,
  "interview_prep_1": false,
  "interview_prep_2": false,
  "interview_prep_3": false,
  "outcome_recorded": false
}
```

---

#### `PATCH /api/v1/jobs/{job_id}/milestones`
Updates one or more milestone flags.

**Request body:**
```json
{
  "resume_tailored": true,
  "contact_selected": true
}
```

Only include the fields you're changing. Omitted fields stay unchanged.

---

#### `GET /api/v1/jobs/{job_id}/contacts`
Returns all discovered contacts for a job.

**Success response (200):**
```json
[
  {
    "id": "uuid",
    "name": "Jane Smith",
    "title": "Engineering Manager",
    "company": "Acme Corp",
    "linkedin_url": "https://linkedin.com/in/janesmith",
    "email": "jane@acme.com"
  }
]
```

---

#### `POST /api/v1/jobs/{job_id}/contacts/discover`
Triggers the AI worker to find relevant contacts for this job. No request body needed.

This is an **async** operation — it puts a message on the Azure Service Bus queue and your worker picks it up. The response comes back immediately but the contacts won't appear yet. Poll `GET /api/v1/jobs/{job_id}/contacts` after a few seconds to see results.

**Success response (202):** Acknowledgement that the task was queued.

---

#### `GET /api/v1/jobs/{job_id}/outreach`
Returns all generated outreach messages for a job.

---

#### `POST /api/v1/jobs/{job_id}/outreach/generate`
Triggers AI generation of an outreach message for a specific contact.

**Request body:**
```json
{
  "contact_id": "uuid-of-contact-from-contacts-endpoint"
}
```

> Get the `contact_id` from `GET /api/v1/jobs/{job_id}/contacts` first.

**Async** — results appear in `GET /api/v1/jobs/{job_id}/outreach` after the worker completes.

---

#### `PATCH /api/v1/jobs/{job_id}/outreach/{outreach_id}`
Edits a generated outreach message (e.g. to tweak the wording before sending).

**Path parameters:** both `job_id` and `outreach_id`

---

#### `GET /api/v1/jobs/{job_id}/follow-up`
Returns all follow-up messages for a job.

---

#### `POST /api/v1/jobs/{job_id}/follow-up/generate`
Triggers AI generation of a follow-up message, linked to an original outreach.

**Request body:**
```json
{
  "outreach_message_id": "uuid-of-outreach-message"
}
```

---

#### `PATCH /api/v1/jobs/{job_id}/follow-up/{follow_up_id}`
Edits a generated follow-up message.

---

#### `GET /api/v1/jobs/{job_id}/flash-cards`
Returns interview prep flash cards for a job.

---

#### `POST /api/v1/jobs/{job_id}/flash-cards/generate`
Triggers AI generation of flash cards based on the job description. No request body needed.

---

#### `GET /api/v1/jobs/{job_id}/pitch-deck`
Returns the generated pitch deck for a job.

---

#### `POST /api/v1/jobs/{job_id}/pitch-deck/generate`
Triggers AI generation of a pitch deck. No request body needed.

---

#### `GET /api/v1/jobs/{job_id}/notes`
Returns the freeform notes saved for a job.

**Success response (200):**
```json
{
  "content": "Spoke to recruiter on March 20th. Salary range is $120k-$140k..."
}
```

---

#### `PATCH /api/v1/jobs/{job_id}/notes`
Saves/overwrites the notes for a job. This is a single text blob, not a list.

**Request body:**
```json
{
  "content": "Your notes here. Supports any text."
}
```

---

#### `GET /api/v1/jobs/{job_id}/activity`
Returns the full activity log for a job — a chronological list of everything that happened (status changes, outreach sent, etc.).

---

### Attachments

---

#### `POST /api/v1/attachments`
Uploads a file (e.g. a resume PDF) to Azure Blob Storage.

> **Note:** This endpoint uses `multipart/form-data`, not JSON. In Swagger, you'll see a file picker instead of a JSON text box. Click "Choose File", select your PDF, then Execute.

**Success response (201):**
```json
{
  "file_id": "uuid",
  "filename": "resume.pdf",
  "url": "https://referrostorage.blob.core.windows.net/..."
}
```

---

#### `GET /api/v1/attachments/files/{file_id}/download`
Returns a download URL for an uploaded file.

**Path parameter:** `file_id` — UUID from the upload response.

---

### Dashboard & Inbox

---

#### `GET /api/v1/dashboard`
Returns aggregate stats for the dashboard — job counts by status, upcoming deadlines, overall progress.

No parameters needed.

---

#### `GET /api/v1/inbox/actions`
Returns all pending action items — things the system has flagged for you to do (e.g. "follow up with Jane Smith", "prep for interview").

---

#### `PATCH /api/v1/inbox/{action_id}/complete`
Marks an inbox action as completed.

**Path parameter:** `action_id` — UUID from `GET /api/v1/inbox/actions`

No request body needed.

---

#### `PATCH /api/v1/inbox/{action_id}/snooze`
Snoozes an inbox action (pushes it back so it stops showing for now).

**Path parameter:** `action_id`

---

### Workflow Runs

---

#### `GET /api/v1/workflow-runs/{workflow_run_id}`
Returns the status and result of a background AI workflow run.

Use this to check whether an async operation (contact discovery, outreach generation, etc.) has completed and whether it succeeded or failed.

**Success response (200):**
```json
{
  "id": "uuid",
  "status": "completed",
  "workflow_type": "contact_discovery",
  "result": { ... },
  "error": null,
  "created_at": "2026-03-21T10:05:00Z",
  "completed_at": "2026-03-21T10:05:12Z"
}
```

Possible `status` values: `pending`, `running`, `completed`, `failed`

---

### Health

---

#### `GET /health`
Checks if the backend is alive. No auth needed.

**Success response (200):**
```json
{ "status": "ok" }
```

> Use this first if something seems broken — if this returns `ok`, the backend is running and the problem is elsewhere.

---

## 5. Reading the Response

After clicking Execute, scroll down to the **Responses** section. You'll see four things:

```
┌─────────────────────────────────────────┐
│ Response code    200                    │
│                                         │
│ Response body                           │
│ { "data": { ... }, "error": null }      │
│                                  [Copy] │
│                                         │
│ Response headers                        │
│ content-type: application/json          │
│                                         │
│ Curl                                    │
│ curl -X GET http://localhost:8000/...   │
└─────────────────────────────────────────┘
```

**Response code** — The HTTP status number. This is the first thing to check.

**Response body** — The actual JSON data. This is what the frontend receives. If something looks wrong in the UI, compare what you see here against what the frontend is rendering.

**Response headers** — Metadata about the response. Usually not needed day-to-day, but useful for debugging caching or content-type issues.

**Curl** — The exact `curl` command that produced this response. Copy it and run it in your terminal to reproduce the call outside of the browser.

---

## 6. Understanding Every HTTP Status Code You'll See

| Code | Meaning | What to do |
|---|---|---|
| `200 OK` | Success, data returned | Nothing — it worked |
| `201 Created` | Success, new record created | Nothing — it worked |
| `202 Accepted` | Request queued for async processing | Poll the relevant GET endpoint after a few seconds |
| `204 No Content` | Success, no data to return | Nothing — this is expected for DELETE and logout |
| `400 Bad Request` | Your request data is invalid | Read the `detail` field in the response body — it tells you exactly what's wrong |
| `401 Unauthorized` | Missing or expired token | Re-login and re-authorize in Swagger |
| `403 Forbidden` | Valid token but wrong permissions | You're trying to access someone else's data |
| `404 Not Found` | The resource doesn't exist | Check your UUID — it may be wrong or deleted |
| `422 Unprocessable Entity` | Request body has wrong field types or missing required fields | Read the `detail` array — each item points to the exact field that failed |
| `500 Internal Server Error` | Bug in the backend | Check the backend terminal logs for the full traceback |

### How a 422 error looks

This is the most common error when testing. Example — you forgot the `name` field on register:

```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "name"],
      "msg": "Field required",
      "input": { "email": "you@example.com", "password": "pass" }
    }
  ]
}
```

Read `loc` to find which field failed (`body` → `name`), and `msg` to know why (`Field required`).

---

## 7. The Schemas Section — Your Data Dictionary

Scroll to the very bottom of the Swagger page and you'll find the **Schemas** section. This lists every request and response object shape used in the API.

Think of it as a data dictionary. Each schema shows:
- Every field name
- Its data type (`string`, `integer`, `boolean`, `null`)
- Whether it's required or optional (optional fields are listed under `anyOf` with a `null` option)

**Referoo schemas at a glance:**

| Schema | Used by |
|---|---|
| `RegisterRequest` | `POST /auth/register` |
| `LoginRequest` | `POST /auth/login` |
| `CreateJobRequest` | `POST /jobs` |
| `PatchJobRequest` | `PATCH /jobs/{job_id}` |
| `PatchMilestonesRequest` | `PATCH /jobs/{job_id}/milestones` |
| `GenerateOutreachRequest` | `POST /jobs/{job_id}/outreach/generate` |
| `GenerateFollowUpRequest` | `POST /jobs/{job_id}/follow-up/generate` |
| `NotesBody` | `PATCH /jobs/{job_id}/notes` |
| `ValidationError` | Returned inside any `422` error response |

When you're unsure what fields an endpoint accepts, scroll down and read the schema rather than guessing.

---

## 8. The Curl Command — Copy and Reuse

After every Execute, Swagger shows you the equivalent `curl` command. Example:

```bash
curl -X GET \
  'http://localhost:8000/api/v1/jobs' \
  -H 'accept: application/json' \
  -H 'Authorization: Bearer eyJhbGci...'
```

This is useful for:
- **Sharing** — paste it in a message to a teammate so they can reproduce the exact call
- **Scripting** — chain multiple curl commands together in a shell script to seed test data
- **Debugging** — run it in your terminal to bypass the browser entirely, removing browser-related variables

To run it in your terminal, copy the curl block, open a terminal, paste it, and hit Enter.

---

## 9. The Full Development Loop

Here's how to use Swagger as your primary testing tool while building:

### When you add or change a backend endpoint

1. Save the Python file — uvicorn reloads automatically (you'll see `Reloading...` in the backend terminal)
2. Refresh the Swagger page
3. Your new/changed endpoint appears immediately
4. "Try it out" → fill in the body → Execute
5. Verify the response looks exactly right **before touching the frontend**

### When you're debugging a frontend bug

Something looks wrong in the UI. Before diving into React code:

1. Open Swagger
2. Call the exact endpoint the UI is using
3. Look at the raw JSON response
4. Compare it against what you expected

If the data is wrong in Swagger → it's a backend bug.
If the data looks right in Swagger but wrong in the UI → it's a frontend rendering bug.

This one habit saves enormous amounts of debugging time.

### When you're setting up test data from scratch

Run these in order:

```
1. POST /api/v1/auth/register          → get a token
2. Authorize with the token
3. POST /api/v1/jobs                   → create a job, copy the job_id
4. POST /api/v1/jobs/{job_id}/contacts/discover   → trigger contact discovery
5. (wait a few seconds for the worker)
6. GET  /api/v1/jobs/{job_id}/contacts → copy a contact_id
7. POST /api/v1/jobs/{job_id}/outreach/generate   → trigger outreach generation
8. GET  /api/v1/jobs/{job_id}/outreach → verify the message appeared
```

### When you want to test an edge case

Example — what happens if you try to register with an email that's already taken?

1. Register with `test@example.com`
2. Try to register again with `test@example.com`
3. Swagger shows you the exact `400` error response
4. Now you know what the frontend needs to handle

---

## 10. Common Mistakes and How to Fix Them

**"Failed to fetch" or no response at all**
The backend isn't running, or CORS is blocking the request. Run `GET /health` — if that fails too, restart the backend with `cd backend && python3 -m uvicorn app.main:app --reload --port 8000`.

**Everything returns 401 after working fine**
Your token expired (60 min limit). Go to `POST /api/v1/auth/login`, get a new token, click Authorize at the top, and paste the new token.

**I refreshed Swagger and now I'm getting 401**
Refreshing the page clears your authorization. You need to re-authorize every time you refresh. The token itself may still be valid — just paste it into the Authorize dialog again.

**422 on every request**
Your JSON is malformed or missing required fields. Check the Schemas section at the bottom to confirm the exact field names — JSON is case-sensitive (`job_id` ≠ `jobId` ≠ `JobId`).

**I ran a generate endpoint but the data never appeared**
These are async — they queue a job for the worker. Check that the worker is running (`cat /tmp/worker.log` in your terminal). If the worker crashed, restart it from the `worker/` directory.

**404 on a job/contact/outreach endpoint**
The UUID you're using doesn't exist. Re-run the parent GET endpoint to get a fresh list of valid IDs.

**The response body is empty even though the status is 200**
Some endpoints return `204 No Content` on success (logout, complete action, delete). An empty body with a 2xx status code is correct behavior, not an error.
