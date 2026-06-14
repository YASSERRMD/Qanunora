import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { VectorStoreService } from './vector-store.service';
import { OpenAiEmbeddingProvider } from './providers/openai-embedding.provider';

export interface SearchFilters {
  type?: string;
  status?: string;
  ministryId?: string;
}

export interface SearchResultItem {
  itemId: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  referenceNumber?: string;
  score: number;
  source: 'keyword' | 'semantic' | 'hybrid';
}

@Injectable()
export class SemanticSearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vectorStore: VectorStoreService,
    private readonly embeddingProvider: OpenAiEmbeddingProvider,
  ) {}

  // ---------------------------------------------------------------------------
  // Pure semantic search
  // ---------------------------------------------------------------------------

  async semanticSearch(query: string, topK = 10): Promise<SearchResultItem[]> {
    const queryEmbedding = await this.embeddingProvider.embed(query);
    const vectorResults = await this.vectorStore.search(queryEmbedding, topK * 3);

    // Deduplicate by itemId, keep max score
    const byItem = new Map<string, number>();
    for (const r of vectorResults) {
      const itemId = r.metadata.itemId as string;
      const current = byItem.get(itemId) ?? -1;
      if (r.score > current) byItem.set(itemId, r.score);
    }

    if (byItem.size === 0) return [];

    // Fetch items from DB
    const items = await this.prisma.legislativeItem.findMany({
      where: { id: { in: Array.from(byItem.keys()) } },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        status: true,
        referenceNumber: true,
      },
    });

    return items
      .map((item) => ({
        itemId: item.id,
        title: item.title,
        description: item.description ?? undefined,
        type: item.type,
        status: item.status,
        referenceNumber: item.referenceNumber ?? undefined,
        score: byItem.get(item.id) ?? 0,
        source: 'semantic' as const,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  // ---------------------------------------------------------------------------
  // Hybrid keyword + semantic search
  // ---------------------------------------------------------------------------

  async hybridSearch(
    query: string,
    filters?: SearchFilters,
    topK = 10,
  ): Promise<SearchResultItem[]> {
    const where: Record<string, unknown> = {
      ...(filters?.type ? { type: filters.type } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.ministryId ? { ministryId: filters.ministryId } : {}),
    };

    // 1. Keyword search
    const keywordWhere = {
      ...where,
      OR: [
        { title: { contains: query, mode: 'insensitive' as const } },
        { description: { contains: query, mode: 'insensitive' as const } },
      ],
    };

    const keywordResults = await this.prisma.legislativeItem.findMany({
      where: keywordWhere,
      take: topK * 2,
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        status: true,
        referenceNumber: true,
      },
    });

    // 2. Semantic search
    let semanticResults: SearchResultItem[] = [];
    try {
      const allSemantic = await this.semanticSearch(query, topK * 2);
      // Apply filters to semantic results
      semanticResults = allSemantic.filter((r) => {
        if (filters?.type && r.type !== filters.type) return false;
        if (filters?.status && r.status !== filters.status) return false;
        return true;
      });
    } catch {
      // Fall back to empty if semantic unavailable
    }

    // 3. Merge: items in both sets get score boost
    const scoreMap = new Map<string, { item: SearchResultItem; boostCount: number }>();

    for (const item of keywordResults) {
      scoreMap.set(item.id, {
        item: {
          itemId: item.id,
          title: item.title,
          description: item.description ?? undefined,
          type: item.type,
          status: item.status,
          referenceNumber: item.referenceNumber ?? undefined,
          score: 0.5,
          source: 'keyword',
        },
        boostCount: 1,
      });
    }

    for (const sem of semanticResults) {
      if (scoreMap.has(sem.itemId)) {
        const existing = scoreMap.get(sem.itemId)!;
        existing.item.score = Math.max(existing.item.score, sem.score) + 0.2; // boost
        existing.item.source = 'hybrid';
        existing.boostCount += 1;
      } else {
        scoreMap.set(sem.itemId, { item: sem, boostCount: 1 });
      }
    }

    return Array.from(scoreMap.values())
      .sort((a, b) => b.item.score - a.item.score)
      .map(({ item }) => item)
      .slice(0, topK);
  }
}
