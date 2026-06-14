import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RegulatoryMappingService } from '../regulatory-mapping.service';
import { PrismaService } from '../../database/prisma.service';
import { AiProviderFactory } from '../../ai-providers/ai-provider.factory';
import { RegulationDetectionResult } from '../interfaces/regulatory-dependency.interface';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_ITEM = {
  id: 'item-uuid-1',
  title: 'Environmental Protection Law',
  type: 'LAW',
  description: 'Governs environmental standards',
  objective: 'Reduce pollution',
};

const MOCK_DETECTION_RESULT: RegulationDetectionResult = {
  affectedLaws: [
    {
      name: 'Clean Air Act 2010',
      referenceNumber: 'No. 22/2010',
      jurisdiction: 'National',
      dependencyType: 'AMENDS',
      isConflicting: false,
      description: 'This law amends the Clean Air Act provisions on emissions.',
    },
    {
      name: 'Industrial Regulations',
      referenceNumber: null,
      jurisdiction: 'National',
      dependencyType: 'CONFLICTS_WITH',
      isConflicting: true,
      description: 'Direct conflict on permitted discharge levels.',
    },
  ],
};

function makeMockPrisma() {
  return {
    legislativeItem: {
      findUnique: jest.fn().mockResolvedValue(MOCK_ITEM),
    },
    regulatoryReference: {
      create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'ref-uuid-' + Math.random(), ...args.data, createdAt: new Date() }),
      ),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'ref-uuid-1',
          referenceType: 'AMENDS',
          referenceName: 'Clean Air Act 2010',
          referenceNumber: 'No. 22/2010',
          jurisdiction: 'National',
          description: 'Amends emissions provisions',
          isConflicting: false,
          legislativeItemId: 'item-uuid-1',
          createdAt: new Date(),
        },
      ]),
      findUnique: jest.fn().mockResolvedValue({
        id: 'ref-uuid-1',
        legislativeItemId: 'item-uuid-1',
      }),
      delete: jest.fn().mockResolvedValue({ id: 'ref-uuid-1' }),
    },
    aiAnalysis: {
      create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'analysis-uuid-1', ...args.data, createdAt: new Date() }),
      ),
    },
  };
}

function makeMockProviderFactory(content: string = JSON.stringify(MOCK_DETECTION_RESULT)) {
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

describe('RegulatoryMappingService', () => {
  let service: RegulatoryMappingService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;
  let mockProviderFactory: ReturnType<typeof makeMockProviderFactory>;

  beforeEach(async () => {
    mockPrisma = makeMockPrisma();
    mockProviderFactory = makeMockProviderFactory();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegulatoryMappingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AiProviderFactory, useValue: mockProviderFactory },
      ],
    }).compile();

    service = module.get<RegulatoryMappingService>(RegulatoryMappingService);
  });

  // -------------------------------------------------------------------------
  // detectAffectedRegulations
  // -------------------------------------------------------------------------

  describe('detectAffectedRegulations', () => {
    it('saves one RegulatoryReference per detected law', async () => {
      await service.detectAffectedRegulations(
        'item-uuid-1',
        ['Clean Air Act 2010', 'Industrial Regulations'],
        'openai',
        'user-uuid-1',
      );

      expect(mockPrisma.regulatoryReference.create).toHaveBeenCalledTimes(2);
    });

    it('saves AiAnalysis record with analysisType REGULATORY_MAPPING', async () => {
      await service.detectAffectedRegulations(
        'item-uuid-1',
        ['Some Law'],
        undefined,
        'user-uuid-1',
      );

      expect(mockPrisma.aiAnalysis.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ analysisType: 'REGULATORY_MAPPING' }),
        }),
      );
    });

    it('throws NotFoundException when item does not exist', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(null);
      await expect(
        service.detectAffectedRegulations('bad-id', ['Law'], undefined, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException on invalid AI JSON', async () => {
      mockProviderFactory.getProvider.mockReturnValue({
        name: 'openai',
        complete: jest.fn().mockResolvedValue({ content: 'not JSON', model: 'gpt-4o-mini' }),
      });

      await expect(
        service.detectAffectedRegulations('item-uuid-1', ['Law'], 'openai', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // findAll
  // -------------------------------------------------------------------------

  describe('findAll', () => {
    it('returns all regulatory references for an item', async () => {
      const refs = await service.findAll('item-uuid-1');
      expect(refs).toHaveLength(1);
      expect(refs[0].referenceName).toBe('Clean Air Act 2010');
    });
  });

  // -------------------------------------------------------------------------
  // createReference
  // -------------------------------------------------------------------------

  describe('createReference', () => {
    it('creates a manual regulatory reference', async () => {
      const dto = {
        referenceType: 'REFERENCES',
        referenceName: 'Water Law 2008',
        jurisdiction: 'National',
        isConflicting: false,
      };

      await service.createReference('item-uuid-1', dto);

      expect(mockPrisma.regulatoryReference.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            referenceName: 'Water Law 2008',
            legislativeItemId: 'item-uuid-1',
          }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // getDependencyGraph
  // -------------------------------------------------------------------------

  describe('getDependencyGraph', () => {
    it('returns nodes and edges with the item as root', async () => {
      const graph = await service.getDependencyGraph('item-uuid-1');

      expect(graph.nodes).toHaveLength(2); // item + 1 reference
      expect(graph.edges).toHaveLength(1);
      expect(graph.nodes[0].type).toBe('ITEM');
      expect(graph.nodes[1].type).toBe('REFERENCE');
    });
  });
});
