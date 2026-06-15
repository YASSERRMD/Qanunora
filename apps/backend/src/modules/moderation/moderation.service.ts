import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AiProviderFactory } from '../ai-providers/ai-provider.factory';
import { ModerationStatus } from '@prisma/client';
import { SubmitAnonymousFeedbackDto } from './dto/moderation.dto';

interface AiModerationResult {
  isSpam: boolean;
  isOffensive: boolean;
  spamScore: number;
  offensiveScore: number;
}

@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiFactory: AiProviderFactory,
  ) {}

  async submitAnonymousFeedback(consultationId: string, dto: SubmitAnonymousFeedbackDto) {
    const feedback = await this.prisma.anonFeedback.create({
      data: {
        consultationId,
        submitterName: dto.submitterName,
        submitterEmail: dto.submitterEmail,
        content: dto.content,
        category: dto.category,
        moderationStatus: ModerationStatus.PENDING,
      },
      select: {
        id: true,
        submitterName: true,
        content: true,
        category: true,
        moderationStatus: true,
        createdAt: true,
      },
    });

    // Run AI moderation asynchronously (fire and forget)
    this.runAiModeration(feedback.id).catch(() => {});

    return feedback;
  }

  async runAiModeration(feedbackId: string): Promise<AiModerationResult> {
    const feedback = await this.prisma.anonFeedback.findUnique({
      where: { id: feedbackId },
      select: { id: true, content: true },
    });
    if (!feedback) throw new NotFoundException(`Feedback ${feedbackId} not found`);

    const provider = this.aiFactory.getProvider();
    const result = await provider.complete({
      messages: [
        {
          role: 'system',
          content: `You are a content moderation assistant for a government legislative portal.
Analyze the provided citizen feedback text and respond ONLY with a JSON object containing:
{
  "isSpam": boolean,
  "isOffensive": boolean,
  "spamScore": number between 0.0 and 1.0,
  "offensiveScore": number between 0.0 and 1.0,
  "reason": string
}
- isSpam: true if the content is irrelevant, promotional, or automated spam
- isOffensive: true if the content contains hate speech, threats, or grossly inappropriate language
- spamScore/offensiveScore: confidence scores (0=definitely not, 1=definitely yes)
Respond only with valid JSON, no markdown, no explanation.`,
        },
        {
          role: 'user',
          content: `Moderate this feedback:\n\n${feedback.content}`,
        },
      ],
      temperature: 0.1,
      maxTokens: 256,
      jsonMode: true,
    });

    let parsed: AiModerationResult;
    try {
      parsed = JSON.parse(result.content) as AiModerationResult;
    } catch {
      parsed = { isSpam: false, isOffensive: false, spamScore: 0, offensiveScore: 0 };
    }

    await this.prisma.anonFeedback.update({
      where: { id: feedbackId },
      data: {
        aiSpamScore: parsed.spamScore ?? 0,
        aiOffensiveScore: parsed.offensiveScore ?? 0,
        isSpam: parsed.isSpam ?? false,
        isOffensive: parsed.isOffensive ?? false,
        moderationStatus:
          (parsed.isSpam || parsed.isOffensive)
            ? ModerationStatus.FLAGGED
            : ModerationStatus.PENDING,
      },
    });

    return parsed;
  }

  async getPendingQueue(consultationId?: string) {
    return this.prisma.anonFeedback.findMany({
      where: {
        moderationStatus: ModerationStatus.PENDING,
        ...(consultationId && { consultationId }),
      },
      orderBy: { createdAt: 'asc' },
      include: {
        consultation: { select: { id: true, title: true } },
      },
    });
  }

  async approve(feedbackId: string, moderatorId: string, note?: string) {
    const feedback = await this.prisma.anonFeedback.findUnique({ where: { id: feedbackId } });
    if (!feedback) throw new NotFoundException(`Feedback ${feedbackId} not found`);

    return this.prisma.anonFeedback.update({
      where: { id: feedbackId },
      data: {
        moderationStatus: ModerationStatus.APPROVED,
        moderatedById: moderatorId,
        moderatedAt: new Date(),
        moderatorNote: note,
        publishedAt: new Date(),
      },
    });
  }

  async reject(feedbackId: string, moderatorId: string, note?: string) {
    const feedback = await this.prisma.anonFeedback.findUnique({ where: { id: feedbackId } });
    if (!feedback) throw new NotFoundException(`Feedback ${feedbackId} not found`);

    return this.prisma.anonFeedback.update({
      where: { id: feedbackId },
      data: {
        moderationStatus: ModerationStatus.REJECTED,
        moderatedById: moderatorId,
        moderatedAt: new Date(),
        moderatorNote: note,
      },
    });
  }

  async flag(feedbackId: string, moderatorId: string, note?: string) {
    const feedback = await this.prisma.anonFeedback.findUnique({ where: { id: feedbackId } });
    if (!feedback) throw new NotFoundException(`Feedback ${feedbackId} not found`);

    return this.prisma.anonFeedback.update({
      where: { id: feedbackId },
      data: {
        moderationStatus: ModerationStatus.FLAGGED,
        moderatedById: moderatorId,
        moderatedAt: new Date(),
        moderatorNote: note,
      },
    });
  }

  async getPublished(consultationId: string) {
    return this.prisma.anonFeedback.findMany({
      where: {
        consultationId,
        moderationStatus: ModerationStatus.APPROVED,
        publishedAt: { not: null },
      },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        submitterName: true,
        content: true,
        category: true,
        publishedAt: true,
      },
    });
  }

  async getModerationStats(consultationId: string) {
    const counts = await this.prisma.anonFeedback.groupBy({
      by: ['moderationStatus'],
      where: { consultationId },
      _count: { _all: true },
    });

    const stats: Record<string, number> = {
      PENDING: 0,
      APPROVED: 0,
      REJECTED: 0,
      FLAGGED: 0,
    };

    for (const row of counts) {
      stats[row.moderationStatus] = row._count._all;
    }

    return {
      consultationId,
      total: Object.values(stats).reduce((sum, n) => sum + n, 0),
      ...stats,
    };
  }
}
