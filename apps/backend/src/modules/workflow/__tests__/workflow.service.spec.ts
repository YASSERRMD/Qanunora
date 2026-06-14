import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { WorkflowService } from '../workflow.service';
import { PrismaService } from '../../database/prisma.service';
import { WorkflowAction, UserRole, LegislativeStatus } from '@prisma/client';

const mockItem = {
  id: 'item-1',
  referenceNumber: 'LI-2025-0001',
  title: 'Test Law',
  status: LegislativeStatus.DRAFTING,
  type: 'DRAFT_LAW',
  ministryId: 'ministry-1',
  createdById: 'user-1',
  confidentialityLevel: 'INTERNAL',
  priority: 'MEDIUM',
  publishedAt: null,
  updatedAt: new Date(),
  createdAt: new Date(),
};

const mockHistoryEntry = {
  id: 'hist-1',
  legislativeItemId: 'item-1',
  fromStatus: LegislativeStatus.DRAFTING,
  toStatus: LegislativeStatus.INTERNAL_REVIEW,
  action: WorkflowAction.SUBMIT_FOR_REVIEW,
  performedById: 'user-1',
  comment: 'Ready for review',
  metadata: { userRole: UserRole.DRAFTING_OFFICER },
  createdAt: new Date(),
  performedBy: { id: 'user-1', firstName: 'Alice', lastName: 'Admin', email: 'alice@gov.qa' },
};

const mockPrisma = {
  legislativeItem: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  workflowHistory: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('WorkflowService', () => {
  let service: WorkflowService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<WorkflowService>(WorkflowService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('transition', () => {
    it('successfully transitions from DRAFTING to INTERNAL_REVIEW', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(mockItem);
      const updatedItem = { ...mockItem, status: LegislativeStatus.INTERNAL_REVIEW };
      mockPrisma.$transaction.mockResolvedValue([updatedItem, mockHistoryEntry]);

      const result = await service.transition(
        'item-1',
        WorkflowAction.SUBMIT_FOR_REVIEW,
        'user-1',
        UserRole.DRAFTING_OFFICER,
        'Ready for review',
      );

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(result.item.status).toBe(LegislativeStatus.INTERNAL_REVIEW);
      expect(result.history).toEqual(mockHistoryEntry);
    });

    it('throws NotFoundException when item does not exist', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(null);
      await expect(
        service.transition('nonexistent', WorkflowAction.SUBMIT_FOR_REVIEW, 'user-1', UserRole.DRAFTING_OFFICER),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for invalid action from current status', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue({
        ...mockItem,
        status: LegislativeStatus.DRAFTING,
      });
      await expect(
        service.transition('item-1', WorkflowAction.PUBLISH, 'user-1', UserRole.SUPER_ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when role is not allowed for action', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(mockItem);
      await expect(
        service.transition(
          'item-1',
          WorkflowAction.SUBMIT_FOR_REVIEW,
          'user-1',
          UserRole.VIEWER,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('sets publishedAt when transitioning to PUBLISHED', async () => {
      const approvedItem = { ...mockItem, status: LegislativeStatus.APPROVED };
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(approvedItem);

      const publishedItem = { ...approvedItem, status: LegislativeStatus.PUBLISHED, publishedAt: new Date() };
      const publishedHistory = {
        ...mockHistoryEntry,
        fromStatus: LegislativeStatus.APPROVED,
        toStatus: LegislativeStatus.PUBLISHED,
        action: WorkflowAction.PUBLISH,
      };
      mockPrisma.$transaction.mockResolvedValue([publishedItem, publishedHistory]);

      const result = await service.transition(
        'item-1',
        WorkflowAction.PUBLISH,
        'user-1',
        UserRole.LEGISLATIVE_ADMIN,
      );

      expect(result.item.status).toBe(LegislativeStatus.PUBLISHED);
      expect(result.item.publishedAt).toBeDefined();
    });

    it('allows SEND_TO_COMMITTEE from INTERNAL_REVIEW for LEGISLATIVE_ADMIN', async () => {
      const reviewItem = { ...mockItem, status: LegislativeStatus.INTERNAL_REVIEW };
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(reviewItem);

      const committeeHistory = {
        ...mockHistoryEntry,
        fromStatus: LegislativeStatus.INTERNAL_REVIEW,
        toStatus: LegislativeStatus.COMMITTEE_REVIEW,
      };
      mockPrisma.$transaction.mockResolvedValue([
        { ...reviewItem, status: LegislativeStatus.COMMITTEE_REVIEW },
        committeeHistory,
      ]);

      const result = await service.transition(
        'item-1',
        WorkflowAction.SEND_TO_COMMITTEE,
        'user-1',
        UserRole.LEGISLATIVE_ADMIN,
      );

      expect(result.item.status).toBe(LegislativeStatus.COMMITTEE_REVIEW);
    });
  });

  describe('getHistory', () => {
    it('returns workflow history for an item', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(mockItem);
      mockPrisma.workflowHistory.findMany.mockResolvedValue([mockHistoryEntry]);

      const result = await service.getHistory('item-1');

      expect(result.data).toEqual([mockHistoryEntry]);
      expect(result.total).toBe(1);
    });

    it('throws NotFoundException when item does not exist', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(null);
      await expect(service.getHistory('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('orders history by createdAt descending', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(mockItem);
      mockPrisma.workflowHistory.findMany.mockResolvedValue([mockHistoryEntry]);

      await service.getHistory('item-1');

      expect(mockPrisma.workflowHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  describe('addComment', () => {
    it('creates a comment history entry without changing status', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(mockItem);
      const commentEntry = {
        ...mockHistoryEntry,
        fromStatus: LegislativeStatus.DRAFTING,
        toStatus: LegislativeStatus.DRAFTING,
        action: WorkflowAction.REQUEST_REVISION,
        comment: 'Please revise section 3',
        metadata: { userRole: UserRole.REVIEWER, type: 'COMMENT' },
      };
      mockPrisma.workflowHistory.create.mockResolvedValue(commentEntry);

      const result = await service.addComment(
        'item-1',
        'user-1',
        UserRole.REVIEWER,
        'Please revise section 3',
      );

      expect(result.fromStatus).toBe(result.toStatus);
      expect(result.comment).toBe('Please revise section 3');
    });

    it('throws NotFoundException when item does not exist', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(null);
      await expect(
        service.addComment('nonexistent', 'user-1', UserRole.REVIEWER, 'comment'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAvailableActions', () => {
    it('returns available transitions for role', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(mockItem);

      const result = await service.getAvailableActions('item-1', UserRole.DRAFTING_OFFICER);

      expect(result.currentStatus).toBe(LegislativeStatus.DRAFTING);
      expect(result.availableTransitions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ action: WorkflowAction.SUBMIT_FOR_REVIEW }),
        ]),
      );
    });

    it('returns empty transitions for VIEWER role', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(mockItem);

      const result = await service.getAvailableActions('item-1', UserRole.VIEWER);

      expect(result.availableTransitions).toHaveLength(0);
    });

    it('throws NotFoundException when item does not exist', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(null);
      await expect(
        service.getAvailableActions('nonexistent', UserRole.SUPER_ADMIN),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
