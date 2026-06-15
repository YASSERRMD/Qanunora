import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { MeetingsService } from '../meetings.service';
import { PrismaService } from '../../database/prisma.service';
import { MeetingStatus, ActionItemStatus } from '@prisma/client';

const MOCK_MEETING = {
  id: 'meeting-uuid-1',
  title: 'Committee Review Q3',
  description: null,
  meetingDate: new Date('2026-08-01'),
  location: 'Room A',
  committeeId: null,
  status: MeetingStatus.SCHEDULED,
  agendaItems: [],
  minutes: null,
  decisions: [],
  actionItems: [],
  attendees: [],
  createdById: 'user-uuid-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  committee: null,
  createdBy: { id: 'user-uuid-1', firstName: 'Ali', lastName: 'Hassan' },
};

const MOCK_AGENDA_ITEM = {
  id: 'agenda-uuid-1',
  meetingId: 'meeting-uuid-1',
  title: 'Review draft legislation',
  description: null,
  order: 1,
  duration: 30,
  presenter: null,
  createdAt: new Date(),
};

const MOCK_ACTION_ITEM = {
  id: 'action-uuid-1',
  meetingId: 'meeting-uuid-1',
  description: 'Send revised draft by Friday',
  assigneeId: null,
  dueDate: null,
  status: ActionItemStatus.OPEN,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeMockPrisma() {
  return {
    meeting: {
      findUnique: jest.fn().mockResolvedValue(MOCK_MEETING),
      findMany: jest.fn().mockResolvedValue([MOCK_MEETING]),
      create: jest.fn().mockResolvedValue(MOCK_MEETING),
      update: jest.fn().mockResolvedValue({ ...MOCK_MEETING, title: 'Updated' }),
    },
    agendaItem: {
      create: jest.fn().mockResolvedValue(MOCK_AGENDA_ITEM),
      findFirst: jest.fn().mockResolvedValue(MOCK_AGENDA_ITEM),
      delete: jest.fn().mockResolvedValue(MOCK_AGENDA_ITEM),
    },
    meetingMinutes: {
      upsert: jest.fn().mockResolvedValue({
        id: 'minutes-uuid-1', meetingId: 'meeting-uuid-1',
        content: 'Meeting notes', recordedBy: 'Ali', approvedAt: null,
        createdAt: new Date(), updatedAt: new Date(),
      }),
    },
    meetingDecision: {
      create: jest.fn().mockResolvedValue({
        id: 'decision-uuid-1', meetingId: 'meeting-uuid-1',
        description: 'Approve budget', decisionRef: null, ownerId: null,
        dueDate: null, createdAt: new Date(),
      }),
    },
    actionItem: {
      create: jest.fn().mockResolvedValue(MOCK_ACTION_ITEM),
      findFirst: jest.fn().mockResolvedValue(MOCK_ACTION_ITEM),
      update: jest.fn().mockResolvedValue({ ...MOCK_ACTION_ITEM, status: ActionItemStatus.COMPLETED }),
    },
    meetingAttendee: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'att-uuid-1', meetingId: 'meeting-uuid-1', userId: 'user-uuid-1', attended: false,
        user: { id: 'user-uuid-1', firstName: 'Ali', lastName: 'Hassan' },
      }),
      update: jest.fn().mockResolvedValue({
        id: 'att-uuid-1', meetingId: 'meeting-uuid-1', userId: 'user-uuid-1', attended: true,
        user: { id: 'user-uuid-1', firstName: 'Ali', lastName: 'Hassan' },
      }),
    },
  };
}

