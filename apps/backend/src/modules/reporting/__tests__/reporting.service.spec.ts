import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ReportingService } from '../reporting.service';
import { PrismaService } from '../../database/prisma.service';

const ITEM_ID = 'item-uuid-1';
const CONSULT_ID = 'consult-uuid-1';

const MOCK_ITEM = {
  id: ITEM_ID,
  referenceNumber: 'REF-001',
  title: 'Test Bill',
  status: 'DRAFT',
  type: 'BILL',
  ministry: { id: 'min-1', name: 'Ministry of Justice' },
  assignedTo: { id: 'user-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
};

const MOCK_CONSULTATION = {
  id: CONSULT_ID,
  title: 'Test Consultation',
  status: 'CLOSED',
  closeDate: new Date('2025-01-01'),
  legislativeItem: { id: ITEM_ID, referenceNumber: 'REF-001', title: 'Test Bill' },
  _count: { feedback: 10 },
};

const MOCK_FEEDBACK = [
  {
    id: 'fb-1',
    status: 'REVIEWED',
    category: 'GENERAL',
    sentiment: 'POSITIVE',
    content: 'Great legislation',
    submittedAt: new Date(),
    submittedBy: { id: 'user-1', firstName: 'Alice', lastName: 'Smith' },
    consultationId: CONSULT_ID,
  },
  {
    id: 'fb-2',
    status: 'PENDING',
    category: 'GENERAL',
    sentiment: 'NEGATIVE',
    content: 'Needs work',
    submittedAt: new Date(),
    submittedBy: { id: 'user-2', firstName: 'Bob', lastName: 'Jones' },
    consultationId: CONSULT_ID,
  },
  {
    id: 'fb-3',
    status: 'REVIEWED',
    category: 'TECHNICAL',
    sentiment: 'NEUTRAL',
    content: 'Neutral feedback',
    submittedAt: new Date(),
    submittedBy: { id: 'user-3', firstName: 'Carol', lastName: 'Lee' },
    consultationId: CONSULT_ID,
  },
];

const MOCK_AMENDMENTS = [
  { id: 'am-1', status: 'APPROVED', title: 'Amendment 1', proposedBy: { id: 'u1', firstName: 'A', lastName: 'B' }, approvedBy: null },
  { id: 'am-2', status: 'PROPOSED', title: 'Amendment 2', proposedBy: { id: 'u2', firstName: 'C', lastName: 'D' }, approvedBy: null },
  { id: 'am-3', status: 'APPROVED', title: 'Amendment 3', proposedBy: { id: 'u1', firstName: 'A', lastName: 'B' }, approvedBy: { id: 'u3', firstName: 'E', lastName: 'F' } },
];

function makeMockPrisma() {
  return {
    legislativeItem: {
      findUnique: jest.fn().mockResolvedValue(MOCK_ITEM),
    },
    consultation: {
      findUnique: jest.fn().mockResolvedValue(MOCK_CONSULTATION),
    },
    consultationFeedback: {
      findMany: jest.fn().mockResolvedValue(MOCK_FEEDBACK),
    },
    workflowHistory: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    version: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    document: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    amendment: {
      findMany: jest.fn().mockResolvedValue(MOCK_AMENDMENTS),
    },
    committeeReview: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    aiAnalysis: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    auditLog: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    regulatoryReference: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    ministry: {
      findUnique: jest.fn().mockResolvedValue({ id: 'min-1', name: 'Ministry of Justice' }),
    },
  };
}

describe('ReportingService', () => {
  let service: ReportingService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;

  beforeEach(async () => {
    mockPrisma = makeMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportingService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ReportingService>(ReportingService);
  });

  // ---------------------------------------------------------------------------
  // generateLifecycleReport
  // ---------------------------------------------------------------------------

  describe('generateLifecycleReport', () => {
    it('includes all required sections', async () => {
      const report = await service.generateLifecycleReport(ITEM_ID);

      expect(report).toHaveProperty('reportType', 'LIFECYCLE');
      expect(report).toHaveProperty('item');
      expect(report).toHaveProperty('workflowHistory');
      expect(report).toHaveProperty('versions');
      expect(report).toHaveProperty('documents');
      expect(report).toHaveProperty('amendments');
      expect(report).toHaveProperty('consultations');
      expect(report).toHaveProperty('committeeReviews');
      expect(report).toHaveProperty('aiAnalyses');
      expect(report).toHaveProperty('auditLogs');
      expect(report).toHaveProperty('generatedAt');
    });

    it('throws NotFoundException when item does not exist', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(null);
      await expect(service.generateLifecycleReport('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('queries all required sub-resources', async () => {
      await service.generateLifecycleReport(ITEM_ID);

      expect(mockPrisma.workflowHistory.findMany).toHaveBeenCalled();
      expect(mockPrisma.version.findMany).toHaveBeenCalled();
      expect(mockPrisma.document.findMany).toHaveBeenCalled();
      expect(mockPrisma.amendment.findMany).toHaveBeenCalled();
      expect(mockPrisma.committeeReview.findMany).toHaveBeenCalled();
      expect(mockPrisma.aiAnalysis.findMany).toHaveBeenCalled();
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // generateConsultationReport
  // ---------------------------------------------------------------------------

  describe('generateConsultationReport', () => {
    it('returns correct feedback stats total', async () => {
      const report = await service.generateConsultationReport(CONSULT_ID);
      expect(report.feedbackStats.total).toBe(3);
    });

    it('counts feedback by status correctly', async () => {
      const report = await service.generateConsultationReport(CONSULT_ID);
      expect(report.feedbackStats.statusCounts['REVIEWED']).toBe(2);
      expect(report.feedbackStats.statusCounts['PENDING']).toBe(1);
    });

    it('returns top categories sorted by frequency', async () => {
      const report = await service.generateConsultationReport(CONSULT_ID);
      expect(Array.isArray(report.topCategories)).toBe(true);
      // GENERAL appears twice, TECHNICAL once
      expect(report.topCategories[0].category).toBe('GENERAL');
      expect(report.topCategories[0].count).toBe(2);
    });

    it('calculates sentiment breakdown with percentages', async () => {
      const report = await service.generateConsultationReport(CONSULT_ID);
      const positive = report.sentimentBreakdown.find((s) => s.sentiment === 'POSITIVE');
      expect(positive).toBeDefined();
      expect(positive?.count).toBe(1);
      expect(positive?.percentage).toBe(33); // 1/3 ≈ 33%
    });

    it('returns all feedback in allFeedback array', async () => {
      const report = await service.generateConsultationReport(CONSULT_ID);
      expect(report.allFeedback).toHaveLength(3);
    });

    it('throws NotFoundException when consultation does not exist', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue(null);
      await expect(service.generateConsultationReport('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // generateAmendmentReport
  // ---------------------------------------------------------------------------

  describe('generateAmendmentReport', () => {
    it('returns correct statusCounts', async () => {
      const report = await service.generateAmendmentReport(ITEM_ID);
      expect(report.statusCounts['APPROVED']).toBe(2);
      expect(report.statusCounts['PROPOSED']).toBe(1);
    });

    it('returns total amendment count', async () => {
      const report = await service.generateAmendmentReport(ITEM_ID);
      expect(report.totalAmendments).toBe(3);
    });

    it('includes proposedBy names in each amendment', async () => {
      const report = await service.generateAmendmentReport(ITEM_ID);
      expect(report.amendments[0].proposedBy).toBeDefined();
      expect(report.amendments[0].proposedBy.firstName).toBe('A');
    });

    it('throws NotFoundException when item does not exist', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(null);
      await expect(service.generateAmendmentReport('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
