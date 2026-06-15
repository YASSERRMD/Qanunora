import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { OpinionStatus, Priority } from '@prisma/client';
import { CreateLegalOpinionDto } from './dto/create-legal-opinion.dto';
import { AddOpinionVersionDto } from './dto/add-opinion-version.dto';

const OPINION_INCLUDE = {
  requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
  assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
  legislativeItem: { select: { id: true, referenceNumber: true, title: true } },
  versions: {
    orderBy: { versionNumber: 'desc' as const },
    include: {
      author: { select: { id: true, firstName: true, lastName: true } },
    },
  },
} as const;

export interface FindAllOpinionsOptions {
  status?: OpinionStatus;
  assignedToId?: string;
  priority?: Priority;
  page?: number;
  limit?: number;
}

@Injectable()
export class LegalOpinionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async generateReferenceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.legalOpinion.count({
      where: { referenceNumber: { startsWith: `LO-${year}-` } },
    });
    const seq = String(count + 1).padStart(4, '0');
    return `LO-${year}-${seq}`;
  }

  async create(dto: CreateLegalOpinionDto, userId: string) {
    const referenceNumber = await this.generateReferenceNumber();
    return this.prisma.legalOpinion.create({
      data: {
        referenceNumber,
        subject: dto.subject,
        requestedById: userId,
        assignedToId: dto.assignedToId,
        legislativeItemId: dto.legislativeItemId,
        priority: dto.priority ?? Priority.MEDIUM,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        references: dto.references ?? [],
        status: OpinionStatus.REQUESTED,
      },
      include: OPINION_INCLUDE,
    });
  }

  async findAll(opts: FindAllOpinionsOptions = {}) {
    const { status, assignedToId, priority, page = 1, limit = 20 } = opts;
    const skip = (page - 1) * limit;

    const where = {
      ...(status && { status }),
      ...(assignedToId && { assignedToId }),
      ...(priority && { priority }),
    };

    const [items, total] = await Promise.all([
      this.prisma.legalOpinion.findMany({
        where,
        include: {
          requestedBy: { select: { id: true, firstName: true, lastName: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
          legislativeItem: { select: { id: true, referenceNumber: true, title: true } },
          _count: { select: { versions: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.legalOpinion.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findById(id: string) {
    const opinion = await this.prisma.legalOpinion.findUnique({
      where: { id },
      include: OPINION_INCLUDE,
    });
    if (!opinion) throw new NotFoundException(`Legal opinion ${id} not found`);
    return opinion;
  }

  async assign(id: string, assigneeId: string) {
    await this.findById(id);
    return this.prisma.legalOpinion.update({
      where: { id },
      data: {
        assignedToId: assigneeId,
        status: OpinionStatus.ASSIGNED,
      },
      include: OPINION_INCLUDE,
    });
  }

  async addVersion(id: string, dto: AddOpinionVersionDto, userId: string) {
    await this.findById(id);
    const latest = await this.prisma.legalOpinionVersion.findFirst({
      where: { opinionId: id },
      orderBy: { versionNumber: 'desc' },
    });
    const nextVersion = (latest?.versionNumber ?? 0) + 1;

    const version = await this.prisma.legalOpinionVersion.create({
      data: {
        opinionId: id,
        versionNumber: nextVersion,
        content: dto.content,
        authorId: userId,
      },
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
    });

    // Move to DRAFTING if still REQUESTED/ASSIGNED
    const opinion = await this.prisma.legalOpinion.findUnique({ where: { id } });
    if (
      opinion &&
      (opinion.status === OpinionStatus.REQUESTED || opinion.status === OpinionStatus.ASSIGNED)
    ) {
      await this.prisma.legalOpinion.update({
        where: { id },
        data: { status: OpinionStatus.DRAFTING },
      });
    }

    return version;
  }

  async approveVersion(opinionId: string, versionId: string, userId: string) {
    await this.findById(opinionId);
    const version = await this.prisma.legalOpinionVersion.findFirst({
      where: { id: versionId, opinionId },
    });
    if (!version) throw new NotFoundException(`Version ${versionId} not found`);

    const approved = await this.prisma.legalOpinionVersion.update({
      where: { id: versionId },
      data: {
        isApproved: true,
        approvedById: userId,
        approvedAt: new Date(),
      },
    });

    await this.prisma.legalOpinion.update({
      where: { id: opinionId },
      data: { status: OpinionStatus.APPROVED },
    });

    return approved;
  }

  async issue(id: string) {
    const opinion = await this.findById(id);
    if (opinion.status !== OpinionStatus.APPROVED) {
      throw new BadRequestException(`Opinion must be APPROVED before it can be issued`);
    }
    return this.prisma.legalOpinion.update({
      where: { id },
      data: { status: OpinionStatus.ISSUED },
      include: OPINION_INCLUDE,
    });
  }

  async withdraw(id: string) {
    const opinion = await this.findById(id);
    if (opinion.status === OpinionStatus.WITHDRAWN) {
      throw new BadRequestException(`Opinion is already WITHDRAWN`);
    }
    return this.prisma.legalOpinion.update({
      where: { id },
      data: { status: OpinionStatus.WITHDRAWN },
      include: OPINION_INCLUDE,
    });
  }
}
