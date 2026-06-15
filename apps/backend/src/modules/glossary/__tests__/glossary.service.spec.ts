import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { GlossaryService } from '../glossary.service';
import { PrismaService } from '../../database/prisma.service';
import { AiProviderFactory } from '../../ai-providers/ai-provider.factory';
import { TermStatus } from '@prisma/client';

const mockTerm = {
  id: 'term-1',
  termEn: 'Legislative Intent',
  termAr: 'النية التشريعية',
  definition: 'The purpose or goal behind the enactment of a statute.',
  definitionAr: 'الغرض أو الهدف من سن قانون ما.',
  domain: 'legal',
  category: 'statutory_interpretation',
  status: TermStatus.ACTIVE,
  isPreferred: true,
  relatedTermIds: [],
  deprecatedTerms: [],
  source: 'Black\'s Law Dictionary',
  createdById: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: { id: 'user-1', firstName: 'Ahmad', lastName: 'Al-Rashid' },
};

const mockAiSuggestions = [
  { termEn: 'Promulgation', termAr: 'إصدار', definition: 'The formal declaration of a law', domain: 'legal', category: 'legislative' },
  { termEn: 'Statute', termAr: 'قانون', definition: 'A written law passed by a legislative body', domain: 'legal', category: 'general' },
];

const mockAiResult = {
  content: JSON.stringify(mockAiSuggestions),
  model: 'gpt-4o',
  provider: 'openai',
};

const mockAiProvider = { complete: jest.fn().mockResolvedValue(mockAiResult) };
const mockAiFactory = { getProvider: jest.fn().mockReturnValue(mockAiProvider) };

const mockPrisma = {
  glossaryTerm: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  },
};

