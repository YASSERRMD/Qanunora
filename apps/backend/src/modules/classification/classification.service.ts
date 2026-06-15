import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AiProviderFactory } from '../ai-providers/ai-provider.factory';
import {
  ClassifyDto,
  DeclassifyDto,
  GrantAccessExceptionDto,
  ClassificationLevel,
} from './dto/classification.dto';

// Role → maximum visible level
const ROLE_LEVEL_MAP: Record<string, ClassificationLevel[]> = {
  VIEWER: ['UNCLASSIFIED'],
  REVIEWER: ['UNCLASSIFIED', 'RESTRICTED', 'CONFIDENTIAL'],
  COMMITTEE_MEMBER: ['UNCLASSIFIED', 'RESTRICTED', 'CONFIDENTIAL'],
  MINISTRY_LEGAL_OFFICER: ['UNCLASSIFIED', 'RESTRICTED', 'CONFIDENTIAL'],
  DRAFTING_OFFICER: ['UNCLASSIFIED', 'RESTRICTED', 'CONFIDENTIAL'],
  LEGISLATIVE_ADMIN: ['UNCLASSIFIED', 'RESTRICTED', 'CONFIDENTIAL', 'SECRET'],
  STAKEHOLDER_MANAGER: ['UNCLASSIFIED'],
  PUBLIC_CONSULTATION_OFFICER: ['UNCLASSIFIED'],
  AUDITOR: ['UNCLASSIFIED', 'RESTRICTED', 'CONFIDENTIAL', 'SECRET'],
  SUPER_ADMIN: ['UNCLASSIFIED', 'RESTRICTED', 'CONFIDENTIAL', 'SECRET', 'TOP_SECRET'],
};

const LEVEL_ORDER: ClassificationLevel[] = [
  'UNCLASSIFIED',
  'RESTRICTED',
  'CONFIDENTIAL',
  'SECRET',
  'TOP_SECRET',
];

