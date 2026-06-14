import { Module } from '@nestjs/common';
import { LegalStructureService } from './legal-structure.service';
import { LegalStructureController } from './legal-structure.controller';

@Module({
  controllers: [LegalStructureController],
  providers: [LegalStructureService],
  exports: [LegalStructureService],
})
export class LegalStructureModule {}
