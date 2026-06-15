import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AiProviderFactory } from '../ai-providers/ai-provider.factory';
import { TranslationStatus } from '@prisma/client';
import {
  CreateTranslationDto,
  ReviewTranslationDto,
  TranslationQueryDto,
} from './dto/ai-translation.dto';

interface AiTranslationOutput {
  translatedText: string;
  confidenceScore: number;
  glossaryTermsUsed: string[];
}

@Injectable()
export class AiTranslationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiFactory: AiProviderFactory,
  ) {}

  async translate(dto: CreateTranslationDto, userId: string) {
    const sourceLang = dto.sourceLang ?? 'ar';
    const targetLang = dto.targetLang ?? 'en';
    const domain = dto.domain ?? 'legal';

    // Check translation memory for exact match
    const cached = await this.prisma.translationMemory.findFirst({
      where: {
        sourceText: dto.sourceText,
        sourceLang,
        targetLang,
      },
    });

    if (cached) {
      // Create request referencing memory entry
      const request = await this.prisma.translationRequest.create({
        data: {
          sourceText: dto.sourceText,
          sourceLang,
          targetLang,
          domain,
          translatedText: cached.translatedText,
          status: TranslationStatus.COMPLETED,
          isApproved: true,
          memoryEntryId: cached.id,
          entityType: dto.entityType,
          entityId: dto.entityId,
          createdById: userId,
        },
        include: {
          memoryEntry: true,
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      // Increment memory usage
      await this.prisma.translationMemory.update({
        where: { id: cached.id },
        data: { usageCount: { increment: 1 } },
      });

      return { ...request, fromCache: true };
    }

    // Call AI provider
    const provider = this.aiFactory.getProvider();
    const langMap: Record<string, string> = {
      ar: 'formal legal Arabic',
      en: 'formal legal English',
      fr: 'formal legal French',
    };
    const sourceLangName = langMap[sourceLang] ?? sourceLang;
    const targetLangName = langMap[targetLang] ?? targetLang;

    const result = await provider.complete({
      messages: [
        {
          role: 'system',
          content: `You are a professional legal translator specializing in government and legislative texts.
Translate from ${sourceLangName} to ${targetLangName} with precision and formal legal register.
Domain: ${domain}.
You MUST respond with valid JSON ONLY, no markdown, no explanation:
{
  "translatedText": "the complete translation",
  "confidenceScore": 0.0 to 1.0,
  "glossaryTermsUsed": ["term1", "term2"]
}
Preserve paragraph structure. Use terminology consistent with official legislative documents.`,
        },
        {
          role: 'user',
          content: dto.sourceText,
        },
      ],
      temperature: 0.2,
      maxTokens: 4096,
      jsonMode: true,
    });

    let parsed: AiTranslationOutput;
    try {
      parsed = JSON.parse(result.content) as AiTranslationOutput;
    } catch {
      throw new BadRequestException('AI provider returned invalid translation response');
    }

    // Save translation memory entry
    const memoryEntry = await this.prisma.translationMemory.upsert({
      where: {
        sourceText_sourceLang_targetLang: {
          sourceText: dto.sourceText,
          sourceLang,
          targetLang,
        },
      },
      create: {
        sourceText: dto.sourceText,
        translatedText: parsed.translatedText,
        sourceLang,
        targetLang,
        domain,
        usageCount: 1,
      },
      update: { usageCount: { increment: 1 } },
    });

    const request = await this.prisma.translationRequest.create({
      data: {
        sourceText: dto.sourceText,
        sourceLang,
        targetLang,
        domain,
        translatedText: parsed.translatedText,
        confidenceScore: parsed.confidenceScore,
        provider: result.provider,
        model: result.model,
        status: TranslationStatus.COMPLETED,
        memoryEntryId: memoryEntry.id,
        entityType: dto.entityType,
        entityId: dto.entityId,
        createdById: userId,
      },
      include: {
        memoryEntry: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return { ...request, glossaryTermsUsed: parsed.glossaryTermsUsed, fromCache: false };
  }

  async findAll(query: TranslationQueryDto) {
    const { status, sourceLang, page = 1, limit = 20 } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {
      ...(status && { status: status as TranslationStatus }),
      ...(sourceLang && { sourceLang }),
    };

    const [data, total] = await Promise.all([
      this.prisma.translationRequest.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          reviewedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.translationRequest.count({ where }),
    ]);

    return {
      data,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    };
  }

  async findById(id: string) {
    const request = await this.prisma.translationRequest.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true } },
        memoryEntry: true,
      },
    });
    if (!request) throw new NotFoundException(`Translation request ${id} not found`);
    return request;
  }

  async submitForReview(id: string, userId: string) {
    const request = await this.findById(id);
    if (request.status !== TranslationStatus.COMPLETED) {
      throw new BadRequestException('Only COMPLETED translations can be submitted for review');
    }
    return this.prisma.translationRequest.update({
      where: { id },
      data: { status: TranslationStatus.UNDER_REVIEW },
    });
  }

  async approveTranslation(id: string, reviewerId: string, dto: ReviewTranslationDto) {
    const request = await this.findById(id);
    const updated = await this.prisma.translationRequest.update({
      where: { id },
      data: {
        status: TranslationStatus.APPROVED,
        isApproved: true,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        reviewNotes: dto.notes,
      },
    });

    // Increment memory usage count on approval
    if (request.memoryEntryId) {
      await this.prisma.translationMemory.update({
        where: { id: request.memoryEntryId },
        data: { usageCount: { increment: 1 } },
      });
    }

    return updated;
  }

  async rejectTranslation(id: string, reviewerId: string, dto: ReviewTranslationDto) {
    await this.findById(id);
    return this.prisma.translationRequest.update({
      where: { id },
      data: {
        status: TranslationStatus.REJECTED,
        isApproved: false,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        reviewNotes: dto.notes,
      },
    });
  }

  async getMemoryEntries(query: { sourceLang?: string; targetLang?: string; page?: number; limit?: number }) {
    const { sourceLang, targetLang, page = 1, limit = 20 } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {
      ...(sourceLang && { sourceLang }),
      ...(targetLang && { targetLang }),
    };

    const [data, total] = await Promise.all([
      this.prisma.translationMemory.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { usageCount: 'desc' },
      }),
      this.prisma.translationMemory.count({ where }),
    ]);

    return { data, total, page: Number(page), limit: Number(limit) };
  }

  async translateLegislativeItem(itemId: string, targetLang: string, userId: string) {
    const item = await this.prisma.legislativeItem.findUnique({
      where: { id: itemId },
      select: { id: true, title: true, description: true, titleAr: true },
    });
    if (!item) throw new NotFoundException(`Legislative item ${itemId} not found`);

    const sourceLang = targetLang === 'en' ? 'ar' : 'en';
    const sourceText = targetLang === 'en'
      ? `${item.titleAr ?? item.title}\n\n${item.description ?? ''}`
      : `${item.title}\n\n${item.description ?? ''}`;

    return this.translate(
      {
        sourceText,
        sourceLang,
        targetLang,
        domain: 'legal',
        entityType: 'legislative_item',
        entityId: itemId,
      },
      userId,
    );
  }
}
