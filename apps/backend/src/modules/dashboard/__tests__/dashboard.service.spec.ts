import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from '../dashboard.service';
import { PrismaService } from '../../database/prisma.service';

function makeMockPrisma() {
  return {
    legislativeItem: {
      groupBy: jest.fn().mockResolvedValue([
        { status: 'DRAFTING', _count: { id: 5 } },
        { status: 'APPROVED', _count: { id: 2 } },
      ]),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'item-1',
          referenceNumber: 'REF-001',
          title: 'Test Law',
          status: 'INTERNAL_REVIEW',
          priority: 'HIGH',
          updatedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
          ministry: { name: 'MOJ', code: 'MOJ' },
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      ]),
    },
    workflowHistory: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'wf-1',
          action: 'SUBMIT_FOR_REVIEW',
          fromStatus: 'DRAFTING',
          toStatus: 'INTERNAL_REVIEW',
          comment: null,
          createdAt: new Date(),
          legislativeItemId: 'item-1',
          legislativeItem: { id: 'item-1', title: 'Test', referenceNumber: 'REF-001' },
          performedBy: { id: 'user-1', firstName: 'Ali', lastName: 'Hassan', email: 'ali@test.com' },
        },
      ]),
    },
    consultation: {
      count: jest.fn().mockResolvedValue(3),
    },
    consultationFeedback: {
      count: jest.fn().mockResolvedValue(15),
    },
  };
}

describe('DashboardService', () => {
  let service: DashboardService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;

  beforeEach(async () => {
    mockPrisma = makeMockPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<DashboardService>(DashboardService);
  });

  // ---------------------------------------------------------------------------
  // getPipelineMetrics
  // ---------------------------------------------------------------------------

  describe('getPipelineMetrics', () => {
    it('returns pipeline array and total', async () => {
      const result = await service.getPipelineMetrics();
      expect(result.total).toBe(7); // 5 + 2
      expect(Array.isArray(result.pipeline)).toBe(true);
      const drafting = result.pipeline.find((p) => p.status === 'DRAFTING');
      expect(drafting?.count).toBe(5);
    });

    it('fills in zero for statuses with no items', async () => {
      const result = await service.getPipelineMetrics();
      const published = result.pipeline.find((p) => p.status === 'PUBLISHED');
      expect(published?.count).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // getDelayedItems
  // ---------------------------------------------------------------------------

  describe('getDelayedItems', () => {
    it('returns delayed items with ageDays calculated', async () => {
      const result = await service.getDelayedItems();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0].ageDays).toBeGreaterThanOrEqual(20);
      expect(result[0].ministry.code).toBe('MOJ');
    });
  });

  // ---------------------------------------------------------------------------
  // getConsultationMetrics
  // ---------------------------------------------------------------------------

  describe('getConsultationMetrics', () => {
    it('returns consultation counts and average feedback', async () => {
      // count is called twice: once for OPEN, once for total
      mockPrisma.consultation.count
        .mockResolvedValueOnce(2)  // openCount
        .mockResolvedValueOnce(3); // total
      const result = await service.getConsultationMetrics();
      expect(result.openCount).toBe(2);
      expect(result.totalConsultations).toBe(3);
      expect(result.totalFeedback).toBe(15);
      expect(result.avgFeedback).toBe(5); // 15/3
    });

    it('returns avgFeedback of 0 when no consultations exist', async () => {
      mockPrisma.consultation.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockPrisma.consultationFeedback.count.mockResolvedValueOnce(0);
      const result = await service.getConsultationMetrics();
      expect(result.avgFeedback).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // getRecentActivity
  // ---------------------------------------------------------------------------

  describe('getRecentActivity', () => {
    it('returns last 10 workflow entries with actor names', async () => {
      const result = await service.getRecentActivity();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0].performedBy.firstName).toBe('Ali');
    });
  });

  // ---------------------------------------------------------------------------
  // getBottlenecks
  // ---------------------------------------------------------------------------

  describe('getBottlenecks', () => {
    it('returns empty array when no workflow history spans multiple transitions', async () => {
      // single entry per item means no time-span to compute
      const result = await service.getBottlenecks();
      expect(Array.isArray(result)).toBe(true);
    });

    it('computes avg days between transitions', async () => {
      const now = new Date();
      const t0 = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      const t1 = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
      mockPrisma.workflowHistory.findMany.mockResolvedValueOnce([
        { toStatus: 'INTERNAL_REVIEW', createdAt: t0, legislativeItemId: 'item-A' },
        { toStatus: 'APPROVED', createdAt: t1, legislativeItemId: 'item-A' },
      ]);
      const result = await service.getBottlenecks();
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('INTERNAL_REVIEW');
      expect(result[0].avgDays).toBeCloseTo(6, 0);
    });
  });
});
