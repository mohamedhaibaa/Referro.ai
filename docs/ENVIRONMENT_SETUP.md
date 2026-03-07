# Environment Setup

## Prerequisites (both founders)

- GitHub repo access
- Node.js LTS (for frontend)
- Python 3.12 (for backend and worker)
- Docker Desktop (for local services)
- Azure CLI (`az` command)
- PostgreSQL client (`psql`)

---

## Step 1 — Clone the repo

```bash
git clone https://github.com/mohamedhaibaa/Referoo.ai.git
cd Referoo.ai
git checkout develop
```

---

## Step 2 — Start local services (Postgres)

```bash
docker compose -f docker-compose.local.yml up -d
```

This starts PostgreSQL on port 5432.

---

## Step 3 — Backend setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -e .
cp ../.env.example .env
# Edit .env — at minimum set DATABASE_URL and JWT_SECRET_KEY
alembic upgrade head             # Run DB migrations
uvicorn app.main:app --reload    # Start API on http://localhost:8000
```

Visit `http://localhost:8000/health` — should return `{"status": "ok"}`.

---

## Step 4 — Worker setup

```bash
cd worker
python -m venv .venv
source .venv/bin/activate
pip install -e .
cp ../.env.example .env
# Edit .env — set DATABASE_URL and SERVICE_BUS_CONNECTION_STRING
python -m app.main                # Start worker
```

---

## Step 5 — Frontend setup

```bash
cd frontend
npm install
cp ../.env.example .env.local
# Set VITE_API_BASE_URL=http://localhost:8000/api/v1
npm run dev                       # Start frontend on http://localhost:5173
```

---

## Environment variables reference

See `.env.example` at the root for all variables and descriptions.

The minimum you need to run locally:

| Variable | Required for |
|----------|-------------|
| `DATABASE_URL` | Backend + Worker |
| `JWT_SECRET_KEY` | Backend |
| `VITE_API_BASE_URL` | Frontend |

The rest (Service Bus, AI Foundry, Gamma, Blob Storage) are needed only when working on those specific features.

---

## Staging & Production

- Staging deploys from `develop` branch automatically via CI
- Production deploys from `main` branch after PR approval
- All secrets live in Azure Key Vault — never in code or `.env` files committed to git
