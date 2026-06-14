import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ReportingService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Lifecycle Report
  // ---------------------------------------------------------------------------

  async generateLifecycleReport(itemId: string) {
    const item = await this.prisma.legislativeItem.findUnique({
      where: { id: itemId },
      include: {
        ministry: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    if (!item) throw new NotFoundException(`Legislative item ${itemId} not found`);

    const [
      workflowHistory,
      versions,
      documents,
      amendments,
      consultations,
      committeeReviews,
      aiAnalyses,
      auditLogs,
    ] = await Promise.all([
      this.prisma.workflowHistory.findMany({
        where: { legislativeItemId: itemId },
        orderBy: { createdAt: 'asc' },
        include: {
          performedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.version.findMany({
        where: { legislativeItemId: itemId },
        orderBy: { versionNumber: 'desc' },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.document.findMany({
        where: { legislativeItemId: itemId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.amendment.findMany({
        where: { legislativeItemId: itemId },
        orderBy: { createdAt: 'desc' },
        include: {
          proposedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.consultation.findMany({
        where: { legislativeItemId: itemId },
        include: { _count: { select: { feedback: true } } },
      }),
      this.prisma.committeeReview.findMany({
        where: { legislativeItemId: itemId },
        include: {
          committee: { select: { id: true, name: true } },
        },
      }),
      this.prisma.aiAnalysis.findMany({
        where: { legislativeItemId: itemId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          analysisType: true,
          status: true,
          createdAt: true,
          completedAt: true,
        },
      }),
      this.prisma.auditLog.findMany({
        where: { entityType: 'LegislativeItem', entityId: itemId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      reportType: 'LIFECYCLE',
      generatedAt: new Date(),
      item,
      workflowHistory,
      versions,
      documents,
      amendments,
      consultations,
      committeeReviews,
      aiAnalyses,
      auditLogs,
    };
  }

  // ---------------------------------------------------------------------------
  // Consultation Report
  // ---------------------------------------------------------------------------

  async generateConsultationReport(consultationId: string) {
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        legislativeItem: { select: { id: true, referenceNumber: true, title: true } },
        _count: { select: { feedback: true } },
      },
    });
    if (!consultation) throw new NotFoundException(`Consultation ${consultationId} not found`);

    const allFeedback = await this.prisma.consultationFeedback.findMany({
      where: { consultationId },
      orderBy: { submittedAt: 'desc' },
      include: {
        submittedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const totalFeedback = allFeedback.length;
    const statusCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    const sentimentCounts: Record<string, number> = { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 };

    for (const f of allFeedback) {
      const status = f.status ?? 'UNKNOWN';
      statusCounts[status] = (statusCounts[status] ?? 0) + 1;

      if (f.category) {
        categoryCounts[f.category] = (categoryCounts[f.category] ?? 0) + 1;
      }

      if (f.sentiment) {
        const s = String(f.sentiment);
        sentimentCounts[s] = (sentimentCounts[s] ?? 0) + 1;
      }
    }

    const topCategories = Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));

    const sentimentBreakdown = Object.entries(sentimentCounts).map(([sentiment, count]) => ({
      sentiment,
      count,
      percentage: totalFeedback > 0 ? Math.round((count / totalFeedback) * 100) : 0,
    }));

    return {
      reportType: 'CONSULTATION',
      generatedAt: new Date(),
      consultation,
      feedbackStats: { total: totalFeedback, statusCounts },
      topCategories,
      sentimentBreakdown,
      allFeedback,
    };
  }

  // ---------------------------------------------------------------------------
  // Impact Report
  // ---------------------------------------------------------------------------

  async generateImpactReport(itemId: string) {
    const item = await this.prisma.legislativeItem.findUnique({
      where: { id: itemId },
      select: { id: true, referenceNumber: true, title: true, status: true, type: true },
    });
    if (!item) throw new NotFoundException(`Legislative item ${itemId} not found`);

    const impactAnalyses = await this.prisma.aiAnalysis.findMany({
      where: {
        legislativeItemId: itemId,
        analysisType: { startsWith: 'IMPACT' },
      },
      orderBy: { createdAt: 'desc' },
    });

    const regulatoryReferences = await this.prisma.regulatoryReference.findMany({
      where: { legislativeItemId: itemId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      reportType: 'IMPACT',
      generatedAt: new Date(),
      item,
      impactAnalyses,
      regulatoryReferences,
    };
  }

  // ---------------------------------------------------------------------------
  // Amendment Report
  // ---------------------------------------------------------------------------

  async generateAmendmentReport(itemId: string) {
    const item = await this.prisma.legislativeItem.findUnique({
      where: { id: itemId },
      select: { id: true, referenceNumber: true, title: true, status: true },
    });
    if (!item) throw new NotFoundException(`Legislative item ${itemId} not found`);

    const amendments = await this.prisma.amendment.findMany({
      where: { legislativeItemId: itemId },
      orderBy: { createdAt: 'desc' },
      include: {
        proposedBy: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const statusCounts: Record<string, number> = {};
    for (const a of amendments) {
      statusCounts[a.status] = (statusCounts[a.status] ?? 0) + 1;
    }

    return {
      reportType: 'AMENDMENT',
      generatedAt: new Date(),
      item,
      amendments,
      statusCounts,
      totalAmendments: amendments.length,
    };
  }

  // ---------------------------------------------------------------------------
  // Audit Report
  // ---------------------------------------------------------------------------

  async generateAuditReport(itemId: string) {
    const item = await this.prisma.legislativeItem.findUnique({
      where: { id: itemId },
      select: { id: true, referenceNumber: true, title: true, status: true, type: true },
    });
    if (!item) throw new NotFoundException(`Legislative item ${itemId} not found`);

    const [workflowDecisions, versions, auditLogs] = await Promise.all([
      this.prisma.workflowHistory.findMany({
        where: { legislativeItemId: itemId },
        orderBy: { createdAt: 'asc' },
        include: {
          performedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.version.findMany({
        where: { legislativeItemId: itemId },
        orderBy: { versionNumber: 'asc' },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.auditLog.findMany({
        where: { entityType: 'LegislativeItem', entityId: itemId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const approvals = workflowDecisions.filter((w) => w.action === 'APPROVE');

    return {
      reportType: 'AUDIT',
      generatedAt: new Date(),
      item,
      workflowDecisions,
      approvals,
      versions,
      auditLogs,
    };
  }

  // ---------------------------------------------------------------------------
  // Ministry Report
  // ---------------------------------------------------------------------------

  async generateMinistryReport(
    ministryId: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const ministry = await this.prisma.ministry.findUnique({
      where: { id: ministryId },
    });
    if (!ministry) throw new NotFoundException(`Ministry ${ministryId} not found`);

    const where = {
      ministryId,
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    };

    const items = await this.prisma.legislativeItem.findMany({
      where,
      select: {
        id: true,
        referenceNumber: true,
        title: true,
        type: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        targetEnactmentDate: true,
      },
    });

    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    for (const item of items) {
      byType[item.type] = (byType[item.type] ?? 0) + 1;
      byStatus[item.status] = (byStatus[item.status] ?? 0) + 1;
    }

    const approvedItems = items.filter((i) => i.status === 'ENACTED');
    const avgDaysToEnactment =
      approvedItems.length > 0
        ? Math.round(
            approvedItems.reduce((sum, i) => {
              const days = Math.ceil(
                (new Date(i.updatedAt).getTime() - new Date(i.createdAt).getTime()) / 86400000,
              );
              return sum + days;
            }, 0) / approvedItems.length,
          )
        : null;

    return {
      reportType: 'MINISTRY',
      generatedAt: new Date(),
      ministry,
      totalItems: items.length,
      byType,
      byStatus,
      avgDaysToEnactment,
      items,
    };
  }
}
