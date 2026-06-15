import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { LegislativeStatus, UserRole } from '@prisma/client';
import {
  CreateSavedViewDto,
  UpdateSavedViewDto,
  CreateQuickActionDto,
  ReorderQuickActionsDto,
} from './dto/workspace.dto';

@Injectable()
export class WorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Personal Dashboard ────────────────────────────────────────────────────

  async getMyDashboard(userId: string) {
    // Get user role for pending actions calculation
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    const [
      assignedItems,
      myDrafts,
      myOpinions,
      recentActivity,
    ] = await Promise.all([
      this.prisma.legislativeItem.findMany({
        where: {
          createdById: userId,
          status: { notIn: [LegislativeStatus.ARCHIVED, LegislativeStatus.PUBLISHED] },
        },
        take: 10,
        orderBy: { updatedAt: 'desc' },
        include: {
          ministry: { select: { id: true, name: true } },
        },
      }),
      this.prisma.legislativeItem.findMany({
        where: {
          createdById: userId,
          status: LegislativeStatus.DRAFTING,
        },
        take: 10,
        orderBy: { updatedAt: 'desc' },
        include: {
          ministry: { select: { id: true, name: true } },
        },
      }),
      this.prisma.legalOpinion.findMany({
        where: { assignedToId: userId },
        take: 10,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.workflowHistory.findMany({
        where: {
          legislativeItem: { createdById: userId },
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          performedBy: { select: { id: true, firstName: true, lastName: true } },
          legislativeItem: { select: { id: true, title: true, referenceNumber: true } },
        },
      }),
    ]);

    // Pending actions: items in INTERNAL_REVIEW if user is REVIEWER or above
    const pendingWhere: Record<string, unknown> = {};
    if (
      user?.role === UserRole.REVIEWER ||
      user?.role === UserRole.COMMITTEE_MEMBER ||
      user?.role === UserRole.LEGISLATIVE_ADMIN ||
      user?.role === UserRole.SUPER_ADMIN
    ) {
      pendingWhere['status'] = LegislativeStatus.INTERNAL_REVIEW;
    }

    const pendingActions =
      Object.keys(pendingWhere).length > 0
        ? await this.prisma.legislativeItem.findMany({
            where: pendingWhere,
            take: 10,
            orderBy: { updatedAt: 'desc' },
            include: { ministry: { select: { id: true, name: true } } },
          })
        : [];

    const myReviews = await this.prisma.workflowHistory.findMany({
      where: { performedById: userId },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        legislativeItem: { select: { id: true, title: true, referenceNumber: true } },
      },
    });

    return {
      assignedItems,
      myDrafts,
      myOpinions,
      recentActivity,
      myReviews,
      pendingActions,
    };
  }

  // ── Saved Views ───────────────────────────────────────────────────────────

  async getSavedViews(userId: string, entityType?: string) {
    const where: Record<string, unknown> = { userId };
    if (entityType) where['entityType'] = entityType;
    return this.prisma.savedView.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async createSavedView(userId: string, dto: CreateSavedViewDto) {
    return this.prisma.savedView.create({
      data: {
        userId,
        name: dto.name,
        entityType: dto.entityType,
        filters: (dto.filters ?? {}) as object,
        columnConfig: (dto.columnConfig ?? []) as object,
        sortField: dto.sortField,
        sortOrder: dto.sortOrder ?? 'desc',
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async updateSavedView(id: string, userId: string, dto: UpdateSavedViewDto) {
    const view = await this.prisma.savedView.findUnique({ where: { id } });
    if (!view) throw new NotFoundException(`SavedView ${id} not found`);
    if (view.userId !== userId) throw new ForbiddenException('Not your saved view');

    return this.prisma.savedView.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.filters !== undefined && { filters: dto.filters as object }),
        ...(dto.columnConfig !== undefined && { columnConfig: dto.columnConfig as object }),
        ...(dto.sortField !== undefined && { sortField: dto.sortField }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
      },
    });
  }

  async deleteSavedView(id: string, userId: string) {
    const view = await this.prisma.savedView.findUnique({ where: { id } });
    if (!view) throw new NotFoundException(`SavedView ${id} not found`);
    if (view.userId !== userId) throw new ForbiddenException('Not your saved view');

    await this.prisma.savedView.delete({ where: { id } });
    return { deleted: true };
  }

  async setDefaultView(id: string, userId: string) {
    const view = await this.prisma.savedView.findUnique({ where: { id } });
    if (!view) throw new NotFoundException(`SavedView ${id} not found`);
    if (view.userId !== userId) throw new ForbiddenException('Not your saved view');

    // Unset other defaults for same entityType
    await this.prisma.savedView.updateMany({
      where: { userId, entityType: view.entityType, isDefault: true },
      data: { isDefault: false },
    });

    return this.prisma.savedView.update({
      where: { id },
      data: { isDefault: true },
    });
  }

  // ── Quick Actions ─────────────────────────────────────────────────────────

  async getQuickActions(userId: string) {
    return this.prisma.workspaceQuickAction.findMany({
      where: { userId },
      orderBy: { order: 'asc' },
    });
  }

  async upsertQuickAction(userId: string, dto: CreateQuickActionDto) {
    // Check if label already exists for user
    const existing = await this.prisma.workspaceQuickAction.findFirst({
      where: { userId, label: dto.label },
    });

    if (existing) {
      return this.prisma.workspaceQuickAction.update({
        where: { id: existing.id },
        data: {
          actionType: dto.actionType,
          actionData: (dto.actionData ?? {}) as object,
          order: dto.order ?? existing.order,
        },
      });
    }

    return this.prisma.workspaceQuickAction.create({
      data: {
        userId,
        label: dto.label,
        actionType: dto.actionType,
        actionData: (dto.actionData ?? {}) as object,
        order: dto.order ?? 0,
      },
    });
  }

  async deleteQuickAction(id: string, userId: string) {
    const action = await this.prisma.workspaceQuickAction.findUnique({ where: { id } });
    if (!action) throw new NotFoundException(`QuickAction ${id} not found`);
    if (action.userId !== userId) throw new ForbiddenException('Not your quick action');

    await this.prisma.workspaceQuickAction.delete({ where: { id } });
    return { deleted: true };
  }

  async reorderQuickActions(userId: string, dto: ReorderQuickActionsDto) {
    const updates = dto.orderedIds.map((id, index) =>
      this.prisma.workspaceQuickAction.updateMany({
        where: { id, userId },
        data: { order: index },
      }),
    );
    await Promise.all(updates);
    return this.getQuickActions(userId);
  }
}
