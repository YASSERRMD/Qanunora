import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SsoService } from '../sso.service';
import { PrismaService } from '../../database/prisma.service';

const PROVIDER = {
  id: 'prov-1',
  name: 'Test OIDC',
  type: 'OIDC',
  isActive: true,
  config: { encrypted: 'PLACEHOLDER' },
  createdById: 'user-admin',
  createdAt: new Date(),
  updatedAt: new Date(),
  groupMappings: [],
  userMappings: [],
};

const GROUP_MAPPING = {
  id: 'gm-1',
  providerId: 'prov-1',
  groupName: 'admin-group',
  role: 'LEGISLATIVE_ADMIN',
  createdAt: new Date(),
};

const USER = {
  id: 'user-jit-1',
  email: 'jit@sso.local',
  firstName: 'SSO',
  lastName: 'User',
  role: 'VIEWER',
  isActive: true,
};

const USER_MAPPING = {
  id: 'um-1',
  providerId: 'prov-1',
  userId: USER.id,
  externalId: 'ext-123',
  externalEmail: 'jit@example.com',
  lastLoginAt: null,
  createdAt: new Date(),
  user: USER,
};

function makePrisma() {
  return {
    identityProvider: {
      create: jest.fn().mockResolvedValue(PROVIDER),
      findMany: jest.fn().mockResolvedValue([PROVIDER]),
      findUnique: jest.fn().mockResolvedValue(PROVIDER),
      update: jest.fn().mockImplementation((args: { data: unknown }) => Promise.resolve({ ...PROVIDER, ...args.data as object })),
      delete: jest.fn().mockResolvedValue(PROVIDER),
    },
    idpGroupMapping: {
      create: jest.fn().mockResolvedValue(GROUP_MAPPING),
      findMany: jest.fn().mockResolvedValue([GROUP_MAPPING]),
      findUnique: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(GROUP_MAPPING),
    },
    idpUserMapping: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(USER_MAPPING),
      update: jest.fn().mockResolvedValue({ ...USER_MAPPING, lastLoginAt: new Date() }),
    },
    user: {
      create: jest.fn().mockResolvedValue(USER),
    },
  };
}

describe('SsoService', () => {
  let service: SsoService;
  let mockPrisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    mockPrisma = makePrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [SsoService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<SsoService>(SsoService);
  });

  describe('createProvider', () => {
    it('encrypts config and creates provider', async () => {
      const result = await service.createProvider(
        { name: 'Test OIDC', type: 'OIDC', config: { clientId: 'abc' } },
        'user-admin',
      );
      expect(result.name).toBe('Test OIDC');
      // Config should be stored as encrypted blob
      const createCall = (mockPrisma.identityProvider.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.config).toHaveProperty('encrypted');
    });
  });

  describe('listProviders', () => {
    it('returns providers with masked config', async () => {
      const providers = await service.listProviders();
      expect(providers).toHaveLength(1);
      expect(providers[0].config).toEqual({ type: 'OIDC', encrypted: true });
    });
  });

  describe('getProvider', () => {
    it('throws NotFoundException for unknown provider', async () => {
      mockPrisma.identityProvider.findUnique.mockResolvedValue(null);
      await expect(service.getProvider('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('activateProvider / deactivateProvider', () => {
    it('sets isActive=true on activate', async () => {
      await service.activateProvider('prov-1');
      expect(mockPrisma.identityProvider.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: true } }),
      );
    });

    it('sets isActive=false on deactivate', async () => {
      await service.deactivateProvider('prov-1');
      expect(mockPrisma.identityProvider.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
    });
  });

  describe('createGroupMapping', () => {
    it('creates group → role mapping', async () => {
      const mapping = await service.createGroupMapping('prov-1', { groupName: 'admin-group', role: 'LEGISLATIVE_ADMIN' });
      expect(mapping.groupName).toBe('admin-group');
      expect(mapping.role).toBe('LEGISLATIVE_ADMIN');
    });
  });

  describe('jitProvision', () => {
    it('creates a new user when no existing mapping found', async () => {
      const user = await service.jitProvision({
        providerId: 'prov-1',
        externalId: 'ext-new',
        externalEmail: 'new@example.com',
        externalGroups: [],
      });
      expect(mockPrisma.user.create).toHaveBeenCalled();
      expect(user).toBeDefined();
    });

    it('returns existing user when mapping already exists', async () => {
      mockPrisma.idpUserMapping.findUnique.mockResolvedValue(USER_MAPPING);
      const user = await service.jitProvision({
        providerId: 'prov-1',
        externalId: 'ext-123',
        externalEmail: 'jit@example.com',
      });
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('resolves role from group mapping when groups provided', async () => {
      mockPrisma.idpGroupMapping.findMany.mockResolvedValue([GROUP_MAPPING]);
      await service.jitProvision({
        providerId: 'prov-1',
        externalId: 'ext-456',
        externalGroups: ['admin-group'],
      });
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ role: 'LEGISLATIVE_ADMIN' }) }),
      );
    });

    it('throws NotFoundException for unknown provider', async () => {
      mockPrisma.identityProvider.findUnique.mockResolvedValue(null);
      await expect(
        service.jitProvision({ providerId: 'missing', externalId: 'ext-1' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('simulateJit', () => {
    it('returns CREATE_NEW_USER when no mapping exists', async () => {
      const result = await service.simulateJit({ providerId: 'prov-1', externalId: 'ext-new' });
      expect(result.action).toBe('CREATE_NEW_USER');
      expect(result.wouldCreate).toBe(true);
    });

    it('returns LOGIN_EXISTING_USER when mapping exists', async () => {
      mockPrisma.idpUserMapping.findUnique.mockResolvedValue(USER_MAPPING);
      const result = await service.simulateJit({ providerId: 'prov-1', externalId: 'ext-123' });
      expect(result.action).toBe('LOGIN_EXISTING_USER');
      expect(result.wouldCreate).toBe(false);
    });

    it('shows matched groups in simulation', async () => {
      mockPrisma.idpGroupMapping.findMany.mockResolvedValue([GROUP_MAPPING]);
      const result = await service.simulateJit({
        providerId: 'prov-1',
        externalId: 'ext-new',
        externalGroups: ['admin-group'],
      });
      expect(result.role).toBe('LEGISLATIVE_ADMIN');
      expect(result.matchedGroups).toContain('admin-group');
    });
  });
});
