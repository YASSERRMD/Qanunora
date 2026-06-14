import { LegislativeStatus, WorkflowAction, UserRole } from '@prisma/client';

export interface TransitionRule {
  action: WorkflowAction;
  toStatus: LegislativeStatus;
  allowedRoles: UserRole[];
}

export const VALID_TRANSITIONS: Map<LegislativeStatus, TransitionRule[]> = new Map([
  [
    LegislativeStatus.DRAFTING,
    [
      {
        action: WorkflowAction.SUBMIT_FOR_REVIEW,
        toStatus: LegislativeStatus.INTERNAL_REVIEW,
        allowedRoles: [
          UserRole.SUPER_ADMIN,
          UserRole.LEGISLATIVE_ADMIN,
          UserRole.MINISTRY_LEGAL_OFFICER,
          UserRole.DRAFTING_OFFICER,
        ],
      },
    ],
  ],
  [
    LegislativeStatus.INTERNAL_REVIEW,
    [
      {
        action: WorkflowAction.SEND_TO_COMMITTEE,
        toStatus: LegislativeStatus.COMMITTEE_REVIEW,
        allowedRoles: [
          UserRole.SUPER_ADMIN,
          UserRole.LEGISLATIVE_ADMIN,
          UserRole.MINISTRY_LEGAL_OFFICER,
        ],
      },
      {
        action: WorkflowAction.RETURN_TO_DRAFT,
        toStatus: LegislativeStatus.DRAFTING,
        allowedRoles: [
          UserRole.SUPER_ADMIN,
          UserRole.LEGISLATIVE_ADMIN,
          UserRole.MINISTRY_LEGAL_OFFICER,
        ],
      },
      {
        action: WorkflowAction.REJECT,
        toStatus: LegislativeStatus.ARCHIVED,
        allowedRoles: [
          UserRole.SUPER_ADMIN,
          UserRole.LEGISLATIVE_ADMIN,
        ],
      },
    ],
  ],
  [
    LegislativeStatus.COMMITTEE_REVIEW,
    [
      {
        action: WorkflowAction.OPEN_CONSULTATION,
        toStatus: LegislativeStatus.PUBLIC_CONSULTATION,
        allowedRoles: [
          UserRole.SUPER_ADMIN,
          UserRole.LEGISLATIVE_ADMIN,
          UserRole.PUBLIC_CONSULTATION_OFFICER,
        ],
      },
      {
        action: WorkflowAction.SEND_TO_LEGAL,
        toStatus: LegislativeStatus.LEGAL_REVIEW,
        allowedRoles: [
          UserRole.SUPER_ADMIN,
          UserRole.LEGISLATIVE_ADMIN,
          UserRole.MINISTRY_LEGAL_OFFICER,
        ],
      },
      {
        action: WorkflowAction.RETURN_TO_DRAFT,
        toStatus: LegislativeStatus.DRAFTING,
        allowedRoles: [
          UserRole.SUPER_ADMIN,
          UserRole.LEGISLATIVE_ADMIN,
          UserRole.COMMITTEE_MEMBER,
        ],
      },
    ],
  ],
  [
    LegislativeStatus.PUBLIC_CONSULTATION,
    [
      {
        action: WorkflowAction.CLOSE_CONSULTATION,
        toStatus: LegislativeStatus.COMMITTEE_REVIEW,
        allowedRoles: [
          UserRole.SUPER_ADMIN,
          UserRole.LEGISLATIVE_ADMIN,
          UserRole.PUBLIC_CONSULTATION_OFFICER,
        ],
      },
    ],
  ],
  [
    LegislativeStatus.LEGAL_REVIEW,
    [
      {
        action: WorkflowAction.APPROVE,
        toStatus: LegislativeStatus.APPROVED,
        allowedRoles: [
          UserRole.SUPER_ADMIN,
          UserRole.LEGISLATIVE_ADMIN,
          UserRole.MINISTRY_LEGAL_OFFICER,
        ],
      },
      {
        action: WorkflowAction.REJECT,
        toStatus: LegislativeStatus.DRAFTING,
        allowedRoles: [
          UserRole.SUPER_ADMIN,
          UserRole.LEGISLATIVE_ADMIN,
          UserRole.MINISTRY_LEGAL_OFFICER,
        ],
      },
    ],
  ],
  [
    LegislativeStatus.APPROVED,
    [
      {
        action: WorkflowAction.PUBLISH,
        toStatus: LegislativeStatus.PUBLISHED,
        allowedRoles: [
          UserRole.SUPER_ADMIN,
          UserRole.LEGISLATIVE_ADMIN,
        ],
      },
      {
        action: WorkflowAction.RETURN_TO_DRAFT,
        toStatus: LegislativeStatus.DRAFTING,
        allowedRoles: [
          UserRole.SUPER_ADMIN,
          UserRole.LEGISLATIVE_ADMIN,
        ],
      },
    ],
  ],
  [
    LegislativeStatus.PUBLISHED,
    [
      {
        action: WorkflowAction.ARCHIVE,
        toStatus: LegislativeStatus.ARCHIVED,
        allowedRoles: [
          UserRole.SUPER_ADMIN,
          UserRole.LEGISLATIVE_ADMIN,
        ],
      },
    ],
  ],
]);

export function getAvailableTransitions(
  status: LegislativeStatus,
  userRole: UserRole,
): TransitionRule[] {
  const rules = VALID_TRANSITIONS.get(status) ?? [];
  return rules.filter((rule) => rule.allowedRoles.includes(userRole));
}

export function findTransition(
  status: LegislativeStatus,
  action: WorkflowAction,
): TransitionRule | undefined {
  const rules = VALID_TRANSITIONS.get(status) ?? [];
  return rules.find((rule) => rule.action === action);
}
