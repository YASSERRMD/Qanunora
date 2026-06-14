import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ImpactCategory, ImpactSeverity } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AiProviderFactory } from '../ai-providers/ai-provider.factory';
import { parseJsonResponse } from '../ai-providers/helpers/json-output.helper';
import {
  ImpactResult,
  ImpactSummary,
  OverallRiskLevel,
  SEVERITY_ORDER,
  DEFAULT_IMPACT_DISCLAIMER,
} from './impact-result.schema';
import { buildImpactAnalysisPrompt } from './prompts/impact.prompts';

@Injectable()
export class AiImpactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProviderFactory: AiProviderFactory,
  ) {}

  // ---------------------------------------------------------------------------
  // Run impact analysis for multiple categories
  // ---------------------------------------------------------------------------

  async analyzeImpact(
    itemId: string,
    categories: ImpactCategory[],
    providerName: string | undefined,
    requestedById: string,
  ) {
    const item = await this.prisma.legislativeItem.findUnique({
      where: { id: itemId },
      select: { id: true, title: true, type: true, description: true, objective: true },
    });

    if (!item) {
      throw new NotFoundException(`Legislative item ${itemId} not found`);
    }

    const provider = this.aiProviderFactory.getProvider(providerName);
    const results: object[] = [];

    for (const category of categories) {
      const { system, user } = buildImpactAnalysisPrompt(item, category);
      const promptText = `SYSTEM:\n${system}\n\nUSER:\n${user}`;

      const start = Date.now();
      const completion = await provider.complete({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.3,
        maxTokens: 2048,
      });
      const processingTimeMs = Date.now() - start;

      let parsed: ImpactResult;
      try {
        parsed = parseJsonResponse<ImpactResult>(completion.content);
      } catch {
        throw new BadRequestException(
          `AI provider returned invalid JSON for category ${category}. Please retry or choose a different provider.`,
        );
      }

      parsed.disclaimer = parsed.disclaimer || DEFAULT_IMPACT_DISCLAIMER;

      const analysis = await this.prisma.aiAnalysis.create({
        data: {
          legislativeItemId: itemId,
          requestedById,
          analysisType: `IMPACT_${category}`,
          provider: provider.name,
          model: completion.model,
          prompt: promptText,
          result: parsed as object,
          confidenceScore: parsed.confidenceScore ?? null,
          processingTimeMs,
          isAiGenerated: true,
          reviewedByHuman: false,
          disclaimer: parsed.disclaimer,
        },
      });

      results.push(analysis);
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Get all impact analyses for an item
  // ---------------------------------------------------------------------------

  async getImpactAnalyses(itemId: string) {
    return this.prisma.aiAnalysis.findMany({
      where: {
        legislativeItemId: itemId,
        analysisType: { startsWith: 'IMPACT_' },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        requestedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Aggregate all impact analyses into a dashboard-ready summary
  // ---------------------------------------------------------------------------

  async getImpactSummary(itemId: string): Promise<ImpactSummary> {
    const analyses = await this.prisma.aiAnalysis.findMany({
      where: {
        legislativeItemId: itemId,
        analysisType: { startsWith: 'IMPACT_' },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!analyses.length) {
      return {
        itemId,
        overallRiskLevel: 'NEGLIGIBLE',
        totalCategories: 0,
        analyzedCategories: [],
        severityBreakdown: {},
        topRisks: [],
        topRecommendations: [],
        averageConfidenceScore: 0,
        analyses: [],
      };
    }

    // Deduplicate — keep latest per category
    const latestByCategory = new Map<string, (typeof analyses)[0]>();
    for (const a of analyses) {
      const cat = a.analysisType.replace('IMPACT_', '');
      if (!latestByCategory.has(cat)) latestByCategory.set(cat, a);
    }

    const latestAnalyses = Array.from(latestByCategory.values());

    const severityBreakdown: Partial<Record<ImpactSeverity, number>> = {};
    let highestSeverityScore = 0;
    let highestSeverity: ImpactSeverity = 'NEGLIGIBLE';
    const allRisks: string[] = [];
    const allRecommendations: string[] = [];
    let totalConfidence = 0;
    const analyzedCategories: ImpactCategory[] = [];

    for (const a of latestAnalyses) {
      const result = a.result as ImpactResult | null;
      if (!result) continue;

      const cat = a.analysisType.replace('IMPACT_', '') as ImpactCategory;
      analyzedCategories.push(cat);

      const sev = result.severity as ImpactSeverity;
      severityBreakdown[sev] = (severityBreakdown[sev] ?? 0) + 1;

      const score = SEVERITY_ORDER[sev] ?? 0;
      if (score > highestSeverityScore) {
        highestSeverityScore = score;
        highestSeverity = sev;
      }

      if (result.risks) allRisks.push(...result.risks);
      if (result.recommendations) allRecommendations.push(...result.recommendations);
      totalConfidence += result.confidenceScore ?? 0;
    }

    return {
      itemId,
      overallRiskLevel: highestSeverity as OverallRiskLevel,
      totalCategories: latestAnalyses.length,
      analyzedCategories,
      severityBreakdown,
      topRisks: allRisks.slice(0, 5),
      topRecommendations: allRecommendations.slice(0, 5),
      averageConfidenceScore:
        latestAnalyses.length > 0 ? totalConfidence / latestAnalyses.length : 0,
      analyses: latestAnalyses.map((a) => {
        const result = a.result as ImpactResult | null;
        return {
          id: a.id,
          category: a.analysisType.replace('IMPACT_', '') as ImpactCategory,
          severity: (result?.severity ?? 'NEGLIGIBLE') as ImpactSeverity,
          summary: result?.summary ?? '',
          createdAt: a.createdAt,
        };
      }),
    };
  }
}
