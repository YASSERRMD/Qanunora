import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ChunkingService } from './chunking.service';
import { VectorStoreService } from './vector-store.service';
import { OpenAiEmbeddingProvider } from './providers/openai-embedding.provider';

@Injectable()
export class IndexingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chunking: ChunkingService,
    private readonly vectorStore: VectorStoreService,
    private readonly embeddingProvider: OpenAiEmbeddingProvider,
  ) {}

  // ---------------------------------------------------------------------------
  // Index a single legislative item
  // ---------------------------------------------------------------------------

  async indexLegislativeItem(itemId: string): Promise<{ chunks: number }> {
    const item = await this.prisma.legislativeItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        title: true,
        description: true,
        objective: true,
        type: true,
        status: true,
        referenceNumber: true,
      },
    });

    if (!item) {
      return { chunks: 0 };
    }

    // Combine text fields for embedding
    const fullText = [item.title, item.description, item.objective]
      .filter(Boolean)
      .join('\n\n');

    const chunks = this.chunking.chunkText(fullText);

    // Remove old chunks for this item
    await this.vectorStore.deleteByPrefix(`${itemId}:`);

    // Embed and store each chunk
    const embeddings = await this.embeddingProvider.embedBatch(chunks);

    for (let i = 0; i < chunks.length; i++) {
      const chunkId = `${itemId}:chunk-${i}`;
      await this.vectorStore.add(chunkId, chunks[i], embeddings[i], {
        itemId: item.id,
        chunkIndex: i,
        itemTitle: item.title,
        itemType: item.type,
        itemStatus: item.status,
        referenceNumber: item.referenceNumber,
      });
    }

    return { chunks: chunks.length };
  }

  // ---------------------------------------------------------------------------
  // Index all legislative items
  // ---------------------------------------------------------------------------

  async indexAll(): Promise<{ indexed: number; totalChunks: number }> {
    const items = await this.prisma.legislativeItem.findMany({
      select: { id: true },
    });

    let totalChunks = 0;
    for (const item of items) {
      const result = await this.indexLegislativeItem(item.id);
      totalChunks += result.chunks;
    }

    return { indexed: items.length, totalChunks };
  }

  // ---------------------------------------------------------------------------
  // Remove all chunks for an item
  // ---------------------------------------------------------------------------

  async removeItem(itemId: string): Promise<void> {
    await this.vectorStore.deleteByPrefix(`${itemId}:`);
  }
}
