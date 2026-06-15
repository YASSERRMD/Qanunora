import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CalendarService } from '../calendar.service';
import { PrismaService } from '../../database/prisma.service';
import { EventType } from '@prisma/client';

const MOCK_EVENT = {
  id: 'event-uuid-1',
  title: 'Review Deadline',
  description: null,
  eventType: EventType.REVIEW_DEADLINE,
  startDate: new Date('2026-07-01'),
  endDate: null,
  allDay: false,
  legislativeItemId: null,
  assignedToId: null,
  remindAt: null,
  isCompleted: false,
  createdById: 'user-uuid-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  legislativeItem: null,
  assignedTo: null,
  createdBy: { id: 'user-uuid-1', firstName: 'Ali', lastName: 'Hassan' },
};

function makeMockPrisma() {
  return {
    calendarEvent: {
      findUnique: jest.fn().mockResolvedValue(MOCK_EVENT),
      findMany: jest.fn().mockResolvedValue([MOCK_EVENT]),
      create: jest.fn().mockResolvedValue(MOCK_EVENT),
      update: jest.fn().mockResolvedValue({ ...MOCK_EVENT, title: 'Updated' }),
      delete: jest.fn().mockResolvedValue(MOCK_EVENT),
    },
  };
}

describe('CalendarService', () => {
  let service: CalendarService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;

  beforeEach(async () => {
    mockPrisma = makeMockPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<CalendarService>(CalendarService);
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('creates a calendar event', async () => {
      const result = await service.create(
        {
          title: 'Review Deadline',
          eventType: EventType.REVIEW_DEADLINE,
          startDate: '2026-07-01',
        },
        'user-uuid-1',
      );
      expect(result).toEqual(MOCK_EVENT);
      expect(mockPrisma.calendarEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Review Deadline',
            createdById: 'user-uuid-1',
          }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------

  describe('findAll', () => {
    it('returns all events', async () => {
      const result = await service.findAll();
      expect(Array.isArray(result)).toBe(true);
      expect(mockPrisma.calendarEvent.findMany).toHaveBeenCalled();
    });

    it('applies eventType filter when provided', async () => {
      await service.findAll({ eventType: EventType.COMMITTEE_MEETING });
      expect(mockPrisma.calendarEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ eventType: EventType.COMMITTEE_MEETING }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findById
  // ---------------------------------------------------------------------------

  describe('findById', () => {
    it('returns event by id', async () => {
      const result = await service.findById('event-uuid-1');
      expect(result).toEqual(MOCK_EVENT);
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.calendarEvent.findUnique.mockResolvedValueOnce(null);
      await expect(service.findById('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  describe('update', () => {
    it('updates an event', async () => {
      const result = await service.update('event-uuid-1', { title: 'Updated' });
      expect(mockPrisma.calendarEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'event-uuid-1' } }),
      );
      expect(result.title).toBe('Updated');
    });
  });

  // ---------------------------------------------------------------------------
  // remove
  // ---------------------------------------------------------------------------

  describe('remove', () => {
    it('deletes and returns deleted: true', async () => {
      const result = await service.remove('event-uuid-1');
      expect(result).toEqual({ deleted: true });
    });
  });

  // ---------------------------------------------------------------------------
  // markCompleted
  // ---------------------------------------------------------------------------

  describe('markCompleted', () => {
    it('marks event as completed', async () => {
      await service.markCompleted('event-uuid-1');
      expect(mockPrisma.calendarEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'event-uuid-1' },
          data: { isCompleted: true },
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getUpcoming / getOverdue
  // ---------------------------------------------------------------------------

  describe('getUpcoming', () => {
    it('queries events within the next N days', async () => {
      await service.getUpcoming(7);
      expect(mockPrisma.calendarEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isCompleted: false }),
        }),
      );
    });
  });

  describe('getOverdue', () => {
    it('queries events with startDate in the past', async () => {
      await service.getOverdue();
      expect(mockPrisma.calendarEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isCompleted: false }),
        }),
      );
    });
  });
});
