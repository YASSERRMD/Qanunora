import {
  Controller,
  Get,
  Patch,
  Delete,
  Post,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { ReminderService } from './reminder.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly reminderService: ReminderService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all notifications for current user' })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  findAll(
    @CurrentUser() user: { id: string },
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    const onlyUnread = unreadOnly === 'true';
    return this.notificationsService.findAll(user.id, onlyUnread);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count for current user' })
  getUnreadCount(@CurrentUser() user: { id: string }) {
    return this.notificationsService.getUnreadCount(user.id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read for current user' })
  markAllAsRead(@CurrentUser() user: { id: string }) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a single notification as read' })
  markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.notificationsService.markAsRead(id, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.notificationsService.delete(id, user.id);
  }

  @Post('check-reminders')
  @ApiOperation({ summary: 'Manually trigger reminder checks (SUPER_ADMIN only)' })
  @Roles(UserRole.SUPER_ADMIN)
  checkReminders() {
    return this.reminderService.scheduleReminders();
  }
}
