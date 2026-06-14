import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AmendmentStatus } from '@prisma/client';
import {
  CreateAmendmentDto,
  UpdateAmendmentDto,
  AmendmentQueryDto,
} from './dto/amendment.dto';

@Injectable()
export class AmendmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(legislativeItemId: string, dto: CreateAmendmentDto, proposedById: string) {
    return this.prisma.amendment.create({
      data: {
        legislativeItemId,
        proposedById,
        title: dto.title,
        description: dto.description,
        reason: dto.reason,
        articleReference: dto.articleReference,
        sectionReference: dto.sectionReference,
        impactSummary: dto.impactSummary,
        status: AmendmentStatus.PROPOSED,
      },
      include: {
        proposedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  async findAll(legislativeItemId: string, query: AmendmentQueryDto) {
    const { page = 1, limit = 20, status } = query;
    const skip = (page - 1) * limit;

    const where = {
      legislativeItemId,
      ...(status && { status }),
    };

    const [data, total] = await Promise.all([
      this.prisma.amendment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          proposedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.amendment.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string) {
    const amendment = await this.prisma.amendment.findUnique({
      where: { id },
      include: {
        proposedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        legislativeItem: { select: { id: true, referenceNumber: true, title: true } },
      },
    });
    if (!amendment) throw new NotFoundException(`Amendment ${id} not found`);
    return amendment;
  }

  async update(id: string, dto: UpdateAmendmentDto) {
    const amendment = await this.findById(id);
    if (amendment.status !== AmendmentStatus.PROPOSED) {
      throw new BadRequestException('Only PROPOSED amendments can be edited');
    }
    return this.prisma.amendment.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.reason !== undefined && { reason: dto.reason }),
        ...(dto.articleReference !== undefined && { articleReference: dto.articleReference }),
        ...(dto.sectionReference !== undefined && { sectionReference: dto.sectionReference }),
        ...(dto.impactSummary !== undefined && { impactSummary: dto.impactSummary }),
      },
      include: {
        proposedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  async approve(id: string, approverId: string) {
    const amendment = await this.findById(id);
    if (amendment.status !== AmendmentStatus.UNDER_REVIEW) {
      throw new BadRequestException('Amendment must be UNDER_REVIEW to approve');
    }
    return this.prisma.amendment.update({
      where: { id },
      data: {
        status: AmendmentStatus.APPROVED,
        approvedById: approverId,
        approvedAt: new Date(),
      },
      include: {
        proposedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  async reject(id: string) {
    const amendment = await this.findById(id);
    if (amendment.status === AmendmentStatus.INCORPORATED) {
      throw new BadRequestException('Cannot reject an already incorporated amendment');
    }
    return this.prisma.amendment.update({
      where: { id },
      data: { status: AmendmentStatus.REJECTED },
      include: {
        proposedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  async incorporate(id: string) {
    const amendment = await this.findById(id);
    if (amendment.status !== AmendmentStatus.APPROVED) {
      throw new BadRequestException('Only APPROVED amendments can be incorporated');
    }
    return this.prisma.amendment.update({
      where: { id },
      data: { status: AmendmentStatus.INCORPORATED },
      include: {
        proposedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }
}
