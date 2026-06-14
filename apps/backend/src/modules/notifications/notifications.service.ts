import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    entityType?: string,
    entityId?: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        entityType,
        entityId,
        metadata: metadata ?? undefined,
        isRead: false,
      },
    });
  }

  async findAll(userId: string, onlyUnread = false) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(onlyUnread ? { isRead: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification) throw new NotFoundException(`Notification ${id} not found`);
    return notification;
  }

  async markAsRead(id: string, userId: string) {
    const notification = await this.findById(id);
    if (notification.userId !== userId) {
      throw new ForbiddenException('Cannot mark another user\'s notification as read');
    }
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { updated: result.count };
  }

  async delete(id: string, userId: string) {
    const notification = await this.findById(id);
    if (notification.userId !== userId) {
      throw new ForbiddenException('Cannot delete another user\'s notification');
    }
    await this.prisma.notification.delete({ where: { id } });
    return { deleted: true };
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  async createBulk(
    userIds: string[],
    type: NotificationType,
    title: string,
    body: string,
    entityType?: string,
    entityId?: string,
  ) {
    const data = userIds.map((userId) => ({
      userId,
      type,
      title,
      body,
      isRead: false,
      entityType,
      entityId,
    }));
    const result = await this.prisma.notification.createMany({ data });
    return { created: result.count };
  }
}
