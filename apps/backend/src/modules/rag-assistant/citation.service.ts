import { Injectable } from '@nestjs/common';
import { RetrievedChunk } from './retrieval.service';

export interface Citation {
  source: string;
  itemId: string;
  itemTitle: string;
  chunkText: string;
}

@Injectable()
export class CitationService {
  buildCitations(chunks: RetrievedChunk[]): Citation[] {
    const seen = new Set<string>();
    return chunks
      .filter((chunk) => {
        const itemId = String(chunk.metadata.itemId ?? '');
        if (!itemId || seen.has(itemId)) return false;
        seen.add(itemId);
        return true;
      })
      .map((chunk) => ({
        source: String(chunk.metadata.referenceNumber ?? chunk.metadata.itemId ?? chunk.id),
        itemId: String(chunk.metadata.itemId ?? ''),
        itemTitle: String(chunk.metadata.itemTitle ?? 'Unknown'),
        chunkText: chunk.text.slice(0, 300),
      }));
  }
}
