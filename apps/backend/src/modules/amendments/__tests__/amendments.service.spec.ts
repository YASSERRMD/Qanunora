import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AmendmentsService } from '../amendments.service';
import { PrismaService } from '../../database/prisma.service';
import { AmendmentStatus } from '@prisma/client';

const mockAmendment = {
  id: 'amendment-1',
  legislativeItemId: 'item-1',
  proposedById: 'user-1',
  title: 'Amendment to Article 5',
  description: 'Extend retention period',
  reason: 'Alignment with international standards',
  articleReference: 'Article 5',
  sectionReference: null,
  status: AmendmentStatus.PROPOSED,
  impactSummary: null,
  approvedById: null,
  approvedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  proposedBy: { id: 'user-1', firstName: 'Alice', lastName: 'Smith', email: 'alice@gov.qa' },
  approvedBy: null,
  legislativeItem: { id: 'item-1', referenceNumber: 'LI-2025-0001', title: 'Test Item' },
};

const mockPrisma = {
  amendment: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe('AmendmentsService', () => {
  let service: AmendmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AmendmentsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AmendmentsService>(AmendmentsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('creates an amendment with PROPOSED status', async () => {
      mockPrisma.amendment.create.mockResolvedValue(mockAmendment);
      const dto = {
        title: 'Amendment to Article 5',
        description: 'Extend retention period',
        reason: 'Alignment with international standards',
      };
      const result = await service.create('item-1', dto, 'user-1');
      expect(mockPrisma.amendment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            legislativeItemId: 'item-1',
            proposedById: 'user-1',
            status: AmendmentStatus.PROPOSED,
          }),
        }),
      );
      expect(result).toEqual(mockAmendment);
    });
  });

  describe('findAll', () => {
    it('returns paginated amendments for a legislative item', async () => {
      mockPrisma.amendment.findMany.mockResolvedValue([mockAmendment]);
      mockPrisma.amendment.count.mockResolvedValue(1);
      const result = await service.findAll('item-1', { page: 1, limit: 20 });
      expect(result.data).toEqual([mockAmendment]);
      expect(result.total).toBe(1);
    });

    it('filters by status when provided', async () => {
      mockPrisma.amendment.findMany.mockResolvedValue([]);
      mockPrisma.amendment.count.mockResolvedValue(0);
      await service.findAll('item-1', { status: AmendmentStatus.APPROVED });
      expect(mockPrisma.amendment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: AmendmentStatus.APPROVED }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('returns amendment when found', async () => {
      mockPrisma.amendment.findUnique.mockResolvedValue(mockAmendment);
      const result = await service.findById('amendment-1');
      expect(result).toEqual(mockAmendment);
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.amendment.findUnique.mockResolvedValue(null);
      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates a PROPOSED amendment', async () => {
      mockPrisma.amendment.findUnique.mockResolvedValue(mockAmendment);
      const updated = { ...mockAmendment, title: 'Updated Title' };
      mockPrisma.amendment.update.mockResolvedValue(updated);
      const result = await service.update('amendment-1', { title: 'Updated Title' });
      expect(result.title).toBe('Updated Title');
    });

    it('rejects update on non-PROPOSED amendment', async () => {
      mockPrisma.amendment.findUnique.mockResolvedValue({
        ...mockAmendment,
        status: AmendmentStatus.APPROVED,
      });
      await expect(service.update('amendment-1', { title: 'New' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('approve', () => {
    it('approves an UNDER_REVIEW amendment', async () => {
      mockPrisma.amendment.findUnique.mockResolvedValue({
        ...mockAmendment,
        status: AmendmentStatus.UNDER_REVIEW,
      });
      mockPrisma.amendment.update.mockResolvedValue({
        ...mockAmendment,
        status: AmendmentStatus.APPROVED,
        approvedById: 'approver-1',
      });
      const result = await service.approve('amendment-1', 'approver-1');
      expect(mockPrisma.amendment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: AmendmentStatus.APPROVED,
            approvedById: 'approver-1',
          }),
        }),
      );
      expect(result.status).toBe(AmendmentStatus.APPROVED);
    });

    it('throws BadRequestException if amendment is not UNDER_REVIEW', async () => {
      mockPrisma.amendment.findUnique.mockResolvedValue(mockAmendment);
      await expect(service.approve('amendment-1', 'approver-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('reject', () => {
    it('rejects an amendment', async () => {
      mockPrisma.amendment.findUnique.mockResolvedValue(mockAmendment);
      mockPrisma.amendment.update.mockResolvedValue({
        ...mockAmendment,
        status: AmendmentStatus.REJECTED,
      });
      const result = await service.reject('amendment-1');
      expect(result.status).toBe(AmendmentStatus.REJECTED);
    });

    it('throws BadRequestException if already incorporated', async () => {
      mockPrisma.amendment.findUnique.mockResolvedValue({
        ...mockAmendment,
        status: AmendmentStatus.INCORPORATED,
      });
      await expect(service.reject('amendment-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('incorporate', () => {
    it('incorporates an APPROVED amendment', async () => {
      mockPrisma.amendment.findUnique.mockResolvedValue({
        ...mockAmendment,
        status: AmendmentStatus.APPROVED,
      });
      mockPrisma.amendment.update.mockResolvedValue({
        ...mockAmendment,
        status: AmendmentStatus.INCORPORATED,
      });
      const result = await service.incorporate('amendment-1');
      expect(result.status).toBe(AmendmentStatus.INCORPORATED);
    });

    it('throws BadRequestException if amendment is not APPROVED', async () => {
      mockPrisma.amendment.findUnique.mockResolvedValue(mockAmendment);
      await expect(service.incorporate('amendment-1')).rejects.toThrow(BadRequestException);
    });
  });
});
