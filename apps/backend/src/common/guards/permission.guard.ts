import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { PERMISSION_KEY } from '../decorators/permission.decorator';
import { Permission, hasPermission } from '../rbac/role-hierarchy';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permission = this.reflector.getAllAndOverride<Permission>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!permission) return true;

    const { user } = context.switchToHttp().getRequest<{ user: { role: UserRole } }>();
    if (!user) throw new ForbiddenException('Authentication required');

    if (!hasPermission(user.role, permission)) {
      throw new ForbiddenException(`Missing permission: ${permission}`);
    }

    return true;
  }
}
