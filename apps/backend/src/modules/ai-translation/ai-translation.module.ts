import { Module } from '@nestjs/common';
import { AiTranslationService } from './ai-translation.service';
import { AiTranslationController } from './ai-translation.controller';

@Module({
  controllers: [AiTranslationController],
  providers: [AiTranslationService],
  exports: [AiTranslationService],
})
export class AiTranslationModule {}
