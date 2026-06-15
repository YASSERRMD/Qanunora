import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SubmissionStatus } from '@prisma/client';
import { CreateCabinetSubmissionDto } from './dto/create-cabinet-submission.dto';
import { UpdateCabinetSubmissionDto } from './dto/update-cabinet-submission.dto';
import { CompleteChecklistItemDto } from './dto/complete-checklist-item.dto';

const DEFAULT_CHECKLIST = [
  { item: 'Impact assessment complete', category: 'Analysis', order: 1 },
  { item: 'Legal opinion attached', category: 'Legal', order: 2 },
  { item: 'Consultation summary attached', category: 'Consultation', order: 3 },
  { item: 'Ministry head signature', category: 'Approval', order: 4 },
  { item: 'Budget implications documented', category: 'Finance', order: 5 },
  { item: 'Implementation timeline', category: 'Planning', order: 6 },
  { item: 'Risk analysis', category: 'Risk', order: 7 },
  { item: 'Regulatory compliance check', category: 'Compliance', order: 8 },
  { item: 'Stakeholder notification', category: 'Communication', order: 9 },
  { item: 'Confidentiality review', category: 'Security', order: 10 },
];

const SUBMISSION_INCLUDE = {
  legislativeItem: { select: { id: true, referenceNumber: true, title: true } },
  preparedBy: { select: { id: true, firstName: true, lastName: true } },
  checklist: { orderBy: { order: 'asc' as const } },
} as const;

export interface FindAllSubmissionsOptions {
  status?: SubmissionStatus;
  page?: number;
  limit?: number;
}

