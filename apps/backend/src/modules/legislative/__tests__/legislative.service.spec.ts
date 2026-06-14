import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LegislativeService } from '../legislative.service';
import { PrismaService } from '../../database/prisma.service';
import { LegislativeItemType, LegislativeStatus } from '@prisma/client';

const mockItem = {
  id: 'item-1',
  referenceNumber: 'LI-2025-0001',
  title: 'Test Legislative Item',
  titleAr: null,
  type: LegislativeItemType.DRAFT_LAW,
  status: LegislativeStatus.DRAFTING,
  confidentialityLevel: 'INTERNAL',
  priority: 'MEDIUM',
  ministryId: 'ministry-1',
  assignedToId: null,
  createdById: 'user-1',
  description: null,
  objective: null,
  targetEnactmentDate: null,
  publishedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ministry: { id: 'ministry-1', name: 'Ministry of Justice', code: 'MOJ' },
  createdBy: { id: 'user-1', firstName: 'Alice', lastName: 'Admin', email: 'alice@gov.qa' },
  assignedTo: null,
};

const mockPrisma = {
  legislativeItem: {
    count: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('LegislativeService', () => {
  let service: LegislativeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LegislativeService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<LegislativeService>(LegislativeService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('generateReferenceNumber', () => {
    it('returns formatted reference number', async () => {
      mockPrisma.legislativeItem.count.mockResolvedValue(5);
      const ref = await service.generateReferenceNumber();
      const year = new Date().getFullYear();
      expect(ref).toBe(`LI-${year}-0006`);
    });

    it('pads sequence number to 4 digits', async () => {
      mockPrisma.legislativeItem.count.mockResolvedValue(0);
      const ref = await service.generateReferenceNumber();
      const year = new Date().getFullYear();
      expect(ref).toBe(`LI-${year}-0001`);
    });
  });

  describe('create', () => {
    it('creates a legislative item with generated reference number', async () => {
      mockPrisma.legislativeItem.count.mockResolvedValue(0);
      mockPrisma.legislativeItem.create.mockResolvedValue(mockItem);

      const dto = {
        title: 'Test Legislative Item',
        type: LegislativeItemType.DRAFT_LAW,
        ministryId: 'ministry-1',
      };

      const result = await service.create(dto, 'user-1');

      expect(mockPrisma.legislativeItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Test Legislative Item',
            createdById: 'user-1',
            confidentialityLevel: 'INTERNAL',
            priority: 'MEDIUM',
          }),
        }),
      );
      expect(result).toEqual(mockItem);
    });

    it('uses provided priority and confidentiality level', async () => {
      mockPrisma.legislativeItem.count.mockResolvedValue(0);
      mockPrisma.legislativeItem.create.mockResolvedValue(mockItem);

      const dto = {
        title: 'Test Item',
        type: LegislativeItemType.BILL,
        ministryId: 'ministry-1',
        priority: 'URGENT' as const,
        confidentialityLevel: 'CONFIDENTIAL' as const,
      };

      await service.create(dto, 'user-1');

      expect(mockPrisma.legislativeItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            priority: 'URGENT',
            confidentialityLevel: 'CONFIDENTIAL',
          }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('returns paginated results with metadata', async () => {
      const items = [mockItem];
      mockPrisma.legislativeItem.findMany.mockResolvedValue(items);
      mockPrisma.legislativeItem.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toEqual(items);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('applies search filter', async () => {
      mockPrisma.legislativeItem.findMany.mockResolvedValue([]);
      mockPrisma.legislativeItem.count.mockResolvedValue(0);

      await service.findAll({ search: 'consumer' });

      expect(mockPrisma.legislativeItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ title: expect.objectContaining({ contains: 'consumer' }) }),
            ]),
          }),
        }),
      );
    });

    it('applies type and status filters', async () => {
      mockPrisma.legislativeItem.findMany.mockResolvedValue([]);
      mockPrisma.legislativeItem.count.mockResolvedValue(0);

      await service.findAll({
        type: LegislativeItemType.BILL,
        status: LegislativeStatus.INTERNAL_REVIEW,
      });

      expect(mockPrisma.legislativeItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: LegislativeItemType.BILL,
            status: LegislativeStatus.INTERNAL_REVIEW,
          }),
        }),
      );
    });

    it('calculates correct skip value', async () => {
      mockPrisma.legislativeItem.findMany.mockResolvedValue([]);
      mockPrisma.legislativeItem.count.mockResolvedValue(50);

      await service.findAll({ page: 3, limit: 10 });

      expect(mockPrisma.legislativeItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });

  describe('findById', () => {
    it('returns item when found', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(mockItem);
      const result = await service.findById('item-1');
      expect(result).toEqual(mockItem);
    });

    it('throws NotFoundException when item does not exist', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(null);
      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates and returns the item', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(mockItem);
      const updated = { ...mockItem, title: 'Updated Title' };
      mockPrisma.legislativeItem.update.mockResolvedValue(updated);

      const result = await service.update('item-1', { title: 'Updated Title' });

      expect(mockPrisma.legislativeItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item-1' },
          data: expect.objectContaining({ title: 'Updated Title' }),
        }),
      );
      expect(result.title).toBe('Updated Title');
    });

    it('throws NotFoundException when item does not exist', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(null);
      await expect(service.update('nonexistent', { title: 'x' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('deletes the item', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(mockItem);
      mockPrisma.legislativeItem.delete.mockResolvedValue(mockItem);

      await service.delete('item-1');

      expect(mockPrisma.legislativeItem.delete).toHaveBeenCalledWith({ where: { id: 'item-1' } });
    });

    it('throws NotFoundException when item does not exist', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(null);
      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
