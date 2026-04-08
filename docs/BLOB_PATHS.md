# Blob Storage Path Convention

Azure Blob Storage account has 3 containers. File paths follow these conventions.
Do not deviate — the API and Worker both use these paths.

## Containers

| Container | Purpose |
|-----------|---------|
| `resumes` | User-uploaded resume files |
| `exports` | User-exported files (future) |
| `ai-outputs` | Files produced by AI workflows (pitch deck PDFs etc.) |

## Path Patterns

| Container | Path pattern | Example |
|-----------|-------------|---------|
| `resumes` | `{user_id}/{filename}` | `abc-123/Mohamed_Resume_2025.pdf` |
| `exports` | `{user_id}/{filename}` | `abc-123/referoo_export_2026-03.csv` |
| `ai-outputs` | `{workflow_run_id}/{filename}` | `run-456/pitch_deck.pdf` |

## Rules

- Resume uploads: API writes to `resumes/{user_id}/`
- AI outputs: Worker writes to `ai-outputs/{workflow_run_id}/`
- All download URLs are pre-signed (expire after 1 hour) — never expose raw storage URLs
- File metadata (blob URL, original name, size, mime type) is always stored in DB
