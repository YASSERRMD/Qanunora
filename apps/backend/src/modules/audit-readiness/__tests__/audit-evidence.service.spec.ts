import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AuditEvidenceService } from '../audit-evidence.service';
import { PrismaService } from '../../database/prisma.service';

const ITEM_ID = 'item-uuid-1';
const MOCK_ITEM = {
  id: ITEM_ID,
  title: 'Test Legislative Item',
  status: 'APPROVED',
};

function makeMockPrisma() {
  return {
    legislativeItem: {
      findUnique: jest.fn().mockResolvedValue(MOCK_ITEM),
      findMany: jest.fn().mockResolvedValue([MOCK_ITEM]),
    },
    document: {
      count: jest.fn().mockImplementation(({ where }: { where: { category: string } }) => {
        // CL01: DRAFT = 1, CL02: FINAL = 1
        if (where.category === 'DRAFT') return Promise.resolve(1);
        if (where.category === 'FINAL') return Promise.resolve(1);
        return Promise.resolve(0);
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    workflowHistory: {
      count: jest.fn().mockResolvedValue(3), // CL03 passes
      findFirst: jest.fn().mockImplementation(({ where }: { where: { action?: string; toStatus?: string } }) => {
        // CL06: LEGAL_REVIEW transition
        if (where.toStatus === 'LEGAL_REVIEW') {
          return Promise.resolve({
            id: 'wf-1',
            action: 'SEND_TO_LEGAL',
            toStatus: 'LEGAL_REVIEW',
            createdAt: new Date('2024-01-10'),
          });
        }
        // CL07: APPROVE action
        if (where.action === 'APPROVE') {
          return Promise.resolve({
            id: 'wf-2',
            action: 'APPROVE',
            createdAt: new Date('2024-01-20'),
          });
        }
        return Promise.resolve(null);
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    committeeReview: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'cr-1',
        recommendation: 'Recommended for approval',
        reviewedAt: new Date(),
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    consultation: {
      count: jest.fn().mockResolvedValue(1), // CL05 passes (1 CLOSED)
      findMany: jest.fn().mockResolvedValue([]),
    },
    version: {
      count: jest.fn().mockResolvedValue(2), // CL08 passes (2 versions)
      findMany: jest.fn().mockResolvedValue([]),
    },
    traceLink: {
      count: jest.fn().mockResolvedValue(1), // CL09 passes
      findMany: jest.fn().mockResolvedValue([]),
    },
    aiAnalysis: {
      count: jest.fn().mockResolvedValue(1), // CL10 passes
      findMany: jest.fn().mockResolvedValue([]),
    },
    auditLog: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

describe('AuditEvidenceService', () => {
  let service: AuditEvidenceService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;

  beforeEach(async () => {
    mockPrisma = makeMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditEvidenceService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AuditEvidenceService>(AuditEvidenceService);
  });

  // ---------------------------------------------------------------------------
  // evaluateChecklist
  // ---------------------------------------------------------------------------

  describe('evaluateChecklist', () => {
    it('CL01 passes when DRAFT document exists', async () => {
      const results = await service.evaluateChecklist(ITEM_ID);
      const cl01 = results.find((r) => r.item.id === 'CL01');

      expect(cl01).toBeDefined();
      expect(cl01?.passed).toBe(true);
      expect(mockPrisma.document.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'DRAFT' }),
        }),
      );
    });

    it('CL01 fails when no DRAFT document exists', async () => {
      mockPrisma.document.count.mockImplementation(({ where }: { where: { category: string } }) => {
        return Promise.resolve(0); // no documents of any category
      });

      const results = await service.evaluateChecklist(ITEM_ID);
      const cl01 = results.find((r) => r.item.id === 'CL01');
      expect(cl01?.passed).toBe(false);
    });

    it('CL03 passes when workflow history exists', async () => {
      const results = await service.evaluateChecklist(ITEM_ID);
      const cl03 = results.find((r) => r.item.id === 'CL03');
      expect(cl03?.passed).toBe(true);
    });

    it('CL04 passes when committee review with recommendation exists', async () => {
      const results = await service.evaluateChecklist(ITEM_ID);
      const cl04 = results.find((r) => r.item.id === 'CL04');
      expect(cl04?.passed).toBe(true);
    });

    it('CL07 passes when APPROVE action exists in workflow history', async () => {
      const results = await service.evaluateChecklist(ITEM_ID);
      const cl07 = results.find((r) => r.item.id === 'CL07');
      expect(cl07?.passed).toBe(true);
    });

    it('throws NotFoundException when item does not exist', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(null);
      await expect(service.evaluateChecklist('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('returns 10 checklist items', async () => {
      const results = await service.evaluateChecklist(ITEM_ID);
      expect(results).toHaveLength(10);
    });
  });

  // ---------------------------------------------------------------------------
  // getAuditSummary
  // ---------------------------------------------------------------------------

  describe('getAuditSummary', () => {
    it('calculates overallStatus as READY when all required items pass', async () => {
      const summary = await service.getAuditSummary(ITEM_ID);
      // All required: CL01, CL02, CL03, CL04, CL06, CL07
      // With our mock all should pass
      expect(summary.passedRequired).toBe(summary.requiredItems);
      expect(summary.overallStatus).toBe('READY');
    });

    it('calculates overallStatus as NOT_READY when no required items pass', async () => {
      // Make all counts return 0 and findFirst return null
      mockPrisma.document.count.mockResolvedValue(0);
      mockPrisma.workflowHistory.count.mockResolvedValue(0);
      mockPrisma.workflowHistory.findFirst.mockResolvedValue(null);
      mockPrisma.committeeReview.findFirst.mockResolvedValue(null);

      const summary = await service.getAuditSummary(ITEM_ID);
      expect(summary.passedRequired).toBe(0);
      expect(summary.overallStatus).toBe('NOT_READY');
    });

    it('calculates PARTIAL when some but not all required items pass', async () => {
      // CL01 DRAFT passes, CL02 FINAL fails
      mockPrisma.document.count.mockImplementation(({ where }: { where: { category: string } }) => {
        if (where.category === 'DRAFT') return Promise.resolve(1);
        return Promise.resolve(0); // no FINAL
      });
      mockPrisma.workflowHistory.count.mockResolvedValue(0);
      mockPrisma.workflowHistory.findFirst.mockResolvedValue(null);
      mockPrisma.committeeReview.findFirst.mockResolvedValue(null);

      const summary = await service.getAuditSummary(ITEM_ID);
      expect(summary.overallStatus).toBe('PARTIAL');
    });

    it('returns correct total and passed counts', async () => {
      const summary = await service.getAuditSummary(ITEM_ID);
      expect(summary.totalItems).toBe(10);
      expect(summary.requiredItems).toBe(6); // CL01-CL04, CL06, CL07 are required
      expect(summary.passedItems).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // exportAuditReport
  // ---------------------------------------------------------------------------

  describe('exportAuditReport', () => {
    it('includes all required report sections', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue({
        ...MOCK_ITEM,
        type: 'BILL',
        referenceNumber: 'REF-001',
        ministry: { id: 'min-1', name: 'Ministry of Justice' },
      });

      const report = await service.exportAuditReport(ITEM_ID);

      expect(report).toHaveProperty('reportGeneratedAt');
      expect(report).toHaveProperty('legislativeItem');
      expect(report).toHaveProperty('auditSummary');
      expect(report).toHaveProperty('checklist');
      expect(report).toHaveProperty('workflowHistory');
      expect(report).toHaveProperty('versions');
      expect(report).toHaveProperty('documents');
      expect(report).toHaveProperty('consultations');
      expect(report).toHaveProperty('committeeReviews');
      expect(report).toHaveProperty('auditLogs');
    });

    it('throws NotFoundException when item does not exist', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(null);
      await expect(service.exportAuditReport('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
