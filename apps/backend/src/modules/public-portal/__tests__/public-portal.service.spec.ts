import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PublicPortalService } from '../public-portal.service';
import { PrismaService } from '../../database/prisma.service';
import { LegislativeStatus, ConsultationStatus, ConfidentialityLevel } from '@prisma/client';

const mockPublishedItem = {
  id: 'item-1',
  referenceNumber: 'LI-2025-0001',
  title: 'Draft Employment Law',
  titleAr: null,
  type: 'BILL',
  status: LegislativeStatus.PUBLISHED,
  description: 'A law about employment',
  objective: 'Protect worker rights',
  publishedAt: new Date('2025-01-10'),
  createdAt: new Date('2025-01-01'),
  ministry: { id: 'min-1', name: 'Ministry of Labour', nameAr: null },
  consultations: [],
  _count: { amendments: 2, consultations: 1 },
};

const mockConsultation = {
  id: 'consult-1',
  title: 'Public Consultation',
  description: 'Submit your views',
  status: ConsultationStatus.OPEN,
  openDate: new Date('2025-01-15'),
  closeDate: new Date('2025-02-15'),
  createdAt: new Date('2025-01-10'),
  legislativeItem: {
    id: 'item-1',
    referenceNumber: 'LI-2025-0001',
    title: 'Draft Employment Law',
    type: 'BILL',
  },
  _count: { feedback: 5 },
};

const mockFeedback = {
  id: 'feedback-1',
  submitterName: 'John Citizen',
  content: 'I support this legislation strongly',
  category: 'SUPPORT',
  submittedAt: new Date(),
};

const mockStructure = [
  { id: 's-1', type: 'CHAPTER', number: '1', title: 'General Provisions', content: null, order: 1, parentId: null },
  { id: 's-2', type: 'ARTICLE', number: '1', title: 'Scope', content: 'This law applies...', order: 1, parentId: 's-1' },
];

const mockPrisma = {
  legislativeItem: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
  },
  consultation: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  consultationFeedback: {
    create: jest.fn(),
  },
  legalStructure: {
    findMany: jest.fn(),
  },
};

describe('PublicPortalService', () => {
  let service: PublicPortalService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicPortalService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PublicPortalService>(PublicPortalService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getPublishedItems', () => {
    it('returns paginated list of published items', async () => {
      mockPrisma.legislativeItem.findMany.mockResolvedValue([mockPublishedItem]);
      mockPrisma.legislativeItem.count.mockResolvedValue(1);

      const result = await service.getPublishedItems({ page: 1, limit: 10 });

      expect(mockPrisma.legislativeItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: LegislativeStatus.PUBLISHED }),
        }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('applies search filter to query', async () => {
      mockPrisma.legislativeItem.findMany.mockResolvedValue([mockPublishedItem]);
      mockPrisma.legislativeItem.count.mockResolvedValue(1);

      await service.getPublishedItems({ search: 'employment', page: 1, limit: 10 });

      expect(mockPrisma.legislativeItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ OR: expect.any(Array) }),
        }),
      );
    });

    it('applies type filter to query', async () => {
      mockPrisma.legislativeItem.findMany.mockResolvedValue([]);
      mockPrisma.legislativeItem.count.mockResolvedValue(0);

      await service.getPublishedItems({ type: 'BILL', page: 1, limit: 10 });

      expect(mockPrisma.legislativeItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'BILL' }),
        }),
      );
    });
  });

  describe('getPublishedItemDetail', () => {
    it('returns a single published item', async () => {
      mockPrisma.legislativeItem.findFirst.mockResolvedValue(mockPublishedItem);
      const result = await service.getPublishedItemDetail('item-1');
      expect(result).toEqual(mockPublishedItem);
      expect(mockPrisma.legislativeItem.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'item-1',
            status: LegislativeStatus.PUBLISHED,
          }),
        }),
      );
    });

    it('throws NotFoundException when item not found or confidential', async () => {
      mockPrisma.legislativeItem.findFirst.mockResolvedValue(null);
      await expect(service.getPublishedItemDetail('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getOpenConsultations', () => {
    it('returns open consultations for public items', async () => {
      mockPrisma.consultation.findMany.mockResolvedValue([mockConsultation]);
      const result = await service.getOpenConsultations();
      expect(result).toHaveLength(1);
      expect(mockPrisma.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: ConsultationStatus.OPEN }),
        }),
      );
    });
  });

  describe('getConsultationDetail', () => {
    it('returns an open consultation detail', async () => {
      mockPrisma.consultation.findFirst.mockResolvedValue(mockConsultation);
      const result = await service.getConsultationDetail('consult-1');
      expect(result).toEqual(mockConsultation);
    });

    it('throws NotFoundException when consultation not found or closed', async () => {
      mockPrisma.consultation.findFirst.mockResolvedValue(null);
      await expect(service.getConsultationDetail('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('submitPublicFeedback', () => {
    it('creates feedback for an open consultation', async () => {
      mockPrisma.consultation.findFirst.mockResolvedValue(mockConsultation);
      mockPrisma.consultationFeedback.create.mockResolvedValue(mockFeedback);

      const result = await service.submitPublicFeedback('consult-1', {
        submittedByName: 'John Citizen',
        content: 'I support this legislation strongly',
        category: 'SUPPORT',
      });

      expect(mockPrisma.consultationFeedback.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            consultationId: 'consult-1',
            submitterName: 'John Citizen',
            isPublic: true,
          }),
        }),
      );
      expect(result).toEqual(mockFeedback);
    });

    it('throws BadRequestException when consultation is not open', async () => {
      mockPrisma.consultation.findFirst.mockResolvedValue(null);
      await expect(
        service.submitPublicFeedback('consult-1', {
          submittedByName: 'John',
          content: 'Test feedback content here',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPublishedLegalStructure', () => {
    it('returns legal structure for a published item', async () => {
      mockPrisma.legislativeItem.findFirst.mockResolvedValue(mockPublishedItem);
      mockPrisma.legalStructure.findMany.mockResolvedValue(mockStructure);

      const result = await service.getPublishedLegalStructure('item-1');
      expect(result).toHaveLength(2);
    });

    it('throws NotFoundException for non-published or confidential items', async () => {
      mockPrisma.legislativeItem.findFirst.mockResolvedValue(null);
      await expect(service.getPublishedLegalStructure('item-1')).rejects.toThrow(NotFoundException);
    });
  });
});
