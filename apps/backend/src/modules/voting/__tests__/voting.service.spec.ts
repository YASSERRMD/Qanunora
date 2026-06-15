import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { VotingService } from '../voting.service';
import { PrismaService } from '../../database/prisma.service';
import { VoteResult, VotePosition } from '@prisma/client';

const MOCK_VOTE_EVENT = {
  id: 'vote-uuid-1',
  title: 'Vote on Digital Commerce Bill — Second Reading',
  description: null,
  voteDate: new Date('2026-05-15'),
  legislativeItemId: 'item-uuid-1',
  legislativeItem: { id: 'item-uuid-1', referenceNumber: 'LI-2026-0001', title: 'Digital Commerce Bill' },
  sessionId: null,
  totalFor: 0,
  totalAgainst: 0,
  totalAbstain: 0,
  quorumRequired: null,
  result: VoteResult.PENDING,
  resolution: null,
  memberPositions: [],
  createdById: 'user-uuid-1',
  createdBy: { id: 'user-uuid-1', firstName: 'Ali', lastName: 'Hassan' },
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_RESOLUTION = {
  id: 'resolution-uuid-1',
  voteEventId: 'vote-uuid-1',
  refNumber: 'RES-2026-0001',
  title: 'Resolution on Digital Commerce',
  text: 'The Council resolves to enact the Digital Commerce Bill',
  effectiveDate: new Date('2026-07-01'),
  issuedAt: new Date(),
  createdAt: new Date(),
};

function makeMockPrisma() {
  return {
    voteEvent: {
      create: jest.fn().mockResolvedValue(MOCK_VOTE_EVENT),
      findMany: jest.fn().mockResolvedValue([MOCK_VOTE_EVENT]),
      findUnique: jest.fn().mockResolvedValue(MOCK_VOTE_EVENT),
      count: jest.fn().mockResolvedValue(1),
      update: jest.fn().mockResolvedValue({ ...MOCK_VOTE_EVENT }),
    },
    memberVotePosition: {
      upsert: jest.fn().mockResolvedValue({
        id: 'pos-uuid-1',
        voteEventId: 'vote-uuid-1',
        memberId: 'user-uuid-2',
        position: VotePosition.FOR,
        note: null,
        votedAt: new Date(),
      }),
      count: jest.fn().mockResolvedValue(5),
    },
    resolution: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue(MOCK_RESOLUTION),
    },
  };
}

