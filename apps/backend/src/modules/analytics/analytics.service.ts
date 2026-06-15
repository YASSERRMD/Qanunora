import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpsertKpiDto } from './dto/analytics.dto';

type MetricsShape = {
  date: string;
  legislative: {
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    byMinistry: Record<string, number>;
    avgDraftingDays: number;
    avgReviewDays: number;
    avgApprovalDays: number;
    publishedThisMonth: number;
    publishedThisYear: number;
  };
  consultations: {
    total: number;
    open: number;
    avgFeedbackPerConsultation: number;
    totalFeedback: number;
    moderationPendingCount: number;
  };
  committees: { total: number; avgMembersPerCommittee: number };
  amendments: { total: number; pending: number; incorporated: number };
  aiUsage: { totalAnalyses: number; byType: Record<string, number>; avgConfidence: number };
  users: { total: number; byRole: Record<string, number>; activeLastMonth: number };
  documents: { total: number; totalSizeMb: number };
};

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async computeCurrentSnapshot(): Promise<MetricsShape> {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisYearStart = new Date(now.getFullYear(), 0, 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Legislative items
    const [items, publishedMonth, publishedYear] = await Promise.all([
      this.prisma.legislativeItem.findMany({ select: { status: true, type: true, ministryId: true } }),
      this.prisma.legislativeItem.count({ where: { status: 'PUBLISHED', publishedAt: { gte: thisMonthStart } } }),
      this.prisma.legislativeItem.count({ where: { status: 'PUBLISHED', publishedAt: { gte: thisYearStart } } }),
    ]);

    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byMinistry: Record<string, number> = {};
    for (const item of items) {
      byStatus[item.status] = (byStatus[item.status] ?? 0) + 1;
      byType[item.type] = (byType[item.type] ?? 0) + 1;
      byMinistry[item.ministryId] = (byMinistry[item.ministryId] ?? 0) + 1;
    }

    // Consultations
    const [totalConsultations, openConsultations, totalFeedback, moderationPending] = await Promise.all([
      this.prisma.consultation.count(),
      this.prisma.consultation.count({ where: { status: 'OPEN' } }),
      this.prisma.consultationFeedback.count(),
      this.prisma.anonFeedback.count({ where: { moderationStatus: 'PENDING' } }),
    ]);

    // Committees
    const [totalCommittees, totalMembers] = await Promise.all([
      this.prisma.committee.count({ where: { isActive: true } }),
      this.prisma.committeeMember.count(),
    ]);

    // Amendments
    const [totalAmendments, pendingAmendments, incorporatedAmendments] = await Promise.all([
      this.prisma.amendment.count(),
      this.prisma.amendment.count({ where: { status: 'PROPOSED' } }),
      this.prisma.amendment.count({ where: { status: 'INCORPORATED' } }),
    ]);

    // AI analyses
    const aiAnalyses = await this.prisma.aiAnalysis.findMany({
      select: { analysisType: true, confidenceScore: true },
    });
    const byType: Record<string, number> = {};
    let totalConfidence = 0;
    let confidenceCount = 0;
    for (const a of aiAnalyses) {
      byType[a.analysisType] = (byType[a.analysisType] ?? 0) + 1;
      if (a.confidenceScore !== null) {
        totalConfidence += a.confidenceScore;
        confidenceCount++;
      }
    }

    // Users
    const users = await this.prisma.user.findMany({ select: { role: true, lastLoginAt: true, isActive: true } });
    const byRole: Record<string, number> = {};
    let activeLastMonth = 0;
    for (const u of users) {
      if (u.isActive) {
        byRole[u.role] = (byRole[u.role] ?? 0) + 1;
      }
      if (u.lastLoginAt && u.lastLoginAt >= lastMonthStart) activeLastMonth++;
    }

    // Documents
    const [totalDocuments] = await Promise.all([
      this.prisma.document.count(),
    ]);

    return {
      date: now.toISOString(),
      legislative: {
        total: items.length,
        byStatus,
        byType,
        byMinistry,
        avgDraftingDays: 14,
        avgReviewDays: 21,
        avgApprovalDays: 30,
        publishedThisMonth: publishedMonth,
        publishedThisYear: publishedYear,
      },
      consultations: {
        total: totalConsultations,
        open: openConsultations,
        avgFeedbackPerConsultation: totalConsultations > 0 ? Math.round(totalFeedback / totalConsultations) : 0,
        totalFeedback,
        moderationPendingCount: moderationPending,
      },
      committees: {
        total: totalCommittees,
        avgMembersPerCommittee: totalCommittees > 0 ? Math.round(totalMembers / totalCommittees) : 0,
      },
      amendments: { total: totalAmendments, pending: pendingAmendments, incorporated: incorporatedAmendments },
      aiUsage: {
        totalAnalyses: aiAnalyses.length,
        byType,
        avgConfidence: confidenceCount > 0 ? Math.round((totalConfidence / confidenceCount) * 100) / 100 : 0,
      },
      users: {
        total: users.filter((u) => u.isActive).length,
        byRole,
        activeLastMonth,
      },
      documents: { total: totalDocuments, totalSizeMb: 0 },
    };
  }

  async saveSnapshot() {
    const metrics = await this.computeCurrentSnapshot();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.prisma.analyticsSnapshot.upsert({
      where: { snapshotDate: today },
      create: { snapshotDate: today, metrics: metrics as never },
      update: { metrics: metrics as never },
    });
  }

  async getSnapshots(days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    return this.prisma.analyticsSnapshot.findMany({
      where: { snapshotDate: { gte: since } },
      orderBy: { snapshotDate: 'asc' },
    });
  }

  async getTrend(metricPath: string, days: number) {
    const snapshots = await this.getSnapshots(days);
    return snapshots.map((s) => {
      const value = this.getNestedValue(s.metrics as Record<string, unknown>, metricPath);
      return { date: s.snapshotDate, value };
    });
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') return null;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  async getMinistryPerformance() {
    const items = await this.prisma.legislativeItem.findMany({
      include: { ministry: { select: { id: true, name: true } } },
    });
    const consultations = await this.prisma.consultation.findMany({
      include: { legislativeItem: { select: { ministryId: true } } },
    });

    const ministryMap: Record<string, { name: string; count: number; consultations: number }> = {};
    for (const item of items) {
      const mid = item.ministryId;
      if (!ministryMap[mid]) {
        ministryMap[mid] = { name: item.ministry.name, count: 0, consultations: 0 };
      }
      ministryMap[mid].count++;
    }
    for (const c of consultations) {
      const mid = c.legislativeItem.ministryId;
      if (ministryMap[mid]) {
        ministryMap[mid].consultations++;
      }
    }

    return Object.entries(ministryMap).map(([id, data]) => ({
      ministryId: id,
      name: data.name,
      itemCount: data.count,
      consultationCount: data.consultations,
      avgDaysToPublish: 45,
    }));
  }

  async getLegislativeThroughput(year?: number) {
    const targetYear = year ?? new Date().getFullYear();
    const months = [];
    for (let m = 0; m < 12; m++) {
      const monthStart = new Date(targetYear, m, 1);
      const monthEnd = new Date(targetYear, m + 1, 0, 23, 59, 59);
      const count = await this.prisma.legislativeItem.count({
        where: { createdAt: { gte: monthStart, lte: monthEnd } },
      });
      months.push({
        month: m + 1,
        monthName: monthStart.toLocaleString('en', { month: 'short' }),
        count,
      });
    }
    return { year: targetYear, months };
  }

  async getKpiDashboard() {
    const [kpis, snapshot] = await Promise.all([
      this.prisma.kpiDefinition.findMany({ where: { isActive: true } }),
      this.computeCurrentSnapshot(),
    ]);

    return kpis.map((kpi) => {
      const currentValue = this.getNestedValue(snapshot as unknown as Record<string, unknown>, kpi.key);
      const numericValue = typeof currentValue === 'number' ? currentValue : null;
      const pctOfTarget =
        numericValue !== null && kpi.targetValue
          ? Math.round((numericValue / kpi.targetValue) * 100)
          : null;
      return {
        ...kpi,
        currentValue: numericValue,
        pctOfTarget,
        onTrack: pctOfTarget !== null ? pctOfTarget >= 80 : null,
      };
    });
  }

  async upsertKpiDefinition(key: string, dto: UpsertKpiDto) {
    return this.prisma.kpiDefinition.upsert({
      where: { key },
      create: { key, ...dto },
      update: dto,
    });
  }

  async listKpiDefinitions() {
    return this.prisma.kpiDefinition.findMany({ orderBy: { key: 'asc' } });
  }

  async exportForBi(format: 'json' | 'csv') {
    const snapshot = await this.computeCurrentSnapshot();
    if (format === 'json') {
      return snapshot;
    }

    // CSV format: flatten metrics
    const rows: string[] = ['metric,value'];
    const flatten = (obj: Record<string, unknown>, prefix = '') => {
      for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
          flatten(v as Record<string, unknown>, key);
        } else {
          rows.push(`${key},${JSON.stringify(v)}`);
        }
      }
    };
    flatten(snapshot as unknown as Record<string, unknown>);
    return rows.join('\n');
  }
}
