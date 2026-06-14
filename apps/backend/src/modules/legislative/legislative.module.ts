import { Module } from '@nestjs/common';
import { LegislativeService } from './legislative.service';
import { LegislativeController } from './legislative.controller';

@Module({
  controllers: [LegislativeController],
  providers: [LegislativeService],
  exports: [LegislativeService],
})
export class LegislativeModule {}