describe('VotingService', () => {
  let service: VotingService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;

  beforeEach(async () => {
    mockPrisma = makeMockPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VotingService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<VotingService>(VotingService);
  });

  // -------------------------------------------------------------------------
  // createVoteEvent
  // -------------------------------------------------------------------------

  describe('createVoteEvent', () => {
    it('creates a vote event with PENDING result', async () => {
      const result = await service.createVoteEvent(
        {
          title: 'Digital Commerce Bill Vote',
          voteDate: '2026-05-15',
          legislativeItemId: 'item-uuid-1',
        },
        'user-uuid-1',
      );
      expect(result).toEqual(MOCK_VOTE_EVENT);
      expect(mockPrisma.voteEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Digital Commerce Bill Vote',
            createdById: 'user-uuid-1',
          }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // findById
  // -------------------------------------------------------------------------

  describe('findById', () => {
    it('returns vote event by id', async () => {
      const result = await service.findById('vote-uuid-1');
      expect(result).toEqual(MOCK_VOTE_EVENT);
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.voteEvent.findUnique.mockResolvedValueOnce(null);
      await expect(service.findById('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // recordMemberVote
  // -------------------------------------------------------------------------

  describe('recordMemberVote', () => {
    it('records a member vote and recalculates totals', async () => {
      mockPrisma.memberVotePosition.count
        .mockResolvedValueOnce(5)  // FOR count
        .mockResolvedValueOnce(2)  // AGAINST count
        .mockResolvedValueOnce(1); // ABSTAIN count
      mockPrisma.voteEvent.update.mockResolvedValueOnce({
        ...MOCK_VOTE_EVENT,
        totalFor: 5,
        totalAgainst: 2,
        totalAbstain: 1,
      });
      const result = await service.recordMemberVote('vote-uuid-1', {
        memberId: 'user-uuid-2',
        position: VotePosition.FOR,
      });
      expect(result.totalFor).toBe(5);
      expect(result.totalAgainst).toBe(2);
    });

    it('throws BadRequestException when vote is already finalized', async () => {
      mockPrisma.voteEvent.findUnique.mockResolvedValueOnce({
        ...MOCK_VOTE_EVENT,
        result: VoteResult.PASSED,
      });
      await expect(
        service.recordMemberVote('vote-uuid-1', {
          memberId: 'user-uuid-2',
          position: VotePosition.FOR,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // finalizeVote
  // -------------------------------------------------------------------------

  describe('finalizeVote', () => {
    it('finalizes vote as PASSED when FOR > AGAINST', async () => {
      mockPrisma.voteEvent.findUnique.mockResolvedValueOnce({
        ...MOCK_VOTE_EVENT,
        totalFor: 10,
        totalAgainst: 3,
        totalAbstain: 2,
      });
      mockPrisma.voteEvent.update.mockResolvedValueOnce({
        ...MOCK_VOTE_EVENT,
        totalFor: 10,
        totalAgainst: 3,
        result: VoteResult.PASSED,
      });
      const result = await service.finalizeVote('vote-uuid-1');
      expect(result.result).toBe(VoteResult.PASSED);
    });

    it('finalizes vote as FAILED when AGAINST > FOR', async () => {
      mockPrisma.voteEvent.findUnique.mockResolvedValueOnce({
        ...MOCK_VOTE_EVENT,
        totalFor: 3,
        totalAgainst: 10,
        totalAbstain: 0,
      });
      mockPrisma.voteEvent.update.mockResolvedValueOnce({
        ...MOCK_VOTE_EVENT,
        result: VoteResult.FAILED,
      });
      const result = await service.finalizeVote('vote-uuid-1');
      expect(result.result).toBe(VoteResult.FAILED);
    });

    it('finalizes as TIED when FOR equals AGAINST', async () => {
      mockPrisma.voteEvent.findUnique.mockResolvedValueOnce({
        ...MOCK_VOTE_EVENT,
        totalFor: 5,
        totalAgainst: 5,
        totalAbstain: 2,
      });
      mockPrisma.voteEvent.update.mockResolvedValueOnce({
        ...MOCK_VOTE_EVENT,
        result: VoteResult.TIED,
      });
      const result = await service.finalizeVote('vote-uuid-1');
      expect(result.result).toBe(VoteResult.TIED);
    });

    it('finalizes as QUORUM_NOT_MET when total votes below quorum', async () => {
      mockPrisma.voteEvent.findUnique.mockResolvedValueOnce({
        ...MOCK_VOTE_EVENT,
        totalFor: 3,
        totalAgainst: 2,
        totalAbstain: 0,
        quorumRequired: 10,
      });
      mockPrisma.voteEvent.update.mockResolvedValueOnce({
        ...MOCK_VOTE_EVENT,
        result: VoteResult.QUORUM_NOT_MET,
      });
      const result = await service.finalizeVote('vote-uuid-1');
      expect(result.result).toBe(VoteResult.QUORUM_NOT_MET);
    });

    it('throws BadRequestException when already finalized', async () => {
      mockPrisma.voteEvent.findUnique.mockResolvedValueOnce({
        ...MOCK_VOTE_EVENT,
        result: VoteResult.PASSED,
      });
      await expect(service.finalizeVote('vote-uuid-1')).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // createResolution
  // -------------------------------------------------------------------------

  describe('createResolution', () => {
    it('creates resolution with auto-generated ref number for PASSED vote', async () => {
      mockPrisma.voteEvent.findUnique.mockResolvedValueOnce({
        ...MOCK_VOTE_EVENT,
        result: VoteResult.PASSED,
        resolution: null,
      });
      const result = await service.createResolution('vote-uuid-1', {
        title: 'Digital Commerce Resolution',
        text: 'The Council resolves...',
      });
      expect(result.refNumber).toMatch(/^RES-\d{4}-\d{4}$/);
      expect(result.title).toBe('Resolution on Digital Commerce');
    });

    it('throws BadRequestException when vote is not PASSED', async () => {
      await expect(
        service.createResolution('vote-uuid-1', {
          title: 'Test',
          text: 'Test resolution text',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when resolution already exists', async () => {
      mockPrisma.voteEvent.findUnique.mockResolvedValueOnce({
        ...MOCK_VOTE_EVENT,
        result: VoteResult.PASSED,
        resolution: MOCK_RESOLUTION,
      });
      await expect(
        service.createResolution('vote-uuid-1', {
          title: 'Duplicate',
          text: 'Test',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // getVoteAnalytics
  // -------------------------------------------------------------------------

  describe('getVoteAnalytics', () => {
    it('returns analytics with percentage breakdown', async () => {
      mockPrisma.voteEvent.findUnique.mockResolvedValueOnce({
        ...MOCK_VOTE_EVENT,
        totalFor: 7,
        totalAgainst: 2,
        totalAbstain: 1,
        result: VoteResult.PASSED,
      });
      const analytics = await service.getVoteAnalytics('vote-uuid-1');
      expect(analytics.totalVotes).toBe(10);
      expect(analytics.breakdown.for.count).toBe(7);
      expect(analytics.breakdown.for.percentage).toBe(70);
      expect(analytics.breakdown.against.percentage).toBe(20);
      expect(analytics.breakdown.abstain.percentage).toBe(10);
    });
  });
});
