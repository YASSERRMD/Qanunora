export type ClassificationLevel = 'UNCLASSIFIED' | 'RESTRICTED' | 'CONFIDENTIAL' | 'SECRET' | 'TOP_SECRET';

export class ClassifyDto {
  level: ClassificationLevel;
  sensitiveFlags?: string[];
  justification?: string;
  reviewDueDate?: string;
}

export class DeclassifyDto {
  justification: string;
}

export class GrantAccessExceptionDto {
  legislativeItemId: string;
  userId: string;
  reason: string;
  expiresAt: string;
}
