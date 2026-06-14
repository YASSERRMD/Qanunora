import { Module } from '@nestjs/common';
import { AmendmentsService } from './amendments.service';
import { AmendmentsController } from './amendments.controller';

@Module({
  controllers: [AmendmentsController],
  providers: [AmendmentsService],
  exports: [AmendmentsService],
})
export class AmendmentsModule {}
