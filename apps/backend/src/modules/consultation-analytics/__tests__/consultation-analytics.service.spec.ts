import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConsultationAnalyticsService } from '../consultation-analytics.service';
import { PrismaService } from '../../database/prisma.service';
import { AiProviderFactory } from '../../ai-providers/ai-provider.factory';

const MOCK_CONSULTATION_ID = 'consultation-uuid-1';
const MOCK_ITEM_ID = 'item-uuid-1';

const MOCK_FEEDBACK = [
  {
    id: 'fb-1',
    content: 'This law will greatly improve our community',
    sentiment: null,
    category: 'SUPPORT',
    submittedAt: new Date('2024-01-15'),
    stakeholder: { id: 'sh-1', name: 'Citizens Group', type: 'NGO' },
  },
  {
    id: 'fb-2',
    content: 'We have concerns about implementation costs',
    sentiment: null,
    category: 'CONCERN',
    submittedAt: new Date('2024-01-16'),
    stakeholder: { id: 'sh-2', name: 'Business Association', type: 'PRIVATE_SECTOR' },
  },
  {
    id: 'fb-3',
    content: 'Neutral observation about the process',
    sentiment: 'NEUTRAL',
    category: 'GENERAL',
    submittedAt: new Date('2024-01-16'),
    stakeholder: null,
  },
];

function makeMockPrisma() {
  return {
    consultation: {
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string }; include?: unknown }) =>
        Promise.resolve(
          where.id === MOCK_CONSULTATION_ID
            ? {
                id: MOCK_CONSULTATION_ID,
                legislativeItemId: MOCK_ITEM_ID,
                feedback: MOCK_FEEDBACK,
              }
            : null,
        ),
      ),
    },
    consultationFeedback: {
      update: jest.fn().mockImplementation(({ where, data }: { where: { id: string }; data: { sentiment: string } }) =>
        Promise.resolve({ id: where.id, sentiment: data.sentiment }),
      ),
      findMany: jest.fn().mockResolvedValue(MOCK_FEEDBACK),
    },
    aiAnalysis: {
      create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'analysis-1', ...args.data, createdAt: new Date() }),
      ),
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };
}

function makeMockProviderFactory() {
  return {
    getProvider: jest.fn().mockReturnValue({
      name: 'openai',
      complete: jest.fn().mockImplementation((_opts: unknown) => {
        const content = JSON.stringify({
          sentiment: 'POSITIVE',
          score: 0.9,
          reason: 'Expressed strong support',
        });
        return Promise.resolve({ content, model: 'gpt-4o-mini', provider: 'openai' });
      }),
    }),
  };
}

describe('ConsultationAnalyticsService', () => {
  let service: ConsultationAnalyticsService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;
  let mockProviderFactory: ReturnType<typeof makeMockProviderFactory>;

  beforeEach(async () => {
    mockPrisma = makeMockPrisma();
    mockProviderFactory = makeMockProviderFactory();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsultationAnalyticsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AiProviderFactory, useValue: mockProviderFactory },
      ],
    }).compile();

    service = module.get<ConsultationAnalyticsService>(ConsultationAnalyticsService);
  });

  // ---------------------------------------------------------------------------
  // analyzeSentiment
  // ---------------------------------------------------------------------------

  describe('analyzeSentiment', () => {
    it('returns sentiment results with correct analysisType SENTIMENT_ANALYSIS', async () => {
      const results = await service.analyzeSentiment(
        MOCK_CONSULTATION_ID,
        'openai',
        'user-uuid-1',
      );

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(MOCK_FEEDBACK.length);
      expect(mockPrisma.aiAnalysis.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            analysisType: 'SENTIMENT_ANALYSIS',
          }),
        }),
      );
    });

    it('updates sentiment on each feedback record', async () => {
      await service.analyzeSentiment(MOCK_CONSULTATION_ID, 'openai', 'user-uuid-1');

      expect(mockPrisma.consultationFeedback.update).toHaveBeenCalledTimes(MOCK_FEEDBACK.length);
      expect(mockPrisma.consultationFeedback.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'fb-1' },
          data: expect.objectContaining({ sentiment: expect.any(String) }),
        }),
      );
    });

    it('throws NotFoundException when consultation does not exist', async () => {
      await expect(
        service.analyzeSentiment('nonexistent-id', 'openai', 'user-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns empty array when consultation has no feedback', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue({
        id: MOCK_CONSULTATION_ID,
        legislativeItemId: MOCK_ITEM_ID,
        feedback: [],
      });

      const results = await service.analyzeSentiment(MOCK_CONSULTATION_ID, 'openai', 'user-uuid-1');
      expect(results).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // getAnalytics
  // ---------------------------------------------------------------------------

  describe('getAnalytics', () => {
    it('returns correct total count', async () => {
      const analytics = await service.getAnalytics(MOCK_CONSULTATION_ID);
      expect(analytics.total).toBe(MOCK_FEEDBACK.length);
    });

    it('counts sentiment correctly from DB sentiment field', async () => {
      // Only the third feedback has a sentiment set
      const analytics = await service.getAnalytics(MOCK_CONSULTATION_ID);
      expect(analytics.bySentiment.NEUTRAL).toBe(1);
    });

    it('counts feedback by category', async () => {
      const analytics = await service.getAnalytics(MOCK_CONSULTATION_ID);
      expect(analytics.byCategory['SUPPORT']).toBe(1);
      expect(analytics.byCategory['CONCERN']).toBe(1);
      expect(analytics.byCategory['GENERAL']).toBe(1);
    });

    it('returns volume by date', async () => {
      const analytics = await service.getAnalytics(MOCK_CONSULTATION_ID);
      expect(Array.isArray(analytics.volumeByDate)).toBe(true);
      const jan15 = analytics.volumeByDate.find((d) => d.date === '2024-01-15');
      expect(jan15?.count).toBe(1);
    });

    it('throws NotFoundException when consultation does not exist', async () => {
      await expect(service.getAnalytics('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });
});
