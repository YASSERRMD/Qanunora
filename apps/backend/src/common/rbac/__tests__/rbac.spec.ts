import { UserRole } from '@prisma/client';
import { hasPermission, hasMinimumRole, PERMISSION_MATRIX } from '../role-hierarchy';

describe('RBAC Role Hierarchy', () => {
  describe('hasMinimumRole', () => {
    it('SUPER_ADMIN has minimum role of VIEWER', () => {
      expect(hasMinimumRole(UserRole.SUPER_ADMIN, UserRole.VIEWER)).toBe(true);
    });

    it('VIEWER does not have minimum role of SUPER_ADMIN', () => {
      expect(hasMinimumRole(UserRole.VIEWER, UserRole.SUPER_ADMIN)).toBe(false);
    });

    it('LEGISLATIVE_ADMIN does not have minimum role of SUPER_ADMIN', () => {
      expect(hasMinimumRole(UserRole.LEGISLATIVE_ADMIN, UserRole.SUPER_ADMIN)).toBe(false);
    });
  });

  describe('hasPermission', () => {
    it('SUPER_ADMIN has all permissions', () => {
      const permissions = Object.keys(PERMISSION_MATRIX) as Array<keyof typeof PERMISSION_MATRIX>;
      permissions.forEach((p) => {
        expect(hasPermission(UserRole.SUPER_ADMIN, p)).toBe(true);
      });
    });

    it('VIEWER can only read legislative items', () => {
      expect(hasPermission(UserRole.VIEWER, 'legislative:read')).toBe(true);
      expect(hasPermission(UserRole.VIEWER, 'legislative:create')).toBe(false);
      expect(hasPermission(UserRole.VIEWER, 'user:manage')).toBe(false);
    });

    it('DRAFTING_OFFICER can create but not delete legislative items', () => {
      expect(hasPermission(UserRole.DRAFTING_OFFICER, 'legislative:create')).toBe(true);
      expect(hasPermission(UserRole.DRAFTING_OFFICER, 'legislative:delete')).toBe(false);
    });

    it('AUDITOR can read audit logs', () => {
      expect(hasPermission(UserRole.AUDITOR, 'audit:read')).toBe(true);
    });
  });
});
