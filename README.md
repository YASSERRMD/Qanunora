# Qanunora — Government Legislative Intelligence Platform

> A premium, AI-powered legislative lifecycle management platform for ministries, parliaments, legislative councils, cabinet offices, and legal affairs departments.

---

## Overview

Qanunora manages the complete legislative lifecycle through 60 integrated modules:

- Draft laws, bills, amendments, regulations, cabinet decisions, circulars, and policy drafts
- Committee reviews, stakeholder consultations, and public feedback management
- AI-powered summarization, impact analysis, and regulatory mapping
- Cross-jurisdiction comparison and legal traceability
- Semantic search and RAG-based legislative assistant
- Full audit readiness and compliance evidence
- Notifications, reporting, and admin configuration

---

## Architecture

```
Qanunora/
├── apps/
│   ├── backend/              # NestJS REST API + WebSocket server
│   │   ├── src/
│   │   │   ├── modules/      # 28 feature modules
│   │   │   ├── common/       # Guards, decorators, pipes, filters, utilities
│   │   │   └── config/       # Environment configuration
│   │   └── prisma/           # Schema, migrations, seed data
│   └── frontend/             # Next.js 14 web application
│       └── src/
│           ├── app/          # 30+ pages (App Router)
│           ├── components/   # Shared UI components
│           ├── stores/       # Zustand state management
│           └── lib/          # API client, utilities
├── packages/
│   └── shared/               # Shared TypeScript types and enums
├── infra/
│   └── postgres/             # Database initialization
├── docker-compose.yml
├── SECURITY.md
└── docs/                     # Architecture and API guides
```

### Tech Stack

| Layer       | Technology                                                    |
|-------------|---------------------------------------------------------------|
| Frontend    | Next.js 14, TypeScript, Tailwind CSS, ShadCN UI patterns      |
| State       | TanStack Query v5, TanStack Table v8, Zustand v4              |
| Backend     | NestJS 10, TypeScript, REST API, WebSocket (Socket.IO)        |
| Database    | PostgreSQL 16 + Prisma ORM 5                                  |
| Cache/Queue | Redis 7 + BullMQ 5                                           |
| Auth        | JWT (access 15m + refresh 7d with rotation), RBAC, SSO-ready |
| AI          | Multi-provider abstraction: 11 providers supported            |
| Storage     | S3-compatible abstraction (local dev / S3 / MinIO)           |
| Security    | Helmet, rate limiting, AES-256-GCM encryption, audit logging  |

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
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env.local
```

Edit each `.env` file. At minimum set:
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_PASSWORD` — Redis password
- `JWT_SECRET` + `JWT_REFRESH_SECRET` — strong random strings
- `ENCRYPTION_SECRET` — 32+ character random string for API key encryption
- At least one AI provider key (e.g. `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`)

### 3. Start infrastructure services

```bash
docker compose up -d postgres redis
```

### 4. Run database migrations and seed

```bash
cd apps/backend
npx prisma migrate dev --name init
npx prisma db seed
cd ../..
```

### 5. Start development servers

```bash
# From root — starts both backend and frontend concurrently
npm run dev
```

Or run individually:

```bash
npm run dev --workspace=apps/backend    # http://localhost:3001
npm run dev --workspace=apps/frontend   # http://localhost:3000
```

### 6. Access the platform

| Service    | URL                            |
|------------|--------------------------------|
| Frontend   | http://localhost:3000          |
| Backend API| http://localhost:3001/api/v1   |
| Swagger    | http://localhost:3001/api/docs |
| WebSocket  | ws://localhost:3001/notifications |

**Default credentials (development only — change before production):**
- Email: `admin@qanunora.gov`
- Password: `Admin@123456`

---

## Docker (Full Stack)

```bash
# Start all services
docker compose --profile full up -d

# View logs
docker compose --profile full logs -f

# Stop all
docker compose --profile full down

# Clean slate (wipes all data)
docker compose --profile full down -v
```

