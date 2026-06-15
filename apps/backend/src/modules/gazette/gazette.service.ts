import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdateGazetteDto, RetractGazetteDto } from './dto/gazette.dto';

const CHECKLIST_ITEMS = [
  'Final text confirmed',
  'Legal review complete',
  'Arabic translation verified',
  'Minister signature obtained',
  'Gazette number assigned',
  'Effective date determined',
  'Stakeholder notification sent',
  'Press office notified',
];

function generateGazetteNumber(): string {
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `OG-${year}-${seq}`;
}

@Injectable()
export class GazetteService {
  constructor(private readonly prisma: PrismaService) {}

  async createEntry(legislativeItemId: string, userId: string) {
    const item = await this.prisma.legislativeItem.findUnique({
      where: { id: legislativeItemId },
    });
    if (!item) throw new NotFoundException('Legislative item not found');
    if (item.status !== 'PUBLISHED') {
      throw new BadRequestException('Legislative item must be PUBLISHED before creating a gazette entry');
    }

    const existing = await this.prisma.gazetteEntry.findUnique({
      where: { legislativeItemId },
    });
    if (existing) throw new BadRequestException('Gazette entry already exists for this legislative item');

    let gazetteNumber = generateGazetteNumber();
    // Ensure uniqueness
    let attempts = 0;
    while (attempts < 10) {
      const conflict = await this.prisma.gazetteEntry.findUnique({ where: { gazetteNumber } });
      if (!conflict) break;
      gazetteNumber = generateGazetteNumber();
      attempts++;
    }

    return this.prisma.gazetteEntry.create({
      data: {
        gazetteNumber,
        legislativeItemId,
        title: item.title,
        titleAr: item.titleAr,
        createdById: userId,
        checklist: {
          create: CHECKLIST_ITEMS.map((item, index) => ({
            item,
            order: index + 1,
          })),
        },
      },
      include: { checklist: true, legislativeItem: { select: { title: true, referenceNumber: true } } },
    });
  }