@Injectable()
export class CabinetSubmissionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async generateReferenceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.cabinetSubmission.count({
      where: { referenceNumber: { startsWith: `CS-${year}-` } },
    });
    const seq = String(count + 1).padStart(4, '0');
    return `CS-${year}-${seq}`;
  }

  async create(dto: CreateCabinetSubmissionDto, userId: string) {
    const referenceNumber = await this.generateReferenceNumber();
    return this.prisma.cabinetSubmission.create({
      data: {
        referenceNumber,
        legislativeItemId: dto.legislativeItemId,
        title: dto.title,
        notes: dto.notes,
        preparedById: userId,
        checklist: {
          create: DEFAULT_CHECKLIST,
        },
      },
      include: SUBMISSION_INCLUDE,
    });
  }

  async findAll(opts: FindAllSubmissionsOptions = {}) {
    const { status, page = 1, limit = 20 } = opts;
    const skip = (page - 1) * limit;
    const where = { ...(status && { status }) };

    const [items, total] = await Promise.all([
      this.prisma.cabinetSubmission.findMany({
        where,
        include: {
          legislativeItem: { select: { id: true, referenceNumber: true, title: true } },
          preparedBy: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { checklist: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.cabinetSubmission.count({ where }),
    ]);

    const itemsWithCompletion = await Promise.all(
      items.map(async (s) => {
        const completed = await this.prisma.submissionChecklist.count({
          where: { submissionId: s.id, isCompleted: true },
        });
        const total_items = s._count?.checklist ?? 0;
        const percentage = total_items > 0 ? Math.round((completed / total_items) * 100) : 0;
        return { ...s, completionPercentage: percentage };
      }),
    );

    return { items: itemsWithCompletion, total, page, limit };
  }

  async findById(id: string) {
    const submission = await this.prisma.cabinetSubmission.findUnique({
      where: { id },
      include: SUBMISSION_INCLUDE,
    });
    if (!submission) throw new NotFoundException(`Cabinet submission ${id} not found`);
    return submission;
  }

  async update(id: string, dto: UpdateCabinetSubmissionDto) {
    await this.findById(id);
    return this.prisma.cabinetSubmission.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: SUBMISSION_INCLUDE,
    });
  }

  async completeChecklistItem(
    submissionId: string,
    checklistItemId: string,
    userId: string,
    dto: CompleteChecklistItemDto,
  ) {
    await this.findById(submissionId);
    const item = await this.prisma.submissionChecklist.findFirst({
      where: { id: checklistItemId, submissionId },
    });
    if (!item) throw new NotFoundException(`Checklist item ${checklistItemId} not found`);

    return this.prisma.submissionChecklist.update({
      where: { id: checklistItemId },
      data: {
        isCompleted: true,
        completedById: userId,
        completedAt: new Date(),
        evidence: dto.evidence,
      },
    });
  }

  async uncompleteChecklistItem(submissionId: string, checklistItemId: string) {
    await this.findById(submissionId);
    const item = await this.prisma.submissionChecklist.findFirst({
      where: { id: checklistItemId, submissionId },
    });
    if (!item) throw new NotFoundException(`Checklist item ${checklistItemId} not found`);

    return this.prisma.submissionChecklist.update({
      where: { id: checklistItemId },
      data: {
        isCompleted: false,
        completedById: null,
        completedAt: null,
        evidence: null,
      },
    });
  }

  async getCompletionPercentage(submissionId: string): Promise<number> {
    await this.findById(submissionId);
    const [total, completed] = await Promise.all([
      this.prisma.submissionChecklist.count({ where: { submissionId } }),
      this.prisma.submissionChecklist.count({ where: { submissionId, isCompleted: true } }),
    ]);
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }

  async submitForApproval(id: string) {
    const submission = await this.findById(id);
    if (submission.status !== SubmissionStatus.PREPARING) {
      throw new BadRequestException(`Submission must be in PREPARING status to submit`);
    }
    const percentage = await this.getCompletionPercentage(id);
    if (percentage < 80) {
      throw new BadRequestException(
        `Checklist must be at least 80% complete before submission (currently ${percentage}%)`,
      );
    }
    return this.prisma.cabinetSubmission.update({
      where: { id },
      data: {
        status: SubmissionStatus.UNDER_REVIEW,
        submittedAt: new Date(),
      },
      include: SUBMISSION_INCLUDE,
    });
  }

  async approve(id: string) {
    const submission = await this.findById(id);
    if (submission.status !== SubmissionStatus.UNDER_REVIEW) {
      throw new BadRequestException(`Submission must be UNDER_REVIEW to approve`);
    }
    return this.prisma.cabinetSubmission.update({
      where: { id },
      data: {
        status: SubmissionStatus.APPROVED,
        approvedAt: new Date(),
      },
      include: SUBMISSION_INCLUDE,
    });
  }

  async returnSubmission(id: string, notes: string) {
    const submission = await this.findById(id);
    if (submission.status !== SubmissionStatus.UNDER_REVIEW) {
      throw new BadRequestException(`Submission must be UNDER_REVIEW to return`);
    }
    return this.prisma.cabinetSubmission.update({
      where: { id },
      data: {
        status: SubmissionStatus.RETURNED,
        notes,
      },
      include: SUBMISSION_INCLUDE,
    });
  }

  async buildPackageSummary(id: string) {
    const submission = await this.prisma.cabinetSubmission.findUnique({
      where: { id },
      include: {
        ...SUBMISSION_INCLUDE,
        legislativeItem: {
          select: {
            id: true,
            referenceNumber: true,
            title: true,
            type: true,
            status: true,
            description: true,
          },
        },
      },
    });
    if (!submission) throw new NotFoundException(`Cabinet submission ${id} not found`);

    const percentage = await this.getCompletionPercentage(id);
    const completedItems = submission.checklist.filter((c) => c.isCompleted);
    const pendingItems = submission.checklist.filter((c) => !c.isCompleted);

    return {
      referenceNumber: submission.referenceNumber,
      title: submission.title,
      status: submission.status,
      preparedBy: submission.preparedBy,
      submittedAt: submission.submittedAt,
      approvedAt: submission.approvedAt,
      legislativeItem: submission.legislativeItem,
      checklist: {
        total: submission.checklist.length,
        completed: completedItems.length,
        pending: pendingItems.length,
        completionPercentage: percentage,
        completedItems,
        pendingItems,
      },
      notes: submission.notes,
      generatedAt: new Date().toISOString(),
    };
  }
}
