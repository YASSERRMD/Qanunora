import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ClassificationService } from '../classification.service';
import { PrismaService } from '../../database/prisma.service';
import { AiProviderFactory } from '../../ai-providers/ai-provider.factory';

const ITEM = { id: 'item-1', title: 'Test Law', description: 'A test law', objective: 'Testing' };

const CLASSIFICATION = {
  id: 'cls-1',
  legislativeItemId: 'item-1',
  classificationLevel: 'CONFIDENTIAL',
  sensitiveFlags: ['FINANCIAL'],
  classifiedById: 'user-1',
  classifiedAt: new Date(),
  reviewDueDate: new Date(Date.now() - 86400000), // yesterday
  declassifiedById: null,
  declassifiedAt: null,
  justification: null,
  updatedAt: new Date(),
};

const EXCEPTION = {
  id: 'exc-1',
  legislativeItemId: 'item-1',
  userId: 'user-viewer',
  grantedById: 'user-admin',
  reason: 'Special access',
  expiresAt: new Date(Date.now() + 86400000 * 7),
  isActive: true,
  createdAt: new Date(),
};

function makePrisma() {
  return {
    legislativeItem: {
      findUnique: jest.fn().mockResolvedValue(ITEM),
      update: jest.fn().mockResolvedValue({ ...ITEM }),
    },
    contentClassification: {
      upsert: jest.fn().mockResolvedValue(CLASSIFICATION),
      update: jest.fn().mockResolvedValue({ ...CLASSIFICATION, classificationLevel: 'UNCLASSIFIED' }),
      findUnique: jest.fn().mockResolvedValue(CLASSIFICATION),
      findMany: jest.fn().mockResolvedValue([CLASSIFICATION]),
      count: jest.fn().mockResolvedValue(1),
    },
    accessException: {
      upsert: jest.fn().mockResolvedValue(EXCEPTION),
      update: jest.fn().mockResolvedValue({ ...EXCEPTION, isActive: false }),
      findUnique: jest.fn().mockResolvedValue(EXCEPTION),
      findMany: jest.fn().mockResolvedValue([EXCEPTION]),
    },
  };
}

function makeAiProviderFactory() {
  return {
    getProvider: jest.fn().mockReturnValue({
      complete: jest.fn().mockResolvedValue(
        JSON.stringify({ flags: ['FINANCIAL'], reasoning: 'Contains financial data', suggestedLevel: 'CONFIDENTIAL' }),
      ),
    }),
  };
}

describe('ClassificationService', () => {
  let service: ClassificationService;
  let mockPrisma: ReturnType<typeof makePrisma>;
  let mockAiFactory: ReturnType<typeof makeAiProviderFactory>;

  beforeEach(async () => {
    mockPrisma = makePrisma();
    mockAiFactory = makeAiProviderFactory();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassificationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AiProviderFactory, useValue: mockAiFactory },
      ],
    }).compile();

    service = module.get<ClassificationService>(ClassificationService);
  });

  describe('classify', () => {
    it('upserts classification with correct level', async () => {
      const result = await service.classify('item-1', { level: 'CONFIDENTIAL', sensitiveFlags: ['FINANCIAL'] }, 'user-1');
      expect(result.classificationLevel).toBe('CONFIDENTIAL');
      expect(mockPrisma.contentClassification.upsert).toHaveBeenCalled();
    });

    it('also updates legislative item confidentiality level', async () => {
      await service.classify('item-1', { level: 'SECRET' }, 'user-1');
      expect(mockPrisma.legislativeItem.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'item-1' } }),
      );
    });

    it('throws NotFoundException for missing item', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(null);
      await expect(service.classify('missing', { level: 'UNCLASSIFIED' }, 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('declassify', () => {
    it('sets level to UNCLASSIFIED and records declassifier', async () => {
      const result = await service.declassify('item-1', { justification: 'Cleared' }, 'user-admin');
      expect(mockPrisma.contentClassification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ classificationLevel: 'UNCLASSIFIED', declassifiedById: 'user-admin' }),
        }),
      );
    });

    it('throws NotFoundException when classification missing', async () => {
      mockPrisma.contentClassification.findUnique.mockResolvedValue(null);
      await expect(service.declassify('item-1', { justification: 'test' }, 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('detectSensitiveContent', () => {
    it('returns AI-suggested flags and level', async () => {
      const result = await service.detectSensitiveContent('item-1');
      expect(result.flags).toContain('FINANCIAL');
      expect(result.suggestedLevel).toBe('CONFIDENTIAL');
    });

    it('calls AiProviderFactory with a prompt', async () => {
      await service.detectSensitiveContent('item-1');
      expect(mockAiFactory.getProvider).toHaveBeenCalled();
    });
  });

  describe('checkAccess', () => {
    it('returns true for SUPER_ADMIN at any level', async () => {
      const result = await service.checkAccess('item-1', 'user-admin', 'SUPER_ADMIN');
      expect(result).toBe(true);
    });

    it('returns false for VIEWER at CONFIDENTIAL level without exception', async () => {
      mockPrisma.accessException.findUnique.mockResolvedValue(null);
      const result = await service.checkAccess('item-1', 'user-viewer', 'VIEWER');
      expect(result).toBe(false);
    });

    it('returns true for VIEWER with active access exception', async () => {
      const result = await service.checkAccess('item-1', 'user-viewer', 'VIEWER');
      expect(result).toBe(true);
    });

    it('returns true when no classification exists', async () => {
      mockPrisma.contentClassification.findUnique.mockResolvedValue(null);
      const result = await service.checkAccess('item-1', 'user-viewer', 'VIEWER');
      expect(result).toBe(true);
    });
  });

  describe('getClassificationStats', () => {
    it('returns counts by level', async () => {
      const stats = await service.getClassificationStats();
      expect(stats).toHaveProperty('counts');
      expect(stats).toHaveProperty('total');
    });
  });

  describe('getPendingDeclassificationReview', () => {
    it('returns items with past reviewDueDate', async () => {
      const items = await service.getPendingDeclassificationReview();
      expect(items).toHaveLength(1);
    });
  });
});
