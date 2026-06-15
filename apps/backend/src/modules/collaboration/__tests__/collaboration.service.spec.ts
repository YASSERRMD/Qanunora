import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CollaborationService } from '../collaboration.service';
import { PrismaService } from '../../database/prisma.service';
import { CollaborationGateway } from '../collaboration.gateway';

const futureDate = new Date(Date.now() + 30 * 60 * 1000);
const pastDate = new Date(Date.now() - 1000);

const mockItem = { id: 'item-1', title: 'Test Bill' };

const mockLock = {
  id: 'lock-1',
  legislativeItemId: 'item-1',
  lockedById: 'user-1',
  lockedBy: { id: 'user-1', firstName: 'Ahmad', lastName: 'Al-Rashid' },
  lockedAt: new Date(),
  expiresAt: futureDate,
  sessionId: 'sess-1',
};

const mockSnapshot = {
  id: 'snap-1',
  legislativeItemId: 'item-1',
  content: 'Document content...',
  savedById: 'user-1',
  savedBy: { id: 'user-1', firstName: 'Ahmad', lastName: 'Al-Rashid' },
  savedAt: new Date(),
};

const mockPrisma = {
  legislativeItem: { findUnique: jest.fn() },
  documentLock: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  autosaveSnapshot: {
    create: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
};

const mockGateway = {
  getPresence: jest.fn().mockReturnValue([]),
};

describe('CollaborationService', () => {
  let service: CollaborationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollaborationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CollaborationGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get<CollaborationService>(CollaborationService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('acquireLock', () => {
    it('creates a new lock when none exists', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(mockItem);
      mockPrisma.documentLock.findUnique.mockResolvedValue(null);
      mockPrisma.documentLock.create.mockResolvedValue(mockLock);

      const result = await service.acquireLock('item-1', 'user-1', {});
      expect(result).toEqual(mockLock);
      expect(mockPrisma.documentLock.create).toHaveBeenCalled();
    });

    it('extends lock for the same user', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(mockItem);
      mockPrisma.documentLock.findUnique.mockResolvedValue(mockLock);
      mockPrisma.documentLock.update.mockResolvedValue({ ...mockLock, expiresAt: futureDate });

      const result = await service.acquireLock('item-1', 'user-1', {});
      expect(mockPrisma.documentLock.update).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('throws ConflictException when locked by another user', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(mockItem);
      mockPrisma.documentLock.findUnique.mockResolvedValue({
        ...mockLock,
        lockedById: 'user-2',
        lockedBy: { id: 'user-2', firstName: 'Sara', lastName: 'Mohammed' },
      });

      await expect(service.acquireLock('item-1', 'user-1', {})).rejects.toThrow(ConflictException);
    });

    it('acquires lock when existing lock is expired', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(mockItem);
      mockPrisma.documentLock.findUnique.mockResolvedValue({ ...mockLock, lockedById: 'user-2', expiresAt: pastDate });
      mockPrisma.documentLock.delete.mockResolvedValue({});
      mockPrisma.documentLock.create.mockResolvedValue(mockLock);

      const result = await service.acquireLock('item-1', 'user-1', {});
      expect(mockPrisma.documentLock.delete).toHaveBeenCalled();
      expect(result).toEqual(mockLock);
    });
  });

  describe('releaseLock', () => {
    it('releases a lock held by the user', async () => {
      mockPrisma.documentLock.findUnique.mockResolvedValue(mockLock);
      mockPrisma.documentLock.delete.mockResolvedValue({});

      const result = await service.releaseLock('item-1', 'user-1');
      expect(result).toEqual({ released: true });
    });

    it('throws ForbiddenException when user does not hold the lock', async () => {
      mockPrisma.documentLock.findUnique.mockResolvedValue({ ...mockLock, lockedById: 'user-2' });
      await expect(service.releaseLock('item-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when no lock exists', async () => {
      mockPrisma.documentLock.findUnique.mockResolvedValue(null);
      await expect(service.releaseLock('item-1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('checkLock', () => {
    it('returns lock info when lock is active', async () => {
      mockPrisma.documentLock.findUnique.mockResolvedValue(mockLock);
      const result = await service.checkLock('item-1');
      expect(result).toEqual(mockLock);
    });

    it('returns null and deletes expired lock', async () => {
      mockPrisma.documentLock.findUnique.mockResolvedValue({ ...mockLock, expiresAt: pastDate });
      mockPrisma.documentLock.delete.mockResolvedValue({});
      const result = await service.checkLock('item-1');
      expect(result).toBeNull();
      expect(mockPrisma.documentLock.delete).toHaveBeenCalled();
    });

    it('returns null when no lock exists', async () => {
      mockPrisma.documentLock.findUnique.mockResolvedValue(null);
      const result = await service.checkLock('item-1');
      expect(result).toBeNull();
    });
  });

  describe('autoSave', () => {
    it('creates a new autosave snapshot', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(mockItem);
      mockPrisma.autosaveSnapshot.create.mockResolvedValue(mockSnapshot);
      mockPrisma.autosaveSnapshot.findMany.mockResolvedValue([mockSnapshot]);

      const result = await service.autoSave('item-1', { content: 'Document content...' }, 'user-1');
      expect(result).toEqual(mockSnapshot);
    });

    it('deletes older snapshots when more than 5 exist', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(mockItem);
      mockPrisma.autosaveSnapshot.create.mockResolvedValue(mockSnapshot);

      const sixSnapshots = Array.from({ length: 6 }, (_, i) => ({ id: `snap-${i}` }));
      mockPrisma.autosaveSnapshot.findMany.mockResolvedValue(sixSnapshots);
      mockPrisma.autosaveSnapshot.deleteMany.mockResolvedValue({ count: 1 });

      await service.autoSave('item-1', { content: 'new content' }, 'user-1');
      expect(mockPrisma.autosaveSnapshot.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['snap-5'] } },
        }),
      );
    });
  });

  describe('getPresence', () => {
    it('delegates to gateway.getPresence', () => {
      mockGateway.getPresence.mockReturnValue(['user-1', 'user-2']);
      const result = service.getPresence('item-1');
      expect(result).toEqual(['user-1', 'user-2']);
      expect(mockGateway.getPresence).toHaveBeenCalledWith('item-1');
    });
  });
});
