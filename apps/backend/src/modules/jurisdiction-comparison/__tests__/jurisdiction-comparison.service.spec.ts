import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { JurisdictionComparisonService } from '../jurisdiction-comparison.service';
import { PrismaService } from '../../database/prisma.service';
import { AiProviderFactory } from '../../ai-providers/ai-provider.factory';
import { ComparisonResult } from '../comparison-result.schema';
import { JURISDICTION_PROFILES } from '../data/jurisdiction-profiles';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_ITEM = {
  id: 'item-uuid-1',
  title: 'Digital Economy Law',
  type: 'LAW',
  description: 'Governs digital transactions',
  objective: 'Enable e-commerce growth',
};

const MOCK_COMPARISON_RESULT: ComparisonResult = {
  targetJurisdiction: 'GBR',
  similarities: ['Both regulate data privacy'],
  differences: ['UK has stricter enforcement penalties'],
  gaps: ['No provision for cross-border data transfers'],
  bestPractices: ['Establish a dedicated digital regulator'],
  recommendations: ['Adopt GDPR-equivalent standards'],
  confidenceScore: 0.88,
  disclaimer: 'AI-generated comparison for reference only.',
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
          analysisType: 'JURISDICTION_COMPARISON',
          provider: 'openai',
          model: 'gpt-4o-mini',
          result: MOCK_COMPARISON_RESULT,
          confidenceScore: 0.88,
          processingTimeMs: 2100,
          createdAt: new Date(),
          requestedBy: { id: 'u1', firstName: 'Jane', lastName: 'Doe', email: 'j@d.com' },
        },
      ]),
    },
  };
}

function makeMockProviderFactory(content: string = JSON.stringify(MOCK_COMPARISON_RESULT)) {
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

describe('JurisdictionComparisonService', () => {
  let service: JurisdictionComparisonService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;
  let mockProviderFactory: ReturnType<typeof makeMockProviderFactory>;

  beforeEach(async () => {
    mockPrisma = makeMockPrisma();
    mockProviderFactory = makeMockProviderFactory();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JurisdictionComparisonService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AiProviderFactory, useValue: mockProviderFactory },
      ],
    }).compile();

    service = module.get<JurisdictionComparisonService>(JurisdictionComparisonService);
  });

  // -------------------------------------------------------------------------
  // compare
  // -------------------------------------------------------------------------

  describe('compare', () => {
    it('saves AiAnalysis with analysisType JURISDICTION_COMPARISON', async () => {
      await service.compare('item-uuid-1', 'GBR', undefined, 'openai', 'user-uuid-1');

      expect(mockPrisma.aiAnalysis.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            analysisType: 'JURISDICTION_COMPARISON',
            legislativeItemId: 'item-uuid-1',
          }),
        }),
      );
    });

    it('throws NotFoundException when item does not exist', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(null);
      await expect(
        service.compare('bad-id', 'GBR', undefined, undefined, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException on invalid AI JSON', async () => {
      mockProviderFactory.getProvider.mockReturnValue({
        name: 'openai',
        complete: jest.fn().mockResolvedValue({ content: 'not JSON', model: 'gpt-4o-mini' }),
      });

      await expect(
        service.compare('item-uuid-1', 'USA', undefined, 'openai', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('sets default disclaimer when AI omits it', async () => {
      const resultWithoutDisclaimer = { ...MOCK_COMPARISON_RESULT, disclaimer: '' };
      mockProviderFactory.getProvider.mockReturnValue({
        name: 'openai',
        complete: jest.fn().mockResolvedValue({
          content: JSON.stringify(resultWithoutDisclaimer),
          model: 'gpt-4o-mini',
        }),
      });

      await service.compare('item-uuid-1', 'SGP', undefined, 'openai', 'user-1');

      const createCall = mockPrisma.aiAnalysis.create.mock.calls[0][0];
      expect(createCall.data.disclaimer).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // getComparisons
  // -------------------------------------------------------------------------

  describe('getComparisons', () => {
    it('returns comparisons filtered by JURISDICTION_COMPARISON type', async () => {
      const comps = await service.getComparisons('item-uuid-1');

      expect(mockPrisma.aiAnalysis.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ analysisType: 'JURISDICTION_COMPARISON' }),
        }),
      );
      expect(comps).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // getJurisdictions
  // -------------------------------------------------------------------------

  describe('getJurisdictions', () => {
    it('returns the full list of jurisdiction profiles', () => {
      const profiles = service.getJurisdictions();
      expect(profiles).toHaveLength(JURISDICTION_PROFILES.length);
      expect(profiles.some((p) => p.code === 'UAE')).toBe(true);
      expect(profiles.some((p) => p.code === 'GBR')).toBe(true);
    });
  });
});
