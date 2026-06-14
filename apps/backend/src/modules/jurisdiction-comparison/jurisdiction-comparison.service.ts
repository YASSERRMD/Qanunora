import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AiProviderFactory } from '../ai-providers/ai-provider.factory';
import { parseJsonResponse } from '../ai-providers/helpers/json-output.helper';
import { ComparisonResult, DEFAULT_JURISDICTION_DISCLAIMER } from './comparison-result.schema';
import { JURISDICTION_PROFILES } from './data/jurisdiction-profiles';
import { buildJurisdictionComparisonPrompt } from './prompts/jurisdiction.prompts';

const ANALYSIS_TYPE = 'JURISDICTION_COMPARISON';

@Injectable()
export class JurisdictionComparisonService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProviderFactory: AiProviderFactory,
  ) {}

  // ---------------------------------------------------------------------------
  // Run comparison for one target jurisdiction
  // ---------------------------------------------------------------------------

  async compare(
    itemId: string,
    targetJurisdiction: string,
    referenceContext: string | undefined,
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

    const { system, user } = buildJurisdictionComparisonPrompt(item, targetJurisdiction, referenceContext);
    const promptText = `SYSTEM:\n${system}\n\nUSER:\n${user}`;

    const provider = this.aiProviderFactory.getProvider(providerName);
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

    let parsed: ComparisonResult;
    try {
      parsed = parseJsonResponse<ComparisonResult>(completion.content);
    } catch {
      throw new BadRequestException(
        'AI provider returned invalid JSON for jurisdiction comparison. Please retry.',
      );
    }

    parsed.disclaimer = parsed.disclaimer || DEFAULT_JURISDICTION_DISCLAIMER;

    const analysis = await this.prisma.aiAnalysis.create({
      data: {
        legislativeItemId: itemId,
        requestedById,
        analysisType: ANALYSIS_TYPE,
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

    return analysis;
  }

  // ---------------------------------------------------------------------------
  // Get all jurisdiction comparisons for an item
  // ---------------------------------------------------------------------------

  async getComparisons(itemId: string) {
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
  // Return available jurisdiction profiles
  // ---------------------------------------------------------------------------

  getJurisdictions() {
    return JURISDICTION_PROFILES;
  }
}
