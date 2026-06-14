import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';
import {
  CreateStakeholderDto,
  UpdateStakeholderDto,
  StakeholderQueryDto,
  LogCommunicationDto,
} from './dto/stakeholder.dto';

@Injectable()
export class StakeholdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateStakeholderDto) {
    return this.prisma.stakeholder.create({
      data: {
        name: dto.name,
        nameAr: dto.nameAr,
        type: dto.type,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        address: dto.address,
        website: dto.website,
        description: dto.description,
        isActive: dto.isActive ?? true,
      },
      include: {
        _count: { select: { communicationLogs: true, consultationFeedback: true } },
      },
    });
  }

  async findAll(query: StakeholderQueryDto) {
    const { page = 1, limit = 20, type, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.StakeholderWhereInput = {
      ...(type && { type }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { nameAr: { contains: search, mode: 'insensitive' } },
          { contactEmail: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.stakeholder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { communicationLogs: true, consultationFeedback: true } },
        },
      }),
      this.prisma.stakeholder.count({ where }),
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
    const stakeholder = await this.prisma.stakeholder.findUnique({
      where: { id },
      include: {
        _count: { select: { communicationLogs: true, consultationFeedback: true } },
      },
    });
    if (!stakeholder) throw new NotFoundException(`Stakeholder ${id} not found`);
    return stakeholder;
  }

  async update(id: string, dto: UpdateStakeholderDto) {
    await this.findById(id);
    return this.prisma.stakeholder.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.nameAr !== undefined && { nameAr: dto.nameAr }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.contactEmail !== undefined && { contactEmail: dto.contactEmail }),
        ...(dto.contactPhone !== undefined && { contactPhone: dto.contactPhone }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        _count: { select: { communicationLogs: true, consultationFeedback: true } },
      },
    });
  }

  async delete(id: string) {
    await this.findById(id);
    await this.prisma.stakeholder.delete({ where: { id } });
  }

  async logCommunication(stakeholderId: string, dto: LogCommunicationDto) {
    await this.findById(stakeholderId);
    return this.prisma.stakeholderCommunicationLog.create({
      data: {
        stakeholderId,
        subject: dto.subject,
        content: dto.content,
        channel: dto.channel ?? 'EMAIL',
        direction: dto.direction ?? 'OUTBOUND',
        sentAt: new Date(),
      },
    });
  }

  async getCommunicationLogs(stakeholderId: string) {
    await this.findById(stakeholderId);
    return this.prisma.stakeholderCommunicationLog.findMany({
      where: { stakeholderId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