  async getEntry(id: string) {
    const entry = await this.prisma.gazetteEntry.findUnique({
      where: { id },
      include: {
        checklist: { orderBy: { order: 'asc' } },
        legislativeItem: { select: { title: true, referenceNumber: true, type: true, status: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!entry) throw new NotFoundException('Gazette entry not found');
    return entry;
  }

  async getEntryByItemId(legislativeItemId: string) {
    const entry = await this.prisma.gazetteEntry.findUnique({
      where: { legislativeItemId },
      include: {
        checklist: { orderBy: { order: 'asc' } },
        legislativeItem: { select: { title: true, referenceNumber: true } },
      },
    });
    if (!entry) throw new NotFoundException('Gazette entry not found for this legislative item');
    return entry;
  }

  async listEntries(status?: string) {
    const where = status ? { publicationStatus: status as never } : {};
    return this.prisma.gazetteEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        legislativeItem: { select: { title: true, referenceNumber: true, type: true } },
        createdBy: { select: { firstName: true, lastName: true } },
        _count: { select: { checklist: true } },
      },
    });
  }

  async updateEntry(id: string, dto: UpdateGazetteDto) {
    await this.getEntry(id);
    return this.prisma.gazetteEntry.update({
      where: { id },
      data: {
        titleAr: dto.titleAr,
        effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : undefined,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
        archiveUrl: dto.archiveUrl,
      },
    });
  }

  async completeChecklistItem(gazetteId: string, checklistItemId: string) {
    const entry = await this.getEntry(gazetteId);
    const checklistItem = entry.checklist.find((c) => c.id === checklistItemId);
    if (!checklistItem) throw new NotFoundException('Checklist item not found');
    return this.prisma.gazetteChecklist.update({
      where: { id: checklistItemId },
      data: { isCompleted: true, completedAt: new Date() },
    });
  }

  async uncompleteChecklistItem(gazetteId: string, checklistItemId: string) {
    const entry = await this.getEntry(gazetteId);
    const checklistItem = entry.checklist.find((c) => c.id === checklistItemId);
    if (!checklistItem) throw new NotFoundException('Checklist item not found');
    return this.prisma.gazetteChecklist.update({
      where: { id: checklistItemId },
      data: { isCompleted: false, completedAt: null },
    });
  }

  async submitForApproval(gazetteId: string, _userId: string) {
    const entry = await this.getEntry(gazetteId);
    const incomplete = entry.checklist.filter((c) => !c.isCompleted);
    if (incomplete.length > 0) {
      throw new BadRequestException(
        `Cannot submit for approval: ${incomplete.length} checklist item(s) incomplete`,
      );
    }
    if (entry.publicationStatus !== 'PREPARING' && entry.publicationStatus !== 'READINESS_CHECK') {
      throw new BadRequestException(`Cannot submit from status: ${entry.publicationStatus}`);
    }
    return this.prisma.gazetteEntry.update({
      where: { id: gazetteId },
      data: { publicationStatus: 'PENDING_APPROVAL' },
    });
  }

  async approve(gazetteId: string, approverId: string) {
    const entry = await this.getEntry(gazetteId);
    if (entry.publicationStatus !== 'PENDING_APPROVAL') {
      throw new BadRequestException(`Cannot approve from status: ${entry.publicationStatus}`);
    }
    return this.prisma.gazetteEntry.update({
      where: { id: gazetteId },
      data: {
        publicationStatus: 'APPROVED',
        approvedById: approverId,
        approvedAt: new Date(),
      },
    });
  }

  async publish(gazetteId: string, _userId: string) {
    const entry = await this.getEntry(gazetteId);
    if (entry.publicationStatus !== 'APPROVED') {
      throw new BadRequestException(`Cannot publish from status: ${entry.publicationStatus}`);
    }
    const now = new Date();
    return this.prisma.gazetteEntry.update({
      where: { id: gazetteId },
      data: {
        publicationStatus: 'PUBLISHED',
        publishedAt: now,
        issueDate: entry.issueDate ?? now,
      },
    });
  }

  async retract(gazetteId: string, _userId: string, dto: RetractGazetteDto) {
    const entry = await this.getEntry(gazetteId);
    if (entry.publicationStatus !== 'PUBLISHED') {
      throw new BadRequestException('Only PUBLISHED entries can be retracted');
    }
    const currentMeta = (entry.metadata ?? {}) as Record<string, unknown>;
    return this.prisma.gazetteEntry.update({
      where: { id: gazetteId },
      data: {
        publicationStatus: 'RETRACTED',
        metadata: {
          ...currentMeta,
          retractedAt: new Date().toISOString(),
          retractReason: dto.reason,
        },
      },
    });
  }

  async buildPublicationPackage(gazetteId: string) {
    const entry = await this.getEntry(gazetteId);
    const checklistCompletion = {
      total: entry.checklist.length,
      completed: entry.checklist.filter((c) => c.isCompleted).length,
      pending: entry.checklist.filter((c) => !c.isCompleted).map((c) => c.item),
    };
    return {
      gazetteNumber: entry.gazetteNumber,
      issueDate: entry.issueDate,
      title: entry.title,
      titleAr: entry.titleAr,
      effectiveDate: entry.effectiveDate,
      legislativeItemRef: entry.legislativeItem.referenceNumber,
      publicationStatus: entry.publicationStatus,
      approvedAt: entry.approvedAt,
      publishedAt: entry.publishedAt,
      archiveUrl: entry.archiveUrl,
      checklistCompletion,
      isReadyToPublish:
        checklistCompletion.pending.length === 0 &&
        entry.publicationStatus === 'APPROVED',
    };
  }

  async getPublishedArchive(year?: number, query?: string) {
    const where: Record<string, unknown> = { publicationStatus: 'PUBLISHED' };
    if (year) {
      where['publishedAt'] = {
        gte: new Date(`${year}-01-01T00:00:00Z`),
        lt: new Date(`${year + 1}-01-01T00:00:00Z`),
      };
    }
    if (query) {
      where['OR'] = [
        { title: { contains: query, mode: 'insensitive' } },
        { gazetteNumber: { contains: query, mode: 'insensitive' } },
      ];
    }
    return this.prisma.gazetteEntry.findMany({
      where: where as never,
      orderBy: { publishedAt: 'desc' },
      include: {
        legislativeItem: { select: { title: true, referenceNumber: true, type: true } },
      },
    });
  }
}