---

## User Roles

| Role | Description | Key Capabilities |
|------|-------------|-----------------|
| Super Admin | Full platform access | User management, system settings, all operations |
| Legislative Admin | Manage all legislative items | Approve, publish, delete, assign |
| Ministry Legal Officer | Manage ministry items | Create, review, approve amendments |
| Drafting Officer | Draft legislation | Create and edit draft laws |
| Reviewer | Review and comment | Read all non-confidential items, add comments |
| Committee Member | Committee participation | Committee reviews, recommendations |
| Stakeholder Manager | Stakeholder registry | Manage stakeholders, communication logs |
| Public Consultation Officer | Consultation campaigns | Manage consultations, review feedback |
| Auditor | Audit access | Read-only audit trail and audit reports |
| Viewer | Read-only | View public and internal (non-restricted) items |

---

## AI Provider Configuration

Qanunora supports 11 AI providers through a unified abstraction. Configure your preferred provider in `apps/backend/.env`:

```bash
# Set default provider (one of: openai, azure-openai, anthropic, gemini, mistral, cohere, groq, deepseek, together, ollama, openai-compatible)
AI_DEFAULT_PROVIDER=openai

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o

# Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6

# Azure OpenAI
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2024-08-01-preview

# Google Gemini
GOOGLE_AI_API_KEY=...
GEMINI_MODEL=gemini-1.5-pro

# Groq (fast inference)
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.1-70b-versatile

# Ollama (local, no key needed)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
```

All AI features include:
- Structured JSON output with confidence scores
- Source references and citations
- "AI-assisted analysis, not legal advice" disclaimer on all outputs
- Human review flag before approval

---

## Development Commands

```bash
# Root — run from the project root
npm run dev              # Start both backend + frontend
npm run build            # Build all workspaces
npm run lint             # Lint all workspaces
npm run format           # Format all files with Prettier
npm run typecheck        # TypeScript check all workspaces
npm run test             # Run all tests

# Backend
npm run prisma:migrate --workspace=apps/backend    # Run migrations
npm run prisma:studio --workspace=apps/backend     # Open Prisma Studio
npm run prisma:seed --workspace=apps/backend       # Seed database
npm test --workspace=apps/backend                  # Run backend tests
npm run test:coverage --workspace=apps/backend     # Coverage report

# Frontend
npm run build --workspace=apps/frontend            # Production build
npm run typecheck --workspace=apps/frontend        # Type check
```

---

## API Overview

The API is versioned at `/api/v1/`. Full interactive documentation at `/api/docs` (Swagger UI).

### Authentication
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Login, returns access + refresh tokens |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Logout, invalidate refresh token |
| GET | `/auth/me` | Get current user |

### Core Legislative
| Resource | Base Path |
|----------|-----------|
| Legislative Items | `/legislative-items` |
| Documents | `/documents` |
| Versions | `/legislative-items/:id/versions` |
| Workflow | `/legislative-items/:id/transition` |
| Amendments | `/legislative-items/:id/amendments` |
| Legal Structure | `/legislative-items/:id/structure` |
| Committees | `/committees` |
| Stakeholders | `/stakeholders` |
| Consultations | `/consultations` |

### AI Features
| Feature | Base Path |
|---------|-----------|
| Summarization | `/legislative-items/:id/summaries` |
| Impact Analysis | `/legislative-items/:id/impact-analysis` |
| Regulatory Mapping | `/legislative-items/:id/regulatory-mapping/detect` |
| Jurisdiction Comparison | `/legislative-items/:id/jurisdiction-comparison` |
| Change Detection | `/versions/detect-changes` |
| Consultation Analytics | `/consultations/:id/analytics` |
| Semantic Search | `/search` |
| AI Assistant (RAG) | `/assistant/sessions` |

