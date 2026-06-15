import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RedlineStatus, RedlineType, NotificationType, EditType } from '@prisma/client';
import { ProposeRedlineDto, ReviewRedlineDto } from './dto/redlining.dto';

@Injectable()
export class RedliningService {
  constructor(private readonly prisma: PrismaService) {}

  async proposeChange(
    legislativeItemId: string,
    dto: ProposeRedlineDto,
    userId: string,
  ) {
    await this.ensureItemExists(legislativeItemId);

    const change = await this.prisma.redlineChange.create({
      data: {
        legislativeItemId,
        proposedById: userId,
        originalText: dto.originalText,
        proposedText: dto.proposedText,
        changeType: dto.changeType ?? RedlineType.MODIFICATION,
        articleRef: dto.articleRef,
        rationale: dto.rationale,
        mentions: dto.mentions ?? [],
      },
      include: {
        proposedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Notify mentioned users
    if (dto.mentions && dto.mentions.length > 0) {
      await Promise.allSettled(
        dto.mentions.map((mentionedUserId) =>
          this.prisma.notification.create({
            data: {
              userId: mentionedUserId,
              type: NotificationType.COMMENT_ADDED,
              title: 'You were mentioned in a redline proposal',
              body: `You were mentioned in a redline change proposal for article: ${dto.articleRef ?? 'N/A'}`,
              entityType: 'redline_change',
              entityId: change.id,
              isRead: false,
            },
          }),
        ),
      );
    }

    return change;
  }

  async findAll(legislativeItemId: string, status?: RedlineStatus) {
    await this.ensureItemExists(legislativeItemId);
    const where: Record<string, unknown> = { legislativeItemId };
    if (status) where['status'] = status;

    return this.prisma.redlineChange.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        proposedBy: { select: { id: true, firstName: true, lastName: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async findById(id: string) {
    const change = await this.prisma.redlineChange.findUnique({
      where: { id },
      include: {
        proposedBy: { select: { id: true, firstName: true, lastName: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!change) throw new NotFoundException(`RedlineChange ${id} not found`);
    return change;
  }

  async acceptChange(id: string, reviewerId: string, dto: ReviewRedlineDto) {
    const change = await this.findById(id);
    if (change.status !== RedlineStatus.PENDING) {
      throw new BadRequestException(`Cannot accept a change with status ${change.status}`);
    }

    const updated = await this.prisma.redlineChange.update({
      where: { id },
      data: {
        status: RedlineStatus.ACCEPTED,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        reviewNote: dto.note,
      },
      include: {
        proposedBy: { select: { id: true, firstName: true, lastName: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Create a document edit snapshot with the proposed text applied
    await this.prisma.documentEdit.create({
      data: {
        legislativeItemId: change.legislativeItemId,
        editorId: reviewerId,
        contentSnapshot: change.proposedText,
        changeDescription: `Accepted redline change: ${change.articleRef ?? change.id}`,
        editType: EditType.CONTENT,
        wordCount: change.proposedText.trim().split(/\s+/).filter(Boolean).length,
        characterCount: change.proposedText.length,
      },
    });

    return updated;
  }

  async rejectChange(id: string, reviewerId: string, dto: ReviewRedlineDto) {
    const change = await this.findById(id);
    if (change.status !== RedlineStatus.PENDING) {
      throw new BadRequestException(`Cannot reject a change with status ${change.status}`);
    }

    return this.prisma.redlineChange.update({
      where: { id },
      data: {
        status: RedlineStatus.REJECTED,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        reviewNote: dto.note,
      },
      include: {
        proposedBy: { select: { id: true, firstName: true, lastName: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async withdrawChange(id: string, userId: string) {
    const change = await this.findById(id);
    if (change.proposedById !== userId) {
      throw new ForbiddenException('Only the proposer can withdraw a change');
    }
    if (change.status !== RedlineStatus.PENDING) {
      throw new BadRequestException(`Cannot withdraw a change with status ${change.status}`);
    }

    return this.prisma.redlineChange.update({
      where: { id },
      data: { status: RedlineStatus.WITHDRAWN },
      include: {
        proposedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async getRedlineStats(legislativeItemId: string) {
    await this.ensureItemExists(legislativeItemId);

    const changes = await this.prisma.redlineChange.findMany({
      where: { legislativeItemId },
      select: { status: true, changeType: true },
    });

    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};

    for (const c of changes) {
      byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
      byType[c.changeType] = (byType[c.changeType] ?? 0) + 1;
    }

    return {
      total: changes.length,
      byStatus,
      byType,
    };
  }

  async applyAllAccepted(legislativeItemId: string, userId: string) {
    await this.ensureItemExists(legislativeItemId);

    const accepted = await this.prisma.redlineChange.findMany({
      where: { legislativeItemId, status: RedlineStatus.ACCEPTED },
      orderBy: { createdAt: 'asc' },
    });

    if (accepted.length === 0) {
      return { applied: 0, message: 'No accepted changes to apply' };
    }

    // Build combined snapshot from all accepted proposed texts
    const combinedContent = accepted.map((c) => c.proposedText).join('\n\n');

    await this.prisma.documentEdit.create({
      data: {
        legislativeItemId,
        editorId: userId,
        contentSnapshot: combinedContent,
        changeDescription: `Bulk applied ${accepted.length} accepted redline changes`,
        editType: EditType.CONTENT,
        wordCount: combinedContent.trim().split(/\s+/).filter(Boolean).length,
        characterCount: combinedContent.length,
      },
    });

    return { applied: accepted.length, message: `Applied ${accepted.length} accepted changes` };
  }

  private async ensureItemExists(id: string) {
    const item = await this.prisma.legislativeItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`LegislativeItem ${id} not found`);
    return item;
  }
}
