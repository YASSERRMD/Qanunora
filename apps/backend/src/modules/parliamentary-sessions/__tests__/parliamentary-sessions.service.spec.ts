import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ParliamentarySessionsService } from '../parliamentary-sessions.service';
import { PrismaService } from '../../database/prisma.service';
import { SessionStatus, SessionType } from '@prisma/client';

const MOCK_SESSION = {
  id: 'session-uuid-1',
  sessionNumber: 'SESSION-2026-001',
  title: 'Regular Legislative Session Q2 2026',
  sessionType: SessionType.ORDINARY,
  startDate: new Date('2026-04-01'),
  endDate: new Date('2026-06-30'),
  status: SessionStatus.UPCOMING,
  readingStages: [],
  debates: [],
  notes: null,
  createdById: 'user-uuid-1',
  createdBy: { id: 'user-uuid-1', firstName: 'Ali', lastName: 'Hassan' },
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_READING_STAGE = {
  id: 'stage-uuid-1',
  sessionId: 'session-uuid-1',
  legislativeItemId: 'item-uuid-1',
  legislativeItem: { id: 'item-uuid-1', referenceNumber: 'LI-2026-0001', title: 'Digital Commerce Bill' },
  stageNumber: 1,
  stageName: 'First Reading',
  scheduledDate: new Date('2026-04-10'),
  completedDate: null,
  outcome: null,
  createdAt: new Date(),
};

const MOCK_DEBATE = {
  id: 'debate-uuid-1',
  sessionId: 'session-uuid-1',
  topic: 'Impact of digital commerce legislation on SMEs',
  summary: 'Extensive discussion on SME impact',
  speakerName: 'Dr. Ahmad Al-Qassim',
  position: 'FOR',
  debateDate: new Date('2026-04-15'),
  createdAt: new Date(),
};

function makeMockPrisma() {
  return {
    parliamentarySession: {
      create: jest.fn().mockResolvedValue(MOCK_SESSION),
      findMany: jest.fn().mockResolvedValue([MOCK_SESSION]),
      findUnique: jest.fn().mockResolvedValue(MOCK_SESSION),
      count: jest.fn().mockResolvedValue(1),
      update: jest.fn().mockResolvedValue({ ...MOCK_SESSION }),
    },
    readingStage: {
      create: jest.fn().mockResolvedValue(MOCK_READING_STAGE),
      findFirst: jest.fn().mockResolvedValue(MOCK_READING_STAGE),
      update: jest.fn().mockResolvedValue({ ...MOCK_READING_STAGE, completedDate: new Date(), outcome: 'Passed' }),
    },
    debate: {
      create: jest.fn().mockResolvedValue(MOCK_DEBATE),
    },
  };
}

describe('ParliamentarySessionsService', () => {
  let service: ParliamentarySessionsService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;

  beforeEach(async () => {
    mockPrisma = makeMockPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParliamentarySessionsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ParliamentarySessionsService>(ParliamentarySessionsService);
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  describe('create', () => {
    it('creates a parliamentary session', async () => {
      const result = await service.create(
        {
          sessionNumber: 'SESSION-2026-001',
          title: 'Regular Legislative Session',
          sessionType: SessionType.ORDINARY,
          startDate: '2026-04-01',
        },
        'user-uuid-1',
      );
      expect(result).toEqual(MOCK_SESSION);
      expect(mockPrisma.parliamentarySession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sessionNumber: 'SESSION-2026-001',
            createdById: 'user-uuid-1',
            sessionType: SessionType.ORDINARY,
          }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // findById
  // -------------------------------------------------------------------------

  describe('findById', () => {
    it('returns session by id', async () => {
      const result = await service.findById('session-uuid-1');
      expect(result).toEqual(MOCK_SESSION);
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.parliamentarySession.findUnique.mockResolvedValueOnce(null);
      await expect(service.findById('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // activate / complete / cancel
  // -------------------------------------------------------------------------

  describe('activate', () => {
    it('activates an UPCOMING session', async () => {
      mockPrisma.parliamentarySession.update.mockResolvedValueOnce({
        ...MOCK_SESSION,
        status: SessionStatus.ACTIVE,
      });
      const result = await service.activate('session-uuid-1');
      expect(result.status).toBe(SessionStatus.ACTIVE);
    });

    it('throws BadRequestException when not UPCOMING', async () => {
      mockPrisma.parliamentarySession.findUnique.mockResolvedValueOnce({
        ...MOCK_SESSION,
        status: SessionStatus.ACTIVE,
      });
      await expect(service.activate('session-uuid-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('complete', () => {
    it('completes an ACTIVE session', async () => {
      mockPrisma.parliamentarySession.findUnique.mockResolvedValueOnce({
        ...MOCK_SESSION,
        status: SessionStatus.ACTIVE,
      });
      mockPrisma.parliamentarySession.update.mockResolvedValueOnce({
        ...MOCK_SESSION,
        status: SessionStatus.COMPLETED,
      });
      const result = await service.complete('session-uuid-1');
      expect(result.status).toBe(SessionStatus.COMPLETED);
    });

    it('throws BadRequestException when not ACTIVE', async () => {
      await expect(service.complete('session-uuid-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('cancels an UPCOMING session', async () => {
      mockPrisma.parliamentarySession.update.mockResolvedValueOnce({
        ...MOCK_SESSION,
        status: SessionStatus.CANCELLED,
      });
      const result = await service.cancel('session-uuid-1');
      expect(result.status).toBe(SessionStatus.CANCELLED);
    });

    it('throws BadRequestException when already COMPLETED', async () => {
      mockPrisma.parliamentarySession.findUnique.mockResolvedValueOnce({
        ...MOCK_SESSION,
        status: SessionStatus.COMPLETED,
      });
      await expect(service.cancel('session-uuid-1')).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // addReadingStage
  // -------------------------------------------------------------------------

  describe('addReadingStage', () => {
    it('adds a reading stage to a session', async () => {
      const result = await service.addReadingStage('session-uuid-1', {
        legislativeItemId: 'item-uuid-1',
        stageNumber: 1,
        stageName: 'First Reading',
        scheduledDate: '2026-04-10',
      });
      expect(result).toEqual(MOCK_READING_STAGE);
    });
  });

  // -------------------------------------------------------------------------
  // completeReadingStage
  // -------------------------------------------------------------------------

  describe('completeReadingStage', () => {
    it('marks a reading stage as complete with outcome', async () => {
      const result = await service.completeReadingStage(
        'session-uuid-1',
        'stage-uuid-1',
        'Passed',
      );
      expect(result.outcome).toBe('Passed');
      expect(result.completedDate).toBeTruthy();
    });

    it('throws NotFoundException when stage not found', async () => {
      mockPrisma.readingStage.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.completeReadingStage('session-uuid-1', 'ghost', 'Passed'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // addDebate
  // -------------------------------------------------------------------------

  describe('addDebate', () => {
    it('adds a debate to a session', async () => {
      const result = await service.addDebate('session-uuid-1', {
        topic: 'SME impact discussion',
        debateDate: '2026-04-15',
      });
      expect(result).toEqual(MOCK_DEBATE);
    });
  });
});
