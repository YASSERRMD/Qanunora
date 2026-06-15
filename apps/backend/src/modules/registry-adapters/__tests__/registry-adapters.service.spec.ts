import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RegistryAdaptersService } from '../registry-adapters.service';
import { PrismaService } from '../../database/prisma.service';
import { RegistryType } from '../dto/registry-adapters.dto';

const ADAPTER = {
  id: 'ada-1',
  name: 'Entity Registry',
  registryType: 'ENTITY_REGISTRY',
  baseUrl: null,
  isEnabled: false,
  config: {},
  lastSyncAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  syncLogs: [],
};

const ENABLED_ADAPTER = { ...ADAPTER, isEnabled: true };

const SYNC_LOG = {
  id: 'log-1',
  adapterId: 'ada-1',
  syncType: 'FULL_SYNC',
  recordsIn: 5,
  recordsOut: 0,
  errors: [],
  success: true,
  startedAt: new Date(),
  completedAt: new Date(),
};

function makePrisma() {
  return {
    registryAdapter: {
      create: jest.fn().mockResolvedValue(ADAPTER),
      findMany: jest.fn().mockResolvedValue([ADAPTER]),
      findUnique: jest.fn().mockResolvedValue({ ...ADAPTER, syncLogs: [] }),
      update: jest.fn().mockImplementation((args: { data: unknown }) => Promise.resolve({ ...ADAPTER, ...args.data as object })),
    },
    registrySyncLog: {
      create: jest.fn().mockResolvedValue(SYNC_LOG),
      update: jest.fn().mockImplementation((args: { data: unknown }) => Promise.resolve({ ...SYNC_LOG, ...args.data as object })),
      findMany: jest.fn().mockResolvedValue([SYNC_LOG]),
    },
  };
}

describe('RegistryAdaptersService', () => {
  let service: RegistryAdaptersService;
  let mockPrisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    mockPrisma = makePrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [RegistryAdaptersService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<RegistryAdaptersService>(RegistryAdaptersService);
  });

  describe('createAdapter', () => {
    it('creates a registry adapter', async () => {
      const result = await service.createAdapter({ name: 'Entity Registry', registryType: RegistryType.ENTITY_REGISTRY });
      expect(result.name).toBe('Entity Registry');
      expect(mockPrisma.registryAdapter.create).toHaveBeenCalled();
    });
  });

  describe('listAdapters', () => {
    it('returns all adapters', async () => {
      const result = await service.listAdapters();
      expect(result).toHaveLength(1);
    });
  });

  describe('getAdapterById', () => {
    it('throws NotFoundException for unknown id', async () => {
      mockPrisma.registryAdapter.findUnique.mockResolvedValue(null);
      await expect(service.getAdapterById('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('enableAdapter / disableAdapter', () => {
    it('sets isEnabled=true on enable', async () => {
      await service.enableAdapter('ada-1');
      expect(mockPrisma.registryAdapter.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isEnabled: true } }),
      );
    });

    it('sets isEnabled=false on disable', async () => {
      await service.disableAdapter('ada-1');
      expect(mockPrisma.registryAdapter.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isEnabled: false } }),
      );
    });
  });

  describe('triggerSync', () => {
    it('throws BadRequestException when adapter is disabled', async () => {
      await expect(service.triggerSync('ada-1')).rejects.toThrow(BadRequestException);
    });

    it('runs sync and creates log when adapter is enabled', async () => {
      mockPrisma.registryAdapter.findUnique.mockResolvedValue({ ...ENABLED_ADAPTER, syncLogs: [] });
      const result = await service.triggerSync('ada-1');
      expect(mockPrisma.registrySyncLog.create).toHaveBeenCalled();
      expect(mockPrisma.registrySyncLog.update).toHaveBeenCalled();
    });
  });

  describe('getAdapterInstance', () => {
    it('returns correct adapter for each type', () => {
      const types = [
        RegistryType.ENTITY_REGISTRY,
        RegistryType.MINISTRY_REGISTRY,
        RegistryType.GAZETTE_REGISTRY,
        RegistryType.LEGAL_REFERENCE_REGISTRY,
        RegistryType.PERSONNEL_REGISTRY,
      ];
      for (const type of types) {
        const adapter = service.getAdapterInstance(type);
        expect(adapter).toBeDefined();
        expect(typeof adapter.sync).toBe('function');
        expect(typeof adapter.push).toBe('function');
      }
    });

    it('throws BadRequestException for unknown type', () => {
      expect(() => service.getAdapterInstance('UNKNOWN' as RegistryType)).toThrow(BadRequestException);
    });
  });

  describe('getSyncLogs', () => {
    it('returns logs filtered by adapterId', async () => {
      const result = await service.getSyncLogs('ada-1');
      expect(result).toHaveLength(1);
    });

    it('returns all logs when no adapterId provided', async () => {
      const result = await service.getSyncLogs();
      expect(result).toHaveLength(1);
    });
  });

  describe('stub adapter sync results', () => {
    it('entity registry returns 5 mock records', async () => {
      const adapter = service.getAdapterInstance(RegistryType.ENTITY_REGISTRY);
      const result = await adapter.sync();
      expect(result.records).toHaveLength(5);
      expect(result.errors).toHaveLength(0);
    });

    it('ministry registry returns 3 mock records', async () => {
      const adapter = service.getAdapterInstance(RegistryType.MINISTRY_REGISTRY);
      const result = await adapter.sync();
      expect(result.records).toHaveLength(3);
    });

    it('gazette registry returns error on sync (push-only)', async () => {
      const adapter = service.getAdapterInstance(RegistryType.GAZETTE_REGISTRY);
      const result = await adapter.sync();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('legal reference registry returns 10 mock records', async () => {
      const adapter = service.getAdapterInstance(RegistryType.LEGAL_REFERENCE_REGISTRY);
      const result = await adapter.sync();
      expect(result.records).toHaveLength(10);
    });

    it('personnel registry returns 5 mock records', async () => {
      const adapter = service.getAdapterInstance(RegistryType.PERSONNEL_REGISTRY);
      const result = await adapter.sync();
      expect(result.records).toHaveLength(5);
    });

    it('gazette registry push returns success with ref', async () => {
      const adapter = service.getAdapterInstance(RegistryType.GAZETTE_REGISTRY);
      const result = await adapter.push({ gazetteNumber: 'OG-2025-001', title: 'Test Law' });
      expect(result.success).toBe(true);
      expect(result.ref).toBe('OG-2025-001');
    });
  });
});
