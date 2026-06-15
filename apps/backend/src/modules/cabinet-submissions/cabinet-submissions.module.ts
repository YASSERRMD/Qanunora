import { Module } from '@nestjs/common';
import { CabinetSubmissionsService } from './cabinet-submissions.service';
import { CabinetSubmissionsController } from './cabinet-submissions.controller';

@Module({
  controllers: [CabinetSubmissionsController],
  providers: [CabinetSubmissionsService],
  exports: [CabinetSubmissionsService],
})
export class CabinetSubmissionsModule {}
