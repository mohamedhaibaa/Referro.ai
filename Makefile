.PHONY: up down backend worker frontend migrate

# Start local Postgres
up:
	docker compose -f docker-compose.local.yml up -d

# Stop local services
down:
	docker compose -f docker-compose.local.yml down

# Run backend API (from backend/ with venv active)
backend:
	cd backend && uvicorn app.main:app --reload --port 8000

# Run worker (from worker/ with venv active)
worker:
	cd worker && python -m app.main

# Run frontend dev server
frontend:
	cd frontend && npm run dev

# Run DB migrations
migrate:
	cd backend && alembic upgrade head

# Lint frontend
lint-fe:
	cd frontend && npm run lint

# Install all dependencies
install:
	cd frontend && npm install
	cd backend && pip install -e .
	cd worker && pip install -e .
