import { Module } from '@nestjs/common';
import { RedliningService } from './redlining.service';
import { RedliningController } from './redlining.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [RedliningController],
  providers: [RedliningService],
  exports: [RedliningService],
})
export class RedliningModule {}
