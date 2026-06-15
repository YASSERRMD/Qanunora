export class CreateRetentionRuleDto {
  name: string;
  entityType: string;
  condition: Record<string, unknown>;
  action: 'ARCHIVE' | 'DELETE' | 'EXPORT_AND_DELETE';
  retentionYears?: number;
}

export class UpdateRetentionRuleDto {
  name?: string;
  condition?: Record<string, unknown>;
  action?: 'ARCHIVE' | 'DELETE' | 'EXPORT_AND_DELETE';
  retentionYears?: number;
  isActive?: boolean;
}

export class CreateLegalHoldDto {
  entityType: string;
  entityId: string;
  reason: string;
  expiresAt?: string;
}

export class ArchiveItemDto {
  entityType: string;
  entityId: string;
  archiveReason: string;
}
