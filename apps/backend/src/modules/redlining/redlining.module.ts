import { Module } from '@nestjs/common';
import { RedliningService } from './redlining.service';
import { RedliningController } from './redlining.controller';

@Module({
  controllers: [RedliningController],
  providers: [RedliningService],
  exports: [RedliningService],
})
export class RedliningModule {}
