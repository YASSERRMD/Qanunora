import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { TenancyService } from '../tenancy.service';
import { PrismaService } from '../../database/prisma.service';

const MOCK_TENANT = {
  id: 'tenant-uuid-1',
  name: 'Ministry of Justice',
  slug: 'ministry-of-justice',
  isActive: true,
  settings: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeMockPrisma() {
  return {
    tenant: {
      findUnique: jest.fn().mockResolvedValue(MOCK_TENANT),
      findMany: jest.fn().mockResolvedValue([MOCK_TENANT]),
      create: jest.fn().mockResolvedValue(MOCK_TENANT),
      update: jest.fn().mockResolvedValue({ ...MOCK_TENANT, name: 'Updated' }),
      delete: jest.fn().mockResolvedValue(MOCK_TENANT),
    },
    user: {
      count: jest.fn().mockResolvedValue(5),
      update: jest.fn().mockResolvedValue({ id: 'user-1', tenantId: 'tenant-uuid-1' }),
    },
    ministry: {
      count: jest.fn().mockResolvedValue(2),
      findMany: jest.fn().mockResolvedValue([{ id: 'min-1' }]),
    },
    legislativeItem: {
      count: jest.fn().mockResolvedValue(10),
    },
  };
}

describe('TenancyService', () => {
  let service: TenancyService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;

  beforeEach(async () => {
    mockPrisma = makeMockPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenancyService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<TenancyService>(TenancyService);
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('creates a tenant when slug is unique', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValueOnce(null);
      const result = await service.create({ name: 'MOJ', slug: 'moj' });
      expect(result).toEqual(MOCK_TENANT);
      expect(mockPrisma.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ slug: 'moj' }) }),
      );
    });

    it('throws ConflictException when slug already exists', async () => {
      // findUnique returns existing tenant (slug conflict)
      mockPrisma.tenant.findUnique.mockResolvedValueOnce(MOCK_TENANT);
      await expect(service.create({ name: 'Dup', slug: 'ministry-of-justice' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------

  describe('findAll', () => {
    it('returns all tenants ordered by createdAt desc', async () => {
      const result = await service.findAll();
      expect(Array.isArray(result)).toBe(true);
      expect(mockPrisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findById
  // ---------------------------------------------------------------------------

  describe('findById', () => {
    it('returns tenant by id', async () => {
      const result = await service.findById('tenant-uuid-1');
      expect(result).toEqual(MOCK_TENANT);
    });

    it('throws NotFoundException when tenant does not exist', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValueOnce(null);
      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  describe('update', () => {
    it('updates tenant name', async () => {
      mockPrisma.tenant.findUnique
        .mockResolvedValueOnce(MOCK_TENANT) // findById check
        .mockResolvedValueOnce(null); // slug conflict check (no conflict)
      const result = await service.update('tenant-uuid-1', { name: 'Updated' });
      expect(mockPrisma.tenant.update).toHaveBeenCalled();
      expect(result.name).toBe('Updated');
    });

    it('throws ConflictException when new slug conflicts with another tenant', async () => {
      const other = { ...MOCK_TENANT, id: 'other-id' };
      mockPrisma.tenant.findUnique
        .mockResolvedValueOnce(MOCK_TENANT) // findById
        .mockResolvedValueOnce(other); // slug conflict check — different id
      await expect(
        service.update('tenant-uuid-1', { slug: 'taken-slug' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ---------------------------------------------------------------------------
  // remove
  // ---------------------------------------------------------------------------

  describe('remove', () => {
    it('deletes tenant and returns deleted: true', async () => {
      const result = await service.remove('tenant-uuid-1');
      expect(mockPrisma.tenant.delete).toHaveBeenCalledWith({ where: { id: 'tenant-uuid-1' } });
      expect(result).toEqual({ deleted: true });
    });

    it('throws NotFoundException when tenant does not exist', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValueOnce(null);
      await expect(service.remove('ghost-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // getTenantStats
  // ---------------------------------------------------------------------------

  describe('getTenantStats', () => {
    it('returns user, ministry, and item counts', async () => {
      const stats = await service.getTenantStats('tenant-uuid-1');
      expect(stats).toEqual({
        tenantId: 'tenant-uuid-1',
        userCount: 5,
        ministryCount: 2,
        itemCount: 10,
      });
    });

    it('throws NotFoundException for unknown tenant', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValueOnce(null);
      await expect(service.getTenantStats('ghost')).rejects.toThrow(NotFoundException);
    });
  });
});
