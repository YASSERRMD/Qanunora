import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ConfidentialityLevel, LegislativeStatus, ConsultationStatus } from '@prisma/client';
import { SubmitPublicFeedbackDto, PublicItemQueryDto } from './dto/submit-public-feedback.dto';

const PUBLIC_SAFE_LEVELS: ConfidentialityLevel[] = [
  ConfidentialityLevel.PUBLIC,
  ConfidentialityLevel.INTERNAL,
  ConfidentialityLevel.RESTRICTED,
];

@Injectable()
export class PublicPortalService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublishedItems(query: PublicItemQueryDto) {
    const { search, type, page = 1, limit = 20 } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = {
      status: LegislativeStatus.PUBLISHED,
      confidentialityLevel: { in: PUBLIC_SAFE_LEVELS },
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { referenceNumber: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(type && { type }),
    };

    const [data, total] = await Promise.all([
      this.prisma.legislativeItem.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true,
          referenceNumber: true,
          title: true,
          titleAr: true,
          type: true,
          status: true,
          description: true,
          objective: true,
          publishedAt: true,
          createdAt: true,
          ministry: { select: { id: true, name: true, nameAr: true } },
          _count: { select: { consultations: true, amendments: true } },
        },
      }),
      this.prisma.legislativeItem.count({ where }),
    ]);

    return {
      data,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    };
  }

  async getPublishedItemDetail(id: string) {
    const item = await this.prisma.legislativeItem.findFirst({
      where: {
        id,
        status: LegislativeStatus.PUBLISHED,
        confidentialityLevel: { in: PUBLIC_SAFE_LEVELS },
      },
      select: {
        id: true,
        referenceNumber: true,
        title: true,
        titleAr: true,
        type: true,
        status: true,
        description: true,
        objective: true,
        publishedAt: true,
        createdAt: true,
        ministry: { select: { id: true, name: true, nameAr: true } },
        consultations: {
          where: { status: ConsultationStatus.OPEN },
          select: { id: true, title: true, description: true, closeDate: true },
        },
        _count: { select: { amendments: true, consultations: true } },
      },
    });

    if (!item) throw new NotFoundException(`Published item ${id} not found`);
    return item;
  }

  async getOpenConsultations() {
    return this.prisma.consultation.findMany({
      where: {
        status: ConsultationStatus.OPEN,
        legislativeItem: { confidentialityLevel: { in: PUBLIC_SAFE_LEVELS } },
      },
      orderBy: { closeDate: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        openDate: true,
        closeDate: true,
        createdAt: true,
        legislativeItem: {
          select: { id: true, referenceNumber: true, title: true, type: true },
        },
        _count: { select: { feedback: true } },
      },
    });
  }

  async getConsultationDetail(id: string) {
    const consultation = await this.prisma.consultation.findFirst({
      where: {
        id,
        status: ConsultationStatus.OPEN,
        legislativeItem: { confidentialityLevel: { in: PUBLIC_SAFE_LEVELS } },
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        openDate: true,
        closeDate: true,
        createdAt: true,
        legislativeItem: {
          select: { id: true, referenceNumber: true, title: true, type: true, description: true },
        },
        _count: { select: { feedback: true } },
      },
    });

    if (!consultation) throw new NotFoundException(`Open consultation ${id} not found`);
    return consultation;
  }

  async submitPublicFeedback(consultationId: string, dto: SubmitPublicFeedbackDto) {
    const consultation = await this.prisma.consultation.findFirst({
      where: { id: consultationId, status: ConsultationStatus.OPEN },
    });

    if (!consultation) {
      throw new BadRequestException(
        `Consultation ${consultationId} is not open for feedback`,
      );
    }

    return this.prisma.consultationFeedback.create({
      data: {
        consultationId,
        submitterName: dto.submittedByName,
        submitterEmail: dto.submittedByEmail,
        content: dto.content,
        category: dto.category,
        isPublic: true,
      },
      select: {
        id: true,
        submitterName: true,
        content: true,
        category: true,
        submittedAt: true,
      },
    });
  }

  async getPublishedLegalStructure(legislativeItemId: string) {
    const item = await this.prisma.legislativeItem.findFirst({
      where: {
        id: legislativeItemId,
        status: LegislativeStatus.PUBLISHED,
        confidentialityLevel: { in: PUBLIC_SAFE_LEVELS },
      },
    });

    if (!item) throw new NotFoundException(`Published item ${legislativeItemId} not found`);

    return this.prisma.legalStructure.findMany({
      where: { legislativeItemId },
      orderBy: [{ order: 'asc' }],
      select: {
        id: true,
        type: true,
        number: true,
        title: true,
        content: true,
        order: true,
        parentId: true,
      },
    });
  }
}
