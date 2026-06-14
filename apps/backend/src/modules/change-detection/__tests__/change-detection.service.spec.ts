import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ChangeDetectionService } from '../change-detection.service';
import { PrismaService } from '../../database/prisma.service';
import { AiProviderFactory } from '../../ai-providers/ai-provider.factory';
import { SemanticDiffResult } from '../semantic-diff.schema';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ITEM_ID = 'item-uuid-1';

const MOCK_V1 = {
  id: 'v1-uuid',
  versionNumber: 1,
  label: 'Initial Draft',
  legislativeItemId: ITEM_ID,
  contentSnapshot: { title: 'Data Law', articles: ['Article 1: ...'] },
  createdAt: new Date(),
  legislativeItem: { id: ITEM_ID },
};

const MOCK_V2 = {
  id: 'v2-uuid',
  versionNumber: 2,
  label: 'Revised Draft',
  legislativeItemId: ITEM_ID,
  contentSnapshot: { title: 'Data Protection Law', articles: ['Article 1: ...', 'Article 2: ...'] },
  createdAt: new Date(),
  legislativeItem: { id: ITEM_ID },
};

const MOCK_DIFF_RESULT: SemanticDiffResult = {
  hasChanges: true,
  changeType: 'MODERATE',
  addedObligations: ['Mandatory breach notification within 72 hours'],
  removedObligations: [],
  modifiedProvisions: ['Article 1 expanded with scope definition'],
  newRisks: ['Compliance burden for SMEs'],
  resolvedRisks: [],
  semanticSummary: 'Version 2 adds data breach notification requirements.',
  confidenceScore: 0.91,
  disclaimer: 'AI-generated analysis only.',
};

function makeMockPrisma() {
  return {
    legislativeItem: {
      findUnique: jest.fn().mockResolvedValue({ id: ITEM_ID, title: 'Data Law' }),
    },
    version: {
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string } }) => {
        if (where.id === 'v1-uuid') return Promise.resolve(MOCK_V1);
        if (where.id === 'v2-uuid') return Promise.resolve(MOCK_V2);
        return Promise.resolve(null);
      }),
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
          analysisType: 'CHANGE_DETECTION',
          provider: 'openai',
          model: 'gpt-4o-mini',
          result: MOCK_DIFF_RESULT,
          confidenceScore: 0.91,
          processingTimeMs: 1800,
          createdAt: new Date(),
          requestedBy: { id: 'u1', firstName: 'Sara', lastName: 'Ali', email: 's@a.com' },
        },
      ]),
    },
  };
}

function makeMockProviderFactory(content: string = JSON.stringify(MOCK_DIFF_RESULT)) {
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

describe('ChangeDetectionService', () => {
  let service: ChangeDetectionService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;
  let mockProviderFactory: ReturnType<typeof makeMockProviderFactory>;

  beforeEach(async () => {
    mockPrisma = makeMockPrisma();
    mockProviderFactory = makeMockProviderFactory();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChangeDetectionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AiProviderFactory, useValue: mockProviderFactory },
      ],
    }).compile();

    service = module.get<ChangeDetectionService>(ChangeDetectionService);
  });

  // -------------------------------------------------------------------------
  // detectChanges
  // -------------------------------------------------------------------------

  describe('detectChanges', () => {
    it('saves AiAnalysis with analysisType CHANGE_DETECTION', async () => {
      await service.detectChanges('v1-uuid', 'v2-uuid', 'openai', 'user-uuid-1');

      expect(mockPrisma.aiAnalysis.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            analysisType: 'CHANGE_DETECTION',
            legislativeItemId: ITEM_ID,
          }),
        }),
      );
    });

    it('throws NotFoundException when version 1 does not exist', async () => {
      mockPrisma.version.findUnique.mockResolvedValue(null);
      await expect(
        service.detectChanges('bad-v1', 'v2-uuid', undefined, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException on invalid AI JSON', async () => {
      mockProviderFactory.getProvider.mockReturnValue({
        name: 'openai',
        complete: jest.fn().mockResolvedValue({ content: 'not JSON', model: 'gpt-4o-mini' }),
      });

      await expect(
        service.detectChanges('v1-uuid', 'v2-uuid', 'openai', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('sets default disclaimer when AI omits it', async () => {
      const resultWithoutDisclaimer = { ...MOCK_DIFF_RESULT, disclaimer: '' };
      mockProviderFactory.getProvider.mockReturnValue({
        name: 'openai',
        complete: jest.fn().mockResolvedValue({
          content: JSON.stringify(resultWithoutDisclaimer),
          model: 'gpt-4o-mini',
        }),
      });

      await service.detectChanges('v1-uuid', 'v2-uuid', 'openai', 'user-1');

      const createCall = mockPrisma.aiAnalysis.create.mock.calls[0][0];
      expect(createCall.data.disclaimer).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // detectRiskChanges
  // -------------------------------------------------------------------------

  describe('detectRiskChanges', () => {
    it('saves AiAnalysis with analysisType RISK_CHANGE_DETECTION', async () => {
      await service.detectRiskChanges('v1-uuid', 'v2-uuid', 'openai', 'user-uuid-1');

      expect(mockPrisma.aiAnalysis.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            analysisType: 'RISK_CHANGE_DETECTION',
          }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // getChangeDetectionHistory
  // -------------------------------------------------------------------------

  describe('getChangeDetectionHistory', () => {
    it('returns analyses with both CHANGE_DETECTION and RISK_CHANGE_DETECTION types', async () => {
      const history = await service.getChangeDetectionHistory(ITEM_ID);

      expect(mockPrisma.aiAnalysis.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            legislativeItemId: ITEM_ID,
            OR: [
              { analysisType: { startsWith: 'CHANGE_DETECTION' } },
              { analysisType: { startsWith: 'RISK_CHANGE_DETECTION' } },
            ],
          }),
        }),
      );
      expect(history).toHaveLength(1);
    });

    it('throws NotFoundException when legislative item does not exist', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(null);
      await expect(service.getChangeDetectionHistory('bad-id')).rejects.toThrow(NotFoundException);
    });
  });
});
