import { Module } from '@nestjs/common';
import { LegalOpinionsService } from './legal-opinions.service';
import { LegalOpinionsController } from './legal-opinions.controller';

@Module({
  controllers: [LegalOpinionsController],
  providers: [LegalOpinionsService],
  exports: [LegalOpinionsService],
})
export class LegalOpinionsModule {}
