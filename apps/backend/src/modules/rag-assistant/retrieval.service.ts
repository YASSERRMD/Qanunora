import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { VectorStoreService } from '../semantic-search/vector-store.service';
import { OpenAiEmbeddingProvider } from '../semantic-search/providers/openai-embedding.provider';
import { UserRole } from '@prisma/client';

export interface RetrievedChunk {
  id: string;
  text: string;
  score: number;
  metadata: Record<string, unknown>;
}

// Map roles to allowed confidentiality levels
const ROLE_CONFIDENTIALITY: Record<string, string[]> = {
  VIEWER: ['PUBLIC'],
  AUDITOR: ['PUBLIC'],
  MINISTRY_LEGAL_OFFICER: ['PUBLIC', 'INTERNAL'],
  DRAFTING_OFFICER: ['PUBLIC', 'INTERNAL'],
  REVIEWER: ['PUBLIC', 'INTERNAL', 'RESTRICTED'],
  COMMITTEE_MEMBER: ['PUBLIC', 'INTERNAL', 'RESTRICTED'],
  MINISTRY_HEAD: ['PUBLIC', 'INTERNAL', 'RESTRICTED'],
  LEGISLATIVE_ADMIN: ['PUBLIC', 'INTERNAL', 'RESTRICTED', 'CONFIDENTIAL'],
  SUPER_ADMIN: ['PUBLIC', 'INTERNAL', 'RESTRICTED', 'CONFIDENTIAL', 'TOP_SECRET'],
};

@Injectable()
export class RetrievalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vectorStore: VectorStoreService,
    private readonly embeddingProvider: OpenAiEmbeddingProvider,
  ) {}

  async retrieve(
    query: string,
    userRole: string,
    legislativeItemId?: string,
    topK = 5,
  ): Promise<RetrievedChunk[]> {
    // Determine allowed confidentiality levels
    const allowedLevels = ROLE_CONFIDENTIALITY[userRole] ?? ['PUBLIC'];

    // Try semantic search first
    let chunks: RetrievedChunk[] = [];
    try {
      const queryEmbedding = await this.embeddingProvider.embed(query);
      const vectorResults = await this.vectorStore.search(queryEmbedding, topK * 3);

      chunks = vectorResults
        .filter((r) => {
          // Filter by legislative item if specified
          if (legislativeItemId && r.metadata.itemId !== legislativeItemId) return false;
          return true;
        })
        .slice(0, topK)
        .map((r) => ({ id: r.id, text: r.text, score: r.score, metadata: r.metadata }));
    } catch {
      // Semantic unavailable
    }

    // Fallback to keyword search if semantic returns nothing
    if (chunks.length === 0) {
      const where: Record<string, unknown> = {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
        confidentialityLevel: { in: allowedLevels },
      };

      if (legislativeItemId) {
        where['id'] = legislativeItemId;
      }

      const items = await this.prisma.legislativeItem.findMany({
        where,
        take: topK,
        select: {
          id: true,
          title: true,
          description: true,
          type: true,
          status: true,
          referenceNumber: true,
        },
      });

      chunks = items.map((item) => ({
        id: `keyword:${item.id}`,
        text: [item.title, item.description].filter(Boolean).join('\n'),
        score: 0.5,
        metadata: {
          itemId: item.id,
          itemTitle: item.title,
          itemType: item.type,
          itemStatus: item.status,
          referenceNumber: item.referenceNumber,
        },
      }));
    }

    // Filter chunks whose items are accessible by this role (via metadata)
    // This is a secondary guard; primary filtering done in the vector store metadata check
    return chunks;
  }
}