describe('MeetingsService', () => {
  let service: MeetingsService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;

  beforeEach(async () => {
    mockPrisma = makeMockPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeetingsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<MeetingsService>(MeetingsService);
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('creates a meeting', async () => {
      const result = await service.create(
        { title: 'Q3 Review', meetingDate: '2026-08-01' },
        'user-uuid-1',
      );
      expect(result).toEqual(MOCK_MEETING);
      expect(mockPrisma.meeting.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ title: 'Q3 Review', createdById: 'user-uuid-1' }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findById
  // ---------------------------------------------------------------------------

  describe('findById', () => {
    it('returns meeting by id', async () => {
      const result = await service.findById('meeting-uuid-1');
      expect(result).toEqual(MOCK_MEETING);
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.meeting.findUnique.mockResolvedValueOnce(null);
      await expect(service.findById('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // cancel / complete
  // ---------------------------------------------------------------------------

  describe('cancel', () => {
    it('sets status to CANCELLED', async () => {
      await service.cancel('meeting-uuid-1');
      expect(mockPrisma.meeting.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: MeetingStatus.CANCELLED } }),
      );
    });
  });

  describe('complete', () => {
    it('sets status to COMPLETED', async () => {
      await service.complete('meeting-uuid-1');
      expect(mockPrisma.meeting.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: MeetingStatus.COMPLETED } }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Agenda
  // ---------------------------------------------------------------------------

  describe('addAgendaItem', () => {
    it('creates agenda item', async () => {
      const result = await service.addAgendaItem('meeting-uuid-1', {
        title: 'Review draft', order: 1,
      });
      expect(result).toEqual(MOCK_AGENDA_ITEM);
    });
  });

  describe('removeAgendaItem', () => {
    it('deletes and returns deleted: true', async () => {
      const result = await service.removeAgendaItem('meeting-uuid-1', 'agenda-uuid-1');
      expect(result).toEqual({ deleted: true });
    });

    it('throws NotFoundException when agenda item not found', async () => {
      mockPrisma.agendaItem.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.removeAgendaItem('meeting-uuid-1', 'ghost'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // Minutes
  // ---------------------------------------------------------------------------

  describe('setMinutes', () => {
    it('upserts meeting minutes', async () => {
      const result = await service.setMinutes('meeting-uuid-1', {
        content: 'Meeting notes', recordedBy: 'Ali',
      });
      expect(result.content).toBe('Meeting notes');
    });
  });

  // ---------------------------------------------------------------------------
  // Decisions
  // ---------------------------------------------------------------------------

  describe('addDecision', () => {
    it('creates a decision', async () => {
      const result = await service.addDecision('meeting-uuid-1', {
        description: 'Approve budget',
      });
      expect(result.description).toBe('Approve budget');
    });
  });

  // ---------------------------------------------------------------------------
  // Action Items
  // ---------------------------------------------------------------------------

  describe('addActionItem', () => {
    it('creates an action item', async () => {
      const result = await service.addActionItem('meeting-uuid-1', {
        description: 'Send revised draft',
      });
      expect(result).toEqual(MOCK_ACTION_ITEM);
    });
  });

  describe('updateActionItem', () => {
    it('updates action item status', async () => {
      const result = await service.updateActionItem(
        'meeting-uuid-1', 'action-uuid-1',
        { status: ActionItemStatus.COMPLETED },
      );
      expect(result.status).toBe(ActionItemStatus.COMPLETED);
    });

    it('throws NotFoundException when action item not found', async () => {
      mockPrisma.actionItem.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.updateActionItem('meeting-uuid-1', 'ghost', { status: ActionItemStatus.OPEN }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // Attendees
  // ---------------------------------------------------------------------------

  describe('addAttendee', () => {
    it('adds user as attendee', async () => {
      const result = await service.addAttendee('meeting-uuid-1', 'user-uuid-1');
      expect(result.userId).toBe('user-uuid-1');
    });

    it('throws BadRequestException when user already an attendee', async () => {
      mockPrisma.meetingAttendee.findUnique.mockResolvedValueOnce({
        id: 'att-existing', meetingId: 'meeting-uuid-1', userId: 'user-uuid-1', attended: false,
      });
      await expect(service.addAttendee('meeting-uuid-1', 'user-uuid-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('markAttendance', () => {
    it('marks attendance as true', async () => {
      const result = await service.markAttendance('meeting-uuid-1', 'user-uuid-1', true);
      expect(result.attended).toBe(true);
    });
  });
});
