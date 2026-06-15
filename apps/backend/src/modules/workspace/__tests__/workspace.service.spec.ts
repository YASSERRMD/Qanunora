import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { WorkspaceService } from '../workspace.service';
import { PrismaService } from '../../database/prisma.service';
import { LegislativeStatus, UserRole } from '@prisma/client';

const mockUser = { id: 'user-1', role: UserRole.REVIEWER };

const mockItem = {
  id: 'item-1',
  title: 'Test Bill',
  referenceNumber: 'REF-001',
  status: LegislativeStatus.DRAFTING,
  ministry: { id: 'min-1', name: 'Ministry of Justice' },
};

const mockWorkflowHistory = {
  id: 'wh-1',
  legislativeItemId: 'item-1',
  action: 'APPROVE',
  createdAt: new Date(),
  performedBy: { id: 'user-1', firstName: 'Ahmad', lastName: 'Al-Rashid' },
  legislativeItem: { id: 'item-1', title: 'Test Bill', referenceNumber: 'REF-001' },
};

const mockView = {
  id: 'view-1',
  userId: 'user-1',
  name: 'Active Bills',
  entityType: 'legislative_items',
  filters: {},
  columnConfig: [],
  sortField: 'createdAt',
  sortOrder: 'desc',
  isDefault: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockQuickAction = {
  id: 'qa-1',
  userId: 'user-1',
  label: 'New Draft',
  actionType: 'navigate',
  actionData: { url: '/legislative-items/new' },
  order: 0,
  createdAt: new Date(),
};

const mockPrisma = {
  user: { findUnique: jest.fn() },
  legislativeItem: { findMany: jest.fn() },
  legalOpinion: { findMany: jest.fn() },
  workflowHistory: { findMany: jest.fn() },
  savedView: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
  workspaceQuickAction: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
};

describe('WorkspaceService', () => {
  let service: WorkspaceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<WorkspaceService>(WorkspaceService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getMyDashboard', () => {
    it('returns assigned items, drafts, opinions, activity, and pending actions', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.legislativeItem.findMany
        .mockResolvedValueOnce([mockItem]) // assignedItems
        .mockResolvedValueOnce([mockItem]) // myDrafts
        .mockResolvedValueOnce([mockItem]); // pendingActions (REVIEWER role)
      mockPrisma.legalOpinion.findMany.mockResolvedValue([]);
      mockPrisma.workflowHistory.findMany
        .mockResolvedValueOnce([mockWorkflowHistory]) // recentActivity
        .mockResolvedValueOnce([mockWorkflowHistory]); // myReviews

      const result = await service.getMyDashboard('user-1');

      expect(result.assignedItems).toHaveLength(1);
      expect(result.myDrafts).toHaveLength(1);
      expect(result.pendingActions).toHaveLength(1);
      expect(result.recentActivity).toHaveLength(1);
    });
  });

  describe('createSavedView', () => {
    it('creates a saved view for the user', async () => {
      mockPrisma.savedView.create.mockResolvedValue(mockView);

      const result = await service.createSavedView('user-1', {
        name: 'Active Bills',
        entityType: 'legislative_items',
      });

      expect(result).toEqual(mockView);
      expect(mockPrisma.savedView.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'user-1', name: 'Active Bills' }),
        }),
      );
    });
  });

  describe('updateSavedView', () => {
    it('updates a saved view owned by the user', async () => {
      mockPrisma.savedView.findUnique.mockResolvedValue(mockView);
      mockPrisma.savedView.update.mockResolvedValue({ ...mockView, name: 'Updated View' });

      const result = await service.updateSavedView('view-1', 'user-1', { name: 'Updated View' });
      expect(result.name).toBe('Updated View');
    });

    it('throws ForbiddenException for non-owner', async () => {
      mockPrisma.savedView.findUnique.mockResolvedValue({ ...mockView, userId: 'user-2' });
      await expect(service.updateSavedView('view-1', 'user-1', {})).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when view not found', async () => {
      mockPrisma.savedView.findUnique.mockResolvedValue(null);
      await expect(service.updateSavedView('bad-id', 'user-1', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('setDefaultView', () => {
    it('unsets other defaults and sets the view as default', async () => {
      mockPrisma.savedView.findUnique.mockResolvedValue(mockView);
      mockPrisma.savedView.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.savedView.update.mockResolvedValue({ ...mockView, isDefault: true });

      const result = await service.setDefaultView('view-1', 'user-1');

      expect(mockPrisma.savedView.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isDefault: true }),
          data: { isDefault: false },
        }),
      );
      expect(result.isDefault).toBe(true);
    });
  });

  describe('deleteSavedView', () => {
    it('deletes a view owned by the user', async () => {
      mockPrisma.savedView.findUnique.mockResolvedValue(mockView);
      mockPrisma.savedView.delete.mockResolvedValue({});

      const result = await service.deleteSavedView('view-1', 'user-1');
      expect(result).toEqual({ deleted: true });
    });

    it('throws ForbiddenException for non-owner', async () => {
      mockPrisma.savedView.findUnique.mockResolvedValue({ ...mockView, userId: 'user-2' });
      await expect(service.deleteSavedView('view-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('upsertQuickAction', () => {
    it('creates a new quick action when label does not exist', async () => {
      mockPrisma.workspaceQuickAction.findFirst.mockResolvedValue(null);
      mockPrisma.workspaceQuickAction.create.mockResolvedValue(mockQuickAction);

      const result = await service.upsertQuickAction('user-1', {
        label: 'New Draft',
        actionType: 'navigate',
        actionData: { url: '/legislative-items/new' },
      });

      expect(result).toEqual(mockQuickAction);
      expect(mockPrisma.workspaceQuickAction.create).toHaveBeenCalled();
    });

    it('updates an existing quick action when label already exists', async () => {
      mockPrisma.workspaceQuickAction.findFirst.mockResolvedValue(mockQuickAction);
      mockPrisma.workspaceQuickAction.update.mockResolvedValue({ ...mockQuickAction, actionType: 'create' });

      await service.upsertQuickAction('user-1', {
        label: 'New Draft',
        actionType: 'create',
      });

      expect(mockPrisma.workspaceQuickAction.update).toHaveBeenCalled();
    });
  });

  describe('reorderQuickActions', () => {
    it('updates the order field for each quick action', async () => {
      mockPrisma.workspaceQuickAction.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.workspaceQuickAction.findMany.mockResolvedValue([mockQuickAction]);

      const result = await service.reorderQuickActions('user-1', { orderedIds: ['qa-1', 'qa-2'] });

      expect(mockPrisma.workspaceQuickAction.updateMany).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(1);
    });
  });
});
