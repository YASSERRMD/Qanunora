import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AiProviderFactory } from '../ai-providers/ai-provider.factory';
import { parseJsonResponse } from '../ai-providers/helpers/json-output.helper';
import {
  SummaryResult,
  SummaryType,
  DEFAULT_SUMMARY_DISCLAIMER,
} from './summary-result.schema';
import {
  buildExecutiveSummaryPrompt,
  buildCitizenSummaryPrompt,
  buildLegalOfficerSummaryPrompt,
  buildAmendmentSummaryPrompt,
  buildBillSummaryPrompt,
} from './prompts/summary.prompts';

const ANALYSIS_TYPE = 'SUMMARIZATION';

@Injectable()
export class AiSummarizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProviderFactory: AiProviderFactory,
  ) {}

  // ---------------------------------------------------------------------------
  // Main summarization entry point
  // ---------------------------------------------------------------------------

  async summarizeLegislativeItem(
    itemId: string,
    summaryType: SummaryType,
    providerName: string | undefined,
    requestedById: string,
  ) {
    const item = await this.prisma.legislativeItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        title: true,
        type: true,
        description: true,
        objective: true,
      },
    });

    if (!item) {
      throw new NotFoundException(`Legislative item ${itemId} not found`);
    }

    const { system, user } = this.buildPromptPair(summaryType, item);
    const promptText = `SYSTEM:\n${system}\n\nUSER:\n${user}`;

    const provider = this.aiProviderFactory.getProvider(providerName);
    const start = Date.now();

    const completionResult = await provider.complete({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.3,
      maxTokens: 2048,
    });

    const processingTimeMs = Date.now() - start;

    let parsedResult: SummaryResult;
    try {
      parsedResult = parseJsonResponse<SummaryResult>(completionResult.content);
    } catch {
      throw new BadRequestException(
        'AI provider returned an invalid JSON response. Please retry or choose a different provider.',
      );
    }

    // Ensure disclaimer and wordCount are set
    parsedResult.disclaimer = parsedResult.disclaimer || DEFAULT_SUMMARY_DISCLAIMER;
    if (!parsedResult.wordCount) {
      parsedResult.wordCount = parsedResult.summary
        ? parsedResult.summary.split(/\s+/).filter(Boolean).length
        : 0;
    }

    const analysis = await this.prisma.aiAnalysis.create({
      data: {
        legislativeItemId: itemId,
        requestedById,
        analysisType: ANALYSIS_TYPE,
        provider: provider.name,
        model: completionResult.model,
        prompt: promptText,
        result: parsedResult as object,
        confidenceScore: parsedResult.confidenceScore ?? null,
        processingTimeMs,
        isAiGenerated: true,
        reviewedByHuman: false,
        disclaimer: parsedResult.disclaimer,
      },
    });

    return analysis;
  }

  // ---------------------------------------------------------------------------
  // List summaries for a legislative item
  // ---------------------------------------------------------------------------

  async getSummaries(itemId: string) {
    return this.prisma.aiAnalysis.findMany({
      where: {
        legislativeItemId: itemId,
        analysisType: ANALYSIS_TYPE,
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
  // Regenerate an existing analysis
  // ---------------------------------------------------------------------------

  async regenerateSummary(analysisId: string, requestedById: string) {
    const existing = await this.prisma.aiAnalysis.findUnique({
      where: { id: analysisId },
      include: {
        legislativeItem: {
          select: {
            id: true,
            title: true,
            type: true,
            description: true,
            objective: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`AI analysis ${analysisId} not found`);
    }

    if (existing.analysisType !== ANALYSIS_TYPE) {
      throw new BadRequestException('This analysis is not a summarization analysis');
    }

    // Determine summaryType from the stored result
    const storedResult = existing.result as SummaryResult | null;
    const summaryType: SummaryType = storedResult?.summaryType ?? 'EXECUTIVE';

    return this.summarizeLegislativeItem(
      existing.legislativeItemId,
      summaryType,
      existing.provider,
      requestedById,
    );
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private buildPromptPair(
    summaryType: SummaryType,
    item: {
      title: string;
      type: string;
      description?: string | null;
      objective?: string | null;
    },
  ) {
    const normalized = {
      title: item.title,
      type: item.type,
      description: item.description ?? undefined,
      objective: item.objective ?? undefined,
    };

    switch (summaryType) {
      case 'EXECUTIVE':
        return buildExecutiveSummaryPrompt(normalized);
      case 'CITIZEN':
        return buildCitizenSummaryPrompt(normalized);
      case 'LEGAL_OFFICER':
        return buildLegalOfficerSummaryPrompt(normalized);
      case 'AMENDMENT':
        return buildAmendmentSummaryPrompt({
          title: normalized.title,
          description: normalized.description ?? '',
          reason: normalized.objective ?? '',
          articleReference: undefined,
        });
      case 'BILL':
        return buildBillSummaryPrompt(normalized);
      default:
        return buildExecutiveSummaryPrompt(normalized);
    }
  }
}
