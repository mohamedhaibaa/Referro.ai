# RUNBOOK — Referro.ai

> **Cold-start guide.** You just opened this repo. Follow this top-to-bottom and you'll be running in under five minutes. No trial-and-error.
>
> For project context, see [`/CLAUDE.md`](./CLAUDE.md). For recent work, see [`/docs/SESSION_LOG.md`](./docs/SESSION_LOG.md).

---

## 1. What this project is

Referro.ai is a job-search assistant. Users paste a LinkedIn job URL, the product helps them reach out to the right people inside that company on LinkedIn. AI parses the job, scrapes contacts, drafts outreach, tracks every conversation through to offer or close.

**Production:** [getreferro.ai](https://getreferro.ai) — currently shows the old kanban UI. New UX lives on `develop`; production deploy pending.

**Repo:** [github.com/mohamedhaibaa/Referro.ai](https://github.com/mohamedhaibaa/Referro.ai). Default branch: `develop`.

---

## 2. Prerequisites

Verify each before continuing. If any check fails, install or upgrade first.

| Tool | Required | Verify |
|---|---|---|
| Python | ≥3.12 (3.12.6 known-good) | `python3.12 --version` |
| Node | ≥20 | `node --version` |
| `psql` client | any recent | `psql --version` |
| Docker Desktop | only if using local Postgres via docker-compose | `docker info` |
| Homebrew Postgres 16 | only if using local Postgres via brew | `brew list postgresql@16` |
| `gh` CLI | recommended | `gh --version` |

Note: on this machine, `python3` defaults to 3.9 — always invoke `python3.12` explicitly when creating venvs.

---

## 3. First-time repo setup

```bash
git clone https://github.com/mohamedhaibaa/Referro.ai.git ~/Documents/Mind/Referro.ai
cd ~/Documents/Mind/Referro.ai
git checkout develop

# Backend venv
cd backend
python3.12 -m venv venv
source venv/bin/activate
pip install -e .
deactivate
cd ..

# Worker venv (separate — different deps)
cd worker
python3.12 -m venv venv
source venv/bin/activate
pip install -e .
deactivate
cd ..

# Frontend
cd frontend
npm install
cd ..
```

The shortcut `make install` runs all three installs, but doesn't create venvs — do that manually first.

---

## 4. Database — Azure (default) vs local

The app supports two databases. **Default is Azure prod**, because the cofounder ([@scriptd-stack](https://github.com/scriptd-stack)) is on Azure and migrations need to stay in sync.

### Live `.env` state

`backend/.env` currently points at Azure:

```
DATABASE_URL=postgresql+psycopg://referro_admin:<REDACTED>@referro-db.postgres.database.azure.com:5432/postgres?sslmode=require
CORS_ALLOWED_ORIGINS=http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173,http://localhost:8081,http://127.0.0.1:8081,http://localhost:5555,https://getreferro.ai
```

(CORS is broad on purpose — Vite occasionally lands on 8081 if 8080 is taken.)

### Switching pattern

The convention is two committed example files (`backend/.env.azure` and `backend/.env.local`) that you copy over to `.env` when switching:

```bash
cd backend
cp .env.azure .env       # back to shared Azure DB
cp .env.local .env       # private local DB
```

**Important:** `.env.azure` and `.env.local` are not yet committed in this repo (REF-19 will add them). Until then, manage `.env` manually — keep two copies somewhere outside the repo (e.g. in `~/.referro/`) and `cp` them in.

### Apply migrations

```bash
cd backend
source venv/bin/activate
alembic current        # confirm where the DB is
alembic upgrade head   # apply any new migrations
```

The current head, as of this writing, is **`l2m3n4o5p6q7`** (REF-13: ref_chat_messages table).

**Push-first rule:** if you create a migration, push the migration file (and ideally the API/UI code that depends on it) **before** the cofounder pulls. Coordinate via DM. Migrations applied via `alembic upgrade head` modify the live Azure DB — there's no separate review environment.

---

## 5. Local Postgres setup (optional)

Skip this section if you're using Azure (the default).

### Primary path: brew install on port 5433

```bash
brew install postgresql@16              # one-time
brew services start postgresql@16
```

Port is **5433** (not the default 5432) due to a config override in `/opt/homebrew/var/postgresql@16/postgresql.conf`. This avoids conflict with any system Postgres on 5432.

Verify:

```bash
lsof -i :5433     # should show a postgres process
```

Connect:

```bash
psql -h localhost -p 5433 -U referro_admin -d referroo
```

User `referro_admin`, db `referroo`. The password is whatever you set during brew setup.

`.env.local` should look roughly like:

```
DATABASE_URL=postgresql+psycopg://referro_admin:<your-pw>@localhost:5433/referroo
```

### Common brew failure

If `brew services start postgresql@16` fails silently:

```bash
tail -50 /opt/homebrew/var/log/postgresql@16.log
launchctl bootout gui/$(id -u)/homebrew.mxcl.postgresql@16   # may "fail" — that's fine
brew services restart postgresql@16
```

### Alternative: docker-compose

The repo ships with `docker-compose.local.yml` that provisions a different setup — user `postgres`/`postgres`, db `referoo` (one `o`), port 5433:

```bash
docker-compose -f docker-compose.local.yml up -d
```

Connection string for that variant:

```
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5433/referoo
```

Note the database name `referoo` here vs `referroo` in the brew path. Pick one and stick with it; don't run both.

---

## 6. The startup sequence

Three terminals. Run them in this order: backend, worker, frontend.

### Terminal 1 — Backend (FastAPI on port 8000)

```bash
cd ~/Documents/Mind/Referro.ai/backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

Expected last line:

```
INFO:     Application startup complete.
```

If you see `alembic.runtime.migration.exc.RangeNotAncestor` or "head mismatch": run `alembic upgrade head` first.

### Terminal 2 — Worker (Service Bus consumers, no port)

```bash
cd ~/Documents/Mind/Referro.ai/worker
source venv/bin/activate
python -m app.main
```

Expected output (one line per consumer):

```
INFO:__main__:Worker starting — listening on all queues
INFO:app.consumers.job_parsing:Listening on queue: job-parsing
INFO:app.consumers.contact_discovery:Listening on queue: contact-discovery
INFO:app.consumers.outreach_generation:Listening on queue: outreach-generation
INFO:app.consumers.follow_up_generation:Listening on queue: follow-up-generation
INFO:app.consumers.flash_card_generation:Listening on queue: flash-card-generation
INFO:app.consumers.pitch_deck_generation:Listening on queue: pitch-deck-generation
INFO:app.consumers.cleanup:cleanup: starting periodic run
```

Only `job-parsing` and `contact-discovery` actually process messages. The other four are 14-line stubs (REF-PRICING called this out).

### Terminal 3 — Frontend (Vite on port 8080)

```bash
cd ~/Documents/Mind/Referro.ai/frontend
npm run dev
```

Expected:

```
VITE v5.x.x  ready in N ms
➜  Local:   http://localhost:8080/
```

If Vite says port in use, see §8.

---

## 7. Smoke test in the browser

1. Open [http://localhost:8080](http://localhost:8080). The landing page should render.
2. Log in with `Mohamed.Hiba@dal.ca`. (Test account; trial tier.)
3. Navigate to `/jobs`. Job cards should render. Click any card → Room should open. Phase 2 contact tiles should show three contacts.

If any of those fail, check terminal 1 for an error and §8 for the symptom.

---

## 8. Common failures & fixes

| Symptom | Cause | Fix |
|---|---|---|
| `git push` says "Repository not found" | Wrong `gh` account active | `gh auth switch --user mohamedhaibaa` |
| Frontend "Network Error" / "Failed to fetch" | Backend not running, OR origin not in CORS | Check terminal 1 is up. If running on a non-8080 port (Vite drifted to 8081), confirm `CORS_ALLOWED_ORIGINS` in `backend/.env` covers it |
| Backend can't connect to DB | `DATABASE_URL` wrong, OR local Postgres not started | `psql` your `DATABASE_URL` directly. If local: `brew services list` |
| `alembic.runtime.migration.exc.RangeNotAncestor` | Cofounder pushed a migration; you're behind | `git pull origin develop` then `alembic upgrade head` |
| `ModuleNotFoundError` in any backend/worker command | Forgot to `source venv/bin/activate` | activate the venv |
| Vite says port 8080 in use | Old dev server still running | `lsof -i :8080` then `kill <PID>` |
| Selected contacts have no profile photos | Known: REF-14 not shipped (`_extract_photo_url` doesn't read dict-shaped `profilePicture`) | Not a config issue; ignore until REF-14 |
| Job cards have no company logos | Known: column `company_logo_url` is never populated by any worker | Not a config issue; tracked as REF-15/16 |
| Contacts older than 30 days lose their `profile_data` overnight | Intentional. The cleanup consumer nullifies stale rows | Not a bug |

---

## 9. Stopping cleanly

Ctrl+C each terminal. If you started a local Postgres for testing:

```bash
brew services stop postgresql@16
# OR
docker-compose -f docker-compose.local.yml down
```

---

## 10. Quick reference

| | |
|---|---|
| Frontend port | **8080** |
| Backend port | **8000** |
| Local Postgres port | **5433** |
| Test account | `Mohamed.Hiba@dal.ca` |
| Default branch | `develop` |
| Branch convention | `feat/REF-XX-description`, `fix/REF-XX-…`, `chore/REF-XX-…` |
| PR target | `develop` (squash merge) |
| Database (default) | Azure prod, shared with [@scriptd-stack](https://github.com/scriptd-stack) |
| Migration head (this writing) | `l2m3n4o5p6q7` |
| Workflow doc | [`/CLAUDE.md`](./CLAUDE.md) |
| Recent activity | [`/docs/SESSION_LOG.md`](./docs/SESSION_LOG.md) |
| Per-ticket records | [`/docs/modifications/`](./docs/modifications/) |
| Codebase deep dive | [`/docs/CODEBASE_AUDIT.md`](./docs/CODEBASE_AUDIT.md) |
| Design rationale | [`/docs/UX_FLOW.md`](./docs/UX_FLOW.md) |
