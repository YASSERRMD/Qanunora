import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AiProviderFactory } from '../ai-providers/ai-provider.factory';
import { parseJsonResponse } from '../ai-providers/helpers/json-output.helper';
import {
  buildSentimentPrompt,
  buildTopicClusteringPrompt,
} from './prompts/analytics.prompts';

export interface SentimentResult {
  feedbackId: string;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  score: number;
  reason: string;
}

export interface ClusterResult {
  clusters: {
    topicLabel: string;
    feedbackIds: string[];
    description: string;
  }[];
}

@Injectable()
export class ConsultationAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProviderFactory: AiProviderFactory,
  ) {}

  // ---------------------------------------------------------------------------
  // Sentiment Analysis
  // ---------------------------------------------------------------------------

  async analyzeSentiment(
    consultationId: string,
    providerName: string | undefined,
    requestedById: string,
  ): Promise<SentimentResult[]> {
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
      include: { feedback: true },
    });

    if (!consultation) {
      throw new NotFoundException(`Consultation ${consultationId} not found`);
    }

    const feedbackItems = consultation.feedback;
    if (!feedbackItems.length) {
      return [];
    }

    const provider = this.aiProviderFactory.getProvider(providerName);
    const results: SentimentResult[] = [];

    // Process in batches of 10, one item per call sequential
    for (const feedback of feedbackItems) {
      const { system, user } = buildSentimentPrompt(feedback.content);
      const start = Date.now();

      let parsed: { sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'; score: number; reason: string };
      try {
        const completion = await provider.complete({
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0.1,
          maxTokens: 256,
        });
        parsed = parseJsonResponse(completion.content);
      } catch {
        parsed = { sentiment: 'NEUTRAL', score: 0.5, reason: 'Analysis unavailable' };
      }

      // Update feedback sentiment in DB
      await this.prisma.consultationFeedback.update({
        where: { id: feedback.id },
        data: { sentiment: parsed.sentiment },
      });

      results.push({
        feedbackId: feedback.id,
        sentiment: parsed.sentiment,
        score: parsed.score,
        reason: parsed.reason,
      });
    }

    const processingTimeMs = Date.now();
    // Save one AiAnalysis record for the whole consultation
    await this.prisma.aiAnalysis.create({
      data: {
        legislativeItemId: consultation.legislativeItemId,
        requestedById,
        analysisType: 'SENTIMENT_ANALYSIS',
        provider: provider.name,
        model: 'batch',
        prompt: `Sentiment analysis for consultation ${consultationId}`,
        result: results as unknown as object,
        confidenceScore: results.reduce((s, r) => s + r.score, 0) / (results.length || 1),
        processingTimeMs: Date.now() - processingTimeMs + 1,
        isAiGenerated: true,
        reviewedByHuman: false,
        disclaimer: 'AI-assisted sentiment analysis. Results may require human review.',
      },
    });

    return results;
  }

  // ---------------------------------------------------------------------------
  // Topic Clustering
  // ---------------------------------------------------------------------------

  async clusterTopics(
    consultationId: string,
    providerName: string | undefined,
    requestedById: string,
  ): Promise<ClusterResult> {
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
      include: { feedback: { select: { id: true, content: true } } },
    });

    if (!consultation) {
      throw new NotFoundException(`Consultation ${consultationId} not found`);
    }

    const feedbackItems = consultation.feedback.map((f) => ({
      id: f.id,
      content: f.content,
    }));

    if (!feedbackItems.length) {
      return { clusters: [] };
    }

    const provider = this.aiProviderFactory.getProvider(providerName);
    const { system, user } = buildTopicClusteringPrompt(feedbackItems);
    const start = Date.now();

    let parsed: ClusterResult = { clusters: [] };
    try {
      const completion = await provider.complete({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.3,
        maxTokens: 2048,
      });
      parsed = parseJsonResponse<ClusterResult>(completion.content);
    } catch {
      parsed = { clusters: [] };
    }

    await this.prisma.aiAnalysis.create({
      data: {
        legislativeItemId: consultation.legislativeItemId,
        requestedById,
        analysisType: 'TOPIC_CLUSTERING',
        provider: provider.name,
        model: 'default',
        prompt: `Topic clustering for consultation ${consultationId}`,
        result: parsed as unknown as object,
        confidenceScore: null,
        processingTimeMs: Date.now() - start,
        isAiGenerated: true,
        reviewedByHuman: false,
        disclaimer: 'AI-assisted topic clustering. Results may require human review.',
      },
    });

    return parsed;
  }

  // ---------------------------------------------------------------------------
  // Get Analytics
  // ---------------------------------------------------------------------------

  async getAnalytics(consultationId: string) {
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        feedback: {
          select: {
            id: true,
            sentiment: true,
            category: true,
            submittedAt: true,
          },
        },
      },
    });

    if (!consultation) {
      throw new NotFoundException(`Consultation ${consultationId} not found`);
    }

    const feedback = consultation.feedback;
    const total = feedback.length;

    // Count by sentiment
    const bySentiment: Record<string, number> = { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0 };
    for (const f of feedback) {
      if (f.sentiment) {
        bySentiment[f.sentiment] = (bySentiment[f.sentiment] ?? 0) + 1;
      }
    }

    // Count by category
    const byCategory: Record<string, number> = {};
    for (const f of feedback) {
      if (f.category) {
        byCategory[f.category] = (byCategory[f.category] ?? 0) + 1;
      }
    }

    // Volume by date
    const byDate: Record<string, number> = {};
    for (const f of feedback) {
      const day = f.submittedAt.toISOString().split('T')[0];
      byDate[day] = (byDate[day] ?? 0) + 1;
    }
    const volumeByDate = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    // Support/opposition ratio
    const positive = bySentiment['POSITIVE'] ?? 0;
    const negative = bySentiment['NEGATIVE'] ?? 0;
    const supportRatio = total > 0 ? positive / total : 0;
    const oppositionRatio = total > 0 ? negative / total : 0;

    // Latest topic clusters
    const latestClustering = await this.prisma.aiAnalysis.findFirst({
      where: {
        legislativeItemId: consultation.legislativeItemId,
        analysisType: 'TOPIC_CLUSTERING',
      },
      orderBy: { createdAt: 'desc' },
    });

    const topTopics =
      latestClustering
        ? ((latestClustering.result as ClusterResult)?.clusters ?? []).map((c) => ({
            label: c.topicLabel,
            count: c.feedbackIds.length,
            description: c.description,
          }))
        : [];

    return {
      total,
      bySentiment,
      byCategory,
      volumeByDate,
      supportRatio,
      oppositionRatio,
      topTopics,
    };
  }

  // ---------------------------------------------------------------------------
  // Stakeholder Sentiment
  // ---------------------------------------------------------------------------

  async getStakeholderSentiment(consultationId: string) {
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
    });
    if (!consultation) {
      throw new NotFoundException(`Consultation ${consultationId} not found`);
    }

    const feedback = await this.prisma.consultationFeedback.findMany({
      where: { consultationId },
      include: {
        stakeholder: { select: { id: true, name: true, type: true } },
      },
    });

    // Group by stakeholder type
    const byType: Record<string, { POSITIVE: number; NEGATIVE: number; NEUTRAL: number; total: number }> = {};

    for (const f of feedback) {
      const type = f.stakeholder?.type ?? 'UNKNOWN';
      if (!byType[type]) {
        byType[type] = { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0, total: 0 };
      }
      byType[type].total += 1;
      if (f.sentiment === 'POSITIVE' || f.sentiment === 'NEGATIVE' || f.sentiment === 'NEUTRAL') {
        byType[type][f.sentiment] += 1;
      }
    }

    return Object.entries(byType).map(([type, counts]) => ({ type, ...counts }));
  }
}
