import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DocumentsService } from '../documents.service';
import { PrismaService } from '../../database/prisma.service';
import { STORAGE_PROVIDER } from '../../storage/storage.interface';

const mockDocument = {
  id: 'doc-1',
  legislativeItemId: 'item-1',
  uploadedById: 'user-1',
  originalName: 'test.pdf',
  storagePath: 'item-1/12345-abcd1234.pdf',
  mimeType: 'application/pdf',
  sizeBytes: BigInt(1024),
  category: 'DRAFT',
  title: null,
  description: null,
  isCurrentVersion: true,
  checksum: 'sha256hash',
  createdAt: new Date(),
  updatedAt: new Date(),
  uploadedBy: { id: 'user-1', firstName: 'Alice', lastName: 'Admin' },
};

const mockPrisma = {
  document: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
};

const mockStorage = {
  upload: jest.fn(),
  delete: jest.fn(),
  getSignedUrl: jest.fn(),
};

const createMockFile = (
  override: Partial<Express.Multer.File> = {},
): Express.Multer.File =>
  ({
    fieldname: 'file',
    originalname: 'test.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    buffer: Buffer.from('test content'),
    size: 12,
    stream: null as never,
    destination: '',
    filename: '',
    path: '',
    ...override,
  } as Express.Multer.File);

describe('DocumentsService', () => {
  let service: DocumentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: STORAGE_PROVIDER, useValue: mockStorage },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('upload', () => {
    it('uploads a valid PDF file', async () => {
      const file = createMockFile();
      mockStorage.upload.mockResolvedValue({ path: 'item-1/test.pdf', url: '/uploads/item-1/test.pdf' });
      mockPrisma.document.create.mockResolvedValue(mockDocument);

      const result = await service.upload(file, { legislativeItemId: 'item-1' }, 'user-1');

      expect(mockStorage.upload).toHaveBeenCalledWith(file, expect.stringContaining('item-1/'));
      expect(mockPrisma.document.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            legislativeItemId: 'item-1',
            uploadedById: 'user-1',
            mimeType: 'application/pdf',
          }),
        }),
      );
      expect(result).toEqual(mockDocument);
    });

    it('rejects files exceeding 50 MB', async () => {
      const largeFile = createMockFile({ size: 51 * 1024 * 1024 });
      await expect(service.upload(largeFile, {}, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('rejects disallowed MIME types', async () => {
      const badFile = createMockFile({ mimetype: 'application/x-executable' });
      await expect(service.upload(badFile, {}, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('accepts all allowed MIME types', async () => {
      const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'image/png',
        'image/jpeg',
        'text/plain',
      ];

      mockStorage.upload.mockResolvedValue({ path: 'x', url: '/x' });
      mockPrisma.document.create.mockResolvedValue(mockDocument);

      for (const mimetype of allowedTypes) {
        const file = createMockFile({ mimetype });
        await expect(service.upload(file, { legislativeItemId: 'item-1' }, 'user-1')).resolves.toBeDefined();
      }
    });
  });

  describe('findAll', () => {
    it('returns paginated documents', async () => {
      mockPrisma.document.findMany.mockResolvedValue([mockDocument]);
      mockPrisma.document.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toEqual([mockDocument]);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('filters by legislativeItemId', async () => {
      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.document.count.mockResolvedValue(0);

      await service.findAll({ legislativeItemId: 'item-1' });

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ legislativeItemId: 'item-1' }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('returns document when found', async () => {
      mockPrisma.document.findUnique.mockResolvedValue(mockDocument);
      const result = await service.findById('doc-1');
      expect(result).toEqual(mockDocument);
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.document.findUnique.mockResolvedValue(null);
      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDownloadUrl', () => {
    it('returns signed URL and filename', async () => {
      mockPrisma.document.findUnique.mockResolvedValue(mockDocument);
      mockStorage.getSignedUrl.mockResolvedValue('/uploads/item-1/test.pdf?expires=9999999');

      const result = await service.getDownloadUrl('doc-1');

      expect(result.url).toContain('/uploads/');
      expect(result.filename).toBe('test.pdf');
    });
  });

  describe('delete', () => {
    it('deletes storage file and DB record', async () => {
      mockPrisma.document.findUnique.mockResolvedValue(mockDocument);
      mockStorage.delete.mockResolvedValue(undefined);
      mockPrisma.document.delete.mockResolvedValue(mockDocument);

      await service.delete('doc-1');

      expect(mockStorage.delete).toHaveBeenCalledWith(mockDocument.storagePath);
      expect(mockPrisma.document.delete).toHaveBeenCalledWith({ where: { id: 'doc-1' } });
    });

    it('throws NotFoundException when document not found', async () => {
      mockPrisma.document.findUnique.mockResolvedValue(null);
      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