### Platform
| Feature | Base Path |
|---------|-----------|
| Knowledge Graph | `/knowledge-graph` |
| Traceability | `/legislative-items/:id/trace-links` |
| Audit Readiness | `/legislative-items/:id/audit-checklist` |
| Reports | `/reports` |
| Notifications | `/notifications` |
| Users | `/users` |
| Admin | `/admin` |
| AI Providers | `/ai-providers` |

---

## Modules (60 Phases)

| # | Module | Description |
|---|--------|-------------|
| 01 | Foundation | Monorepo, NestJS, Next.js, Docker, TypeScript config |
| 02 | Database | Prisma schema, 25+ models, migrations, seed data |
| 03 | Authentication | JWT, refresh tokens, login/logout, protected routes |
| 04 | RBAC | Role hierarchy, permission matrix, guards, decorators |
| 05 | Legislative Items | CRUD, item types, statuses, search, filters |
| 06 | Document Management | Upload, validation, categories, preview, download |
| 07 | Version Control | Draft history, comparison, restore, version notes |
| 08 | Lifecycle Workflow | Status transitions, role validation, workflow history |
| 09 | Committee Management | Committees, members, reviews, recommendations |
| 10 | Amendment Tracking | Proposals, approval workflow, article linking, impact |
| 11 | Article Structure | Chapters, sections, articles, clauses, hierarchy |
| 12 | Public Consultation | Campaigns, feedback submission, review workflow |
| 13 | Stakeholder Management | Registry, types, communication logs |
| 14 | AI Provider Abstraction | 11 providers, unified interface, streaming, JSON mode |
| 15 | AI Summarization | Executive, citizen, legal officer, bill, amendment summaries |
| 16 | AI Impact Analysis | Social, economic, legal, operational impact with scoring |
| 17 | Regulatory Mapping | Affected regulations, conflict detection, dependency graph |
| 18 | Jurisdiction Comparison | 10 jurisdictions, similarity analysis, best practices |
| 19 | Traceability Engine | Trace links, audit trail, requirement-to-article mapping |
| 20 | Change Detection | Semantic diff, obligation changes, risk identification |
| 21 | Consultation Analytics | Sentiment analysis, topic clustering, stakeholder breakdown |
| 22 | Knowledge Graph | Entity graph across laws, amendments, committees, stakeholders |
| 23 | Semantic Search | Embeddings, vector store, hybrid keyword+semantic search |
| 24 | RAG Assistant | Conversational AI with citations, role-based source filtering |
| 25 | Audit Readiness | Checklist, evidence collection, audit report export |
| 26 | Notifications | In-app, WebSocket real-time, email adapter, reminders |
| 27 | Reporting | Lifecycle, consultation, impact, amendment, audit, ministry reports |
| 28 | Admin Configuration | System settings, workflow config, ministry management, security |
| 29 | Security Hardening | Rate limiting, CSP, API key encryption, file security, audit |
| 30 | Documentation | Architecture, API, deployment guides |
| 31 | Multi-Tenancy | Tenant isolation, ministry RBAC, tenant-scoped settings |
| 32 | Organization Chart | Departments, units, hierarchy management |
| 33 | Dashboard | Executive KPI cards, activity feed, quick actions |
| 34 | Calendar & Events | Legislative calendar, deadlines, reminders |
| 35 | Meetings Management | Agendas, minutes, decisions, action items |
| 36 | Decision Register | Formal decision records, linked items, status tracking |
| 37 | Legal Opinion Management | Opinion requests, drafting workflow, version history |
| 38 | Cabinet Submissions | Submission packages, pre-approval checklist, tracking |
| 39 | Parliamentary Sessions | Session tracking, reading stages, debate records |
| 40 | Voting & Resolutions | Vote events, member positions, resolution issuance |
| 41 | Public Portal | Public legislative portal, citizen feedback |
| 42 | Moderation | Spam detection, AI moderation scores, queue management |
| 43 | AI Translation | Bilingual AR/EN with translation memory and glossary |
| 44 | Legal Glossary | Bilingual term registry, domain classification |
| 45 | Document Editor | Rich text editing, autosave, collaborative locking |
| 46 | Redlining | Track changes, accept/reject, reviewer comments |
| 47 | Collaboration | Real-time document co-editing, presence indicators |
| 48 | Search Facets | Advanced multi-filter search, saved searches, views |
| 49 | Personal Workspace | Saved views, quick actions, pinned items |
| 50 | Advanced Audit | Immutable ledger, hash chain, tamper evidence |
| 51 | Data Retention | Retention rules, legal holds, archival workflow |
| 52 | Classification | Content security classification, access exceptions |
| 53 | Security Controls | Session management, MFA, IP restrictions, activity monitoring |
| 54 | SSO Integration | OIDC, SAML, LDAP with JIT provisioning |
| 55 | Final Documentation | Deployment guide, AI provider guide, architecture diagram |
| 56 | API Integration Framework | External integrations, outbound webhooks with HMAC, inbound receiver |
| 57 | Government Registry Integrations | Entity, Ministry, Gazette, Legal Reference, Personnel registries |
| 58 | Official Gazette Publication | Gazette workflow, publication checklist, public archive |
| 59 | Advanced Analytics & BI | Comprehensive KPIs, trend analysis, BI export (JSON/CSV) |
| 60 | Enterprise Deployment Hardening | Production Dockerfiles, Kubernetes, Helm, readiness probes |

