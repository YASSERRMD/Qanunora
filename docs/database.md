# Database Guide — Qanunora

## Overview

Qanunora uses PostgreSQL 16 with Prisma ORM 5. The schema is defined in `apps/backend/prisma/schema.prisma`.

## Running Migrations

```bash
cd apps/backend

# Development (creates migration files)
npx prisma migrate dev --name describe_change

# Production (applies existing migrations)
npx prisma migrate deploy

# Reset database (development only — DESTRUCTIVE)
npx prisma migrate reset

# Check migration status
npx prisma migrate status
```

## Seeding

```bash
cd apps/backend
npx prisma db seed
```

Seeds:
- 3 ministries (Justice, Finance, Health)
- 8 users (one per main role) with password `Admin@123456`
- 4 committees
- 3 stakeholders
- 6 system settings

## Prisma Studio (Visual Browser)

```bash
cd apps/backend
npx prisma studio
# Opens at http://localhost:5555
```

## Key Models

### User
- `id` UUID primary key
- `email` unique
- `passwordHash` bcrypt hash
- `role` UserRole enum (10 values)
- `ministryId` → Ministry

### LegislativeItem
- `referenceNumber` unique, format `LI-YYYY-NNNN`
- `type` LegislativeItemType enum
- `status` LegislativeStatus enum
- `confidentialityLevel` ConfidentialityLevel enum
- `priority` Priority enum

### AiAnalysis
- `analysisType` string: SUMMARIZATION, IMPACT_SOCIAL, IMPACT_ECONOMIC, REGULATORY_MAPPING, JURISDICTION_COMPARISON, CHANGE_DETECTION, RISK_CHANGE_DETECTION, SENTIMENT_ANALYSIS, TOPIC_CLUSTERING
- `result` JSON — type-specific structured data
- `disclaimer` always set to "AI-assisted analysis, not legal advice"

## Performance Indexes

Key indexes on frequently queried fields:
- `users`: email (unique), role
- `legislative_items`: status, type, ministryId, createdById
- `documents`: legislativeItemId, uploadedById
- `workflow_history`: legislativeItemId
- `ai_analyses`: legislativeItemId, analysisType
- `audit_logs`: userId, entityType+entityId, createdAt
- `notifications`: userId+isRead

## PostgreSQL Extensions

Initialized in `infra/postgres/init.sql`:
- `uuid-ossp` — for UUID generation
- `pg_trgm` — for trigram-based text search (used in keyword search)
- `unaccent` — for accent-insensitive text search

## Backup and Restore

```bash
# Backup
pg_dump -U qanunora -h localhost qanunora > backup.sql

# Restore
psql -U qanunora -h localhost qanunora < backup.sql
```
