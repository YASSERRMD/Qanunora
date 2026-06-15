export class RecordEventDto {
  eventType: string;
  actorId?: string;
  actorEmail?: string;
  entityType: string;
  entityId: string;
  action: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  ipAddress?: string;
  userAgent?: string;
}

export class QueryAuditEntriesDto {
  entityType?: string;
  entityId?: string;
  actorId?: string;
  eventType?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export class UpsertRetentionPolicyDto {
  retentionDays: number;
}
