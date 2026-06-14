import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AiProviderFactory } from '../ai-providers/ai-provider.factory';
import { parseJsonResponse } from '../ai-providers/helpers/json-output.helper';
import {
  RegulationDetectionResult,
  DependencyGraph,
  DependencyNode,
  DependencyEdge,
} from './interfaces/regulatory-dependency.interface';
import {
  buildRegulationDetectionPrompt,
  buildConflictDetectionPrompt,
} from './prompts/regulatory.prompts';

export interface CreateReferenceDto {
  referenceType: string;
  referenceName: string;
  referenceNumber?: string;
  jurisdiction?: string;
  description?: string;
  isConflicting?: boolean;
}

@Injectable()
export class RegulatoryMappingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProviderFactory: AiProviderFactory,
  ) {}

  // ---------------------------------------------------------------------------
  // AI Detection
  // ---------------------------------------------------------------------------

  async detectAffectedRegulations(
    itemId: string,
    existingLaws: string[],
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

    const { system, user } = buildRegulationDetectionPrompt(item, existingLaws);
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

    let parsed: RegulationDetectionResult;
    try {
      parsed = parseJsonResponse<RegulationDetectionResult>(completion.content);
    } catch {
      throw new BadRequestException(
        'AI provider returned invalid JSON for regulatory detection. Please retry.',
      );
    }

    // Save each detected law as a RegulatoryReference
    const savedRefs = await Promise.all(
      (parsed.affectedLaws ?? []).map((law) =>
        this.prisma.regulatoryReference.create({
          data: {
            legislativeItemId: itemId,
            referenceType: law.dependencyType,
            referenceName: law.name,
            referenceNumber: law.referenceNumber ?? null,
            jurisdiction: law.jurisdiction ?? null,
            description: law.description ?? null,
            isConflicting: law.isConflicting ?? false,
          },
        }),
      ),
    );

    // Save AI analysis record
    await this.prisma.aiAnalysis.create({
      data: {
        legislativeItemId: itemId,
        requestedById,
        analysisType: 'REGULATORY_MAPPING',
        provider: provider.name,
        model: completion.model,
        prompt: promptText,
        result: parsed as object,
        confidenceScore: null,
        processingTimeMs,
        isAiGenerated: true,
        reviewedByHuman: false,
        disclaimer:
          'Regulatory mapping is AI-generated. Human legal review is required before formal use.',
      },
    });

    return savedRefs;
  }

  // ---------------------------------------------------------------------------
  // Conflict Detection
  // ---------------------------------------------------------------------------

  async detectConflict(
    itemId: string,
    reference: { name: string; description?: string },
    providerName: string | undefined,
  ) {
    const item = await this.prisma.legislativeItem.findUnique({
      where: { id: itemId },
      select: { id: true, title: true, type: true, description: true, objective: true },
    });

    if (!item) throw new NotFoundException(`Legislative item ${itemId} not found`);

    const { system, user } = buildConflictDetectionPrompt(item, reference);
    const provider = this.aiProviderFactory.getProvider(providerName);

    const completion = await provider.complete({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.3,
      maxTokens: 1024,
    });

    try {
      return parseJsonResponse<unknown>(completion.content);
    } catch {
      throw new BadRequestException('AI returned invalid JSON for conflict detection.');
    }
  }

  // ---------------------------------------------------------------------------
  // Manual CRUD
  // ---------------------------------------------------------------------------

  async createReference(itemId: string, dto: CreateReferenceDto) {
    const item = await this.prisma.legislativeItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException(`Legislative item ${itemId} not found`);

    return this.prisma.regulatoryReference.create({
      data: {
        legislativeItemId: itemId,
        referenceType: dto.referenceType,
        referenceName: dto.referenceName,
        referenceNumber: dto.referenceNumber ?? null,
        jurisdiction: dto.jurisdiction ?? null,
        description: dto.description ?? null,
        isConflicting: dto.isConflicting ?? false,
      },
    });
  }

  async findAll(itemId: string) {
    return this.prisma.regulatoryReference.findMany({
      where: { legislativeItemId: itemId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const ref = await this.prisma.regulatoryReference.findUnique({ where: { id } });
    if (!ref) throw new NotFoundException(`Regulatory reference ${id} not found`);
    return ref;
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.regulatoryReference.delete({ where: { id } });
  }

  // ---------------------------------------------------------------------------
  // Dependency Graph
  // ---------------------------------------------------------------------------

  async getDependencyGraph(itemId: string): Promise<DependencyGraph> {
    const item = await this.prisma.legislativeItem.findUnique({
      where: { id: itemId },
      select: { id: true, title: true },
    });

    if (!item) throw new NotFoundException(`Legislative item ${itemId} not found`);

    const refs = await this.prisma.regulatoryReference.findMany({
      where: { legislativeItemId: itemId },
    });

    const nodes: DependencyNode[] = [
      { id: item.id, label: item.title, type: 'ITEM' },
    ];

    const edges: DependencyEdge[] = [];

    for (const ref of refs) {
      nodes.push({ id: ref.id, label: ref.referenceName, type: 'REFERENCE' });
      edges.push({ from: item.id, to: ref.id, label: ref.referenceType });
    }

    return { nodes, edges };
  }
}
