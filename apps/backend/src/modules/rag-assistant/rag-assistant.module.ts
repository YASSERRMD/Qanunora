import { Module } from '@nestjs/common';
import { RagChatService } from './rag-chat.service';
import { RagAssistantController } from './rag-assistant.controller';
import { RetrievalService } from './retrieval.service';
import { CitationService } from './citation.service';
import { SemanticSearchModule } from '../semantic-search/semantic-search.module';

@Module({
  imports: [SemanticSearchModule],
  controllers: [RagAssistantController],
  providers: [RagChatService, RetrievalService, CitationService],
  exports: [RagChatService],
})
export class RagAssistantModule {}
