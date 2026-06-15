import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from './notifications.service';
import { NotificationType, LegislativeStatus } from '@prisma/client';

// Calendar reminder payload (subset of CalendarEvent)
interface CalendarReminder {
  id: string;
  title: string;
  startDate: Date;
  remindAt: Date | null;
  assignedTo?: { id: string } | null;
  createdBy: { id: string };
}

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async checkConsultationDeadlines(): Promise<void> {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const consultations = await this.prisma.consultation.findMany({
      where: {
        status: 'OPEN',
        closeDate: {
          gte: now,
          lte: threeDaysFromNow,
        },
      },
      include: {
        legislativeItem: {
          select: {
            id: true,
            title: true,
            referenceNumber: true,
            assignedToId: true,
          },
        },
      },
    });

    for (const consultation of consultations) {
      const daysLeft = Math.ceil(
        (new Date(consultation.closeDate!).getTime() - now.getTime()) / 86400000,
      );

      const userIds: string[] = [];
      if (consultation.legislativeItem?.assignedToId) {
        userIds.push(consultation.legislativeItem.assignedToId);
      }

      if (userIds.length === 0) continue;

      await this.notificationsService.createBulk(
        userIds,
        NotificationType.CONSULTATION_DEADLINE,
        `Consultation Closing Soon`,
        `The consultation for "${consultation.legislativeItem?.title ?? 'Unknown'}" closes in ${daysLeft} day(s).`,
        'Consultation',
        consultation.id,
      );

      this.logger.log(
        `Sent CONSULTATION_DEADLINE notifications for consultation ${consultation.id} (${daysLeft} day(s) left)`,
      );
    }
  }

  async checkReviewReminders(): Promise<void> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const items = await this.prisma.legislativeItem.findMany({
      where: {
        status: {
          in: [LegislativeStatus.INTERNAL_REVIEW, LegislativeStatus.COMMITTEE_REVIEW],
        },
        assignedToId: { not: null },
        updatedAt: { lte: sevenDaysAgo },
      },
      select: {
        id: true,
        title: true,
        referenceNumber: true,
        status: true,
        assignedToId: true,
      },
    });

    const itemsWithNoRecentAction: typeof items = [];
    for (const item of items) {
      const recentAction = await this.prisma.workflowHistory.findFirst({
        where: {
          legislativeItemId: item.id,
          createdAt: { gte: sevenDaysAgo },
        },
      });
      if (!recentAction) {
        itemsWithNoRecentAction.push(item);
      }
    }

    for (const item of itemsWithNoRecentAction) {
      if (!item.assignedToId) continue;

      await this.notificationsService.create(
        item.assignedToId,
        NotificationType.REVIEW_REMINDER,
        `Review Reminder: ${item.referenceNumber ?? item.id}`,
        `"${item.title}" has been in ${item.status.replace(/_/g, ' ')} for over 7 days with no action.`,
        'LegislativeItem',
        item.id,
      );

      this.logger.log(
        `Sent REVIEW_REMINDER notification for item ${item.id} to user ${item.assignedToId}`,
      );
    }
  }

  async checkCalendarReminders(): Promise<void> {
    const dueEvents = await (this.prisma.calendarEvent.findMany({
      where: {
        remindAt: { lte: new Date() },
        isCompleted: false,
      },
      select: {
        id: true,
        title: true,
        startDate: true,
        remindAt: true,
        assignedTo: { select: { id: true } },
        createdBy: { select: { id: true } },
      },
      orderBy: { remindAt: 'asc' },
    }) as Promise<CalendarReminder[]>);

    for (const event of dueEvents) {
      const recipientIds = new Set<string>();
      if (event.assignedTo) recipientIds.add(event.assignedTo.id);
      recipientIds.add(event.createdBy.id);

      for (const userId of recipientIds) {
        await this.notificationsService.create(
          userId,
          NotificationType.REVIEW_REMINDER,
          `Deadline Reminder: ${event.title}`,
          `Event "${event.title}" is due on ${event.startDate.toLocaleDateString()}.`,
          'CalendarEvent',
          event.id,
        );
      }

      this.logger.log(`Sent calendar reminder for event ${event.id}: "${event.title}"`);
    }
  }

  async scheduleReminders(): Promise<{ consultationCount: number; reviewCount: number; calendarCount: number }> {
    this.logger.log('Running reminder checks...');
    const before = await this.getNotificationCountSnapshot();
    await this.checkConsultationDeadlines();
    await this.checkReviewReminders();
    const calendarBefore = await this.prisma.notification.count({ where: { type: NotificationType.REVIEW_REMINDER } });
    await this.checkCalendarReminders();
    const calendarAfter = await this.prisma.notification.count({ where: { type: NotificationType.REVIEW_REMINDER } });
    const after = await this.getNotificationCountSnapshot();
    return {
      consultationCount: Math.max(0, after.consultation - before.consultation),
      reviewCount: Math.max(0, after.review - before.review),
      calendarCount: Math.max(0, calendarAfter - calendarBefore),
    };
  }

  private async getNotificationCountSnapshot() {
    const [consultation, review] = await Promise.all([
      this.prisma.notification.count({ where: { type: NotificationType.CONSULTATION_DEADLINE } }),
      this.prisma.notification.count({ where: { type: NotificationType.REVIEW_REMINDER } }),
    ]);
    return { consultation, review };
  }
}
