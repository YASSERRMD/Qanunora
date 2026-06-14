import { Test, TestingModule } from '@nestjs/testing';
import { KnowledgeGraphService } from '../knowledge-graph.service';
import { PrismaService } from '../../database/prisma.service';

const MOCK_ITEM = {
  id: 'item-1',
  title: 'Test Bill',
  type: 'BILL',
  status: 'DRAFT',
  referenceNumber: 'REF-001',
  ministryId: 'ministry-1',
};

const MOCK_AMENDMENT = {
  id: 'amend-1',
  title: 'Amendment 1',
  status: 'PROPOSED',
  legislativeItemId: 'item-1',
};

const MOCK_CONSULTATION = {
  id: 'consult-1',
  title: 'Public Consultation',
  status: 'OPEN',
  legislativeItemId: 'item-1',
};

function makeMockPrisma() {
  return {
    legislativeItem: {
      findMany: jest.fn().mockResolvedValue([MOCK_ITEM]),
      findUnique: jest.fn().mockResolvedValue(MOCK_ITEM),
    },
    amendment: {
      findMany: jest.fn().mockResolvedValue([MOCK_AMENDMENT]),
      findUnique: jest.fn().mockResolvedValue(MOCK_AMENDMENT),
    },
    consultation: {
      findMany: jest.fn().mockResolvedValue([MOCK_CONSULTATION]),
      findUnique: jest.fn().mockResolvedValue(MOCK_CONSULTATION),
    },
    committeeReview: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    regulatoryReference: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    traceLink: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    committee: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  };
}

describe('KnowledgeGraphService', () => {
  let service: KnowledgeGraphService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;

  beforeEach(async () => {
    mockPrisma = makeMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeGraphService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<KnowledgeGraphService>(KnowledgeGraphService);
  });

  // ---------------------------------------------------------------------------
  // buildGraph
  // ---------------------------------------------------------------------------

  describe('buildGraph', () => {
    it('returns correct node types for items, amendments, and consultations', async () => {
      const graph = await service.buildGraph();

      const nodeTypes = graph.nodes.map((n) => n.type);
      expect(nodeTypes).toContain('LEGISLATIVE_ITEM');
      expect(nodeTypes).toContain('AMENDMENT');
      expect(nodeTypes).toContain('CONSULTATION');
    });

    it('includes the correct number of nodes', async () => {
      const graph = await service.buildGraph();
      // 1 legislative item + 1 amendment + 1 consultation = 3 nodes
      expect(graph.nodes.length).toBe(3);
    });

    it('returns empty graph when no items exist', async () => {
      mockPrisma.legislativeItem.findMany.mockResolvedValue([]);
      const graph = await service.buildGraph();
      expect(graph.nodes).toHaveLength(0);
      expect(graph.edges).toHaveLength(0);
    });

    it('applies ministryId filter to legislative items query', async () => {
      await service.buildGraph({ ministryId: 'ministry-1' });
      expect(mockPrisma.legislativeItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ ministryId: 'ministry-1' }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // edges
  // ---------------------------------------------------------------------------

  describe('edges', () => {
    it('includes item→amendment edges', async () => {
      const graph = await service.buildGraph();
      const amendmentEdge = graph.edges.find(
        (e) => e.source === 'item-1' && e.target === 'amend-1',
      );
      expect(amendmentEdge).toBeDefined();
      expect(amendmentEdge?.label).toBe('HAS_AMENDMENT');
    });

    it('includes item→consultation edges', async () => {
      const graph = await service.buildGraph();
      const consultEdge = graph.edges.find(
        (e) => e.source === 'item-1' && e.target === 'consult-1',
      );
      expect(consultEdge).toBeDefined();
      expect(consultEdge?.label).toBe('HAS_CONSULTATION');
    });
  });

  // ---------------------------------------------------------------------------
  // getNeighbors
  // ---------------------------------------------------------------------------

  describe('getNeighbors', () => {
    it('returns a subgraph centered on the given node', async () => {
      const subgraph = await service.getNeighbors('item-1', 'LEGISLATIVE_ITEM', 1);
      expect(subgraph.nodes.length).toBeGreaterThan(0);
      const nodeIds = subgraph.nodes.map((n) => n.id);
      expect(nodeIds).toContain('item-1');
    });

    it('depth 1 includes direct neighbors', async () => {
      const subgraph = await service.getNeighbors('item-1', 'LEGISLATIVE_ITEM', 1);
      const nodeIds = subgraph.nodes.map((n) => n.id);
      expect(nodeIds).toContain('amend-1');
      expect(nodeIds).toContain('consult-1');
    });
  });
});
