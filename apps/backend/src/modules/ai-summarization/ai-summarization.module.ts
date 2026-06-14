import { Module } from '@nestjs/common';
import { AiSummarizationService } from './ai-summarization.service';
import { AiSummarizationController } from './ai-summarization.controller';

@Module({
  controllers: [AiSummarizationController],
  providers: [AiSummarizationService],
  exports: [AiSummarizationService],
})
export class AiSummarizationModule {}
