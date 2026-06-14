# Deployment Guide — Qanunora

## Local Development

See [README.md](../README.md#quick-start) for the quick start.

## Docker Production Deployment

### Build images

```bash
# Build backend
docker build -f apps/backend/Dockerfile -t qanunora-backend:latest .

# Build frontend
docker build -f apps/frontend/Dockerfile -t qanunora-frontend:latest .
```

### Production Docker Compose

Create a `docker-compose.prod.yml`:

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks: [qanunora]

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks: [qanunora]

  backend:
    image: qanunora-backend:latest
    restart: always
    depends_on: [postgres, redis]
    env_file: ./apps/backend/.env.production
    ports: ["3001:3001"]
    volumes:
      - uploads:/app/uploads
    networks: [qanunora]

  frontend:
    image: qanunora-frontend:latest
    restart: always
    depends_on: [backend]
    env_file: ./apps/frontend/.env.production
    ports: ["3000:3000"]
    networks: [qanunora]

volumes:
  postgres_data:
  redis_data:
  uploads:

networks:
  qanunora:
    driver: bridge
```

```bash
docker compose -f docker-compose.prod.yml up -d
```

## Nginx Reverse Proxy

```nginx
server {
    listen 443 ssl http2;
    server_name qanunora.yourdomain.gov;

    ssl_certificate /etc/ssl/certs/qanunora.crt;
    ssl_certificate_key /etc/ssl/private/qanunora.key;

    # API + WebSocket
    location /api/ {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # Auth endpoint rate limiting
        limit_req zone=auth burst=5 nodelay;
    }

    # Frontend
    location / {
        proxy_pass http://frontend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

server {
    listen 80;
    server_name qanunora.yourdomain.gov;
    return 301 https://$host$request_uri;
}
```

## Environment Variables — Production

### Backend (`.env.production`)

```bash
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://qanunora.yourdomain.gov

DATABASE_URL=postgresql://user:password@postgres:5432/qanunora?sslmode=prefer
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=<strong-random-password>

JWT_SECRET=<64-char-random-hex>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<64-char-random-hex-different>
JWT_REFRESH_EXPIRES_IN=7d

ENCRYPTION_SECRET=<32-char-random-string>

STORAGE_PROVIDER=s3
S3_BUCKET=qanunora-documents
S3_REGION=me-south-1
S3_ACCESS_KEY_ID=<aws-key>
S3_SECRET_ACCESS_KEY=<aws-secret>

AI_DEFAULT_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

### Frontend (`.env.production`)

```bash
NEXT_PUBLIC_API_URL=https://qanunora.yourdomain.gov/api/v1
NEXT_PUBLIC_APP_URL=https://qanunora.yourdomain.gov
```

## Database Migrations in Production

```bash
# Always run migrations before deploying new backend version
docker exec qanunora-backend npx prisma migrate deploy

# Verify migration status
docker exec qanunora-backend npx prisma migrate status
```

## Health Checks

```bash
# Backend health
curl https://qanunora.yourdomain.gov/api/health

# Expected response
{"status":"ok","service":"qanunora-backend","timestamp":"..."}
```

## Backup Strategy

```bash
# Database backup
docker exec qanunora-postgres pg_dump -U qanunora qanunora | gzip > backup-$(date +%Y%m%d).sql.gz

# Uploads backup (if using local storage)
tar czf uploads-$(date +%Y%m%d).tar.gz uploads/
```

## Scaling

For high availability:
1. Run multiple backend instances behind a load balancer
2. Use a shared Redis cluster (Redis Sentinel or Cluster mode)
3. Use S3 for document storage (not local filesystem)
4. Enable read replicas on PostgreSQL for reporting queries
5. Deploy BullMQ workers as separate services
