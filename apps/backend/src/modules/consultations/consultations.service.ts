import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ConsultationStatus } from '@prisma/client';
import {
  CreateConsultationDto,
  UpdateConsultationDto,
  SubmitFeedbackDto,
  ReviewFeedbackDto,
  FeedbackQueryDto,
} from './dto/consultation.dto';

@Injectable()
export class ConsultationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createConsultation(dto: CreateConsultationDto) {
    return this.prisma.consultation.create({
      data: {
        legislativeItemId: dto.legislativeItemId,
        title: dto.title,
        description: dto.description,
        status: ConsultationStatus.DRAFT,
        openDate: dto.openDate ? new Date(dto.openDate) : null,
        closeDate: dto.closeDate ? new Date(dto.closeDate) : null,
      },
      include: {
        legislativeItem: { select: { id: true, referenceNumber: true, title: true } },
        _count: { select: { feedback: true } },
      },
    });
  }

  async findAll() {
    return this.prisma.consultation.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        legislativeItem: { select: { id: true, referenceNumber: true, title: true } },
        _count: { select: { feedback: true } },
      },
    });
  }

  async findById(id: string) {
    const consultation = await this.prisma.consultation.findUnique({
      where: { id },
      include: {
        legislativeItem: { select: { id: true, referenceNumber: true, title: true } },
        _count: { select: { feedback: true } },
      },
    });
    if (!consultation) throw new NotFoundException(`Consultation ${id} not found`);
    return consultation;
  }

  async update(id: string, dto: UpdateConsultationDto) {
    await this.findById(id);
    return this.prisma.consultation.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.openDate !== undefined && { openDate: dto.openDate ? new Date(dto.openDate) : null }),
        ...(dto.closeDate !== undefined && { closeDate: dto.closeDate ? new Date(dto.closeDate) : null }),
      },
      include: {
        legislativeItem: { select: { id: true, referenceNumber: true, title: true } },
        _count: { select: { feedback: true } },
      },
    });
  }

  async open(id: string) {
    const consultation = await this.findById(id);
    if (consultation.status !== ConsultationStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT consultations can be opened');
    }
    return this.prisma.consultation.update({
      where: { id },
      data: {
        status: ConsultationStatus.OPEN,
        openDate: consultation.openDate ?? new Date(),
      },
      include: {
        legislativeItem: { select: { id: true, referenceNumber: true, title: true } },
        _count: { select: { feedback: true } },
      },
    });
  }

  async close(id: string) {
    const consultation = await this.findById(id);
    if (consultation.status !== ConsultationStatus.OPEN) {
      throw new BadRequestException('Only OPEN consultations can be closed');
    }
    return this.prisma.consultation.update({
      where: { id },
      data: {
        status: ConsultationStatus.CLOSED,
        closeDate: consultation.closeDate ?? new Date(),
      },
      include: {
        legislativeItem: { select: { id: true, referenceNumber: true, title: true } },
        _count: { select: { feedback: true } },
      },
    });
  }

  async submitFeedback(consultationId: string, dto: SubmitFeedbackDto) {
    const consultation = await this.findById(consultationId);
    if (consultation.status !== ConsultationStatus.OPEN) {
      throw new BadRequestException('Feedback can only be submitted to OPEN consultations');
    }
    return this.prisma.consultationFeedback.create({
      data: {
        consultationId,
        stakeholderId: dto.stakeholderId,
        submitterName: dto.submitterName,
        submitterEmail: dto.submitterEmail,
        content: dto.content,
        category: dto.category,
        sentiment: dto.sentiment,
        isPublic: dto.isPublic ?? false,
      },
      include: {
        stakeholder: { select: { id: true, name: true, type: true } },
      },
    });
  }

  async getFeedback(consultationId: string, query: FeedbackQueryDto) {
    await this.findById(consultationId);
    const { page = 1, limit = 20, category, sentiment } = query;
    const skip = (page - 1) * limit;

    const where = {
      consultationId,
      ...(category && { category }),
      ...(sentiment && { sentiment }),
    };

    const [data, total] = await Promise.all([
      this.prisma.consultationFeedback.findMany({
        where,
        skip,
        take: limit,
        orderBy: { submittedAt: 'desc' },
        include: {
          stakeholder: { select: { id: true, name: true, type: true } },
          reviews: {
            include: {
              reviewer: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      }),
      this.prisma.consultationFeedback.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async reviewFeedback(feedbackId: string, dto: ReviewFeedbackDto, reviewedById: string) {
    const feedback = await this.prisma.consultationFeedback.findUnique({
      where: { id: feedbackId },
    });
    if (!feedback) throw new NotFoundException(`Feedback ${feedbackId} not found`);

    return this.prisma.consultationFeedbackReview.create({
      data: {
        feedbackId,
        reviewedBy: reviewedById,
        decision: dto.decision,
        notes: dto.notes,
      },
      include: {
        reviewer: { select: { id: true, firstName: true, lastName: true } },
        feedback: { select: { id: true, content: true, category: true } },
      },
    });
  }

  async getSummary(consultationId: string) {
    await this.findById(consultationId);

    const all = await this.prisma.consultationFeedback.findMany({
      where: { consultationId },
      select: { category: true, sentiment: true },
    });

    const byCategory: Record<string, number> = {};
    const bySentiment: Record<string, number> = {};

    for (const f of all) {
      if (f.category) byCategory[f.category] = (byCategory[f.category] ?? 0) + 1;
      if (f.sentiment) bySentiment[f.sentiment] = (bySentiment[f.sentiment] ?? 0) + 1;
    }

    return {
      total: all.length,
      byCategory,
      bySentiment,
    };
  }
}
