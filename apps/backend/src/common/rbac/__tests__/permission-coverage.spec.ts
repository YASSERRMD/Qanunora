import { UserRole } from '@prisma/client';
import { PERMISSION_MATRIX, hasPermission } from '../role-hierarchy';

const ALL_ROLES = Object.values(UserRole);
const ALL_PERMISSIONS = Object.keys(PERMISSION_MATRIX) as Array<keyof typeof PERMISSION_MATRIX>;

describe('Permission Matrix Coverage', () => {
  it('every permission has at least one allowed role', () => {
    ALL_PERMISSIONS.forEach((permission) => {
      const allowed = PERMISSION_MATRIX[permission] as readonly UserRole[];
      expect(allowed.length).toBeGreaterThan(0);
    });
  });

  it('SUPER_ADMIN has access to every permission', () => {
    ALL_PERMISSIONS.forEach((permission) => {
      expect(hasPermission(UserRole.SUPER_ADMIN, permission)).toBe(true);
    });
  });

  it('VIEWER has access only to read permissions', () => {
    const readPermissions = ALL_PERMISSIONS.filter((p) => p.includes(':read'));
    const writePermissions = ALL_PERMISSIONS.filter((p) => !p.includes(':read'));

    readPermissions.forEach((p) => {
      expect(hasPermission(UserRole.VIEWER, p)).toBe(true);
    });

    writePermissions.forEach((p) => {
      expect(hasPermission(UserRole.VIEWER, p)).toBe(false);
    });
  });

  it('no undefined roles appear in permission matrix', () => {
    ALL_PERMISSIONS.forEach((permission) => {
      const allowed = PERMISSION_MATRIX[permission] as readonly UserRole[];
      allowed.forEach((role) => {
        expect(ALL_ROLES).toContain(role);
      });
    });
  });

  it('sensitive permissions are restricted to appropriate roles', () => {
    const sensitivePerms = ['user:manage', 'settings:manage', 'legislative:delete'] as const;
    const unauthorizedRoles = [
      UserRole.VIEWER,
      UserRole.AUDITOR,
      UserRole.DRAFTING_OFFICER,
      UserRole.REVIEWER,
      UserRole.COMMITTEE_MEMBER,
    ];

    sensitivePerms.forEach((perm) => {
      unauthorizedRoles.forEach((role) => {
        expect(hasPermission(role, perm)).toBe(false);
      });
    });
  });

  it('ai:use is restricted to roles with legitimate analytical needs', () => {
    const noAiRoles = [UserRole.VIEWER, UserRole.AUDITOR];
    noAiRoles.forEach((role) => {
      expect(hasPermission(role, 'ai:use')).toBe(false);
    });
  });
});
