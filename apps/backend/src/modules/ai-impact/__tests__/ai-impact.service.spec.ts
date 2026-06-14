import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ImpactCategory, ImpactSeverity } from '@prisma/client';
import { AiImpactService } from '../ai-impact.service';
import { PrismaService } from '../../database/prisma.service';
import { AiProviderFactory } from '../../ai-providers/ai-provider.factory';
import { ImpactResult } from '../impact-result.schema';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_ITEM = {
  id: 'item-uuid-1',
  title: 'Test Legislative Item',
  type: 'BILL',
  description: 'A test description',
  objective: 'A test objective',
};

const MOCK_IMPACT_RESULT: ImpactResult = {
  category: 'SOCIAL' as ImpactCategory,
  severity: 'MEDIUM' as ImpactSeverity,
  summary: 'Moderate social impact expected.',
  affectedGroups: ['Citizens', 'NGOs'],
  positiveEffects: ['Improved access to services'],
  negativeEffects: ['Potential compliance burden'],
  risks: ['Implementation delays'],
  recommendations: ['Consult stakeholders early'],
  confidenceScore: 0.85,
  disclaimer: 'AI-generated analysis only.',
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
          analysisType: 'IMPACT_SOCIAL',
          provider: 'openai',
          model: 'gpt-4o-mini',
          result: MOCK_IMPACT_RESULT,
          confidenceScore: 0.85,
          processingTimeMs: 1200,
          createdAt: new Date(),
        },
      ]),
    },
  };
}

function makeMockProviderFactory(content: string = JSON.stringify(MOCK_IMPACT_RESULT)) {
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

describe('AiImpactService', () => {
  let service: AiImpactService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;
  let mockProviderFactory: ReturnType<typeof makeMockProviderFactory>;

  beforeEach(async () => {
    mockPrisma = makeMockPrisma();
    mockProviderFactory = makeMockProviderFactory();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiImpactService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AiProviderFactory, useValue: mockProviderFactory },
      ],
    }).compile();

    service = module.get<AiImpactService>(AiImpactService);
  });

  // -------------------------------------------------------------------------
  // analyzeImpact
  // -------------------------------------------------------------------------

  describe('analyzeImpact', () => {
    it('saves AiAnalysis with analysisType IMPACT_<category> for each category', async () => {
      const categories: ImpactCategory[] = ['SOCIAL', 'ECONOMIC'];
      await service.analyzeImpact('item-uuid-1', categories, 'openai', 'user-uuid-1');

      expect(mockPrisma.aiAnalysis.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.aiAnalysis.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          data: expect.objectContaining({
            analysisType: 'IMPACT_SOCIAL',
            legislativeItemId: 'item-uuid-1',
          }),
        }),
      );
      expect(mockPrisma.aiAnalysis.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          data: expect.objectContaining({
            analysisType: 'IMPACT_ECONOMIC',
          }),
        }),
      );
    });

    it('throws NotFoundException when legislative item does not exist', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(null);
      await expect(
        service.analyzeImpact('bad-id', ['SOCIAL'], undefined, 'user-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when AI returns invalid JSON', async () => {
      mockProviderFactory.getProvider.mockReturnValue({
        name: 'openai',
        complete: jest.fn().mockResolvedValue({
          content: 'not JSON',
          model: 'gpt-4o-mini',
          provider: 'openai',
        }),
      });

      await expect(
        service.analyzeImpact('item-uuid-1', ['SOCIAL'], 'openai', 'user-uuid-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('sets default disclaimer when AI omits it', async () => {
      const resultWithoutDisclaimer = { ...MOCK_IMPACT_RESULT, disclaimer: '' };
      mockProviderFactory.getProvider.mockReturnValue({
        name: 'openai',
        complete: jest.fn().mockResolvedValue({
          content: JSON.stringify(resultWithoutDisclaimer),
          model: 'gpt-4o-mini',
          provider: 'openai',
        }),
      });

      await service.analyzeImpact('item-uuid-1', ['SOCIAL'], 'openai', 'user-uuid-1');

      const createCall = mockPrisma.aiAnalysis.create.mock.calls[0][0];
      expect(createCall.data.disclaimer).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // getImpactSummary
  // -------------------------------------------------------------------------

  describe('getImpactSummary', () => {
    it('returns aggregated structure with overallRiskLevel and severityBreakdown', async () => {
      const summary = await service.getImpactSummary('item-uuid-1');

      expect(summary).toHaveProperty('overallRiskLevel');
      expect(summary).toHaveProperty('severityBreakdown');
      expect(summary).toHaveProperty('topRisks');
      expect(summary).toHaveProperty('topRecommendations');
      expect(summary).toHaveProperty('averageConfidenceScore');
      expect(summary.analyzedCategories).toContain('SOCIAL');
    });

    it('returns NEGLIGIBLE risk and empty arrays when no analyses exist', async () => {
      mockPrisma.aiAnalysis.findMany.mockResolvedValue([]);
      const summary = await service.getImpactSummary('item-uuid-1');

      expect(summary.overallRiskLevel).toBe('NEGLIGIBLE');
      expect(summary.totalCategories).toBe(0);
      expect(summary.topRisks).toHaveLength(0);
    });

    it('picks the highest severity from all categories', async () => {
      mockPrisma.aiAnalysis.findMany.mockResolvedValue([
        {
          id: 'a1',
          analysisType: 'IMPACT_SOCIAL',
          result: { ...MOCK_IMPACT_RESULT, severity: 'LOW' },
          confidenceScore: 0.8,
          createdAt: new Date(),
        },
        {
          id: 'a2',
          analysisType: 'IMPACT_ECONOMIC',
          result: { ...MOCK_IMPACT_RESULT, severity: 'CRITICAL', category: 'ECONOMIC', risks: ['Major risk'], recommendations: ['Act now'] },
          confidenceScore: 0.9,
          createdAt: new Date(Date.now() + 1000),
        },
      ]);

      const summary = await service.getImpactSummary('item-uuid-1');
      expect(summary.overallRiskLevel).toBe('CRITICAL');
    });
  });
});
