import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AiSummarizationService } from '../ai-summarization.service';
import { PrismaService } from '../../database/prisma.service';
import { AiProviderFactory } from '../../ai-providers/ai-provider.factory';
import { SummaryResult } from '../summary-result.schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_ITEM = {
  id: 'item-uuid-1',
  title: 'Test Legislative Item',
  type: 'BILL',
  description: 'A test description',
  objective: 'A test objective',
};

const MOCK_SUMMARY_RESULT: SummaryResult = {
  title: 'Test Legislative Item',
  summaryType: 'EXECUTIVE',
  keyPoints: ['Point A', 'Point B'],
  summary: 'This is an executive summary of the test bill.',
  wordCount: 9,
  confidenceScore: 0.92,
  disclaimer: 'AI-assisted analysis, not legal advice',
  sources: [],
};

function makeMockPrisma() {
  return {
    legislativeItem: {
      findUnique: jest.fn().mockResolvedValue(MOCK_ITEM),
    },
    aiAnalysis: {
      create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: 'analysis-uuid-1',
          ...args.data,
          createdAt: new Date(),
        }),
      ),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'analysis-uuid-1',
          analysisType: 'SUMMARIZATION',
          provider: 'openai',
          model: 'gpt-4o-mini',
          result: MOCK_SUMMARY_RESULT,
          confidenceScore: 0.92,
          processingTimeMs: 1500,
          createdAt: new Date(),
        },
      ]),
      findUnique: jest.fn().mockResolvedValue({
        id: 'analysis-uuid-1',
        analysisType: 'SUMMARIZATION',
        provider: 'openai',
        model: 'gpt-4o-mini',
        result: MOCK_SUMMARY_RESULT,
        legislativeItemId: 'item-uuid-1',
        legislativeItem: MOCK_ITEM,
      }),
    },
  };
}

function makeMockProviderFactory(content: string = JSON.stringify(MOCK_SUMMARY_RESULT)) {
  return {
    getProvider: jest.fn().mockReturnValue({
      name: 'openai',
      complete: jest.fn().mockResolvedValue({
        content,
        model: 'gpt-4o-mini',
        provider: 'openai',
      }),
    }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AiSummarizationService', () => {
  let service: AiSummarizationService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;
  let mockProviderFactory: ReturnType<typeof makeMockProviderFactory>;

  beforeEach(async () => {
    mockPrisma = makeMockPrisma();
    mockProviderFactory = makeMockProviderFactory();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiSummarizationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AiProviderFactory, useValue: mockProviderFactory },
      ],
    }).compile();

    service = module.get<AiSummarizationService>(AiSummarizationService);
  });

  // -------------------------------------------------------------------------
  // summarizeLegislativeItem
  // -------------------------------------------------------------------------

  describe('summarizeLegislativeItem', () => {
    it('creates an AiAnalysis record with analysisType=SUMMARIZATION', async () => {
      const analysis = await service.summarizeLegislativeItem(
        'item-uuid-1',
        'EXECUTIVE',
        'openai',
        'user-uuid-1',
      );

      expect(mockPrisma.aiAnalysis.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            analysisType: 'SUMMARIZATION',
            legislativeItemId: 'item-uuid-1',
            requestedById: 'user-uuid-1',
            provider: 'openai',
          }),
        }),
      );
      expect(analysis).toBeDefined();
    });

    it('throws NotFoundException when legislative item does not exist', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(null);
      await expect(
        service.summarizeLegislativeItem('nonexistent', 'EXECUTIVE', undefined, 'user-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when AI returns invalid JSON', async () => {
      mockProviderFactory.getProvider.mockReturnValue({
        name: 'openai',
        complete: jest.fn().mockResolvedValue({
          content: 'This is not JSON at all',
          model: 'gpt-4o-mini',
          provider: 'openai',
        }),
      });

      await expect(
        service.summarizeLegislativeItem('item-uuid-1', 'EXECUTIVE', 'openai', 'user-uuid-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('handles JSON wrapped in markdown fences', async () => {
      const fencedContent = '```json\n' + JSON.stringify(MOCK_SUMMARY_RESULT) + '\n```';
      mockProviderFactory.getProvider.mockReturnValue({
        name: 'openai',
        complete: jest.fn().mockResolvedValue({
          content: fencedContent,
          model: 'gpt-4o-mini',
          provider: 'openai',
        }),
      });

      const analysis = await service.summarizeLegislativeItem(
        'item-uuid-1',
        'EXECUTIVE',
        'openai',
        'user-uuid-1',
      );

      expect(mockPrisma.aiAnalysis.create).toHaveBeenCalled();
      expect(analysis).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // getSummaries
  // -------------------------------------------------------------------------

  describe('getSummaries', () => {
    it('returns all AiAnalysis records filtered by analysisType=SUMMARIZATION', async () => {
      const results = await service.getSummaries('item-uuid-1');

      expect(mockPrisma.aiAnalysis.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            legislativeItemId: 'item-uuid-1',
            analysisType: 'SUMMARIZATION',
          }),
        }),
      );
      expect(results).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // regenerateSummary
  // -------------------------------------------------------------------------

  describe('regenerateSummary', () => {
    it('calls complete again with the same provider and summary type', async () => {
      await service.regenerateSummary('analysis-uuid-1', 'user-uuid-2');

      // The factory should be called with the stored provider name
      expect(mockProviderFactory.getProvider).toHaveBeenCalledWith('openai');
      // A new AiAnalysis record should be created
      expect(mockPrisma.aiAnalysis.create).toHaveBeenCalled();
    });

    it('throws NotFoundException when analysis does not exist', async () => {
      mockPrisma.aiAnalysis.findUnique.mockResolvedValue(null);
      await expect(service.regenerateSummary('nonexistent', 'user-uuid-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when analysis is not a SUMMARIZATION type', async () => {
      mockPrisma.aiAnalysis.findUnique.mockResolvedValue({
        id: 'analysis-uuid-1',
        analysisType: 'IMPACT_ASSESSMENT',
        provider: 'openai',
        model: 'gpt-4o-mini',
        result: {},
        legislativeItemId: 'item-uuid-1',
        legislativeItem: MOCK_ITEM,
      });

      await expect(service.regenerateSummary('analysis-uuid-1', 'user-uuid-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
