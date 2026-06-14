import { Module } from '@nestjs/common';
import { AiImpactService } from './ai-impact.service';
import { AiImpactController } from './ai-impact.controller';

@Module({
  controllers: [AiImpactController],
  providers: [AiImpactService],
  exports: [AiImpactService],
})
export class AiImpactModule {}
