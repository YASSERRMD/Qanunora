# Qanunora Backup and Restore Guide

## Recovery Objectives

| Metric | Target |
|--------|--------|
| Recovery Time Objective (RTO) | 4 hours |
| Recovery Point Objective (RPO) | 1 hour |
| Backup Frequency | Daily full, hourly incremental |
| Backup Retention | 30 days |

## PostgreSQL Backup

### Manual Backup with pg_dump

```bash
# Full database dump (compressed)
pg_dump \
  --dbname="$DATABASE_URL" \
  --format=custom \
  --compress=9 \
  --verbose \
  --file="qanunora-$(date +%Y%m%d-%H%M%S).pgdump"

# SQL format (human-readable)
pg_dump \
  --dbname="$DATABASE_URL" \
  --format=plain \
  --file="qanunora-$(date +%Y%m%d).sql"
```

### Kubernetes CronJob for Automated Backups

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: qanunora
spec:
  schedule: "0 * * * *"   # Hourly
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: backup
              image: postgres:15-alpine
              command:
                - /bin/sh
                - -c
                - |
                  pg_dump "$DATABASE_URL" --format=custom --compress=9 \
                    --file="/backup/qanunora-$(date +%Y%m%d-%H%M%S).pgdump"
                  # Upload to S3
                  aws s3 cp /backup/qanunora-*.pgdump \
                    s3://qanunora-backups/postgres/
              envFrom:
                - secretRef:
                    name: qanunora-secrets
              volumeMounts:
                - name: backup
                  mountPath: /backup
          volumes:
            - name: backup
              emptyDir: {}
          restartPolicy: OnFailure
```

### Restore from Backup

```bash
# Restore from custom format dump
pg_restore \
  --dbname="$DATABASE_URL" \
  --verbose \
  --clean \
  --if-exists \
  qanunora-20250101-120000.pgdump

# Restore from SQL dump
psql "$DATABASE_URL" < qanunora-20250101.sql

# Point-in-time recovery (requires WAL archiving configured)
# Set recovery target in postgresql.conf:
#   recovery_target_time = '2025-01-01 12:00:00'
```

## Redis Backup

### BGSAVE (Background Save)

```bash
# Trigger background save
redis-cli -u "$REDIS_URL" BGSAVE

# Check save status
redis-cli -u "$REDIS_URL" LASTSAVE

# Copy RDB file
kubectl cp qanunora/redis-pod:/data/dump.rdb ./redis-backup-$(date +%Y%m%d).rdb
```

### Redis Persistence Configuration

```conf
# In redis.conf or command args:
save 60 1       # Save if at least 1 key changed in 60 seconds
save 300 10     # Save if at least 10 keys changed in 5 minutes
save 900 1      # Save if at least 1 key changed in 15 minutes
appendonly yes  # Enable AOF for better durability
appendfsync everysec
```

### Restore Redis

```bash
# Stop Redis, copy RDB file, restart
kubectl exec -n qanunora redis-pod -- redis-cli SHUTDOWN NOSAVE
kubectl cp ./redis-backup-20250101.rdb qanunora/redis-pod:/data/dump.rdb
kubectl rollout restart deployment/redis -n qanunora
```

## Application Files Backup

```bash
# Backup uploaded documents (if using local storage)
kubectl exec -n qanunora qanunora-backend-pod -- \
  tar czf /tmp/uploads-backup.tar.gz /app/uploads

kubectl cp qanunora/qanunora-backend-pod:/tmp/uploads-backup.tar.gz \
  ./uploads-backup-$(date +%Y%m%d).tar.gz

# Upload to S3
aws s3 sync ./uploads-backup-*.tar.gz s3://qanunora-backups/uploads/
```

## Disaster Recovery Procedure

1. **Assess the incident** — identify what data or services are affected
2. **Stop write operations** — prevent additional data loss (set maintenance mode)
3. **Identify recovery point** — find the most recent valid backup before the incident
4. **Restore database** — use pg_restore with the selected backup
5. **Restore Redis** — copy RDB file and restart Redis
6. **Verify data integrity** — run Prisma queries to check key tables
7. **Run Prisma migrations** — ensure schema is current: `npx prisma migrate deploy`
8. **Restart application** — `kubectl rollout restart deployment -n qanunora`
9. **Run smoke tests** — verify `/api/health` and `/api/readiness` endpoints
10. **Resume traffic** — remove maintenance mode and monitor metrics

## Backup Verification

```bash
# Test restore to staging environment
pg_restore \
  --dbname="$STAGING_DATABASE_URL" \
  --clean \
  --if-exists \
  qanunora-latest.pgdump

# Verify record counts
psql "$STAGING_DATABASE_URL" -c "
SELECT
  (SELECT COUNT(*) FROM legislative_items) as items,
  (SELECT COUNT(*) FROM users) as users,
  (SELECT COUNT(*) FROM gazette_entries) as gazette_entries;
"
```
