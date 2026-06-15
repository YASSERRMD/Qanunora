import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { DecisionStatus } from '@prisma/client';
import { CreateDecisionDto } from './dto/create-decision.dto';
import { UpdateDecisionDto } from './dto/update-decision.dto';
import { AddDecisionLinkDto } from './dto/add-decision-link.dto';

const DECISION_INCLUDE = {
  owner: { select: { id: true, firstName: true, lastName: true, email: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  linkedItems: true,
} as const;

export interface FindAllDecisionsOptions {
  status?: DecisionStatus;
  ownerId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class DecisionRegisterService {
  constructor(private readonly prisma: PrismaService) {}

  private async generateReferenceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.decisionRecord.count({
      where: { referenceNumber: { startsWith: `DR-${year}-` } },
    });
    const seq = String(count + 1).padStart(4, '0');
    return `DR-${year}-${seq}`;
  }

  async create(dto: CreateDecisionDto, userId: string) {
    const referenceNumber = await this.generateReferenceNumber();
    return this.prisma.decisionRecord.create({
      data: {
        referenceNumber,
        title: dto.title,
        description: dto.description,
        rationale: dto.rationale,
        decisionDate: new Date(dto.decisionDate),
        ownerId: dto.ownerId,
        createdById: userId,
      },
      include: DECISION_INCLUDE,
    });
  }

  async findAll(opts: FindAllDecisionsOptions = {}) {
    const { status, ownerId, startDate, endDate, page = 1, limit = 20 } = opts;
    const skip = (page - 1) * limit;

    const where = {
      ...(status && { status }),
      ...(ownerId && { ownerId }),
      ...(startDate || endDate
        ? {
            decisionDate: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) }),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.decisionRecord.findMany({
        where,
        include: DECISION_INCLUDE,
        orderBy: { decisionDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.decisionRecord.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findById(id: string) {
    const record = await this.prisma.decisionRecord.findUnique({
      where: { id },
      include: DECISION_INCLUDE,
    });
    if (!record) throw new NotFoundException(`Decision ${id} not found`);
    return record;
  }

  async update(id: string, dto: UpdateDecisionDto) {
    await this.findById(id);
    return this.prisma.decisionRecord.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.rationale !== undefined && { rationale: dto.rationale }),
        ...(dto.decisionDate !== undefined && { decisionDate: new Date(dto.decisionDate) }),
        ...(dto.ownerId !== undefined && { ownerId: dto.ownerId }),
      },
      include: DECISION_INCLUDE,
    });
  }

  async supersede(id: string) {
    const record = await this.findById(id);
    if (record.status !== DecisionStatus.ACTIVE) {
      throw new BadRequestException(`Decision must be ACTIVE to be superseded`);
    }
    return this.prisma.decisionRecord.update({
      where: { id },
      data: { status: DecisionStatus.SUPERSEDED },
      include: DECISION_INCLUDE,
    });
  }

  async revoke(id: string) {
    const record = await this.findById(id);
    if (record.status === DecisionStatus.REVOKED) {
      throw new BadRequestException(`Decision is already REVOKED`);
    }
    return this.prisma.decisionRecord.update({
      where: { id },
      data: { status: DecisionStatus.REVOKED },
      include: DECISION_INCLUDE,
    });
  }

  async addLink(decisionId: string, dto: AddDecisionLinkDto) {
    await this.findById(decisionId);
    return this.prisma.decisionLink.create({
      data: {
        decisionId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        linkNote: dto.linkNote,
      },
    });
  }

  async removeLink(linkId: string) {
    const link = await this.prisma.decisionLink.findUnique({ where: { id: linkId } });
    if (!link) throw new NotFoundException(`DecisionLink ${linkId} not found`);
    await this.prisma.decisionLink.delete({ where: { id: linkId } });
    return { deleted: true };
  }

  async getLinks(decisionId: string) {
    await this.findById(decisionId);
    return this.prisma.decisionLink.findMany({
      where: { decisionId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
