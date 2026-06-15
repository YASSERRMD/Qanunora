import { Test, TestingModule } from '@nestjs/testing';
import { SecurityControlsService } from '../security-controls.service';
import { PrismaService } from '../../database/prisma.service';

const SESSION = {
  id: 'sess-1',
  userId: 'user-1',
  sessionToken: 'token-abc',
  deviceInfo: { browser: 'Chrome', os: 'macOS' },
  ipAddress: '1.2.3.4',
  userAgent: 'Mozilla/5.0',
  isActive: true,
  lastActivityAt: new Date(),
  expiresAt: new Date(Date.now() + 86400000),
  revokedAt: null,
  revokedById: null,
  createdAt: new Date(),
};

const SUSPICIOUS = {
  id: 'sus-1',
  activityType: 'BRUTE_FORCE',
  details: { failureCount: 5 },
  riskScore: 0.9,
  isResolved: false,
  resolvedById: null,
  resolvedAt: null,
  createdAt: new Date(),
};

function makePrisma() {
  return {
    userSession: {
      create: jest.fn().mockResolvedValue(SESSION),
      findMany: jest.fn().mockResolvedValue([SESSION]),
      update: jest.fn().mockResolvedValue({ ...SESSION, isActive: false }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    loginHistory: {
      create: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([
        { id: 'l1', email: 'user@test.com', success: true, createdAt: new Date() },
      ]),
    },
    ipRestriction: {
      create: jest.fn().mockResolvedValue({ id: 'ip-1', ipAddress: '1.2.3.4', type: 'BLOCK' }),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ id: 'ip-1', isActive: false }),
    },
    suspiciousActivity: {
      create: jest.fn().mockResolvedValue(SUSPICIOUS),
      findMany: jest.fn().mockResolvedValue([SUSPICIOUS]),
      update: jest.fn().mockResolvedValue({ ...SUSPICIOUS, isResolved: true }),
    },
    auditLog: {
      count: jest.fn().mockResolvedValue(0),
    },
  };
}

describe('SecurityControlsService', () => {
  let service: SecurityControlsService;
  let mockPrisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    mockPrisma = makePrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [SecurityControlsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<SecurityControlsService>(SecurityControlsService);
  });

  describe('createSession', () => {
    it('creates a session record', async () => {
      const sess = await service.createSession(
        'user-1', 'token', { browser: 'Chrome' }, '1.2.3.4', 'UA', new Date(),
      );
      expect(sess.sessionToken).toBe('token-abc');
      expect(mockPrisma.userSession.create).toHaveBeenCalled();
    });
  });

  describe('getActiveSessions', () => {
    it('returns only active sessions for user', async () => {
      const sessions = await service.getActiveSessions('user-1');
      expect(sessions).toHaveLength(1);
      expect(mockPrisma.userSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1', isActive: true } }),
      );
    });
  });

  describe('revokeSession', () => {
    it('sets isActive=false and records revokedBy', async () => {
      const result = await service.revokeSession('sess-1', 'user-admin');
      expect(mockPrisma.userSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false, revokedById: 'user-admin' }),
        }),
      );
    });
  });

  describe('revokeAllSessions', () => {
    it('calls updateMany for all active sessions of the user', async () => {
      await service.revokeAllSessions('user-1');
      expect(mockPrisma.userSession.updateMany).toHaveBeenCalled();
    });
  });

  describe('recordLogin', () => {
    it('creates a login history entry on success', async () => {
      await service.recordLogin({ email: 'u@test.com', success: true });
      expect(mockPrisma.loginHistory.create).toHaveBeenCalled();
    });

    it('triggers brute force detection after 5 failures', async () => {
      mockPrisma.loginHistory.count.mockResolvedValue(5);
      await service.recordLogin({ email: 'u@test.com', success: false, failReason: 'wrong password' });
      expect(mockPrisma.suspiciousActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ activityType: 'BRUTE_FORCE' }) }),
      );
    });

    it('does not trigger brute force for fewer than 5 failures', async () => {
      mockPrisma.loginHistory.count.mockResolvedValue(3);
      await service.recordLogin({ email: 'u@test.com', success: false });
      expect(mockPrisma.suspiciousActivity.create).not.toHaveBeenCalled();
    });
  });

  describe('checkIpRestriction', () => {
    it('returns blocked=false when no restriction exists', async () => {
      const result = await service.checkIpRestriction('1.2.3.4');
      expect(result.blocked).toBe(false);
    });

    it('returns blocked=true for BLOCK type restriction', async () => {
      mockPrisma.ipRestriction.findFirst.mockResolvedValue({
        id: 'ip-1', type: 'BLOCK', reason: 'Banned', expiresAt: null,
      });
      const result = await service.checkIpRestriction('1.2.3.4');
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('Banned');
    });

    it('returns blocked=false for ALLOW type restriction', async () => {
      mockPrisma.ipRestriction.findFirst.mockResolvedValue({
        id: 'ip-2', type: 'ALLOW', reason: null, expiresAt: null,
      });
      const result = await service.checkIpRestriction('1.2.3.4');
      expect(result.blocked).toBe(false);
    });
  });

  describe('getSuspiciousActivities', () => {
    it('returns list of suspicious activities', async () => {
      const activities = await service.getSuspiciousActivities(false);
      expect(activities).toHaveLength(1);
      expect(activities[0].activityType).toBe('BRUTE_FORCE');
    });
  });

  describe('resolveActivity', () => {
    it('marks activity as resolved', async () => {
      const result = await service.resolveActivity('sus-1', 'user-admin');
      expect(mockPrisma.suspiciousActivity.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isResolved: true }) }),
      );
    });
  });

  describe('detectMassExport', () => {
    it('returns null when below threshold', async () => {
      mockPrisma.auditLog.count.mockResolvedValue(5);
      const result = await service.detectMassExport('user-1', 15, 10);
      expect(result).toBeNull();
    });

    it('records MASS_EXPORT when threshold exceeded', async () => {
      mockPrisma.auditLog.count.mockResolvedValue(15);
      await service.detectMassExport('user-1', 15, 10);
      expect(mockPrisma.suspiciousActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ activityType: 'MASS_EXPORT' }) }),
      );
    });
  });
});
