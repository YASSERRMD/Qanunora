# Security Documentation — Qanunora

## Security Controls

### Authentication & Authorization
- JWT access tokens (15-minute expiry) + refresh tokens (7-day expiry with rotation)
- All tokens signed with separate secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`)
- Refresh token rotation: each refresh invalidates the old token
- Global `JwtAuthGuard` — every route requires authentication unless marked `@Public()`
- Role-Based Access Control (RBAC) via `@Roles()` + `RolesGuard`
- Granular permission-based access via `@RequirePermission()` + `PermissionGuard`
- 10-role hierarchy with numeric weights for comparison

### Transport Security
- Helmet.js with Content Security Policy, HSTS (1 year, preload), X-Frame-Options DENY, X-Content-Type-Options nosniff
- CORS restricted to `FRONTEND_URL` environment variable only
- All API responses include `Referrer-Policy: strict-origin-when-cross-origin`

### Rate Limiting
Three-tier throttler applied globally:
- **Short**: 10 requests / 1 second
- **Medium**: 50 requests / 10 seconds
- **Long**: 200 requests / 60 seconds

Auth endpoints should be additionally rate-limited at the reverse-proxy level for production.

### Input Validation
- NestJS `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true` — strips unknown fields, rejects invalid input
- `SanitizePipe` — strips XSS patterns (`<script>`, `javascript:`, event handlers) from string fields
- Zod schema validation on the frontend before submission

### File Security
- Allowlist of safe MIME types and extensions (PDF, Office docs, images, plain text)
- Blocklist of dangerous extensions (`.exe`, `.bat`, `.sh`, `.js`, `.php`, etc.)
- 50 MB maximum file size
- Path traversal prevention via `path.basename()` normalization
- SHA-256 checksums stored for all uploaded documents
- Filenames sanitized to alphanumeric + `_-. ` only

### API Key Encryption
- Provider API keys stored encrypted using AES-256-GCM with random IV per encryption
- Encryption key derived from `ENCRYPTION_SECRET` environment variable via `scrypt`
- Keys masked in API responses (`sk-a****mnop` format)
- API keys never returned in plaintext from any endpoint

### Audit Logging
- Every login/logout recorded in `AuditLog`
- All DELETE, APPROVE, PUBLISH, role-change operations logged
- Document downloads and report exports logged via `SensitiveReadAuditInterceptor`
- Workflow transitions logged with from/to status and actor
- Audit logs are append-only (no update or delete endpoints exposed)

### Password Security
- Passwords hashed with bcrypt (salt rounds: 10)
- Minimum 8 characters enforced at both API and frontend validation layers
- Passwords never logged or returned in any API response

## Environment Variables to Protect

```
JWT_SECRET
JWT_REFRESH_SECRET
DATABASE_URL
REDIS_PASSWORD
ENCRYPTION_SECRET
OPENAI_API_KEY (and all AI provider keys)
POSTGRES_PASSWORD
```

Never commit these to version control. Use `.env.example` as the template.

## Production Recommendations

1. Run behind a reverse proxy (nginx/Caddy) with TLS termination
2. Add IP-based rate limiting at the proxy level for `/api/v1/auth/login`
3. Enable PostgreSQL SSL with `?sslmode=require` in `DATABASE_URL`
4. Set `NODE_ENV=production` to disable debug endpoints
5. Rotate JWT secrets regularly (requires logout of all users)
6. Enable Redis AUTH with a strong password
7. Use S3 + signed URLs with short expiry for document downloads
8. Enable CloudFront/CDN signed cookies for frontend static assets
9. Run `npm audit` regularly and pin dependency versions in CI
10. Set `ENCRYPTION_SECRET` to a 32+ character random value
