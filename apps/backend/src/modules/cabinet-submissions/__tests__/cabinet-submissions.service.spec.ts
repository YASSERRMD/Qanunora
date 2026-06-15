import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CabinetSubmissionsService } from '../cabinet-submissions.service';
import { PrismaService } from '../../database/prisma.service';
import { SubmissionStatus } from '@prisma/client';

const MOCK_CHECKLIST_ITEMS = Array.from({ length: 10 }, (_, i) => ({
  id: `checklist-uuid-${i + 1}`,
  submissionId: 'submission-uuid-1',
  item: `Checklist item ${i + 1}`,
  category: 'General',
  isCompleted: false,
  completedById: null,
  completedAt: null,
  evidence: null,
  order: i + 1,
}));

const MOCK_SUBMISSION = {
  id: 'submission-uuid-1',
  referenceNumber: 'CS-2026-0001',
  legislativeItemId: 'item-uuid-1',
  legislativeItem: { id: 'item-uuid-1', referenceNumber: 'LI-2026-0001', title: 'Digital Commerce Bill' },
  title: 'Digital Commerce Bill Cabinet Submission',
  status: SubmissionStatus.PREPARING,
  checklist: MOCK_CHECKLIST_ITEMS,
  preparedById: 'user-uuid-1',
  preparedBy: { id: 'user-uuid-1', firstName: 'Sara', lastName: 'Ahmed' },
  submittedAt: null,
  approvedAt: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeMockPrisma() {
  return {
    cabinetSubmission: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue(MOCK_SUBMISSION),
      findMany: jest.fn().mockResolvedValue([MOCK_SUBMISSION]),
      findUnique: jest.fn().mockResolvedValue(MOCK_SUBMISSION),
      update: jest.fn().mockResolvedValue({ ...MOCK_SUBMISSION }),
    },
    submissionChecklist: {
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockResolvedValue(MOCK_CHECKLIST_ITEMS[0]),
      update: jest.fn().mockResolvedValue({ ...MOCK_CHECKLIST_ITEMS[0], isCompleted: true }),
    },
  };
}

describe('CabinetSubmissionsService', () => {
  let service: CabinetSubmissionsService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;

  beforeEach(async () => {
    mockPrisma = makeMockPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CabinetSubmissionsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<CabinetSubmissionsService>(CabinetSubmissionsService);
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  describe('create', () => {
    it('creates a submission with auto-generated reference number and 10 checklist items', async () => {
      const result = await service.create(
        { legislativeItemId: 'item-uuid-1', title: 'Test Submission' },
        'user-uuid-1',
      );
      expect(result).toEqual(MOCK_SUBMISSION);
      expect(mockPrisma.cabinetSubmission.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            referenceNumber: expect.stringMatching(/^CS-\d{4}-\d{4}$/),
            preparedById: 'user-uuid-1',
            checklist: {
              create: expect.arrayContaining([
                expect.objectContaining({ item: 'Impact assessment complete' }),
                expect.objectContaining({ item: 'Legal opinion attached' }),
              ]),
            },
          }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // findById
  // -------------------------------------------------------------------------

  describe('findById', () => {
    it('returns submission by id', async () => {
      const result = await service.findById('submission-uuid-1');
      expect(result).toEqual(MOCK_SUBMISSION);
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.cabinetSubmission.findUnique.mockResolvedValueOnce(null);
      await expect(service.findById('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // getCompletionPercentage
  // -------------------------------------------------------------------------

  describe('getCompletionPercentage', () => {
    it('returns 0 when no items completed', async () => {
      mockPrisma.submissionChecklist.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(0); // completed
      const result = await service.getCompletionPercentage('submission-uuid-1');
      expect(result).toBe(0);
    });

    it('returns 80 when 8 of 10 items completed', async () => {
      mockPrisma.submissionChecklist.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(8); // completed
      const result = await service.getCompletionPercentage('submission-uuid-1');
      expect(result).toBe(80);
    });

    it('returns 100 when all items completed', async () => {
      mockPrisma.submissionChecklist.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(10);
      const result = await service.getCompletionPercentage('submission-uuid-1');
      expect(result).toBe(100);
    });
  });

  // -------------------------------------------------------------------------
  // submitForApproval
  // -------------------------------------------------------------------------

  describe('submitForApproval', () => {
    it('submits when checklist is 80%+ complete', async () => {
      mockPrisma.submissionChecklist.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(8);
      mockPrisma.cabinetSubmission.update.mockResolvedValueOnce({
        ...MOCK_SUBMISSION,
        status: SubmissionStatus.UNDER_REVIEW,
        submittedAt: new Date(),
      });
      const result = await service.submitForApproval('submission-uuid-1');
      expect(result.status).toBe(SubmissionStatus.UNDER_REVIEW);
    });

    it('throws BadRequestException when checklist is less than 80% complete', async () => {
      mockPrisma.submissionChecklist.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(5);
      await expect(service.submitForApproval('submission-uuid-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when not in PREPARING status', async () => {
      mockPrisma.cabinetSubmission.findUnique.mockResolvedValueOnce({
        ...MOCK_SUBMISSION,
        status: SubmissionStatus.UNDER_REVIEW,
      });
      await expect(service.submitForApproval('submission-uuid-1')).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // completeChecklistItem
  // -------------------------------------------------------------------------

  describe('completeChecklistItem', () => {
    it('marks checklist item as complete', async () => {
      const result = await service.completeChecklistItem(
        'submission-uuid-1',
        'checklist-uuid-1',
        'user-uuid-1',
        { evidence: 'Document attached' },
      );
      expect(result.isCompleted).toBe(true);
    });

    it('throws NotFoundException when checklist item not found', async () => {
      mockPrisma.submissionChecklist.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.completeChecklistItem('submission-uuid-1', 'ghost', 'user-uuid-1', {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // approve / returnSubmission
  // -------------------------------------------------------------------------

  describe('approve', () => {
    it('approves a submission under review', async () => {
      mockPrisma.cabinetSubmission.findUnique.mockResolvedValueOnce({
        ...MOCK_SUBMISSION,
        status: SubmissionStatus.UNDER_REVIEW,
      });
      mockPrisma.cabinetSubmission.update.mockResolvedValueOnce({
        ...MOCK_SUBMISSION,
        status: SubmissionStatus.APPROVED,
        approvedAt: new Date(),
      });
      const result = await service.approve('submission-uuid-1');
      expect(result.status).toBe(SubmissionStatus.APPROVED);
    });

    it('throws when not UNDER_REVIEW', async () => {
      await expect(service.approve('submission-uuid-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('returnSubmission', () => {
    it('returns a submission with notes', async () => {
      mockPrisma.cabinetSubmission.findUnique.mockResolvedValueOnce({
        ...MOCK_SUBMISSION,
        status: SubmissionStatus.UNDER_REVIEW,
      });
      mockPrisma.cabinetSubmission.update.mockResolvedValueOnce({
        ...MOCK_SUBMISSION,
        status: SubmissionStatus.RETURNED,
        notes: 'Missing legal opinion',
      });
      const result = await service.returnSubmission('submission-uuid-1', 'Missing legal opinion');
      expect(result.status).toBe(SubmissionStatus.RETURNED);
    });
  });
});
