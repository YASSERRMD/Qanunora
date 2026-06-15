import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from '../analytics.service';
import { PrismaService } from '../../database/prisma.service';

const ITEMS = [
  { status: 'PUBLISHED', type: 'DRAFT_LAW', ministryId: 'min-1' },
  { status: 'DRAFTING', type: 'BILL', ministryId: 'min-1' },
  { status: 'PUBLISHED', type: 'REGULATION', ministryId: 'min-2' },
];

const AI_ANALYSES = [
  { analysisType: 'SUMMARIZATION', confidenceScore: 0.9 },
  { analysisType: 'IMPACT', confidenceScore: 0.7 },
  { analysisType: 'SUMMARIZATION', confidenceScore: 0.8 },
];

const USERS = [
  { role: 'SUPER_ADMIN', lastLoginAt: new Date(), isActive: true },
  { role: 'REVIEWER', lastLoginAt: new Date(Date.now() - 90 * 86400000), isActive: true },
  { role: 'VIEWER', lastLoginAt: null, isActive: false },
];

const SNAPSHOT = {
  id: 'snap-1',
  snapshotDate: new Date(),
  metrics: {
    date: new Date().toISOString(),
    legislative: { total: 3, byStatus: { PUBLISHED: 2, DRAFTING: 1 }, byType: {}, byMinistry: {}, avgDraftingDays: 14, avgReviewDays: 21, avgApprovalDays: 30, publishedThisMonth: 1, publishedThisYear: 2 },
    consultations: { total: 5, open: 2, avgFeedbackPerConsultation: 3, totalFeedback: 15, moderationPendingCount: 4 },
    committees: { total: 3, avgMembersPerCommittee: 5 },
    amendments: { total: 10, pending: 3, incorporated: 5 },
    aiUsage: { totalAnalyses: 3, byType: { SUMMARIZATION: 2, IMPACT: 1 }, avgConfidence: 0.8 },
    users: { total: 2, byRole: { SUPER_ADMIN: 1, REVIEWER: 1 }, activeLastMonth: 1 },
    documents: { total: 50, totalSizeMb: 0 },
  },
  createdAt: new Date(),
};

function makePrisma() {
  return {
    legislativeItem: {
      findMany: jest.fn().mockResolvedValue(ITEMS),
      count: jest.fn().mockResolvedValue(2),
    },
    consultation: {
      count: jest.fn().mockResolvedValue(5),
      findMany: jest.fn().mockResolvedValue([
        { legislativeItem: { ministryId: 'min-1' } },
        { legislativeItem: { ministryId: 'min-2' } },
      ]),
    },
    consultationFeedback: {
      count: jest.fn().mockResolvedValue(15),
    },
    anonFeedback: {
      count: jest.fn().mockResolvedValue(4),
    },
    committee: {
      count: jest.fn().mockResolvedValue(3),
    },
    committeeMember: {
      count: jest.fn().mockResolvedValue(15),
    },
    amendment: {
      count: jest.fn().mockResolvedValue(10),
    },
    aiAnalysis: {
      findMany: jest.fn().mockResolvedValue(AI_ANALYSES),
    },
    user: {
      findMany: jest.fn().mockResolvedValue(USERS),
    },
    document: {
      count: jest.fn().mockResolvedValue(50),
    },
    analyticsSnapshot: {
      upsert: jest.fn().mockResolvedValue(SNAPSHOT),
      findMany: jest.fn().mockResolvedValue([SNAPSHOT]),
    },
    kpiDefinition: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockImplementation((args: { create: unknown }) => Promise.resolve(args.create)),
    },
  };
}

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let mockPrisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    mockPrisma = makePrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [AnalyticsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  describe('computeCurrentSnapshot', () => {
    it('returns a comprehensive metrics object', async () => {
      const snapshot = await service.computeCurrentSnapshot();
      expect(snapshot.date).toBeDefined();
      expect(snapshot.legislative).toBeDefined();
      expect(snapshot.consultations).toBeDefined();
      expect(snapshot.aiUsage).toBeDefined();
      expect(snapshot.users).toBeDefined();
    });

    it('computes legislative byStatus breakdown', async () => {
      const snapshot = await service.computeCurrentSnapshot();
      expect(snapshot.legislative.total).toBe(3);
      expect(snapshot.legislative.byStatus).toHaveProperty('PUBLISHED');
      expect(snapshot.legislative.byStatus['PUBLISHED']).toBe(2);
    });

    it('computes AI usage with average confidence', async () => {
      const snapshot = await service.computeCurrentSnapshot();
      expect(snapshot.aiUsage.totalAnalyses).toBe(3);
      expect(snapshot.aiUsage.byType['SUMMARIZATION']).toBe(2);
      expect(snapshot.aiUsage.avgConfidence).toBeCloseTo(0.8, 1);
    });

    it('computes active users correctly', async () => {
      const snapshot = await service.computeCurrentSnapshot();
      expect(snapshot.users.total).toBe(2); // Only active users
      expect(snapshot.users.byRole['SUPER_ADMIN']).toBe(1);
    });
  });

  describe('saveSnapshot', () => {
    it('upserts snapshot for today', async () => {
      await service.saveSnapshot();
      expect(mockPrisma.analyticsSnapshot.upsert).toHaveBeenCalled();
    });
  });

  describe('getSnapshots', () => {
    it('returns snapshots for the specified days window', async () => {
      const result = await service.getSnapshots(30);
      expect(result).toHaveLength(1);
      expect(mockPrisma.analyticsSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ snapshotDate: expect.objectContaining({ gte: expect.any(Date) }) }) }),
      );
    });
  });

  describe('getTrend', () => {
    it('extracts a nested metric value over time', async () => {
      const trend = await service.getTrend('legislative.total', 30);
      expect(trend).toHaveLength(1);
      expect(trend[0]).toHaveProperty('date');
      expect(trend[0]).toHaveProperty('value');
    });
  });

  describe('getLegislativeThroughput', () => {
    it('returns 12 months for the given year', async () => {
      const result = await service.getLegislativeThroughput(2025);
      expect(result.year).toBe(2025);
      expect(result.months).toHaveLength(12);
    });
  });

  describe('getKpiDashboard', () => {
    it('returns empty array when no KPIs defined', async () => {
      const result = await service.getKpiDashboard();
      expect(result).toHaveLength(0);
    });
  });

  describe('upsertKpiDefinition', () => {
    it('creates KPI definition', async () => {
      await service.upsertKpiDefinition('legislative.total', {
        name: 'Total Legislative Items',
        unit: 'count',
        targetValue: 100,
      });
      expect(mockPrisma.kpiDefinition.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'legislative.total' },
        }),
      );
    });
  });

  describe('exportForBi', () => {
    it('returns JSON format', async () => {
      const result = await service.exportForBi('json');
      expect(typeof result).toBe('object');
      expect((result as { legislative: unknown }).legislative).toBeDefined();
    });

    it('returns CSV format as string', async () => {
      const result = await service.exportForBi('csv');
      expect(typeof result).toBe('string');
      expect(result).toContain('metric,value');
    });
  });

  describe('getMinistryPerformance', () => {
    it('returns performance data per ministry', async () => {
      const result = await service.getMinistryPerformance();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
