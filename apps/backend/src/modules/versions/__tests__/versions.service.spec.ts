import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { VersionsService } from '../versions.service';
import { PrismaService } from '../../database/prisma.service';

const mockVersion = {
  id: 'ver-1',
  legislativeItemId: 'item-1',
  documentId: null,
  versionNumber: 1,
  label: 'Initial draft',
  notes: 'First snapshot',
  contentSnapshot: { title: 'Test Law', status: 'DRAFTING' },
  createdById: 'user-1',
  createdAt: new Date('2025-01-01'),
  document: null,
  legislativeItem: {
    id: 'item-1',
    referenceNumber: 'LI-2025-0001',
    title: 'Test Law',
  },
};

const mockVersion2 = {
  ...mockVersion,
  id: 'ver-2',
  versionNumber: 2,
  label: 'After review',
  contentSnapshot: { title: 'Test Law Revised', status: 'INTERNAL_REVIEW', newField: 'added' },
  createdAt: new Date('2025-02-01'),
};

const mockPrisma = {
  version: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
};

describe('VersionsService', () => {
  let service: VersionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VersionsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<VersionsService>(VersionsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createVersion', () => {
    it('creates first version with number 1', async () => {
      mockPrisma.version.findFirst.mockResolvedValue(null);
      mockPrisma.version.create.mockResolvedValue({ ...mockVersion, versionNumber: 1 });

      await service.createVersion({
        legislativeItemId: 'item-1',
        label: 'Initial draft',
        contentSnapshot: { title: 'Test Law' },
        createdById: 'user-1',
      });

      expect(mockPrisma.version.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ versionNumber: 1 }),
        }),
      );
    });

    it('increments version number from last version', async () => {
      mockPrisma.version.findFirst.mockResolvedValue(mockVersion);
      mockPrisma.version.create.mockResolvedValue({ ...mockVersion2 });

      await service.createVersion({
        legislativeItemId: 'item-1',
        label: 'After review',
        createdById: 'user-1',
      });

      expect(mockPrisma.version.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ versionNumber: 2 }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('returns versions ordered by number descending', async () => {
      mockPrisma.version.findMany.mockResolvedValue([mockVersion2, mockVersion]);

      const result = await service.findAll('item-1');

      expect(mockPrisma.version.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { legislativeItemId: 'item-1' },
          orderBy: { versionNumber: 'desc' },
        }),
      );
      expect(result.total).toBe(2);
    });
  });

  describe('findById', () => {
    it('returns version when found', async () => {
      mockPrisma.version.findUnique.mockResolvedValue(mockVersion);
      const result = await service.findById('ver-1');
      expect(result).toEqual(mockVersion);
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.version.findUnique.mockResolvedValue(null);
      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('restoreVersion', () => {
    it('creates a new version with snapshot from the restored version', async () => {
      mockPrisma.version.findUnique.mockResolvedValue(mockVersion);
      mockPrisma.version.findFirst.mockResolvedValue(mockVersion);
      mockPrisma.version.create.mockResolvedValue({
        ...mockVersion,
        id: 'ver-3',
        versionNumber: 2,
        label: 'Restored from v1',
      });

      const result = await service.restoreVersion('item-1', 'ver-1', 'user-1');

      expect(mockPrisma.version.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            label: 'Restored from v1',
            contentSnapshot: mockVersion.contentSnapshot,
          }),
        }),
      );
      expect(result.label).toBe('Restored from v1');
    });

    it('throws NotFoundException when version does not belong to item', async () => {
      mockPrisma.version.findUnique.mockResolvedValue({
        ...mockVersion,
        legislativeItemId: 'other-item',
      });
      await expect(service.restoreVersion('item-1', 'ver-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('compareVersions', () => {
    it('returns diff between two versions', async () => {
      mockPrisma.version.findUnique
        .mockResolvedValueOnce(mockVersion)
        .mockResolvedValueOnce(mockVersion2);

      const result = await service.compareVersions('ver-1', 'ver-2');

      expect(result.totalChanges).toBeGreaterThan(0);
      expect(result.v1.versionNumber).toBe(1);
      expect(result.v2.versionNumber).toBe(2);
      expect(result.diff).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'title', changed: true }),
          expect.objectContaining({ field: 'status', changed: true }),
          expect.objectContaining({ field: 'newField', changed: true }),
        ]),
      );
    });

    it('reports zero changes when comparing identical snapshots', async () => {
      mockPrisma.version.findUnique
        .mockResolvedValueOnce(mockVersion)
        .mockResolvedValueOnce({ ...mockVersion, id: 'ver-copy' });

      const result = await service.compareVersions('ver-1', 'ver-copy');
      expect(result.totalChanges).toBe(0);
      expect(result.diff.every((d) => !d.changed)).toBe(true);
    });
  });
});
