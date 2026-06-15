import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

export interface TenantRequest extends Request {
  tenantId?: string;
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: TenantRequest, _res: Response, next: NextFunction): void {
    // Priority 1: explicit header
    const headerTenantId = req.headers['x-tenant-id'] as string | undefined;
    if (headerTenantId) {
      req.tenantId = headerTenantId;
      return next();
    }

    // Priority 2: subdomain resolution (e.g. ministry-of-justice.example.com)
    const host = req.hostname ?? '';
    const parts = host.split('.');
    if (parts.length > 2) {
      // first label is the tenant slug
      req.tenantId = parts[0];
    }

    next();
  }
}
