import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AiProviderFactory } from '../ai-providers/ai-provider.factory';
import { parseJsonResponse } from '../ai-providers/helpers/json-output.helper';
import {
  SemanticDiffResult,
  DEFAULT_CHANGE_DISCLAIMER,
} from './semantic-diff.schema';
import {
  buildSemanticDiffPrompt,
  buildRiskChangePrompt,
} from './prompts/change-detection.prompts';

const CHANGE_DETECTION_TYPE = 'CHANGE_DETECTION';
const RISK_CHANGE_TYPE = 'RISK_CHANGE_DETECTION';

@Injectable()
export class ChangeDetectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProviderFactory: AiProviderFactory,
  ) {}

  // ---------------------------------------------------------------------------
  // Detect semantic changes between two versions
  // ---------------------------------------------------------------------------

  async detectChanges(
    versionId1: string,
    versionId2: string,
    providerName: string | undefined,
    requestedById: string,
  ) {
    const [v1, v2] = await this.fetchVersions(versionId1, versionId2);

    const v1Content = JSON.stringify(v1.contentSnapshot ?? {}, null, 2);
    const v2Content = JSON.stringify(v2.contentSnapshot ?? {}, null, 2);

    const { system, user } = buildSemanticDiffPrompt(v1Content, v2Content);

    return this.runAnalysis(
      v1.legislativeItemId,
      CHANGE_DETECTION_TYPE,
      system,
      user,
      providerName,
      requestedById,
    );
  }

  // ---------------------------------------------------------------------------
  // Detect risk-introducing changes between two versions
  // ---------------------------------------------------------------------------

  async detectRiskChanges(
    versionId1: string,
    versionId2: string,
    providerName: string | undefined,
    requestedById: string,
  ) {
    const [v1, v2] = await this.fetchVersions(versionId1, versionId2);

    const v1Content = JSON.stringify(v1.contentSnapshot ?? {}, null, 2);
    const v2Content = JSON.stringify(v2.contentSnapshot ?? {}, null, 2);

    const { system, user } = buildRiskChangePrompt(v1Content, v2Content);

    return this.runAnalysis(
      v1.legislativeItemId,
      RISK_CHANGE_TYPE,
      system,
      user,
      providerName,
      requestedById,
    );
  }

  // ---------------------------------------------------------------------------
  // Get history of change detection analyses for an item
  // ---------------------------------------------------------------------------

  async getChangeDetectionHistory(legislativeItemId: string) {
    const item = await this.prisma.legislativeItem.findUnique({
      where: { id: legislativeItemId },
    });
    if (!item) throw new NotFoundException(`Legislative item ${legislativeItemId} not found`);

    return this.prisma.aiAnalysis.findMany({
      where: {
        legislativeItemId,
        OR: [
          { analysisType: { startsWith: CHANGE_DETECTION_TYPE } },
          { analysisType: { startsWith: RISK_CHANGE_TYPE } },
        ],
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
  // Private helpers
  // ---------------------------------------------------------------------------

  private async fetchVersions(id1: string, id2: string) {
    const [v1, v2] = await Promise.all([
      this.prisma.version.findUnique({
        where: { id: id1 },
        include: { legislativeItem: { select: { id: true } } },
      }),
      this.prisma.version.findUnique({
        where: { id: id2 },
        include: { legislativeItem: { select: { id: true } } },
      }),
    ]);

    if (!v1) throw new NotFoundException(`Version ${id1} not found`);
    if (!v2) throw new NotFoundException(`Version ${id2} not found`);

    return [v1, v2] as const;
  }

  private async runAnalysis(
    legislativeItemId: string,
    analysisType: string,
    system: string,
    user: string,
    providerName: string | undefined,
    requestedById: string,
  ) {
    const provider = this.aiProviderFactory.getProvider(providerName);
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

    let parsed: SemanticDiffResult;
    try {
      parsed = parseJsonResponse<SemanticDiffResult>(completion.content);
    } catch {
      throw new BadRequestException(
        'AI provider returned invalid JSON for change detection. Please retry.',
      );
    }

    parsed.disclaimer = parsed.disclaimer || DEFAULT_CHANGE_DISCLAIMER;

    return this.prisma.aiAnalysis.create({
      data: {
        legislativeItemId,
        requestedById,
        analysisType,
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
  }
}
