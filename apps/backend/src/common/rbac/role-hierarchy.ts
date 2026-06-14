import { UserRole } from '@prisma/client';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.SUPER_ADMIN]: 100,
  [UserRole.LEGISLATIVE_ADMIN]: 90,
  [UserRole.MINISTRY_LEGAL_OFFICER]: 70,
  [UserRole.DRAFTING_OFFICER]: 60,
  [UserRole.REVIEWER]: 50,
  [UserRole.COMMITTEE_MEMBER]: 50,
  [UserRole.STAKEHOLDER_MANAGER]: 45,
  [UserRole.PUBLIC_CONSULTATION_OFFICER]: 45,
  [UserRole.AUDITOR]: 30,
  [UserRole.VIEWER]: 10,
};

export function hasMinimumRole(userRole: UserRole, minimumRole: UserRole): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[minimumRole] ?? 0);
}

export const PERMISSION_MATRIX = {
  'legislative:create': [
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.DRAFTING_OFFICER,
  ],
  'legislative:update': [
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.DRAFTING_OFFICER,
  ],
  'legislative:delete': [UserRole.SUPER_ADMIN, UserRole.LEGISLATIVE_ADMIN],
  'legislative:approve': [UserRole.SUPER_ADMIN, UserRole.LEGISLATIVE_ADMIN, UserRole.MINISTRY_LEGAL_OFFICER],
  'legislative:publish': [UserRole.SUPER_ADMIN, UserRole.LEGISLATIVE_ADMIN],
  'legislative:read': Object.values(UserRole),
  'document:upload': [
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.DRAFTING_OFFICER,
    UserRole.REVIEWER,
  ],
  'document:delete': [UserRole.SUPER_ADMIN, UserRole.LEGISLATIVE_ADMIN],
  'committee:manage': [UserRole.SUPER_ADMIN, UserRole.LEGISLATIVE_ADMIN],
  'consultation:manage': [
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.PUBLIC_CONSULTATION_OFFICER,
  ],
  'stakeholder:manage': [
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.STAKEHOLDER_MANAGER,
  ],
  'user:manage': [UserRole.SUPER_ADMIN],
  'audit:read': [UserRole.SUPER_ADMIN, UserRole.AUDITOR],
  'settings:manage': [UserRole.SUPER_ADMIN],
  'ai:use': [
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.DRAFTING_OFFICER,
    UserRole.REVIEWER,
  ],
} as const;

export type Permission = keyof typeof PERMISSION_MATRIX;

export function hasPermission(userRole: UserRole, permission: Permission): boolean {
  const allowed = PERMISSION_MATRIX[permission] as readonly UserRole[];
  return allowed.includes(userRole);
}
