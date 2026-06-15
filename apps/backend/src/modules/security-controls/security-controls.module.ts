import { Module } from '@nestjs/common';
import { SecurityControlsService } from './security-controls.service';
import { SecurityControlsController } from './security-controls.controller';

@Module({
  controllers: [SecurityControlsController],
  providers: [SecurityControlsService],
  exports: [SecurityControlsService],
})
export class SecurityControlsModule {}
