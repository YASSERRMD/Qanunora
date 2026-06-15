import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { LegislativeStatus, ConsultationStatus } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Pipeline metrics — counts by status
  // -------------------------------------------------------------------------

  async getPipelineMetrics() {
    const items = await this.prisma.legislativeItem.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const counts: Record<string, number> = {};
    for (const entry of items) {
      counts[entry.status] = entry._count.id;
    }

    const statuses = Object.values(LegislativeStatus);
    const pipeline = statuses.map((s) => ({ status: s, count: counts[s] ?? 0 }));
    const total = pipeline.reduce((acc, p) => acc + p.count, 0);

    return { pipeline, total };
  }

  // -------------------------------------------------------------------------
  // Delayed items — in INTERNAL_REVIEW or COMMITTEE_REVIEW for >14 days
  // -------------------------------------------------------------------------

  async getDelayedItems() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);

    const items = await this.prisma.legislativeItem.findMany({
      where: {
        status: { in: [LegislativeStatus.INTERNAL_REVIEW, LegislativeStatus.COMMITTEE_REVIEW] },
        updatedAt: { lt: cutoff },
      },
      select: {
        id: true,
        referenceNumber: true,
        title: true,
        status: true,
        priority: true,
        updatedAt: true,
        ministry: { select: { name: true, code: true } },
      },
      orderBy: { updatedAt: 'asc' },
    });

    return items.map((item) => {
      const ageDays = Math.floor(
        (Date.now() - item.updatedAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      return { ...item, ageDays };
    });
  }

  // -------------------------------------------------------------------------
  // Bottlenecks — average days per status from WorkflowHistory transitions
  // -------------------------------------------------------------------------

  async getBottlenecks() {
    const history = await this.prisma.workflowHistory.findMany({
      select: { toStatus: true, createdAt: true, legislativeItemId: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by legislativeItemId to compute time per status
    const byItem = new Map<string, Array<{ status: string; at: Date }>>();
    for (const h of history) {
      if (!byItem.has(h.legislativeItemId)) byItem.set(h.legislativeItemId, []);
      byItem.get(h.legislativeItemId)!.push({ status: h.toStatus, at: h.createdAt });
    }

    const statusDays: Record<string, number[]> = {};
    byItem.forEach((transitions) => {
      for (let i = 0; i < transitions.length - 1; i++) {
        const status = transitions[i].status;
        const days =
          (transitions[i + 1].at.getTime() - transitions[i].at.getTime()) /
          (1000 * 60 * 60 * 24);
        if (!statusDays[status]) statusDays[status] = [];
        statusDays[status].push(days);
      }
    });

    return Object.entries(statusDays).map(([status, days]) => ({
      status,
      avgDays: Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10,
      sampleCount: days.length,
    })).sort((a, b) => b.avgDays - a.avgDays);
  }

  // -------------------------------------------------------------------------
  // Consultation metrics
  // -------------------------------------------------------------------------

  async getConsultationMetrics() {
    const [openCount, total, feedbackCount] = await Promise.all([
      this.prisma.consultation.count({ where: { status: ConsultationStatus.OPEN } }),
      this.prisma.consultation.count(),
      this.prisma.consultationFeedback.count(),
    ]);

    const avgFeedback = total > 0 ? Math.round((feedbackCount / total) * 10) / 10 : 0;

    return { openCount, totalConsultations: total, totalFeedback: feedbackCount, avgFeedback };
  }

  // -------------------------------------------------------------------------
  // Approval performance — avg days from DRAFTING to APPROVED by ministry
  // -------------------------------------------------------------------------

  async getApprovalPerformance() {
    const approved = await this.prisma.legislativeItem.findMany({
      where: { status: { in: [LegislativeStatus.APPROVED, LegislativeStatus.PUBLISHED] } },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        ministry: { select: { name: true, code: true } },
      },
    });

    const byMinistry: Record<string, { name: string; days: number[] }> = {};
    for (const item of approved) {
      const code = item.ministry.code;
      if (!byMinistry[code]) byMinistry[code] = { name: item.ministry.name, days: [] };
      const days = (item.updatedAt.getTime() - item.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      byMinistry[code].days.push(days);
    }

    return Object.entries(byMinistry).map(([code, { name, days }]) => ({
      ministryCode: code,
      ministryName: name,
      avgDaysToApproval: Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10,
      sampleCount: days.length,
    })).sort((a, b) => b.avgDaysToApproval - a.avgDaysToApproval);
  }

  // -------------------------------------------------------------------------
  // Recent activity — last 10 workflow history entries
  // -------------------------------------------------------------------------

  async getRecentActivity() {
    return this.prisma.workflowHistory.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        action: true,
        fromStatus: true,
        toStatus: true,
        comment: true,
        createdAt: true,
        legislativeItem: { select: { id: true, title: true, referenceNumber: true } },
        performedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }
}
