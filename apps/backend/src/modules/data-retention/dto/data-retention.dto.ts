export class CreateRetentionRuleDto {
  name: string;
  entityType: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  condition: any;
  action: 'ARCHIVE' | 'DELETE' | 'EXPORT_AND_DELETE';
  retentionYears?: number;
}

export class UpdateRetentionRuleDto {
  name?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  condition?: any;
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
