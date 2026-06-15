import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataRetentionService } from '../data-retention.service';
import { PrismaService } from '../../database/prisma.service';

const RULE = {
  id: 'rule-1',
  name: 'Archive Old',
  entityType: 'LegislativeItem',
  condition: { status: 'ARCHIVED', olderThanDays: 365 },
  action: 'ARCHIVE',
  retentionYears: 7,
  isActive: true,
  createdById: 'user-1',
  lastRunAt: null,
  nextRunAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const HOLD = {
  id: 'hold-1',
  entityType: 'LegislativeItem',
  entityId: 'item-1',
  reason: 'Litigation hold',
  heldById: 'user-1',
  isActive: true,
  expiresAt: null,
  releasedById: null,
  releasedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const ARCHIVED = {
  id: 'arch-1',
  entityType: 'LegislativeItem',
  entityId: 'item-2',
  archivedData: {},
  archiveReason: 'Manual archive',
  archivedById: 'user-1',
  restoredAt: null,
  restoredById: null,
  archivedAt: new Date(),
};

function makePrisma() {
  return {
    retentionRule: {
      create: jest.fn().mockResolvedValue(RULE),
      findMany: jest.fn().mockResolvedValue([RULE]),
      findUnique: jest.fn().mockResolvedValue(RULE),
      update: jest.fn().mockImplementation(({ data }: { data: unknown }) => Promise.resolve({ ...RULE, ...data as object })),
    },
    legalHold: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue(HOLD),
      update: jest.fn().mockResolvedValue({ ...HOLD, isActive: false }),
      findMany: jest.fn().mockResolvedValue([HOLD]),
    },
    archivedItem: {
      create: jest.fn().mockResolvedValue(ARCHIVED),
      findUnique: jest.fn().mockResolvedValue(ARCHIVED),
      findMany: jest.fn().mockResolvedValue([ARCHIVED]),
      update: jest.fn().mockResolvedValue({ ...ARCHIVED, restoredAt: new Date() }),
    },
    legislativeItem: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
  };
}

describe('DataRetentionService', () => {
  let service: DataRetentionService;
  let mockPrisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    mockPrisma = makePrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [DataRetentionService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<DataRetentionService>(DataRetentionService);
  });

  describe('createRule', () => {
    it('creates a retention rule with the correct data', async () => {
      const rule = await service.createRule(
        { name: 'Test', entityType: 'LegislativeItem', condition: {}, action: 'ARCHIVE' },
        'user-1',
      );
      expect(rule.name).toBe('Archive Old');
      expect(mockPrisma.retentionRule.create).toHaveBeenCalled();
    });
  });

  describe('getRules', () => {
    it('returns all retention rules', async () => {
      const rules = await service.getRules();
      expect(rules).toHaveLength(1);
    });
  });

  describe('runRule', () => {
    it('throws NotFoundException when rule does not exist', async () => {
      mockPrisma.retentionRule.findUnique.mockResolvedValue(null);
      await expect(service.runRule('missing')).rejects.toThrow(NotFoundException);
    });

    it('skips items with active legal holds', async () => {
      mockPrisma.legalHold.findMany.mockResolvedValue([{ entityId: 'item-99' }]);
      mockPrisma.legislativeItem.findMany.mockResolvedValue([
        { id: 'item-99', title: 'Held Item', status: 'ARCHIVED' },
      ]);

      const result = await service.runRule('rule-1');
      expect(result.skipped).toBe(1);
      expect(result.processed).toBe(0);
    });

    it('updates rule lastRunAt after execution', async () => {
      await service.runRule('rule-1');
      expect(mockPrisma.retentionRule.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ lastRunAt: expect.any(Date) }) }),
      );
    });
  });

  describe('createLegalHold', () => {
    it('creates a new legal hold', async () => {
      const hold = await service.createLegalHold(
        { entityType: 'LegislativeItem', entityId: 'item-1', reason: 'Test hold' },
        'user-1',
      );
      expect(hold.entityId).toBe('item-1');
    });

    it('throws BadRequestException when active hold already exists', async () => {
      mockPrisma.legalHold.findUnique.mockResolvedValue({ ...HOLD, isActive: true });
      await expect(
        service.createLegalHold(
          { entityType: 'LegislativeItem', entityId: 'item-1', reason: 'Duplicate' },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('releaseLegalHold', () => {
    it('sets isActive=false on release', async () => {
      const released = await service.releaseLegalHold('hold-1', 'user-2');
      expect(released.isActive).toBe(false);
    });
  });

  describe('archiveItem', () => {
    it('creates an archived item record', async () => {
      const item = await service.archiveItem(
        { entityType: 'LegislativeItem', entityId: 'item-2', archiveReason: 'Manual' },
        'user-1',
      );
      expect(item.entityId).toBe('item-2');
    });

    it('blocks archive when active hold exists', async () => {
      mockPrisma.legalHold.findUnique.mockResolvedValue({ ...HOLD, isActive: true });
      await expect(
        service.archiveItem(
          { entityType: 'LegislativeItem', entityId: 'item-1', archiveReason: 'Blocked' },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('restoreItem', () => {
    it('sets restoredAt and restoredById', async () => {
      const restored = await service.restoreItem('arch-1', 'user-2');
      expect(restored.restoredAt).toBeDefined();
    });

    it('throws NotFoundException for missing archive', async () => {
      mockPrisma.archivedItem.findUnique.mockResolvedValue(null);
      await expect(service.restoreItem('missing', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });
});
