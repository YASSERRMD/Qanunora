import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { ReminderService } from './reminder.service';
import { ConsoleEmailAdapter } from './adapters/email.adapter';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsGateway,
    ReminderService,
    ConsoleEmailAdapter,
  ],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
