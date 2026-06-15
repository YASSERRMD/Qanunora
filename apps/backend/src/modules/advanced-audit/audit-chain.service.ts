import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { RecordEventDto, QueryAuditEntriesDto, UpsertRetentionPolicyDto } from './dto/record-event.dto';

@Injectable()
export class AuditChainService {
  constructor(private readonly prisma: PrismaService) {}

  private computeHash(
    sequenceNumber: number,
    eventType: string,
    actorId: string | null | undefined,
    entityId: string,
    action: string,
    payload: unknown,
    previousHash: string | null | undefined,
  ): string {
    const data = [
      sequenceNumber.toString(),
      eventType,
      actorId ?? '',
      entityId,
      action,
      JSON.stringify(payload),
      previousHash ?? '',
    ].join('|');
    return createHash('sha256').update(data).digest('hex');
  }

  async recordEvent(dto: RecordEventDto) {
    const last = await this.prisma.immutableAuditEntry.findFirst({
      orderBy: { sequenceNumber: 'desc' },
      select: { sequenceNumber: true, entryHash: true },
    });

    const sequenceNumber = (last?.sequenceNumber ?? 0) + 1;
    const previousHash = last?.entryHash ?? null;

    const entryHash = this.computeHash(
      sequenceNumber,
      dto.eventType,
      dto.actorId,
      dto.entityId,
      dto.action,
      dto.payload,
      previousHash,
    );

    return this.prisma.immutableAuditEntry.create({
      data: {
        sequenceNumber,
        eventType: dto.eventType,
        actorId: dto.actorId,
        actorEmail: dto.actorEmail,
        entityType: dto.entityType,
        entityId: dto.entityId,
        action: dto.action,
        payload: dto.payload,
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
        previousHash,
        entryHash,
      },
    });
  }

  async getEntries(query: QueryAuditEntriesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.entityType) where['entityType'] = query.entityType;
    if (query.entityId) where['entityId'] = query.entityId;
    if (query.actorId) where['actorId'] = query.actorId;
    if (query.eventType) where['eventType'] = query.eventType;
    if (query.fromDate || query.toDate) {
      where['createdAt'] = {
        ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
        ...(query.toDate ? { lte: new Date(query.toDate) } : {}),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.immutableAuditEntry.findMany({
        where,
        orderBy: { sequenceNumber: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.immutableAuditEntry.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async verifyChainIntegrity(limit?: number) {
    const entries = await this.prisma.immutableAuditEntry.findMany({
      orderBy: { sequenceNumber: 'asc' },
      take: limit,
    });

    let firstBrokenAt: number | undefined;
    let previousHash: string | null = null;

    for (const entry of entries) {
      const expectedHash = this.computeHash(
        entry.sequenceNumber,
        entry.eventType,
        entry.actorId,
        entry.entityId,
        entry.action,
        entry.payload,
        previousHash,
      );

      if (expectedHash !== entry.entryHash) {
        firstBrokenAt = entry.sequenceNumber;
        return { valid: false, firstBrokenAt, checked: entries.length };
      }
      previousHash = entry.entryHash;
    }

    return { valid: true, checked: entries.length };
  }

  async exportEvidence(entityType: string, entityId: string, format: 'json' | 'csv' = 'json') {
    const entries = await this.prisma.immutableAuditEntry.findMany({
      where: { entityType, entityId },
      orderBy: { sequenceNumber: 'asc' },
    });

    if (format === 'csv') {
      const header = 'sequenceNumber,eventType,actorId,actorEmail,action,ipAddress,createdAt,entryHash';
      const rows = entries.map((e) =>
        [
          e.sequenceNumber,
          e.eventType,
          e.actorId ?? '',
          e.actorEmail ?? '',
          e.action,
          e.ipAddress ?? '',
          e.createdAt.toISOString(),
          e.entryHash,
        ].join(','),
      );
      return { format: 'csv', content: [header, ...rows].join('\n'), count: entries.length };
    }

    return { format: 'json', content: entries, count: entries.length };
  }

  async applyRetentionPolicy() {
    const policies = await this.prisma.auditRetentionPolicy.findMany({ where: { isActive: true } });

    for (const policy of policies) {
      const retainUntil = new Date();
      retainUntil.setDate(retainUntil.getDate() + policy.retentionDays);

      await this.prisma.immutableAuditEntry.updateMany({
        where: { entityType: policy.entityType, retainUntil: null },
        data: { retainUntil },
      });
    }

    return { applied: policies.length };
  }

  async getRetentionPolicies() {
    return this.prisma.auditRetentionPolicy.findMany({ orderBy: { entityType: 'asc' } });
  }

  async upsertRetentionPolicy(entityType: string, dto: UpsertRetentionPolicyDto) {
    return this.prisma.auditRetentionPolicy.upsert({
      where: { entityType },
      update: { retentionDays: dto.retentionDays },
      create: { entityType, retentionDays: dto.retentionDays },
    });
  }

  async recordSensitiveAction(
    actorId: string,
    actorEmail: string,
    entityType: string,
    entityId: string,
    action: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: any,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.recordEvent({
      eventType: 'SENSITIVE_ACTION',
      actorId,
      actorEmail,
      entityType,
      entityId,
      action,
      payload,
      ipAddress,
      userAgent,
    });
  }
}