describe('GlossaryService', () => {
  let service: GlossaryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GlossaryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AiProviderFactory, useValue: mockAiFactory },
      ],
    }).compile();

    service = module.get<GlossaryService>(GlossaryService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('creates a new glossary term', async () => {
      mockPrisma.glossaryTerm.findUnique.mockResolvedValue(null);
      mockPrisma.glossaryTerm.create.mockResolvedValue(mockTerm);

      const result = await service.create(
        { termEn: 'Legislative Intent', definition: 'The purpose behind a statute', domain: 'legal' },
        'user-1',
      );

      expect(mockPrisma.glossaryTerm.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            termEn: 'Legislative Intent',
            domain: 'legal',
            status: TermStatus.ACTIVE,
          }),
        }),
      );
      expect(result).toEqual(mockTerm);
    });

    it('throws ConflictException when term already exists in domain', async () => {
      mockPrisma.glossaryTerm.findUnique.mockResolvedValue(mockTerm);
      await expect(
        service.create({ termEn: 'Legislative Intent', definition: 'duplicate', domain: 'legal' }, 'user-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('returns paginated terms', async () => {
      mockPrisma.glossaryTerm.findMany.mockResolvedValue([mockTerm]);
      mockPrisma.glossaryTerm.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 30 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('applies search filter across English and Arabic terms', async () => {
      mockPrisma.glossaryTerm.findMany.mockResolvedValue([]);
      mockPrisma.glossaryTerm.count.mockResolvedValue(0);

      await service.findAll({ search: 'legislative', page: 1, limit: 30 });

      expect(mockPrisma.glossaryTerm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ OR: expect.any(Array) }),
        }),
      );
    });

    it('applies domain filter', async () => {
      mockPrisma.glossaryTerm.findMany.mockResolvedValue([]);
      mockPrisma.glossaryTerm.count.mockResolvedValue(0);

      await service.findAll({ domain: 'legal', page: 1, limit: 30 });

      expect(mockPrisma.glossaryTerm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ domain: 'legal' }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('returns a term by ID', async () => {
      mockPrisma.glossaryTerm.findUnique.mockResolvedValue(mockTerm);
      const result = await service.findById('term-1');
      expect(result).toEqual(mockTerm);
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.glossaryTerm.findUnique.mockResolvedValue(null);
      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates specified fields of a term', async () => {
      mockPrisma.glossaryTerm.findUnique.mockResolvedValue(mockTerm);
      mockPrisma.glossaryTerm.update.mockResolvedValue({ ...mockTerm, termAr: 'نية تشريعية محدثة' });

      await service.update('term-1', { termAr: 'نية تشريعية محدثة' }, 'user-1');

      expect(mockPrisma.glossaryTerm.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ termAr: 'نية تشريعية محدثة' }),
        }),
      );
    });
  });

  describe('deprecate', () => {
    it('sets term status to DEPRECATED', async () => {
      mockPrisma.glossaryTerm.findUnique.mockResolvedValue(mockTerm);
      mockPrisma.glossaryTerm.update.mockResolvedValue({ ...mockTerm, status: TermStatus.DEPRECATED });

      await service.deprecate('term-1', 'user-1');

      expect(mockPrisma.glossaryTerm.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: TermStatus.DEPRECATED },
        }),
      );
    });
  });

  describe('suggestTerm', () => {
    it('calls AI and creates PROPOSED terms', async () => {
      mockPrisma.glossaryTerm.upsert.mockResolvedValue({ ...mockTerm, status: TermStatus.PROPOSED });

      const result = await service.suggestTerm(
        { text: 'This legislative bill addresses the promulgation and enactment of new statutes in the constitutional framework.', domain: 'legal' },
        'user-1',
      );

      expect(mockAiProvider.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
          ]),
        }),
      );
      expect(mockPrisma.glossaryTerm.upsert).toHaveBeenCalledTimes(mockAiSuggestions.length);
      expect(result.suggestions).toHaveLength(mockAiSuggestions.length);
      expect(result.created).toBe(mockAiSuggestions.length);
    });

    it('handles invalid AI JSON gracefully', async () => {
      mockAiProvider.complete.mockResolvedValueOnce({ content: 'not json', model: 'gpt-4o', provider: 'openai' });

      const result = await service.suggestTerm(
        { text: 'Some legal text that is long enough to meet minimum length requirement for the test.', domain: 'legal' },
        'user-1',
      );

      expect(result.suggestions).toHaveLength(0);
      expect(result.created).toBe(0);
    });
  });

  describe('importTerms', () => {
    it('bulk creates terms and reports created/skipped counts', async () => {
      mockPrisma.glossaryTerm.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockTerm); // second is duplicate
      mockPrisma.glossaryTerm.create.mockResolvedValue(mockTerm);

      const result = await service.importTerms(
        [
          { termEn: 'New Term', definition: 'A new term definition', domain: 'legal' },
          { termEn: 'Legislative Intent', definition: 'Duplicate', domain: 'legal' },
        ],
        'user-1',
      );

      expect(result.total).toBe(2);
    });
  });

  describe('lookup', () => {
    it('returns matching ACTIVE terms by partial name', async () => {
      mockPrisma.glossaryTerm.findMany.mockResolvedValue([mockTerm]);

      const result = await service.lookup('legislative');

      expect(mockPrisma.glossaryTerm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: TermStatus.ACTIVE,
            OR: expect.any(Array),
          }),
          take: 10,
        }),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('exportTerms', () => {
    it('returns JSON format by default', async () => {
      mockPrisma.glossaryTerm.findMany.mockResolvedValue([mockTerm]);
      const result = await service.exportTerms('json');
      expect(result.format).toBe('json');
      expect(Array.isArray(result.content)).toBe(true);
    });

    it('returns CSV format when requested', async () => {
      mockPrisma.glossaryTerm.findMany.mockResolvedValue([mockTerm]);
      const result = await service.exportTerms('csv');
      expect(result.format).toBe('csv');
      expect(typeof result.content).toBe('string');
      expect((result.content as string)).toContain('termEn');
    });
  });
});
