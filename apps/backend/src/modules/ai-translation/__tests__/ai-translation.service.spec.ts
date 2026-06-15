import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AiTranslationService } from '../ai-translation.service';
import { PrismaService } from '../../database/prisma.service';
import { AiProviderFactory } from '../../ai-providers/ai-provider.factory';
import { TranslationStatus } from '@prisma/client';

const mockTranslationOutput = {
  translatedText: 'The Employment Law aims to protect the rights of workers.',
  confidenceScore: 0.92,
  glossaryTermsUsed: ['employment', 'rights', 'workers'],
};

const mockAiResult = {
  content: JSON.stringify(mockTranslationOutput),
  model: 'gpt-4o',
  provider: 'openai',
};

const mockAiProvider = { complete: jest.fn().mockResolvedValue(mockAiResult) };
const mockAiFactory = { getProvider: jest.fn().mockReturnValue(mockAiProvider) };

const mockRequest = {
  id: 'req-1',
  sourceText: 'يهدف قانون العمل إلى حماية حقوق العمال.',
  sourceLang: 'ar',
  targetLang: 'en',
  domain: 'legal',
  translatedText: 'The Employment Law aims to protect the rights of workers.',
  confidenceScore: 0.92,
  provider: 'openai',
  model: 'gpt-4o',
  status: TranslationStatus.COMPLETED,
  isApproved: false,
  memoryEntryId: 'mem-1',
  entityType: null,
  entityId: null,
  reviewedById: null,
  reviewedAt: null,
  reviewNotes: null,
  createdById: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: { id: 'user-1', firstName: 'Ahmad', lastName: 'Al-Rashid' },
  reviewedBy: null,
  memoryEntry: { id: 'mem-1', usageCount: 1 },
};

const mockMemoryEntry = {
  id: 'mem-1',
  sourceText: 'يهدف قانون العمل إلى حماية حقوق العمال.',
  translatedText: 'The Employment Law aims to protect the rights of workers.',
  sourceLang: 'ar',
  targetLang: 'en',
  domain: 'legal',
  usageCount: 1,
};

const mockPrisma = {
  translationRequest: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  translationMemory: {
    findFirst: jest.fn(),
    upsert: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  legislativeItem: {
    findUnique: jest.fn(),
  },
};

describe('AiTranslationService', () => {
  let service: AiTranslationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiTranslationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AiProviderFactory, useValue: mockAiFactory },
      ],
    }).compile();

    service = module.get<AiTranslationService>(AiTranslationService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('translate', () => {
    it('returns cached translation from memory without calling AI', async () => {
      mockPrisma.translationMemory.findFirst.mockResolvedValue(mockMemoryEntry);
      mockPrisma.translationRequest.create.mockResolvedValue({ ...mockRequest, fromCache: true });
      mockPrisma.translationMemory.update.mockResolvedValue({ ...mockMemoryEntry, usageCount: 2 });

      const result = await service.translate(
        { sourceText: 'يهدف قانون العمل', sourceLang: 'ar', targetLang: 'en' },
        'user-1',
      );

      expect(mockAiProvider.complete).not.toHaveBeenCalled();
      expect(mockPrisma.translationMemory.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { usageCount: { increment: 1 } } }),
      );
    });

    it('calls AI provider when no cache entry exists', async () => {
      mockPrisma.translationMemory.findFirst.mockResolvedValue(null);
      mockPrisma.translationMemory.upsert.mockResolvedValue(mockMemoryEntry);
      mockPrisma.translationRequest.create.mockResolvedValue(mockRequest);

      const result = await service.translate(
        { sourceText: 'يهدف قانون العمل إلى حماية حقوق العمال.', sourceLang: 'ar', targetLang: 'en' },
        'user-1',
      );

      expect(mockAiFactory.getProvider).toHaveBeenCalled();
      expect(mockAiProvider.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user' }),
          ]),
        }),
      );
      expect(mockPrisma.translationMemory.upsert).toHaveBeenCalled();
      expect(mockPrisma.translationRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sourceLang: 'ar',
            targetLang: 'en',
            status: TranslationStatus.COMPLETED,
          }),
        }),
      );
    });

    it('throws BadRequestException when AI returns invalid JSON', async () => {
      mockPrisma.translationMemory.findFirst.mockResolvedValue(null);
      mockAiProvider.complete.mockResolvedValueOnce({ content: 'invalid json', model: 'gpt-4o', provider: 'openai' });

      await expect(
        service.translate({ sourceText: 'test', sourceLang: 'ar', targetLang: 'en' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('returns paginated list of translation requests', async () => {
      mockPrisma.translationRequest.findMany.mockResolvedValue([mockRequest]);
      mockPrisma.translationRequest.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('filters by status when provided', async () => {
      mockPrisma.translationRequest.findMany.mockResolvedValue([]);
      mockPrisma.translationRequest.count.mockResolvedValue(0);

      await service.findAll({ status: 'COMPLETED', page: 1, limit: 10 });

      expect(mockPrisma.translationRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'COMPLETED' }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('returns a translation request by ID', async () => {
      mockPrisma.translationRequest.findUnique.mockResolvedValue(mockRequest);
      const result = await service.findById('req-1');
      expect(result).toEqual(mockRequest);
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.translationRequest.findUnique.mockResolvedValue(null);
      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('submitForReview', () => {
    it('transitions COMPLETED request to UNDER_REVIEW', async () => {
      mockPrisma.translationRequest.findUnique.mockResolvedValue(mockRequest);
      mockPrisma.translationRequest.update.mockResolvedValue({
        ...mockRequest,
        status: TranslationStatus.UNDER_REVIEW,
      });

      await service.submitForReview('req-1', 'user-1');

      expect(mockPrisma.translationRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: TranslationStatus.UNDER_REVIEW },
        }),
      );
    });

    it('throws BadRequestException if status is not COMPLETED', async () => {
      mockPrisma.translationRequest.findUnique.mockResolvedValue({
        ...mockRequest,
        status: TranslationStatus.PENDING,
      });
      await expect(service.submitForReview('req-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('approveTranslation', () => {
    it('sets APPROVED and increments memory usage', async () => {
      mockPrisma.translationRequest.findUnique.mockResolvedValue(mockRequest);
      mockPrisma.translationRequest.update.mockResolvedValue({
        ...mockRequest,
        status: TranslationStatus.APPROVED,
        isApproved: true,
      });
      mockPrisma.translationMemory.update.mockResolvedValue({ ...mockMemoryEntry, usageCount: 2 });

      await service.approveTranslation('req-1', 'reviewer-1', { notes: 'Looks good' });

      expect(mockPrisma.translationRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: TranslationStatus.APPROVED,
            isApproved: true,
            reviewedById: 'reviewer-1',
          }),
        }),
      );
      expect(mockPrisma.translationMemory.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { usageCount: { increment: 1 } } }),
      );
    });
  });

  describe('rejectTranslation', () => {
    it('sets REJECTED status', async () => {
      mockPrisma.translationRequest.findUnique.mockResolvedValue(mockRequest);
      mockPrisma.translationRequest.update.mockResolvedValue({
        ...mockRequest,
        status: TranslationStatus.REJECTED,
      });

      await service.rejectTranslation('req-1', 'reviewer-1', { notes: 'Inaccurate' });

      expect(mockPrisma.translationRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: TranslationStatus.REJECTED,
            isApproved: false,
          }),
        }),
      );
    });
  });
});
