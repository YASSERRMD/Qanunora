# Architecture Guide — Qanunora

## System Architecture

Qanunora is a monorepo consisting of three packages:

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Browser                          │
│                    Next.js 14 (Port 3000)                       │
│  ┌────────────┐  ┌───────────────┐  ┌────────────────────────┐ │
│  │ Auth Pages │  │ Dashboard     │  │ Admin / Reports        │ │
│  │ /login     │  │ /legislative  │  │ /admin, /reports       │ │
│  └────────────┘  └───────────────┘  └────────────────────────┘ │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTPS REST / WebSocket
┌───────────────────────────────▼─────────────────────────────────┐
│                    NestJS Backend (Port 3001)                    │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ Auth Module │  │ Legislative  │  │ AI Modules (14 total)  │ │
│  │ JWT + RBAC  │  │ Workflow     │  │ Summarize, Impact, RAG │ │
│  └─────────────┘  └──────────────┘  └────────────────────────┘ │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ Documents   │  │ Committees   │  │ Notifications          │ │
│  │ Versions    │  │ Amendments   │  │ Reports, Admin         │ │
│  └─────────────┘  └──────────────┘  └────────────────────────┘ │
└──────────────────┬───────────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
┌───────────────┐    ┌────────────────┐
│  PostgreSQL   │    │     Redis      │
│  (Port 5432)  │    │  (Port 6379)   │
│  All data     │    │  Cache + Queue │
└───────────────┘    └────────────────┘
```

## Backend Module Graph

```
AppModule
├── ConfigModule (global)
├── ThrottlerModule (global rate limiting)
├── DatabaseModule (global — PrismaService)
├── AuthModule
│   ├── UsersModule
│   └── JwtModule
├── LegislativeModule
├── DocumentsModule
│   └── StorageModule (local / S3 abstraction)
├── VersionsModule
├── WorkflowModule
├── CommitteesModule
├── AmendmentsModule
├── LegalStructureModule
├── ConsultationsModule
├── StakeholdersModule
├── AiProvidersModule (global — AiProviderFactory, AiProviderRegistry)
│   └── 11 Provider classes (OpenAI, Anthropic, Gemini, …)
├── AiSummarizationModule
├── AiImpactModule
├── RegulatoryMappingModule
├── JurisdictionComparisonModule
├── TraceabilityModule
├── ChangeDetectionModule
├── ConsultationAnalyticsModule
├── KnowledgeGraphModule
├── SemanticSearchModule
│   └── VectorStoreService (in-memory cosine similarity)
├── RagAssistantModule
│   └── SemanticSearchModule (re-used)
├── AuditReadinessModule
├── NotificationsModule
│   └── NotificationsGateway (WebSocket)
├── ReportingModule
└── AdminModule
```

## Data Flow: Legislative Item Lifecycle

```
Draft Created
     │
     ▼
DRAFTING ──[SUBMIT_FOR_REVIEW]──► INTERNAL_REVIEW
                                        │
                          [SEND_TO_COMMITTEE]──► COMMITTEE_REVIEW
                                        │              │
                          [RETURN_TO_DRAFT]◄───────────┤
                                                       │
                          [OPEN_CONSULTATION]──► PUBLIC_CONSULTATION
                                                       │
                          [CLOSE_CONSULTATION]──► COMMITTEE_REVIEW
                                                       │
                          [SEND_TO_LEGAL]──────► LEGAL_REVIEW
                                                       │
                                [APPROVE]──────► APPROVED
                                                       │
                                [PUBLISH]──────► PUBLISHED
                                                       │
                                [ARCHIVE]──────► ARCHIVED
```

Each transition:
1. Validates action is allowed from current status
2. Validates the actor's role is authorized for the action
3. Creates a `WorkflowHistory` record
4. Updates the `LegislativeItem.status`
5. Creates audit log entry
6. Triggers notifications to relevant stakeholders

## AI Provider Abstraction

```
Controller / Service
        │
        ▼
AiProviderFactory.getProvider(providerName?)
        │
        ▼
AiProviderRegistry.get(name) / getDefault()
        │
        ▼
IAiProvider.complete(options: AiCompletionOptions)
        │
   ┌────┴────────────────────────────────────────┐
   ▼        ▼         ▼        ▼         ▼       ▼
OpenAI  Anthropic  Gemini  Mistral  Groq   Ollama  …
   │
   ▼
AiCompletionResult { content, model, provider, usage }
        │
        ▼
parseJsonResponse<T>(content)
        │
        ▼
Save AiAnalysis { analysisType, provider, model, result, confidenceScore, disclaimer }
```

## Database Schema Overview

```
User ──(role)──► UserRole enum
User ──(ministryId)──► Ministry
User ──(refreshTokens)──► RefreshToken

LegislativeItem ──(ministryId)──► Ministry
LegislativeItem ──(createdById)──► User
LegislativeItem ──(documents)──► Document[]
LegislativeItem ──(versions)──► Version[]
LegislativeItem ──(amendments)──► Amendment[]
LegislativeItem ──(legalStructure)──► LegalStructure[]
LegislativeItem ──(consultations)──► Consultation[]
LegislativeItem ──(workflowHistory)──► WorkflowHistory[]
LegislativeItem ──(aiAnalyses)──► AiAnalysis[]
LegislativeItem ──(regulatoryRefs)──► RegulatoryReference[]
LegislativeItem ──(traceLinks)──► TraceLink[]

Consultation ──(feedback)──► ConsultationFeedback[]
ConsultationFeedback ──(reviews)──► ConsultationFeedbackReview[]

Committee ──(members)──► CommitteeMember[]
Committee ──(reviews)──► CommitteeReview[]

ChatSession ──(messages)──► ChatMessage[]

User ──(notifications)──► Notification[]
User ──(auditLogs)──► AuditLog[]
```

## Security Architecture

```
Request
  │
  ▼
ThrottlerGuard (10/s, 50/10s, 200/60s)
  │
  ▼
Helmet (CSP, HSTS, noSniff, referrerPolicy)
  │
  ▼
CORS check (FRONTEND_URL allowlist)
  │
  ▼
JwtAuthGuard ──(@Public?)──► allow
  │ (JWT valid)
  ▼
ValidationPipe (whitelist, forbidNonWhitelisted, transform)
  │
  ▼
RolesGuard (@Roles check)
  │
  ▼
PermissionGuard (@RequirePermission check)
  │
  ▼
Controller → Service → PrismaService → PostgreSQL
  │
  ▼
AuditLogInterceptor (sensitive write logging)
SensitiveReadAuditInterceptor (download/export logging)
  │
  ▼
GlobalHttpExceptionFilter (structured error response)
```
