import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DocumentEditorService } from '../document-editor.service';
import { PrismaService } from '../../database/prisma.service';
import { EditType } from '@prisma/client';

const mockItem = { id: 'item-1', title: 'Test Bill', referenceNumber: 'REF-001' };

const mockEdit = {
  id: 'edit-1',
  legislativeItemId: 'item-1',
  editorId: 'user-1',
  contentSnapshot: 'Article 1: Introduction\nThis is the content.',
  changeDescription: 'Initial draft',
  editType: EditType.CONTENT,
  wordCount: 6,
  characterCount: 41,
  createdAt: new Date(),
  editor: { id: 'user-1', firstName: 'Ahmad', lastName: 'Al-Rashid' },
};

const mockComment = {
  id: 'comment-1',
  legislativeItemId: 'item-1',
  authorId: 'user-1',
  content: 'This clause needs revision',
  articleRef: 'Article 1',
  isResolved: false,
  resolvedById: null,
  resolvedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  author: { id: 'user-1', firstName: 'Ahmad', lastName: 'Al-Rashid' },
};

const mockStructures = [
  { id: 's-1', type: 'ARTICLE', number: '1', title: 'Introduction', content: 'This law establishes...', order: 1 },
  { id: 's-2', type: 'CLAUSE', number: '1.1', title: null, content: 'Definitions apply herein.', order: 2 },
];

const mockPrisma = {
  legislativeItem: { findUnique: jest.fn() },
  documentEdit: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  editorComment: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  legalStructure: { findMany: jest.fn() },
};

describe('DocumentEditorService', () => {
  let service: DocumentEditorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentEditorService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DocumentEditorService>(DocumentEditorService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('saveEdit', () => {
    it('creates a document edit with word and character counts', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(mockItem);
      mockPrisma.documentEdit.create.mockResolvedValue(mockEdit);

      const result = await service.saveEdit(
        'item-1',
        { content: 'Article 1: Introduction\nThis is the content.', changeDescription: 'Initial draft' },
        'user-1',
      );

      expect(mockPrisma.documentEdit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            legislativeItemId: 'item-1',
            editorId: 'user-1',
          }),
        }),
      );
      expect(result).toEqual(mockEdit);
    });

    it('throws NotFoundException when legislative item does not exist', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(null);
      await expect(
        service.saveEdit('bad-id', { content: 'text' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getEditHistory', () => {
    it('returns edits ordered by createdAt desc', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(mockItem);
      mockPrisma.documentEdit.findMany.mockResolvedValue([mockEdit]);

      const result = await service.getEditHistory('item-1');
      expect(result).toHaveLength(1);
      expect(mockPrisma.documentEdit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });
  });

  describe('getEditById', () => {
    it('returns an edit by id', async () => {
      mockPrisma.documentEdit.findUnique.mockResolvedValue(mockEdit);
      const result = await service.getEditById('edit-1');
      expect(result).toEqual(mockEdit);
    });

    it('throws NotFoundException when edit not found', async () => {
      mockPrisma.documentEdit.findUnique.mockResolvedValue(null);
      await expect(service.getEditById('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('diffEdits', () => {
    it('returns added, removed, and unchanged lines', () => {
      const c1 = 'Line A\nLine B\nLine C';
      const c2 = 'Line B\nLine C\nLine D';

      const result = service.diffEdits(c1, c2);
      expect(result.added).toContain('Line D');
      expect(result.removed).toContain('Line A');
      expect(result.unchanged).toContain('Line B');
      expect(result.unchanged).toContain('Line C');
    });

    it('returns all unchanged when content is identical', () => {
      const content = 'Line 1\nLine 2';
      const result = service.diffEdits(content, content);
      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
      expect(result.unchanged).toHaveLength(2);
    });
  });

  describe('addComment', () => {
    it('creates a comment for a legislative item', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(mockItem);
      mockPrisma.editorComment.create.mockResolvedValue(mockComment);

      const result = await service.addComment(
        'item-1',
        { content: 'This clause needs revision', articleRef: 'Article 1' },
        'user-1',
      );
      expect(result).toEqual(mockComment);
      expect(mockPrisma.editorComment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            content: 'This clause needs revision',
            articleRef: 'Article 1',
          }),
        }),
      );
    });
  });

  describe('resolveComment', () => {
    it('sets isResolved to true', async () => {
      mockPrisma.editorComment.findUnique.mockResolvedValue(mockComment);
      mockPrisma.editorComment.update.mockResolvedValue({ ...mockComment, isResolved: true });

      await service.resolveComment('comment-1', 'user-2');
      expect(mockPrisma.editorComment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isResolved: true }),
        }),
      );
    });

    it('throws BadRequestException if already resolved', async () => {
      mockPrisma.editorComment.findUnique.mockResolvedValue({ ...mockComment, isResolved: true });
      await expect(service.resolveComment('comment-1', 'user-2')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when comment not found', async () => {
      mockPrisma.editorComment.findUnique.mockResolvedValue(null);
      await expect(service.resolveComment('bad-id', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getNumberedContent', () => {
    it('returns formatted numbered legal structure text', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(mockItem);
      mockPrisma.legalStructure.findMany.mockResolvedValue(mockStructures);

      const result = await service.getNumberedContent('item-1');
      expect(result).toContain('Article 1: Introduction');
      expect(result).toContain('1.1');
    });
  });
});
