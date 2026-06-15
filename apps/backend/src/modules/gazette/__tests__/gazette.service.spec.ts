import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { GazetteService } from '../gazette.service';
import { PrismaService } from '../../database/prisma.service';

const LEGISLATIVE_ITEM = {
  id: 'item-1',
  title: 'Test Law 2025',
  titleAr: 'قانون اختبار 2025',
  referenceNumber: 'LAW-2025-001',
  status: 'PUBLISHED',
  type: 'DRAFT_LAW',
};

const CHECKLIST = [
  { id: 'cl-1', gazetteId: 'gaz-1', item: 'Final text confirmed', isCompleted: false, completedAt: null, order: 1 },
  { id: 'cl-2', gazetteId: 'gaz-1', item: 'Legal review complete', isCompleted: false, completedAt: null, order: 2 },
];

const ALL_COMPLETE_CHECKLIST = CHECKLIST.map((c) => ({ ...c, isCompleted: true, completedAt: new Date() }));

const GAZETTE_ENTRY = {
  id: 'gaz-1',
  gazetteNumber: 'OG-2025-1234',
  legislativeItemId: 'item-1',
  title: 'Test Law 2025',
  titleAr: null,
  effectiveDate: null,
  issueDate: null,
  publicationStatus: 'PREPARING',
  approvedById: null,
  approvedAt: null,
  publishedAt: null,
  archiveUrl: null,
  metadata: {},
  createdById: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  checklist: CHECKLIST,
  legislativeItem: { title: 'Test Law 2025', referenceNumber: 'LAW-2025-001', type: 'DRAFT_LAW', status: 'PUBLISHED' },
  createdBy: { id: 'user-1', firstName: 'Admin', lastName: 'User' },
  approvedBy: null,
};

function makePrisma() {
  return {
    legislativeItem: {
      findUnique: jest.fn().mockResolvedValue(LEGISLATIVE_ITEM),
    },
    gazetteEntry: {
      create: jest.fn().mockResolvedValue(GAZETTE_ENTRY),
      findUnique: jest.fn().mockResolvedValue(GAZETTE_ENTRY),
      findMany: jest.fn().mockResolvedValue([GAZETTE_ENTRY]),
      update: jest.fn().mockImplementation((args: { data: unknown }) => Promise.resolve({ ...GAZETTE_ENTRY, ...args.data as object })),
    },
    gazetteChecklist: {
      update: jest.fn().mockImplementation((args: { data: unknown }) => Promise.resolve({ ...CHECKLIST[0], ...args.data as object })),
    },
  };
}

