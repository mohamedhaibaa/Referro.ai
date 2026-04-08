.PHONY: backend worker frontend migrate install lint-fe

# Run backend API
backend:
	cd backend && uvicorn app.main:app --reload --port 8000

# Run worker
worker:
	cd worker && python -m app.main

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
	cd backend && pip install -e .
	cd worker && pip install -e .
