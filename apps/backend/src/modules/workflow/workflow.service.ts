import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { WorkflowAction, UserRole, LegislativeStatus } from '@prisma/client';
import { findTransition, getAvailableTransitions } from './lifecycle-rules';

@Injectable()
export class WorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  async transition(
    itemId: string,
    action: WorkflowAction,
    userId: string,
    userRole: UserRole,
    comment?: string,
  ) {
    const item = await this.prisma.legislativeItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException(`Legislative item ${itemId} not found`);

    const rule = findTransition(item.status, action);

    if (!rule) {
      throw new BadRequestException(
        `Action "${action}" is not valid from status "${item.status}"`,
      );
    }

    if (!rule.allowedRoles.includes(userRole)) {
      throw new ForbiddenException(
        `Role "${userRole}" cannot perform action "${action}"`,
      );
    }

    const [updatedItem, historyRecord] = await this.prisma.$transaction([
      this.prisma.legislativeItem.update({
        where: { id: itemId },
        data: {
          status: rule.toStatus,
          ...(rule.toStatus === LegislativeStatus.PUBLISHED && { publishedAt: new Date() }),
        },
      }),
      this.prisma.workflowHistory.create({
        data: {
          legislativeItemId: itemId,
          fromStatus: item.status,
          toStatus: rule.toStatus,
          action,
          performedById: userId,
          comment,
          metadata: { userRole },
        },
        include: {
          performedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
    ]);

    return { item: updatedItem, history: historyRecord };
  }

  async getHistory(itemId: string) {
    const item = await this.prisma.legislativeItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException(`Legislative item ${itemId} not found`);

    const history = await this.prisma.workflowHistory.findMany({
      where: { legislativeItemId: itemId },
      orderBy: { createdAt: 'desc' },
      include: {
        performedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return { data: history, total: history.length };
  }

  async addComment(itemId: string, userId: string, userRole: UserRole, comment: string) {
    const item = await this.prisma.legislativeItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException(`Legislative item ${itemId} not found`);

    return this.prisma.workflowHistory.create({
      data: {
        legislativeItemId: itemId,
        fromStatus: item.status,
        toStatus: item.status,
        action: WorkflowAction.REQUEST_REVISION,
        performedById: userId,
        comment,
        metadata: { userRole, type: 'COMMENT' },
      },
      include: {
        performedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async getAvailableActions(itemId: string, userRole: UserRole) {
    const item = await this.prisma.legislativeItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException(`Legislative item ${itemId} not found`);

    return {
      currentStatus: item.status,
      availableTransitions: getAvailableTransitions(item.status, userRole),
    };
  }
}
