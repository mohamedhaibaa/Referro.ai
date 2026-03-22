.PHONY: backend worker frontend migrate install lint-fe dev

# ── Start everything (open 3 tabs/panes and run each) ──────────────────────
#   Terminal 1: make backend
#   Terminal 2: make worker
#   Terminal 3: make frontend
# Or use: make dev  (runs all three with concurrently — requires: npm i -g concurrently)
dev:
	npx concurrently \
		--names "backend,worker,frontend" \
		--prefix-colors "blue,green,magenta" \
		"make backend" \
		"make worker" \
		"make frontend"

# Run backend API (always run from backend/ so .env is found)
backend:
	cd backend && python3 -m uvicorn app.main:app --reload --port 8000

# Run worker (uses isolated venv to avoid package shadowing)
worker:
	cd worker && .venv/bin/python -m app.main

# Run frontend dev server
frontend:
	cd frontend && npm run dev

# Run DB migrations against Azure Postgres
migrate:
	cd backend && alembic upgrade head

# Lint frontend
lint-fe:
	cd frontend && npm run lint

# Install all dependencies
install:
	cd frontend && npm install
	cd backend && pip3 install -e .
	cd worker && python3 -m venv .venv && .venv/bin/pip install -e .
