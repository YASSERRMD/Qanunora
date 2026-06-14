import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LegalStructureService } from '../legal-structure.service';
import { PrismaService } from '../../database/prisma.service';
import { LegalStructureType } from '@prisma/client';

const makeNode = (overrides: Partial<ReturnType<typeof baseNode>> = {}) => ({
  ...baseNode(),
  ...overrides,
});

function baseNode() {
  return {
    id: 'node-1',
    legislativeItemId: 'item-1',
    type: LegalStructureType.CHAPTER,
    number: '1',
    title: 'General Provisions',
    content: null,
    order: 0,
    parentId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    parent: null,
    children: [],
    _count: { children: 0 },
  };
}

const mockPrisma = {
  legalStructure: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
};

describe('LegalStructureService', () => {
  let service: LegalStructureService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LegalStructureService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<LegalStructureService>(LegalStructureService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('creates a legal structure node', async () => {
      const node = makeNode();
      mockPrisma.legalStructure.create.mockResolvedValue(node);
      const result = await service.create('item-1', {
        type: LegalStructureType.CHAPTER,
        number: '1',
        title: 'General Provisions',
        order: 0,
      });
      expect(mockPrisma.legalStructure.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            legislativeItemId: 'item-1',
            type: LegalStructureType.CHAPTER,
            number: '1',
            order: 0,
          }),
        }),
      );
      expect(result).toEqual(node);
    });
  });

  describe('findAll', () => {
    it('returns all nodes for a legislative item', async () => {
      const nodes = [makeNode()];
      mockPrisma.legalStructure.findMany.mockResolvedValue(nodes);
      const result = await service.findAll('item-1');
      expect(result).toEqual(nodes);
    });
  });

  describe('findById', () => {
    it('returns node when found', async () => {
      mockPrisma.legalStructure.findUnique.mockResolvedValue(makeNode());
      const result = await service.findById('node-1');
      expect(result.id).toBe('node-1');
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.legalStructure.findUnique.mockResolvedValue(null);
      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates a node', async () => {
      mockPrisma.legalStructure.findUnique.mockResolvedValue(makeNode());
      const updated = makeNode({ title: 'Updated Title' });
      mockPrisma.legalStructure.update.mockResolvedValue(updated);
      const result = await service.update('node-1', { title: 'Updated Title' });
      expect(result.title).toBe('Updated Title');
    });

    it('throws NotFoundException when node does not exist', async () => {
      mockPrisma.legalStructure.findUnique.mockResolvedValue(null);
      await expect(service.update('nonexistent', { title: 'x' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('deletes a node', async () => {
      mockPrisma.legalStructure.findUnique.mockResolvedValue(makeNode());
      mockPrisma.legalStructure.delete.mockResolvedValue(makeNode());
      await service.delete('node-1');
      expect(mockPrisma.legalStructure.delete).toHaveBeenCalledWith({ where: { id: 'node-1' } });
    });

    it('throws NotFoundException when node does not exist', async () => {
      mockPrisma.legalStructure.findUnique.mockResolvedValue(null);
      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('reorder', () => {
    it('updates order for each item and returns the tree', async () => {
      mockPrisma.legalStructure.updateMany.mockResolvedValue({ count: 1 });
      const chapter = makeNode();
      const article = makeNode({
        id: 'node-2',
        type: LegalStructureType.ARTICLE,
        parentId: 'node-1',
        order: 0,
      });
      mockPrisma.legalStructure.findMany.mockResolvedValue([chapter, article]);

      const result = await service.reorder('item-1', [
        { id: 'node-1', order: 0 },
        { id: 'node-2', order: 1 },
      ]);

      expect(mockPrisma.legalStructure.updateMany).toHaveBeenCalledTimes(2);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getTree', () => {
    it('builds hierarchical tree from flat list', async () => {
      const chapter = makeNode();
      const article = makeNode({
        id: 'node-2',
        type: LegalStructureType.ARTICLE,
        number: '1',
        parentId: 'node-1',
        order: 0,
      });
      mockPrisma.legalStructure.findMany.mockResolvedValue([chapter, article]);

      const tree = await service.getTree('item-1');

      expect(tree).toHaveLength(1);
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children[0].id).toBe('node-2');
    });

    it('places orphan nodes at root level', async () => {
      const node = makeNode({ parentId: 'nonexistent-parent' });
      mockPrisma.legalStructure.findMany.mockResolvedValue([node]);
      const tree = await service.getTree('item-1');
      expect(tree).toHaveLength(1);
    });
  });
});
