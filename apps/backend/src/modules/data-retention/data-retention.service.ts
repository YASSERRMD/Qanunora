import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  CreateRetentionRuleDto,
  UpdateRetentionRuleDto,
  CreateLegalHoldDto,
  ArchiveItemDto,
} from './dto/data-retention.dto';

@Injectable()
export class DataRetentionService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Retention Rules ───────────────────────────────────────────────────────

  async createRule(dto: CreateRetentionRuleDto, userId: string) {
    return this.prisma.retentionRule.create({
      data: {
        name: dto.name,
        entityType: dto.entityType,
        condition: dto.condition,
        action: dto.action,
        retentionYears: dto.retentionYears ?? 7,
        createdById: userId,
      },
    });
  }

  async getRules() {
    return this.prisma.retentionRule.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async updateRule(id: string, dto: UpdateRetentionRuleDto) {
    return this.prisma.retentionRule.update({ where: { id }, data: dto });
  }

  async activateRule(id: string) {
    return this.prisma.retentionRule.update({ where: { id }, data: { isActive: true } });
  }

  async deactivateRule(id: string) {
    return this.prisma.retentionRule.update({ where: { id }, data: { isActive: false } });
  }

  async runRule(ruleId: string) {
    const rule = await this.prisma.retentionRule.findUnique({ where: { id: ruleId } });
    if (!rule) throw new NotFoundException('Retention rule not found');

    const condition = rule.condition as Record<string, unknown>;
    const cutoffDays = typeof condition['olderThanDays'] === 'number' ? condition['olderThanDays'] : null;
    const statusCondition = condition['status'] as string | undefined;

    // Find legislative items matching the condition
    const where: Record<string, unknown> = { entityType: rule.entityType };
    if (statusCondition) where['status'] = statusCondition;
    if (cutoffDays !== null) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - cutoffDays);
      where['createdAt'] = { lte: cutoff };
    }

    // Check for active legal holds before proceeding
    const holds = await this.prisma.legalHold.findMany({
      where: { entityType: rule.entityType, isActive: true },
      select: { entityId: true },
    });
    const heldEntityIds = new Set(holds.map((h) => h.entityId));

    let processed = 0;
    let skipped = 0;

    if (rule.entityType === 'LegislativeItem') {
      const items = await this.prisma.legislativeItem.findMany({
        where: {
          ...(statusCondition ? { status: statusCondition as never } : {}),
          ...(cutoffDays !== null
            ? { createdAt: { lte: new Date(Date.now() - cutoffDays * 86400000) } }
            : {}),
        },
        select: { id: true, title: true, status: true, type: true, referenceNumber: true },
      });

      for (const item of items) {
        if (heldEntityIds.has(item.id)) {
          skipped++;
          continue;
        }

        if (rule.action === 'ARCHIVE' || rule.action === 'EXPORT_AND_DELETE') {
          const existing = await this.prisma.archivedItem.findUnique({ where: { entityId: item.id } });
          if (!existing) {
            await this.prisma.archivedItem.create({
              data: {
                entityType: rule.entityType,
                entityId: item.id,
                archivedData: item,
                archiveReason: `Retention rule: ${rule.name}`,
                archivedById: rule.createdById,
              },
            });
          }
        }

        if (rule.action === 'ARCHIVE') {
          await this.prisma.legislativeItem.update({
            where: { id: item.id },
            data: { status: 'ARCHIVED' },
          });
        }

        processed++;
      }
    }

    await this.prisma.retentionRule.update({
      where: { id: ruleId },
      data: { lastRunAt: new Date() },
    });

    return { processed, skipped, ruleId, action: rule.action };
  }

  // ── Legal Holds ───────────────────────────────────────────────────────────

  async createLegalHold(dto: CreateLegalHoldDto, userId: string) {
    const existing = await this.prisma.legalHold.findUnique({
      where: { entityType_entityId: { entityType: dto.entityType, entityId: dto.entityId } },
    });
    if (existing && existing.isActive) {
      throw new BadRequestException('An active legal hold already exists for this entity');
    }

    return this.prisma.legalHold.upsert({
      where: { entityType_entityId: { entityType: dto.entityType, entityId: dto.entityId } },
      create: {
        entityType: dto.entityType,
        entityId: dto.entityId,
        reason: dto.reason,
        heldById: userId,
        isActive: true,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
      update: {
        reason: dto.reason,
        heldById: userId,
        isActive: true,
        releasedById: null,
        releasedAt: null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
  }

  async releaseLegalHold(id: string, userId: string) {
    return this.prisma.legalHold.update({
      where: { id },
      data: { isActive: false, releasedById: userId, releasedAt: new Date() },
    });
  }

  async getLegalHolds(entityType?: string, entityId?: string) {
    return this.prisma.legalHold.findMany({
      where: {
        ...(entityType ? { entityType } : {}),
        ...(entityId ? { entityId } : {}),
      },
      include: { heldBy: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Archive / Restore ─────────────────────────────────────────────────────

  async archiveItem(dto: ArchiveItemDto, userId: string) {
    const hold = await this.prisma.legalHold.findUnique({
      where: { entityType_entityId: { entityType: dto.entityType, entityId: dto.entityId } },
    });
    if (hold?.isActive) {
      throw new BadRequestException('Cannot archive: item has an active legal hold');
    }

    return this.prisma.archivedItem.create({
      data: {
        entityType: dto.entityType,
        entityId: dto.entityId,
        archivedData: {},
        archiveReason: dto.archiveReason,
        archivedById: userId,
      },
    });
  }

  async restoreItem(id: string, userId: string) {
    const item = await this.prisma.archivedItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Archived item not found');

    if (item.entityType === 'LegislativeItem') {
      await this.prisma.legislativeItem.update({
        where: { id: item.entityId },
        data: { status: 'DRAFTING' },
      });
    }

    return this.prisma.archivedItem.update({
      where: { id },
      data: { restoredAt: new Date(), restoredById: userId },
    });
  }

  async getArchivedItems(entityType?: string) {
    return this.prisma.archivedItem.findMany({
      where: entityType ? { entityType } : {},
      include: { archivedBy: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { archivedAt: 'desc' },
    });
  }
}
