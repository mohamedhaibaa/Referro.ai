# API Spec

Base URL: `/api/v1`
Authentication: Bearer JWT
Content-Type: `application/json`

## Conventions
- All protected endpoints require `Authorization: Bearer <token>`
- All timestamps are ISO 8601 UTC
- All IDs are UUID strings
- All list endpoints support `page` and `page_size` query params
- Async generation endpoints return `202 Accepted` with `workflow_run_id`

## Response envelope

### Success
```json
{
  "data": {},
  "meta": {},
  "error": null
}
```

### Error
```json
{
  "data": null,
  "meta": { "request_id": "req_123" },
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "details": [{ "field": "email", "message": "Invalid email format." }]
  }
}
```

## Status codes
- `200` success
- `201` created
- `202` accepted (async job queued)
- `204` no content / deleted
- `400` bad request
- `401` unauthorized
- `403` forbidden
- `404` not found
- `409` conflict
- `422` validation error
- `429` rate limited
- `500` internal server error

---

## POST /auth/register
Create user account.

### Request
```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!",
  "first_name": "Mohamed",
  "last_name": "Haiba"
}
```
### Responses: `201`, `409` conflict if user exists, `422` validation

---

## POST /auth/login
### Request
```json
{ "email": "user@example.com", "password": "StrongPassword123!" }
```
### Success body
```json
{
  "data": {
    "access_token": "jwt",
    "token_type": "Bearer",
    "user": { "id": "uuid", "email": "user@example.com" }
  }
}
```

---

## GET /jobs
List current user's jobs.

Query params: `page`, `page_size`, `status`, `search`

### Success body
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Product Manager",
      "company": "Acme",
      "status": "Interested",
      "source_url": "https://...",
      "created_at": "2026-03-07T10:00:00Z"
    }
  ],
  "meta": { "page": 1, "page_size": 20, "total": 1 }
}
```

---

## POST /jobs
Create job and trigger async parsing.

### Request
```json
{ "source_url": "https://www.linkedin.com/jobs/view/..." }
```
### Response: `202 Accepted`
```json
{
  "data": {
    "job": { "id": "uuid", "status": "new", "source_url": "..." },
    "workflow_run": { "id": "uuid", "type": "job-parsing", "status": "queued" }
  }
}
```

---

## GET /jobs/{job_id}
Full job detail including milestones, contacts, outreach, follow-ups, activity.

## PATCH /jobs/{job_id}
Update status, notes, milestones, or user fields.

## DELETE /jobs/{job_id}
Soft delete the job.

---

## GET /workflow-runs/{workflow_run_id}
Poll async job status. Frontend polls until `completed` or `failed`.

```json
{
  "data": {
    "id": "uuid",
    "type": "job-parsing",
    "status": "running",
    "started_at": "2026-03-07T10:02:00Z",
    "completed_at": null,
    "error_message": null
  }
}
```

---

## GET /jobs/{job_id}/contacts
## POST /jobs/{job_id}/contacts/discover → `202`

---

## GET /jobs/{job_id}/outreach
## POST /jobs/{job_id}/outreach/generate → `202`
```json
{ "contact_id": "uuid" }
```

---

## GET /jobs/{job_id}/follow-up
## POST /jobs/{job_id}/follow-up/generate → `202`
```json
{ "outreach_message_id": "uuid" }
```

---

## POST /jobs/{job_id}/flash-cards/generate → `202`
## GET /jobs/{job_id}/flash-cards

---

## POST /jobs/{job_id}/pitch-deck/generate → `202`
## GET /jobs/{job_id}/pitch-deck

---

## POST /attachments
Upload resume or file. Validate type (PDF/DOCX) and size (max 10MB).
Stores metadata in DB, file in Blob Storage.

## GET /files/{file_id}/download
Returns pre-signed Blob Storage URL.

---

## GET /dashboard
Returns dashboard metrics for the current user.

---

## GET /inbox/actions
## PATCH /inbox/{action_id}/complete
## PATCH /inbox/{action_id}/snooze

---

## GET /jobs/{job_id}/notes
## PATCH /jobs/{job_id}/notes
## GET /jobs/{job_id}/activity
