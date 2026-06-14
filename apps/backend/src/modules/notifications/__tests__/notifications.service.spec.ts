import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotificationsService } from '../notifications.service';
import { PrismaService } from '../../database/prisma.service';
import { NotificationType } from '@prisma/client';

const USER_A = 'user-a-uuid';
const USER_B = 'user-b-uuid';
const NOTIF_ID = 'notif-uuid-1';

const MOCK_NOTIFICATION = {
  id: NOTIF_ID,
  userId: USER_A,
  type: NotificationType.SYSTEM,
  title: 'Test Notification',
  body: 'Test body',
  isRead: false,
  entityType: null,
  entityId: null,
  metadata: null,
  createdAt: new Date(),
};

function makeMockPrisma() {
  return {
    notification: {
      create: jest.fn().mockResolvedValue(MOCK_NOTIFICATION),
      findMany: jest.fn().mockResolvedValue([MOCK_NOTIFICATION]),
      findUnique: jest.fn().mockResolvedValue(MOCK_NOTIFICATION),
      update: jest.fn().mockResolvedValue({ ...MOCK_NOTIFICATION, isRead: true }),
      updateMany: jest.fn().mockResolvedValue({ count: 3 }),
      delete: jest.fn().mockResolvedValue(MOCK_NOTIFICATION),
      count: jest.fn().mockResolvedValue(2),
      createMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
  };
}

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;

  beforeEach(async () => {
    mockPrisma = makeMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('create', () => {
    it('creates a notification with required fields', async () => {
      const result = await service.create(
        USER_A,
        NotificationType.SYSTEM,
        'Test title',
        'Test body',
      );
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: USER_A,
            type: NotificationType.SYSTEM,
            title: 'Test title',
            body: 'Test body',
            isRead: false,
          }),
        }),
      );
      expect(result.id).toBe(NOTIF_ID);
    });

    it('creates a notification with entity metadata', async () => {
      await service.create(
        USER_A,
        NotificationType.WORKFLOW_TRANSITION,
        'Item transitioned',
        'Item moved to review',
        'LegislativeItem',
        'item-uuid',
      );
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: 'LegislativeItem',
            entityId: 'item-uuid',
          }),
        }),
      );
    });
  });

  describe('markAsRead', () => {
    it('marks a notification as read when user owns it', async () => {
      const result = await service.markAsRead(NOTIF_ID, USER_A);
      expect(mockPrisma.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: NOTIF_ID },
          data: { isRead: true },
        }),
      );
      expect(result.isRead).toBe(true);
    });

    it('throws ForbiddenException when user does not own the notification', async () => {
      // findUnique returns a notification owned by USER_A
      mockPrisma.notification.findUnique.mockResolvedValue({
        ...MOCK_NOTIFICATION,
        userId: USER_A,
      });

      await expect(service.markAsRead(NOTIF_ID, USER_B)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when notification does not exist', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);
      await expect(service.markAsRead('nonexistent', USER_A)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUnreadCount', () => {
    it('returns the unread count for a user', async () => {
      mockPrisma.notification.count.mockResolvedValue(5);
      const result = await service.getUnreadCount(USER_A);
      expect(result).toEqual({ count: 5 });
      expect(mockPrisma.notification.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER_A, isRead: false },
        }),
      );
    });

    it('returns zero when user has no unread notifications', async () => {
      mockPrisma.notification.count.mockResolvedValue(0);
      const result = await service.getUnreadCount(USER_A);
      expect(result).toEqual({ count: 0 });
    });
  });

  describe('findAll', () => {
    it('returns all notifications for a user ordered by createdAt desc', async () => {
      const result = await service.findAll(USER_A);
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER_A },
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(Array.isArray(result)).toBe(true);
    });

    it('filters to unread only when onlyUnread is true', async () => {
      await service.findAll(USER_A, true);
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER_A, isRead: false },
        }),
      );
    });
  });

  describe('markAllAsRead', () => {
    it('marks all unread notifications as read and returns count', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 3 });
      const result = await service.markAllAsRead(USER_A);
      expect(result).toEqual({ updated: 3 });
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER_A, isRead: false },
          data: { isRead: true },
        }),
      );
    });
  });
});
