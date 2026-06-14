# Qanunora — Government Legislative Intelligence Platform

> A premium legislative lifecycle management platform for ministries, parliaments, legislative councils, cabinet offices, and legal affairs departments.

---

## Overview

Qanunora manages the full legislative lifecycle:

- Draft laws, bills, amendments
- Committee reviews and stakeholder consultations
- Legal impact analysis and regulatory mapping
- Version history and traceability
- Approval workflows and publication readiness
- AI-powered summarization and analysis

---

## Architecture

```
Qanunora/
├── apps/
│   ├── backend/          # NestJS REST API + WebSocket server
│   └── frontend/         # Next.js 14 web application
├── packages/
│   └── shared/           # Shared TypeScript types and utilities
├── infra/
│   └── postgres/         # Database initialization scripts
├── docker-compose.yml    # Local development services
└── docs/                 # Documentation (added in Phase 30)
```

### Tech Stack

| Layer     | Technology                                           |
|-----------|------------------------------------------------------|
| Frontend  | Next.js 14, TypeScript, Tailwind CSS, ShadCN UI     |
| State     | TanStack Query, TanStack Table, Zustand              |
| Backend   | NestJS, TypeScript, REST, WebSocket                 |
| Database  | PostgreSQL 16 + Prisma ORM                          |
| Cache/Queue | Redis 7 + BullMQ                                  |
| Auth      | JWT (access + refresh), RBAC, SSO-ready             |
| AI        | Multi-provider abstraction (10+ providers)           |
| Storage   | S3-compatible abstraction (local dev supported)     |

---

## Quick Start

### Prerequisites

- Node.js ≥ 20
- Docker & Docker Compose
- npm ≥ 10

### 1. Clone and install

```bash
git clone https://github.com/YASSERRMD/Qanunora.git
cd Qanunora
npm install
```

### 2. Configure environment

```bash
# Root (Docker services)
cp .env.example .env

# Backend
cp apps/backend/.env.example apps/backend/.env

# Frontend
cp apps/frontend/.env.example apps/frontend/.env.local
```

Edit each `.env` file with your credentials.

### 3. Start services (PostgreSQL + Redis)

```bash
docker compose up -d postgres redis
```

### 4. Run database migrations

```bash
cd apps/backend
npx prisma migrate dev
npx prisma db seed
```

### 5. Start development servers

```bash
# From root — starts both backend and frontend
npm run dev
```

Or individually:

```bash
# Backend only
npm run dev --workspace=apps/backend

# Frontend only
npm run dev --workspace=apps/frontend
```

### 6. Access the platform

| Service    | URL                          |
|------------|------------------------------|
| Frontend   | http://localhost:3000        |
| Backend API| http://localhost:3001/api    |
| Swagger    | http://localhost:3001/api/docs |

---

## Docker (Full Stack)

```bash
# Build and start all services
docker compose --profile full up -d

# Stop all
docker compose --profile full down

# Wipe volumes (clean slate)
docker compose --profile full down -v
```

---

## User Roles

| Role | Description |
|------|-------------|
| Super Admin | Full platform access |
| Legislative Admin | Manage all legislative items |
| Ministry Legal Officer | Manage ministry's items |
| Drafting Officer | Create and edit drafts |
| Reviewer | Review and comment on items |
| Committee Member | Access committee reviews |
| Stakeholder Manager | Manage stakeholder registry |
| Public Consultation Officer | Manage consultation campaigns |
| Auditor | Read-only audit access |
| Viewer | Read-only access |

---

## AI Providers

Qanunora supports 11 AI providers through a unified abstraction layer. Configure your preferred provider in `apps/backend/.env`:

- OpenAI
- Azure OpenAI
- Anthropic Claude
- Google Gemini
- Mistral
- Cohere
- Groq
- DeepSeek
- Together AI
- Ollama (local)
- OpenAI-compatible custom endpoints

---

## Development

```bash
# Lint all packages
npm run lint

# Format all files
npm run format

# Type check all packages
npm run typecheck

# Run all tests
npm run test
```

---

## License

See [LICENSE](./LICENSE) for details.
