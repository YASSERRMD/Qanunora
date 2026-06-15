import { Test, TestingModule } from '@nestjs/testing';
import { createHash } from 'crypto';
import { AuditChainService } from '../audit-chain.service';
import { PrismaService } from '../../database/prisma.service';

function computeHash(
  seq: number,
  eventType: string,
  actorId: string | null | undefined,
  entityId: string,
  action: string,
  payload: unknown,
  previousHash: string | null | undefined,
): string {
  const data = [seq.toString(), eventType, actorId ?? '', entityId, action, JSON.stringify(payload), previousHash ?? ''].join('|');
  return createHash('sha256').update(data).digest('hex');
}

const ENTRY_1 = {
  id: 'entry-1',
  sequenceNumber: 1,
  eventType: 'TEST',
  actorId: 'user-1',
  actorEmail: 'user@test.com',
  entityType: 'LegislativeItem',
  entityId: 'item-1',
  action: 'CREATE',
  payload: { note: 'test' },
  ipAddress: '127.0.0.1',
  userAgent: 'test-agent',
  previousHash: null,
  entryHash: '',
  retainUntil: null,
  createdAt: new Date(),
};

function makePrisma() {
  ENTRY_1.entryHash = computeHash(1, 'TEST', 'user-1', 'item-1', 'CREATE', { note: 'test' }, null);
  return {
    immutableAuditEntry: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(ENTRY_1),
      findMany: jest.fn().mockResolvedValue([ENTRY_1]),
      count: jest.fn().mockResolvedValue(1),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    auditRetentionPolicy: {
      findMany: jest.fn().mockResolvedValue([{ id: 'p1', entityType: 'LegislativeItem', retentionDays: 365, isActive: true }]),
      upsert: jest.fn().mockResolvedValue({ id: 'p1', entityType: 'LegislativeItem', retentionDays: 365 }),
    },
  };
}

describe('AuditChainService', () => {
  let service: AuditChainService;
  let mockPrisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    mockPrisma = makePrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditChainService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<AuditChainService>(AuditChainService);
  });

  describe('recordEvent', () => {
    it('creates an entry with sequence number 1 when no prior entries exist', async () => {
      mockPrisma.immutableAuditEntry.findFirst.mockResolvedValue(null);
      await service.recordEvent({
        eventType: 'TEST',
        actorId: 'user-1',
        actorEmail: 'user@test.com',
        entityType: 'LegislativeItem',
        entityId: 'item-1',
        action: 'CREATE',
        payload: {},
      });

      expect(mockPrisma.immutableAuditEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ sequenceNumber: 1, previousHash: null }) }),
      );
    });

    it('increments sequence number from last entry', async () => {
      mockPrisma.immutableAuditEntry.findFirst.mockResolvedValue({ sequenceNumber: 5, entryHash: 'prev-hash' });

      await service.recordEvent({
        eventType: 'UPDATE',
        entityType: 'LegislativeItem',
        entityId: 'item-1',
        action: 'UPDATE',
        payload: {},
      });

      expect(mockPrisma.immutableAuditEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ sequenceNumber: 6, previousHash: 'prev-hash' }) }),
      );
    });

    it('computes a deterministic SHA-256 entry hash', async () => {
      let capturedData: Record<string, unknown> = {};
      mockPrisma.immutableAuditEntry.create.mockImplementation((args: { data: Record<string, unknown> }) => {
        capturedData = args.data;
        return Promise.resolve(capturedData);
      });

      await service.recordEvent({
        eventType: 'VIEW',
        actorId: 'u1',
        entityType: 'Item',
        entityId: 'e1',
        action: 'VIEW',
        payload: { x: 1 },
      });

      const expected = computeHash(1, 'VIEW', 'u1', 'e1', 'VIEW', { x: 1 }, null);
      expect(capturedData['entryHash']).toBe(expected);
    });
  });

  describe('verifyChainIntegrity', () => {
    it('returns valid=true for a correct single-entry chain', async () => {
      const result = await service.verifyChainIntegrity();
      expect(result.valid).toBe(true);
      expect(result.checked).toBe(1);
    });

    it('returns valid=false when hash is tampered', async () => {
      const tampered = { ...ENTRY_1, entryHash: 'tampered-hash' };
      mockPrisma.immutableAuditEntry.findMany.mockResolvedValue([tampered]);

      const result = await service.verifyChainIntegrity();
      expect(result.valid).toBe(false);
      expect(result.firstBrokenAt).toBe(1);
    });
  });

  describe('exportEvidence', () => {
    it('returns JSON format by default', async () => {
      const result = await service.exportEvidence('LegislativeItem', 'item-1', 'json');
      expect(result.format).toBe('json');
      expect(result.count).toBe(1);
    });

    it('returns CSV format when requested', async () => {
      const result = await service.exportEvidence('LegislativeItem', 'item-1', 'csv');
      expect(result.format).toBe('csv');
      expect(typeof result.content).toBe('string');
      expect((result.content as string)).toContain('sequenceNumber');
    });
  });

  describe('getRetentionPolicies', () => {
    it('lists all retention policies', async () => {
      const policies = await service.getRetentionPolicies();
      expect(policies).toHaveLength(1);
      expect(policies[0].entityType).toBe('LegislativeItem');
    });
  });

  describe('upsertRetentionPolicy', () => {
    it('calls prisma upsert with the correct entity type', async () => {
      await service.upsertRetentionPolicy('LegislativeItem', { retentionDays: 730 });
      expect(mockPrisma.auditRetentionPolicy.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { entityType: 'LegislativeItem' } }),
      );
    });
  });

  describe('recordSensitiveAction', () => {
    it('records an event with eventType SENSITIVE_ACTION', async () => {
      await service.recordSensitiveAction('u1', 'u@test.com', 'Item', 'i1', 'DELETE', {});
      expect(mockPrisma.immutableAuditEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ eventType: 'SENSITIVE_ACTION' }) }),
      );
    });
  });
});
