import { Injectable } from '@nestjs/common';

export interface VectorEntry {
  id: string;
  text: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

export interface SearchResult {
  id: string;
  text: string;
  score: number;
  metadata: Record<string, unknown>;
}

@Injectable()
export class VectorStoreService {
  private vectors: Map<string, VectorEntry> = new Map();

  async add(
    id: string,
    text: string,
    embedding: number[],
    metadata: Record<string, unknown>,
  ): Promise<void> {
    this.vectors.set(id, { id, text, embedding, metadata });
  }

  async search(queryEmbedding: number[], topK = 10): Promise<SearchResult[]> {
    if (this.vectors.size === 0) {
      return [];
    }

    const results: SearchResult[] = [];

    for (const entry of this.vectors.values()) {
      const score = this.cosineSimilarity(queryEmbedding, entry.embedding);
      results.push({ id: entry.id, text: entry.text, score, metadata: entry.metadata });
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async delete(id: string): Promise<void> {
    this.vectors.delete(id);
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    for (const key of this.vectors.keys()) {
      if (key.startsWith(prefix)) {
        this.vectors.delete(key);
      }
    }
  }

  size(): number {
    return this.vectors.size;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    if (denom === 0) return 0;
    return dot / denom;
  }
}
