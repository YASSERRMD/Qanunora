import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConsultationsService } from '../consultations.service';
import { PrismaService } from '../../database/prisma.service';
import { ConsultationStatus } from '@prisma/client';

const mockConsultation = {
  id: 'consult-1',
  legislativeItemId: 'item-1',
  title: 'Public Consultation on Draft Law',
  description: 'Your feedback is welcome',
  status: ConsultationStatus.DRAFT,
  openDate: null,
  closeDate: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  legislativeItem: { id: 'item-1', referenceNumber: 'LI-2025-0001', title: 'Draft Law' },
  _count: { feedback: 0 },
};

const mockFeedback = {
  id: 'feedback-1',
  consultationId: 'consult-1',
  stakeholderId: null,
  submitterName: 'Jane Doe',
  submitterEmail: 'jane@example.com',
  content: 'I support this legislation',
  category: 'GENERAL',
  sentiment: 'POSITIVE',
  isPublic: false,
  submittedAt: new Date(),
  stakeholder: null,
  reviews: [],
};

const mockPrisma = {
  consultation: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  consultationFeedback: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
  },
  consultationFeedbackReview: {
    create: jest.fn(),
  },
};

describe('ConsultationsService', () => {
  let service: ConsultationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsultationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ConsultationsService>(ConsultationsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createConsultation', () => {
    it('creates a consultation with DRAFT status', async () => {
      mockPrisma.consultation.create.mockResolvedValue(mockConsultation);
      const result = await service.createConsultation({
        legislativeItemId: 'item-1',
        title: 'Public Consultation on Draft Law',
      });
      expect(mockPrisma.consultation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ConsultationStatus.DRAFT,
            legislativeItemId: 'item-1',
          }),
        }),
      );
      expect(result).toEqual(mockConsultation);
    });
  });

  describe('findAll', () => {
    it('returns all consultations', async () => {
      mockPrisma.consultation.findMany.mockResolvedValue([mockConsultation]);
      const result = await service.findAll();
      expect(result).toEqual([mockConsultation]);
    });
  });

  describe('findById', () => {
    it('returns consultation when found', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue(mockConsultation);
      const result = await service.findById('consult-1');
      expect(result).toEqual(mockConsultation);
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue(null);
      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('open', () => {
    it('transitions DRAFT consultation to OPEN', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue(mockConsultation);
      mockPrisma.consultation.update.mockResolvedValue({
        ...mockConsultation,
        status: ConsultationStatus.OPEN,
      });
      const result = await service.open('consult-1');
      expect(mockPrisma.consultation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ConsultationStatus.OPEN }),
        }),
      );
      expect(result.status).toBe(ConsultationStatus.OPEN);
    });

    it('throws BadRequestException if not in DRAFT status', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue({
        ...mockConsultation,
        status: ConsultationStatus.OPEN,
      });
      await expect(service.open('consult-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('close', () => {
    it('transitions OPEN consultation to CLOSED', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue({
        ...mockConsultation,
        status: ConsultationStatus.OPEN,
      });
      mockPrisma.consultation.update.mockResolvedValue({
        ...mockConsultation,
        status: ConsultationStatus.CLOSED,
      });
      const result = await service.close('consult-1');
      expect(result.status).toBe(ConsultationStatus.CLOSED);
    });

    it('throws BadRequestException if not in OPEN status', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue(mockConsultation);
      await expect(service.close('consult-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('submitFeedback', () => {
    it('submits feedback to an OPEN consultation', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue({
        ...mockConsultation,
        status: ConsultationStatus.OPEN,
      });
      mockPrisma.consultationFeedback.create.mockResolvedValue(mockFeedback);
      const result = await service.submitFeedback('consult-1', {
        content: 'I support this legislation',
        submitterName: 'Jane Doe',
      });
      expect(result).toEqual(mockFeedback);
    });

    it('throws BadRequestException if consultation is not OPEN', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue(mockConsultation);
      await expect(
        service.submitFeedback('consult-1', { content: 'test' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getFeedback', () => {
    it('returns paginated feedback for a consultation', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue(mockConsultation);
      mockPrisma.consultationFeedback.findMany.mockResolvedValue([mockFeedback]);
      mockPrisma.consultationFeedback.count.mockResolvedValue(1);
      const result = await service.getFeedback('consult-1', { page: 1, limit: 20 });
      expect(result.data).toEqual([mockFeedback]);
      expect(result.total).toBe(1);
    });
  });

  describe('reviewFeedback', () => {
    it('creates a review record for feedback', async () => {
      mockPrisma.consultationFeedback.findUnique.mockResolvedValue(mockFeedback);
      const mockReview = {
        id: 'review-1',
        feedbackId: 'feedback-1',
        reviewedBy: 'user-1',
        decision: 'ACCEPTED',
        notes: 'Valid point',
        reviewedAt: new Date(),
        reviewer: { id: 'user-1', firstName: 'Alice', lastName: 'Smith' },
        feedback: { id: 'feedback-1', content: 'test', category: 'GENERAL' },
      };
      mockPrisma.consultationFeedbackReview.create.mockResolvedValue(mockReview);
      const result = await service.reviewFeedback('feedback-1', { decision: 'ACCEPTED', notes: 'Valid point' }, 'user-1');
      expect(result).toEqual(mockReview);
    });

    it('throws NotFoundException when feedback not found', async () => {
      mockPrisma.consultationFeedback.findUnique.mockResolvedValue(null);
      await expect(
        service.reviewFeedback('nonexistent', { decision: 'ACCEPTED' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSummary', () => {
    it('returns aggregated counts by category and sentiment', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue(mockConsultation);
      mockPrisma.consultationFeedback.findMany.mockResolvedValue([
        { category: 'GENERAL', sentiment: 'POSITIVE' },
        { category: 'GENERAL', sentiment: 'NEGATIVE' },
        { category: 'LEGAL', sentiment: 'POSITIVE' },
      ]);
      const result = await service.getSummary('consult-1');
      expect(result.total).toBe(3);
      expect(result.byCategory['GENERAL']).toBe(2);
      expect(result.byCategory['LEGAL']).toBe(1);
      expect(result.bySentiment['POSITIVE']).toBe(2);
      expect(result.bySentiment['NEGATIVE']).toBe(1);
    });
  });
});
