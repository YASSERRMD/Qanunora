import { Injectable } from '@nestjs/common';

@Injectable()
export class ChunkingService {
  /**
   * Split text into overlapping chunks for embedding.
   * @param text - Input text to chunk
   * @param chunkSize - Approximate size of each chunk in characters
   * @param overlap - Number of characters to overlap between chunks
   */
  chunkText(text: string, chunkSize = 512, overlap = 64): string[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const cleaned = text.trim();
    if (cleaned.length <= chunkSize) {
      return [cleaned];
    }

    const chunks: string[] = [];
    let start = 0;

    while (start < cleaned.length) {
      const end = Math.min(start + chunkSize, cleaned.length);
      const chunk = cleaned.slice(start, end).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }
      if (end >= cleaned.length) break;
      start = end - overlap;
    }

    return chunks;
  }
}
