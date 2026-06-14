import { Module } from '@nestjs/common';
import { JurisdictionComparisonService } from './jurisdiction-comparison.service';
import { JurisdictionComparisonController } from './jurisdiction-comparison.controller';

@Module({
  controllers: [JurisdictionComparisonController],
  providers: [JurisdictionComparisonService],
  exports: [JurisdictionComparisonService],
})
export class JurisdictionComparisonModule {}