@Injectable()
export class ClassificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProviderFactory: AiProviderFactory,
  ) {}

  async classify(
    legislativeItemId: string,
    dto: ClassifyDto,
    userId: string,
  ) {
    // Verify item exists
    const item = await this.prisma.legislativeItem.findUnique({ where: { id: legislativeItemId } });
    if (!item) throw new NotFoundException('Legislative item not found');

    // Map ClassificationLevel to ConfidentialityLevel for the legislative item
    const confidentialityMap: Record<ClassificationLevel, string> = {
      UNCLASSIFIED: 'PUBLIC',
      RESTRICTED: 'RESTRICTED',
      CONFIDENTIAL: 'CONFIDENTIAL',
      SECRET: 'RESTRICTED',
      TOP_SECRET: 'TOP_SECRET',
    };

    const [classification] = await Promise.all([
      this.prisma.contentClassification.upsert({
        where: { legislativeItemId },
        create: {
          legislativeItemId,
          classificationLevel: dto.level,
          sensitiveFlags: dto.sensitiveFlags ?? [],
          classifiedById: userId,
          justification: dto.justification,
          reviewDueDate: dto.reviewDueDate ? new Date(dto.reviewDueDate) : null,
        },
        update: {
          classificationLevel: dto.level,
          sensitiveFlags: dto.sensitiveFlags ?? [],
          classifiedById: userId,
          justification: dto.justification,
          reviewDueDate: dto.reviewDueDate ? new Date(dto.reviewDueDate) : null,
          declassifiedAt: null,
          declassifiedById: null,
        },
      }),
      this.prisma.legislativeItem.update({
        where: { id: legislativeItemId },
        data: { confidentialityLevel: confidentialityMap[dto.level] as never },
      }),
    ]);

    return classification;
  }

  async declassify(legislativeItemId: string, dto: DeclassifyDto, userId: string) {
    const classification = await this.prisma.contentClassification.findUnique({
      where: { legislativeItemId },
    });
    if (!classification) throw new NotFoundException('Classification not found');

    return this.prisma.contentClassification.update({
      where: { legislativeItemId },
      data: {
        classificationLevel: 'UNCLASSIFIED',
        declassifiedById: userId,
        declassifiedAt: new Date(),
        justification: dto.justification,
      },
    });
  }

  async getClassification(legislativeItemId: string) {
    return this.prisma.contentClassification.findUnique({
      where: { legislativeItemId },
      include: {
        classifiedBy: { select: { firstName: true, lastName: true, email: true } },
        declassifiedBy: { select: { firstName: true, lastName: true, email: true } },
      },
    });
  }

  async detectSensitiveContent(legislativeItemId: string) {
    const item = await this.prisma.legislativeItem.findUnique({
      where: { id: legislativeItemId },
      select: { title: true, description: true, objective: true },
    });
    if (!item) throw new NotFoundException('Legislative item not found');

    const provider = this.aiProviderFactory.getProvider(undefined);
    const prompt = `Analyze the following legislative item for sensitive content. Identify any sensitivity flags from: FINANCIAL, PERSONAL_DATA, NATIONAL_SECURITY, LEGAL_PRIVILEGE, TRADE_SECRET, HEALTH_DATA. Suggest an appropriate classification level: UNCLASSIFIED, RESTRICTED, CONFIDENTIAL, SECRET, or TOP_SECRET. Respond ONLY with valid JSON in this exact format: {"flags":["FLAG1"],"reasoning":"brief explanation","suggestedLevel":"LEVEL"}.

Title: ${item.title}
Description: ${item.description ?? 'N/A'}
Objective: ${item.objective ?? 'N/A'}`;

    const response = await provider.complete({
      messages: [{ role: 'user', content: prompt }],
    });

    const text = typeof response === 'string' ? response : (response as { content?: string })?.content ?? JSON.stringify(response);

    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]) as { flags: string[]; reasoning: string; suggestedLevel: ClassificationLevel };
      }
    } catch {
      // fall through
    }

    return { flags: [], reasoning: text, suggestedLevel: 'UNCLASSIFIED' as ClassificationLevel };
  }

  async grantAccessException(dto: GrantAccessExceptionDto, grantorId: string) {
    return this.prisma.accessException.upsert({
      where: { legislativeItemId_userId: { legislativeItemId: dto.legislativeItemId, userId: dto.userId } },
      create: {
        legislativeItemId: dto.legislativeItemId,
        userId: dto.userId,
        grantedById: grantorId,
        reason: dto.reason,
        expiresAt: new Date(dto.expiresAt),
        isActive: true,
      },
      update: {
        reason: dto.reason,
        grantedById: grantorId,
        expiresAt: new Date(dto.expiresAt),
        isActive: true,
      },
    });
  }

  async revokeAccessException(exceptionId: string) {
    return this.prisma.accessException.update({
      where: { id: exceptionId },
      data: { isActive: false },
    });
  }

  async checkAccess(legislativeItemId: string, userId: string, userRole: string): Promise<boolean> {
    const classification = await this.prisma.contentClassification.findUnique({
      where: { legislativeItemId },
      select: { classificationLevel: true },
    });

    // If no classification, treat as UNCLASSIFIED (all roles can access)
    if (!classification) return true;

    const allowedLevels = ROLE_LEVEL_MAP[userRole] ?? ['UNCLASSIFIED'];
    const level = classification.classificationLevel as ClassificationLevel;

    if (allowedLevels.includes(level)) return true;

    // Check for active access exception
    const exception = await this.prisma.accessException.findUnique({
      where: { legislativeItemId_userId: { legislativeItemId, userId } },
    });

    if (exception && exception.isActive && exception.expiresAt > new Date()) return true;

    return false;
  }

  async getPendingDeclassificationReview() {
    return this.prisma.contentClassification.findMany({
      where: {
        reviewDueDate: { lte: new Date() },
        declassifiedAt: null,
      },
      include: {
        legislativeItem: { select: { id: true, title: true, referenceNumber: true } },
        classifiedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { reviewDueDate: 'asc' },
    });
  }

  async getClassificationStats() {
    const levels: ClassificationLevel[] = LEVEL_ORDER;
    const counts: Record<string, number> = {};

    for (const level of levels) {
      counts[level] = await this.prisma.contentClassification.count({
        where: { classificationLevel: level },
      });
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return { counts, total };
  }

  async listAccessExceptions(legislativeItemId?: string) {
    return this.prisma.accessException.findMany({
      where: legislativeItemId ? { legislativeItemId } : {},
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        grantedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
