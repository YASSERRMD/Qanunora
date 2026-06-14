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

const SENSITIVE_ROUTES: { method: string; pathPattern: RegExp; action: string }[] = [
  { method: 'DELETE', pathPattern: /\/legislative-items\//, action: 'DELETE' },
  { method: 'POST', pathPattern: /\/auth\/login/, action: 'LOGIN' },
  { method: 'POST', pathPattern: /\/auth\/logout/, action: 'LOGOUT' },
  { method: 'PATCH', pathPattern: /\/users\/.*\/role/, action: 'UPDATE' },
  { method: 'POST', pathPattern: /\/.*\/publish/, action: 'PUBLISH' },
  { method: 'GET', pathPattern: /\/reports\//, action: 'EXPORT' },
];

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { user?: { id: string } }>();
    const match = SENSITIVE_ROUTES.find(
      (r) => r.method === request.method && r.pathPattern.test(request.url),
    );

    return next.handle().pipe(
      tap(async () => {
        if (!match || !request.user?.id) return;
        try {
          await this.prisma.auditLog.create({
            data: {
              userId: request.user.id,
              action: match.action as import('@prisma/client').AuditAction,
              entityType: 'API',
              ipAddress: request.ip ?? request.socket.remoteAddress,
              userAgent: request.headers['user-agent'],
              metadata: { method: request.method, path: request.url },
            },
          });
        } catch (err) {
          this.logger.warn('Failed to write audit log', err);
        }
      }),
    );
  }
}
