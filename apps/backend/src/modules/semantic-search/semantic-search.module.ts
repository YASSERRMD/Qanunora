import { Module } from '@nestjs/common';
import { SemanticSearchService } from './semantic-search.service';
import { SemanticSearchController } from './semantic-search.controller';
import { IndexingService } from './indexing.service';
import { ChunkingService } from './chunking.service';
import { VectorStoreService } from './vector-store.service';
import { OpenAiEmbeddingProvider } from './providers/openai-embedding.provider';

@Module({
  controllers: [SemanticSearchController],
  providers: [
    SemanticSearchService,
    IndexingService,
    ChunkingService,
    VectorStoreService,
    OpenAiEmbeddingProvider,
  ],
  exports: [SemanticSearchService, IndexingService, VectorStoreService],
})
export class SemanticSearchModule {}
