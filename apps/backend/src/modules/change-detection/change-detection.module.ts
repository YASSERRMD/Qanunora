import { Module } from '@nestjs/common';
import { ChangeDetectionService } from './change-detection.service';
import { ChangeDetectionController } from './change-detection.controller';

@Module({
  controllers: [ChangeDetectionController],
  providers: [ChangeDetectionService],
  exports: [ChangeDetectionService],
})
export class ChangeDetectionModule {}
