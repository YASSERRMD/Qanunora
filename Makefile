.PHONY: help dev build lint test typecheck format db-up db-down db-migrate db-seed db-studio clean

help:
	@echo "Qanunora — Available commands:"
	@echo "  make dev          Start backend + frontend dev servers"
	@echo "  make build        Build all workspaces"
	@echo "  make lint         Lint all workspaces"
	@echo "  make test         Run all tests"
	@echo "  make typecheck    TypeScript check all workspaces"
	@echo "  make format       Format all files with Prettier"
	@echo "  make db-up        Start PostgreSQL + Redis via Docker"
	@echo "  make db-down      Stop Docker services"
	@echo "  make db-migrate   Run Prisma migrations"
	@echo "  make db-seed      Seed the database"
	@echo "  make db-studio    Open Prisma Studio"
	@echo "  make clean        Remove node_modules and build artifacts"

dev:
	npm run dev

build:
	npm run build

lint:
	npm run lint

test:
	npm run test

typecheck:
	npm run typecheck

format:
	npm run format

db-up:
	docker compose up -d postgres redis

db-down:
	docker compose down

db-migrate:
	cd apps/backend && npx prisma migrate dev

db-seed:
	cd apps/backend && npx prisma db seed

db-studio:
	cd apps/backend && npx prisma studio

clean:
	find . -name "node_modules" -type d -prune -exec rm -rf '{}' + 2>/dev/null || true
	find . -name "dist" -type d -prune -exec rm -rf '{}' + 2>/dev/null || true
	find . -name ".next" -type d -prune -exec rm -rf '{}' + 2>/dev/null || true
