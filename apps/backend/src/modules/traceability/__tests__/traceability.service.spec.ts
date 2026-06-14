import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TraceabilityService } from '../traceability.service';
import { PrismaService } from '../../database/prisma.service';
import { CreateTraceLinkDto } from '../dto/traceability.dto';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_ITEM = {
  id: 'item-uuid-1',
  title: 'Data Protection Law',
};

const MOCK_LINK = {
  id: 'link-uuid-1',
  legislativeItemId: 'item-uuid-1',
  sourceType: 'REQUIREMENT',
  sourceId: 'req-uuid-1',
  targetType: 'ARTICLE',
  targetId: 'art-uuid-1',
  linkType: 'REQUIREMENT_TO_ARTICLE',
  description: 'Article 3 implements Requirement R-001',
  createdAt: new Date(),
};

const MOCK_AUDIT_LOG = {
  id: 'audit-uuid-1',
  action: 'CREATE',
  entityType: 'LegislativeItem',
  entityId: 'item-uuid-1',
  ipAddress: '127.0.0.1',
  createdAt: new Date(),
  user: { id: 'u1', firstName: 'Ali', lastName: 'Hassan', email: 'ali@example.com' },
};

function makeMockPrisma() {
  return {
    legislativeItem: {
      findUnique: jest.fn().mockResolvedValue(MOCK_ITEM),
    },
    traceLink: {
      create: jest.fn().mockResolvedValue(MOCK_LINK),
      findMany: jest.fn().mockResolvedValue([MOCK_LINK]),
      findUnique: jest.fn().mockResolvedValue(MOCK_LINK),
      delete: jest.fn().mockResolvedValue(MOCK_LINK),
    },
    auditLog: {
      findMany: jest.fn().mockResolvedValue([MOCK_AUDIT_LOG]),
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TraceabilityService', () => {
  let service: TraceabilityService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;

  beforeEach(async () => {
    mockPrisma = makeMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TraceabilityService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TraceabilityService>(TraceabilityService);
  });

  // -------------------------------------------------------------------------
  // createLink
  // -------------------------------------------------------------------------

  describe('createLink', () => {
    it('creates a trace link with all required fields', async () => {
      const dto: CreateTraceLinkDto = {
        sourceType: 'REQUIREMENT',
        sourceId: 'req-uuid-1',
        targetType: 'ARTICLE',
        targetId: 'art-uuid-1',
        linkType: 'REQUIREMENT_TO_ARTICLE',
        description: 'Article 3 implements R-001',
      };

      const result = await service.createLink('item-uuid-1', dto);

      expect(mockPrisma.traceLink.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            legislativeItemId: 'item-uuid-1',
            sourceType: 'REQUIREMENT',
            targetType: 'ARTICLE',
            linkType: 'REQUIREMENT_TO_ARTICLE',
          }),
        }),
      );
      expect(result.id).toBe('link-uuid-1');
    });

    it('throws NotFoundException when legislative item does not exist', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(null);
      await expect(
        service.createLink('bad-id', {
          sourceType: 'A',
          sourceId: 'a',
          targetType: 'B',
          targetId: 'b',
          linkType: 'REQUIREMENT_TO_ARTICLE',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // getLinks
  // -------------------------------------------------------------------------

  describe('getLinks', () => {
    it('returns all trace links for a legislative item', async () => {
      const links = await service.getLinks('item-uuid-1');
      expect(links).toHaveLength(1);
      expect(links[0].linkType).toBe('REQUIREMENT_TO_ARTICLE');
    });

    it('applies filters to the query', async () => {
      await service.getLinks('item-uuid-1', { linkType: 'REQUIREMENT_TO_ARTICLE' });

      expect(mockPrisma.traceLink.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            legislativeItemId: 'item-uuid-1',
            linkType: 'REQUIREMENT_TO_ARTICLE',
          }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // getGraph
  // -------------------------------------------------------------------------

  describe('getGraph', () => {
    it('returns nodes and edges representing the trace graph', async () => {
      const graph = await service.getGraph('item-uuid-1');

      expect(graph.nodes.length).toBeGreaterThanOrEqual(3); // item + source + target
      expect(graph.edges).toHaveLength(1);
      expect(graph.edges[0].label).toBe('REQUIREMENT_TO_ARTICLE');
    });

    it('includes the legislative item as a node', async () => {
      const graph = await service.getGraph('item-uuid-1');
      const itemNode = graph.nodes.find((n) => n.id === 'item-uuid-1');
      expect(itemNode).toBeDefined();
      expect(itemNode?.type).toBe('LEGISLATIVE_ITEM');
    });
  });

  // -------------------------------------------------------------------------
  // getAuditTrail
  // -------------------------------------------------------------------------

  describe('getAuditTrail', () => {
    it('returns audit log entries for the item', async () => {
      const trail = await service.getAuditTrail('item-uuid-1');
      expect(trail).toHaveLength(1);
      expect(trail[0].action).toBe('CREATE');
      expect(trail[0].user?.firstName).toBe('Ali');
    });

    it('queries audit log by entityType and entityId', async () => {
      await service.getAuditTrail('item-uuid-1');

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entityType: 'LegislativeItem',
            entityId: 'item-uuid-1',
          }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // deleteLink
  // -------------------------------------------------------------------------

  describe('deleteLink', () => {
    it('deletes a trace link by id', async () => {
      await service.deleteLink('link-uuid-1');
      expect(mockPrisma.traceLink.delete).toHaveBeenCalledWith({ where: { id: 'link-uuid-1' } });
    });

    it('throws NotFoundException when link does not exist', async () => {
      mockPrisma.traceLink.findUnique.mockResolvedValue(null);
      await expect(service.deleteLink('bad-id')).rejects.toThrow(NotFoundException);
    });
  });
});