describe('GazetteService', () => {
  let service: GazetteService;
  let mockPrisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    mockPrisma = makePrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [GazetteService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<GazetteService>(GazetteService);
  });

  describe('createEntry', () => {
    it('creates gazette entry for published item', async () => {
      mockPrisma.gazetteEntry.findUnique.mockResolvedValueOnce(null); // No existing entry
      mockPrisma.gazetteEntry.findUnique.mockResolvedValue(null); // No number conflict
      mockPrisma.gazetteEntry.create.mockResolvedValue(GAZETTE_ENTRY);
      const result = await service.createEntry('item-1', 'user-1');
      expect(result.gazetteNumber).toMatch(/^OG-\d{4}-\d{4}$/);
    });

    it('throws BadRequestException if item is not PUBLISHED', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue({ ...LEGISLATIVE_ITEM, status: 'DRAFTING' });
      await expect(service.createEntry('item-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException if item not found', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(null);
      await expect(service.createEntry('missing', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getEntry', () => {
    it('returns gazette entry with checklist', async () => {
      const result = await service.getEntry('gaz-1');
      expect(result.id).toBe('gaz-1');
      expect(result.checklist).toBeDefined();
    });

    it('throws NotFoundException for unknown id', async () => {
      mockPrisma.gazetteEntry.findUnique.mockResolvedValue(null);
      await expect(service.getEntry('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('completeChecklistItem', () => {
    it('marks checklist item as completed', async () => {
      await service.completeChecklistItem('gaz-1', 'cl-1');
      expect(mockPrisma.gazetteChecklist.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isCompleted: true }) }),
      );
    });

    it('throws NotFoundException if checklist item not found', async () => {
      await expect(service.completeChecklistItem('gaz-1', 'cl-missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('submitForApproval', () => {
    it('throws BadRequestException if checklist incomplete', async () => {
      await expect(service.submitForApproval('gaz-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('submits for approval when all checklist items complete', async () => {
      mockPrisma.gazetteEntry.findUnique.mockResolvedValue({ ...GAZETTE_ENTRY, checklist: ALL_COMPLETE_CHECKLIST });
      await service.submitForApproval('gaz-1', 'user-1');
      expect(mockPrisma.gazetteEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { publicationStatus: 'PENDING_APPROVAL' } }),
      );
    });
  });

  describe('approve', () => {
    it('approves a PENDING_APPROVAL entry', async () => {
      mockPrisma.gazetteEntry.findUnique.mockResolvedValue({ ...GAZETTE_ENTRY, publicationStatus: 'PENDING_APPROVAL', checklist: [] });
      await service.approve('gaz-1', 'user-1');
      expect(mockPrisma.gazetteEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ publicationStatus: 'APPROVED', approvedById: 'user-1' }) }),
      );
    });

    it('throws BadRequestException if not in PENDING_APPROVAL status', async () => {
      mockPrisma.gazetteEntry.findUnique.mockResolvedValue({ ...GAZETTE_ENTRY, publicationStatus: 'PREPARING', checklist: [] });
      await expect(service.approve('gaz-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('publish', () => {
    it('publishes an APPROVED entry', async () => {
      mockPrisma.gazetteEntry.findUnique.mockResolvedValue({ ...GAZETTE_ENTRY, publicationStatus: 'APPROVED', checklist: [] });
      await service.publish('gaz-1', 'user-1');
      expect(mockPrisma.gazetteEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ publicationStatus: 'PUBLISHED' }) }),
      );
    });

    it('throws BadRequestException if not APPROVED', async () => {
      mockPrisma.gazetteEntry.findUnique.mockResolvedValue({ ...GAZETTE_ENTRY, publicationStatus: 'PREPARING', checklist: [] });
      await expect(service.publish('gaz-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('retract', () => {
    it('retracts a PUBLISHED entry', async () => {
      mockPrisma.gazetteEntry.findUnique.mockResolvedValue({ ...GAZETTE_ENTRY, publicationStatus: 'PUBLISHED', checklist: [] });
      await service.retract('gaz-1', 'user-1', { reason: 'Error found' });
      expect(mockPrisma.gazetteEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ publicationStatus: 'RETRACTED' }) }),
      );
    });

    it('throws BadRequestException if not PUBLISHED', async () => {
      mockPrisma.gazetteEntry.findUnique.mockResolvedValue({ ...GAZETTE_ENTRY, publicationStatus: 'PREPARING', checklist: [] });
      await expect(service.retract('gaz-1', 'user-1', { reason: 'Error' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('buildPublicationPackage', () => {
    it('returns complete package summary', async () => {
      const pkg = await service.buildPublicationPackage('gaz-1');
      expect(pkg.gazetteNumber).toBe('OG-2025-1234');
      expect(pkg.checklistCompletion).toBeDefined();
      expect(pkg.checklistCompletion.total).toBe(2);
    });
  });

  describe('getPublishedArchive', () => {
    it('returns published entries', async () => {
      const result = await service.getPublishedArchive();
      expect(result).toHaveLength(1);
    });

    it('filters by year', async () => {
      await service.getPublishedArchive(2025);
      expect(mockPrisma.gazetteEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ publicationStatus: 'PUBLISHED' }) }),
      );
    });
  });
});
