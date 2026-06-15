import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ModerationService } from '../moderation.service';
import { PrismaService } from '../../database/prisma.service';
import { AiProviderFactory } from '../../ai-providers/ai-provider.factory';
import { ModerationStatus } from '@prisma/client';

const mockFeedback = {
  id: 'feedback-1',
  consultationId: 'consult-1',
  submitterName: 'Jane Doe',
  submitterEmail: null,
  content: 'This is my feedback about the law.',
  category: 'GENERAL',
  isSpam: false,
  isOffensive: false,
  moderationStatus: ModerationStatus.PENDING,
  aiSpamScore: null,
  aiOffensiveScore: null,
  moderatedById: null,
  moderatedAt: null,
  moderatorNote: null,
  publishedAt: null,
  createdAt: new Date(),
};

const mockAiResult = {
  content: JSON.stringify({ isSpam: false, isOffensive: false, spamScore: 0.05, offensiveScore: 0.02, reason: 'Normal feedback' }),
  model: 'gpt-4o',
  provider: 'openai',
};

const mockAiProvider = { complete: jest.fn().mockResolvedValue(mockAiResult) };
const mockAiFactory = { getProvider: jest.fn().mockReturnValue(mockAiProvider) };

const mockPrisma = {
  anonFeedback: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    groupBy: jest.fn(),
  },
};

describe('ModerationService', () => {
  let service: ModerationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModerationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AiProviderFactory, useValue: mockAiFactory },
      ],
    }).compile();

    service = module.get<ModerationService>(ModerationService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('submitAnonymousFeedback', () => {
    it('creates an anonymous feedback record with PENDING status', async () => {
      mockPrisma.anonFeedback.create.mockResolvedValue(mockFeedback);
      mockPrisma.anonFeedback.findUnique.mockResolvedValue(mockFeedback);
      mockPrisma.anonFeedback.update.mockResolvedValue({ ...mockFeedback, aiSpamScore: 0.05 });

      const result = await service.submitAnonymousFeedback('consult-1', {
        submitterName: 'Jane Doe',
        content: 'This is my feedback about the law.',
      });

      expect(mockPrisma.anonFeedback.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            consultationId: 'consult-1',
            moderationStatus: ModerationStatus.PENDING,
          }),
        }),
      );
      expect(result).toEqual(mockFeedback);
    });
  });

  describe('runAiModeration', () => {
    it('calls AI provider and updates scores', async () => {
      mockPrisma.anonFeedback.findUnique.mockResolvedValue(mockFeedback);
      mockPrisma.anonFeedback.update.mockResolvedValue({ ...mockFeedback, aiSpamScore: 0.05 });

      const result = await service.runAiModeration('feedback-1');

      expect(mockAiFactory.getProvider).toHaveBeenCalled();
      expect(mockAiProvider.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'user' }),
          ]),
        }),
      );
      expect(result.isSpam).toBe(false);
      expect(result.isOffensive).toBe(false);
      expect(result.spamScore).toBe(0.05);
    });

    it('flags feedback when AI detects spam', async () => {
      const spamAiResult = {
        content: JSON.stringify({ isSpam: true, isOffensive: false, spamScore: 0.95, offensiveScore: 0.01 }),
        model: 'gpt-4o',
        provider: 'openai',
      };
      mockAiProvider.complete.mockResolvedValueOnce(spamAiResult);
      mockPrisma.anonFeedback.findUnique.mockResolvedValue(mockFeedback);
      mockPrisma.anonFeedback.update.mockResolvedValue({ ...mockFeedback, isSpam: true, moderationStatus: ModerationStatus.FLAGGED });

      await service.runAiModeration('feedback-1');

      expect(mockPrisma.anonFeedback.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isSpam: true,
            moderationStatus: ModerationStatus.FLAGGED,
          }),
        }),
      );
    });

    it('throws NotFoundException when feedback not found', async () => {
      mockPrisma.anonFeedback.findUnique.mockResolvedValue(null);
      await expect(service.runAiModeration('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPendingQueue', () => {
    it('returns pending items', async () => {
      mockPrisma.anonFeedback.findMany.mockResolvedValue([mockFeedback]);
      const result = await service.getPendingQueue();
      expect(result).toHaveLength(1);
      expect(mockPrisma.anonFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ moderationStatus: ModerationStatus.PENDING }),
        }),
      );
    });

    it('filters by consultationId when provided', async () => {
      mockPrisma.anonFeedback.findMany.mockResolvedValue([]);
      await service.getPendingQueue('consult-1');
      expect(mockPrisma.anonFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ consultationId: 'consult-1' }),
        }),
      );
    });
  });

  describe('approve', () => {
    it('sets APPROVED status and publishedAt', async () => {
      mockPrisma.anonFeedback.findUnique.mockResolvedValue(mockFeedback);
      mockPrisma.anonFeedback.update.mockResolvedValue({
        ...mockFeedback,
        moderationStatus: ModerationStatus.APPROVED,
        publishedAt: new Date(),
      });

      const result = await service.approve('feedback-1', 'moderator-1', 'Looks good');

      expect(mockPrisma.anonFeedback.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            moderationStatus: ModerationStatus.APPROVED,
            moderatedById: 'moderator-1',
          }),
        }),
      );
      expect(result.moderationStatus).toBe(ModerationStatus.APPROVED);
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.anonFeedback.findUnique.mockResolvedValue(null);
      await expect(service.approve('nonexistent', 'moderator-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('reject', () => {
    it('sets REJECTED status', async () => {
      mockPrisma.anonFeedback.findUnique.mockResolvedValue(mockFeedback);
      mockPrisma.anonFeedback.update.mockResolvedValue({
        ...mockFeedback,
        moderationStatus: ModerationStatus.REJECTED,
      });
      await service.reject('feedback-1', 'moderator-1');
      expect(mockPrisma.anonFeedback.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ moderationStatus: ModerationStatus.REJECTED }),
        }),
      );
    });
  });

  describe('flag', () => {
    it('sets FLAGGED status', async () => {
      mockPrisma.anonFeedback.findUnique.mockResolvedValue(mockFeedback);
      mockPrisma.anonFeedback.update.mockResolvedValue({
        ...mockFeedback,
        moderationStatus: ModerationStatus.FLAGGED,
      });
      await service.flag('feedback-1', 'moderator-1');
      expect(mockPrisma.anonFeedback.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ moderationStatus: ModerationStatus.FLAGGED }),
        }),
      );
    });
  });

  describe('getModerationStats', () => {
    it('returns counts by status', async () => {
      mockPrisma.anonFeedback.groupBy.mockResolvedValue([
        { moderationStatus: ModerationStatus.PENDING, _count: { _all: 5 } },
        { moderationStatus: ModerationStatus.APPROVED, _count: { _all: 3 } },
        { moderationStatus: ModerationStatus.REJECTED, _count: { _all: 2 } },
      ]);

      const result = await service.getModerationStats('consult-1');

      expect(result.PENDING).toBe(5);
      expect(result.APPROVED).toBe(3);
      expect(result.REJECTED).toBe(2);
      expect(result.total).toBe(10);
    });
  });
});
