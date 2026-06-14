import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import { PrismaService } from '../../modules/database/prisma.service';

/**
 * Records audit events for sensitive read operations (document downloads, report exports).
 */
@Injectable()
export class SensitiveReadAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SensitiveReadAuditInterceptor.name);

  private readonly sensitiveReads = [
    { pattern: /\/documents\/.*\/download/, action: 'DOWNLOAD' as const },
    { pattern: /\/reports\//, action: 'EXPORT' as const },
    { pattern: /\/audit-report/, action: 'EXPORT' as const },
  ];

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { user?: { id: string } }>();

    if (req.method !== 'GET') return next.handle();

    const match = this.sensitiveReads.find((r) => r.pattern.test(req.url));

    return next.handle().pipe(
      tap(async () => {
        if (!match || !req.user?.id) return;
        try {
          await this.prisma.auditLog.create({
            data: {
              userId: req.user.id,
              action: match.action,
              entityType: 'API',
              ipAddress: req.ip ?? req.socket.remoteAddress,
              userAgent: req.headers['user-agent'],
              metadata: { path: req.url },
            },
          });
        } catch (err) {
          this.logger.warn('Failed to write sensitive read audit log', err);
        }
      }),
    );
  }
}