---

## Remaining Limitations

The following are known limitations for the initial release:

1. **PDF generation**: Reports are exported as structured text (UTF-8). Full PDF generation requires integrating `pdfkit` or `puppeteer` (not bundled to avoid native dependencies in Docker).
2. **Excel export**: Reports use CSV format. Full `.xlsx` output requires `exceljs` (add as a dependency when needed).
3. **Graph visualization**: The knowledge graph and dependency graph have list-based representation. Interactive D3.js or Cytoscape.js visualization is a planned enhancement.
4. **Vector search persistence**: Embeddings are stored in-memory (`VectorStoreService`). A production deployment should integrate pgvector, Pinecone, or Weaviate.
5. **BullMQ workers**: Job queues are defined but worker processes are not started automatically — add dedicated worker processes in production.
6. **Email delivery**: Email notifications use a `ConsoleEmailAdapter` (logs to stdout). Wire in Nodemailer + SMTP or an email API (SendGrid, SES) for production.
7. **SSO integration**: The auth module is SSO-ready (Passport.js) but OAuth/SAML providers are not configured out of the box.
8. **Streaming AI responses**: Only the OpenAI provider implements `completeStream`. Other providers fall back to synchronous completion.
9. **Arabic RTL support**: The schema supports `nameAr`/`titleAr` fields throughout, but RTL layout on the frontend is not yet applied globally.
10. **Multi-tenancy**: Currently single-tenant. Ministry-scoped data isolation is enforced by RBAC, not database-level row security.

---

## Roadmap

### Near-term
- [ ] PDF/XLSX export with proper formatting
- [ ] Interactive knowledge graph visualization (D3.js)
- [ ] pgvector integration for persistent semantic search
- [ ] Email delivery (Nodemailer + SMTP/SendGrid)
- [ ] Dedicated BullMQ worker processes
- [ ] Arabic RTL layout support

### Medium-term
- [ ] OAuth 2.0 / SAML SSO integration
- [ ] Mobile-responsive design pass
- [ ] Multi-language support (i18n)
- [ ] Advanced consultation forms (surveys, structured feedback)
- [ ] Automated e-Gazette/official journal export
- [ ] AI fine-tuning on jurisdiction-specific legal corpus
- [ ] Microsoft Teams / Slack notifications integration

### Long-term
- [ ] Multi-tenancy with database-level isolation
- [ ] Blockchain-based immutable audit trail
- [ ] AI-powered drafting assistant (co-pilot mode)
- [ ] Parliamentary procedure tracking
- [ ] Public-facing portal for citizen consultation
- [ ] API federation across ministries
