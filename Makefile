.PHONY: help dev build lint test typecheck format db-up db-down db-migrate db-seed db-studio clean \
        k8s-apply k8s-delete helm-install helm-upgrade docker-build-backend docker-build-frontend

HELM_RELEASE ?= qanunora
HELM_NAMESPACE ?= qanunora
IMAGE_TAG ?= latest

help:
	@echo "Qanunora — Available commands:"
	@echo "  make dev                  Start backend + frontend dev servers"
	@echo "  make build                Build all workspaces"
	@echo "  make lint                 Lint all workspaces"
	@echo "  make test                 Run all tests"
	@echo "  make typecheck            TypeScript check all workspaces"
	@echo "  make format               Format all files with Prettier"
	@echo "  make db-up                Start PostgreSQL + Redis via Docker"
	@echo "  make db-down              Stop Docker services"
	@echo "  make db-migrate           Run Prisma migrations"
	@echo "  make db-seed              Seed the database"
	@echo "  make db-studio            Open Prisma Studio"
	@echo "  make clean                Remove node_modules and build artifacts"
	@echo ""
	@echo "Kubernetes:"
	@echo "  make k8s-apply            Apply all K8s manifests"
	@echo "  make k8s-delete           Delete all K8s resources"
	@echo "  make helm-install         Install Helm chart"
	@echo "  make helm-upgrade         Upgrade Helm chart"
	@echo "  make docker-build-backend Build backend production Docker image"
	@echo "  make docker-build-frontend Build frontend production Docker image"

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

# ── Kubernetes ─────────────────────────────────────────────────────────────────

k8s-apply:
	kubectl apply -f infra/k8s/namespace.yaml
	kubectl apply -f infra/k8s/configmap.yaml
	kubectl apply -f infra/k8s/postgres.yaml
	kubectl apply -f infra/k8s/redis.yaml
	kubectl apply -f infra/k8s/backend-deployment.yaml
	kubectl apply -f infra/k8s/frontend-deployment.yaml
	kubectl apply -f infra/k8s/ingress.yaml
	@echo "All K8s resources applied to namespace $(HELM_NAMESPACE)"

k8s-delete:
	kubectl delete -f infra/k8s/ --ignore-not-found=true
	@echo "All K8s resources deleted"

k8s-status:
	@kubectl get pods,svc,ingress,hpa -n $(HELM_NAMESPACE)

# ── Helm ──────────────────────────────────────────────────────────────────────

helm-install:
	helm install $(HELM_RELEASE) infra/helm/ \
	  --namespace $(HELM_NAMESPACE) \
	  --create-namespace \
	  --values infra/helm/values.yaml
	@echo "Helm release '$(HELM_RELEASE)' installed"

helm-upgrade:
	helm upgrade $(HELM_RELEASE) infra/helm/ \
	  --namespace $(HELM_NAMESPACE) \
	  --values infra/helm/values.yaml \
	  --atomic \
	  --timeout 5m
	@echo "Helm release '$(HELM_RELEASE)' upgraded"

helm-uninstall:
	helm uninstall $(HELM_RELEASE) --namespace $(HELM_NAMESPACE)

# ── Docker (Production) ───────────────────────────────────────────────────────

docker-build-backend:
	docker build \
	  -f apps/backend/Dockerfile.prod \
	  -t ghcr.io/yasserrmd/qanunora-backend:$(IMAGE_TAG) \
	  .
	@echo "Backend image built: ghcr.io/yasserrmd/qanunora-backend:$(IMAGE_TAG)"

docker-build-frontend:
	docker build \
	  -f apps/frontend/Dockerfile.prod \
	  -t ghcr.io/yasserrmd/qanunora-frontend:$(IMAGE_TAG) \
	  .
	@echo "Frontend image built: ghcr.io/yasserrmd/qanunora-frontend:$(IMAGE_TAG)"
