# Qanunora Observability Guide

## Health Check Endpoints

| Endpoint | Description | Auth Required |
|----------|-------------|---------------|
| `GET /api/health` | Basic liveness check | No |
| `GET /api/readiness` | Readiness check with dependency verification | No |

### Readiness Response

```json
{
  "ready": true,
  "checks": {
    "database": true,
    "redis": true
  },
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

## Structured Logging

Qanunora uses NestJS's built-in logger with structured JSON output in production.

### Log Levels

| Level | Usage |
|-------|-------|
| `error` | Application errors, unhandled exceptions |
| `warn` | Deprecated usage, rate limit warnings |
| `log` | Standard application events |
| `debug` | Detailed debugging (development only) |
| `verbose` | Very detailed tracing |

### Setting Log Level

```env
LOG_LEVEL=info  # error | warn | log | debug | verbose
```

### Sample Log Entry

```json
{
  "level": "log",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "context": "GazetteService",
  "message": "Publishing gazette entry OG-2025-1234",
  "requestId": "uuid",
  "userId": "uuid"
}
```

## Prometheus Metrics (Placeholders)

To enable Prometheus scraping, integrate `@nestjs/terminus` and `prom-client`:

```
GET /metrics   →  Prometheus text format
```

### Key Metrics to Track

- `http_request_duration_seconds` — API response time histogram
- `http_requests_total` — Request count by route and status
- `db_query_duration_seconds` — Database query latency
- `active_legislative_items` — Business KPI gauge
- `consultation_feedback_total` — Feedback volume counter
- `ai_analysis_duration_seconds` — AI processing time

## Alerting Examples

### PagerDuty / Alertmanager Rules

```yaml
groups:
  - name: qanunora
    rules:
      - alert: BackendDown
        expr: up{job="qanunora-backend"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Qanunora backend is down"

      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High HTTP error rate detected"

      - alert: DatabaseUnreachable
        expr: qanunora_readiness_database == 0
        for: 30s
        labels:
          severity: critical
        annotations:
          summary: "Database connectivity check failed"

      - alert: SlowQueries
        expr: db_query_duration_seconds{quantile="0.95"} > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Slow database queries detected (p95 > 2s)"
```

## Kubernetes Monitoring

```bash
# Check pod status
kubectl get pods -n qanunora

# View backend logs
kubectl logs -n qanunora -l app=qanunora-backend --tail=100 -f

# View HPA status
kubectl get hpa -n qanunora

# Describe readiness probe
kubectl describe pod -n qanunora -l app=qanunora-backend | grep -A 10 "Readiness"
```
