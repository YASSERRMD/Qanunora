import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { LegislativeItem, Prisma } from '@prisma/client';
import {
  CreateLegislativeItemDto,
  UpdateLegislativeItemDto,
  LegislativeItemQueryDto,
} from './dto/legislative.dto';

@Injectable()
export class LegislativeService {
  constructor(private readonly prisma: PrismaService) {}

  async generateReferenceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.legislativeItem.count({
      where: {
        createdAt: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`),
        },
      },
    });
    const seq = String(count + 1).padStart(4, '0');
    return `LI-${year}-${seq}`;
  }

  async create(dto: CreateLegislativeItemDto, userId: string): Promise<LegislativeItem> {
    const referenceNumber = await this.generateReferenceNumber();
    return this.prisma.legislativeItem.create({
      data: {
        referenceNumber,
        title: dto.title,
        titleAr: dto.titleAr,
        type: dto.type,
        ministryId: dto.ministryId,
        confidentialityLevel: dto.confidentialityLevel ?? 'INTERNAL',
        priority: dto.priority ?? 'MEDIUM',
        assignedToId: dto.assignedToId,
        createdById: userId,
        description: dto.description,
        descriptionAr: dto.descriptionAr,
        summaryAr: dto.summaryAr,
        objective: dto.objective,
        targetEnactmentDate: dto.targetEnactmentDate ? new Date(dto.targetEnactmentDate) : null,
      },
      include: {
        ministry: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  async findAll(query: LegislativeItemQueryDto) {
    const { page = 1, limit = 20, search, type, status, ministryId } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.LegislativeItemWhereInput = {
      ...(type && { type }),
      ...(status && { status }),
      ...(ministryId && { ministryId }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { titleAr: { contains: search, mode: 'insensitive' } },
          { referenceNumber: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.legislativeItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          ministry: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
          _count: { select: { documents: true, workflowHistory: true } },
        },
      }),
      this.prisma.legislativeItem.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<LegislativeItem> {
    const item = await this.prisma.legislativeItem.findUnique({
      where: { id },
      include: {
        ministry: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: {
          select: { documents: true, workflowHistory: true, amendments: true },
        },
      },
    });

    if (!item) throw new NotFoundException(`Legislative item ${id} not found`);
    return item;
  }

  async update(id: string, dto: UpdateLegislativeItemDto): Promise<LegislativeItem> {
    await this.findById(id);

    return this.prisma.legislativeItem.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.titleAr !== undefined && { titleAr: dto.titleAr }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.ministryId !== undefined && { ministryId: dto.ministryId }),
        ...(dto.confidentialityLevel !== undefined && { confidentialityLevel: dto.confidentialityLevel }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.assignedToId !== undefined && { assignedToId: dto.assignedToId }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.descriptionAr !== undefined && { descriptionAr: dto.descriptionAr }),
        ...(dto.summaryAr !== undefined && { summaryAr: dto.summaryAr }),
        ...(dto.objective !== undefined && { objective: dto.objective }),
        ...(dto.targetEnactmentDate !== undefined && {
          targetEnactmentDate: dto.targetEnactmentDate ? new Date(dto.targetEnactmentDate) : null,
        }),
      },
      include: {
        ministry: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    await this.prisma.legislativeItem.delete({ where: { id } });
  }
}
