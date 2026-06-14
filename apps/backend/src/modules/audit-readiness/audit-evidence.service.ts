import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  AUDIT_CHECKLIST_ITEMS,
  AuditOverallStatus,
  AuditSummary,
  ChecklistEvaluationResult,
} from './audit-checklist.schema';

@Injectable()
export class AuditEvidenceService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Evaluate all checklist items for a legislative item
  // ---------------------------------------------------------------------------

  async evaluateChecklist(
    legislativeItemId: string,
  ): Promise<ChecklistEvaluationResult[]> {
    const item = await this.prisma.legislativeItem.findUnique({
      where: { id: legislativeItemId },
      select: { id: true, title: true, status: true },
    });

    if (!item) {
      throw new NotFoundException(`Legislative item ${legislativeItemId} not found`);
    }

    const results: ChecklistEvaluationResult[] = [];

    for (const checklistItem of AUDIT_CHECKLIST_ITEMS) {
      const result = await this.evaluateItem(legislativeItemId, checklistItem.id);
      results.push({
        item: checklistItem,
        passed: result.passed,
        evidence: result.evidence,
      });
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Individual item evaluators
  // ---------------------------------------------------------------------------

  private async evaluateItem(
    legislativeItemId: string,
    checklistId: string,
  ): Promise<{ passed: boolean; evidence: string }> {
    switch (checklistId) {
      case 'CL01': {
        // At least one DRAFT document
        const count = await this.prisma.document.count({
          where: { legislativeItemId, category: 'DRAFT' },
        });
        return {
          passed: count > 0,
          evidence:
            count > 0
              ? `${count} DRAFT document(s) found`
              : 'No DRAFT documents uploaded',
        };
      }

      case 'CL02': {
        // At least one FINAL document
        const count = await this.prisma.document.count({
          where: { legislativeItemId, category: 'FINAL' },
        });
        return {
          passed: count > 0,
          evidence:
            count > 0
              ? `${count} FINAL document(s) found`
              : 'No FINAL documents uploaded',
        };
      }

      case 'CL03': {
        // At least one workflow transition
        const count = await this.prisma.workflowHistory.count({
          where: { legislativeItemId },
        });
        return {
          passed: count > 0,
          evidence:
            count > 0
              ? `${count} workflow transition(s) recorded`
              : 'No workflow transitions recorded',
        };
      }

      case 'CL04': {
        // Committee review with a recommendation
        const review = await this.prisma.committeeReview.findFirst({
          where: {
            legislativeItemId,
            recommendation: { not: null },
          },
        });
        return {
          passed: !!review,
          evidence: review
            ? `Committee review found with recommendation: "${review.recommendation?.slice(0, 60)}"`
            : 'No committee review with recommendation found',
        };
      }

      case 'CL05': {
        // At least one CLOSED consultation
        const count = await this.prisma.consultation.count({
          where: { legislativeItemId, status: 'CLOSED' },
        });
        return {
          passed: count > 0,
          evidence:
            count > 0
              ? `${count} consultation(s) reached CLOSED status`
              : 'No consultations have been closed',
        };
      }

      case 'CL06': {
        // Item reached LEGAL_REVIEW status at some point
        const transition = await this.prisma.workflowHistory.findFirst({
          where: {
            legislativeItemId,
            toStatus: 'LEGAL_REVIEW',
          },
        });
        return {
          passed: !!transition,
          evidence: transition
            ? `Item transitioned to LEGAL_REVIEW on ${transition.createdAt.toISOString().split('T')[0]}`
            : 'Item has not reached LEGAL_REVIEW stage',
        };
      }

      case 'CL07': {
        // APPROVE action exists in workflow history
        const approval = await this.prisma.workflowHistory.findFirst({
          where: { legislativeItemId, action: 'APPROVE' },
        });
        return {
          passed: !!approval,
          evidence: approval
            ? `Approval recorded on ${approval.createdAt.toISOString().split('T')[0]}`
            : 'No approval action found in workflow history',
        };
      }

      case 'CL08': {
        // At least 2 versions
        const count = await this.prisma.version.count({
          where: { legislativeItemId },
        });
        return {
          passed: count >= 2,
          evidence:
            count >= 2
              ? `${count} version(s) exist in version history`
              : `Only ${count} version(s) — minimum 2 required`,
        };
      }

      case 'CL09': {
        // At least one trace link
        const count = await this.prisma.traceLink.count({
          where: { legislativeItemId },
        });
        return {
          passed: count > 0,
          evidence:
            count > 0
              ? `${count} trace link(s) established`
              : 'No trace links found for this item',
        };
      }

      case 'CL10': {
        // At least one impact analysis
        const count = await this.prisma.aiAnalysis.count({
          where: {
            legislativeItemId,
            analysisType: { startsWith: 'IMPACT_' },
          },
        });
        return {
          passed: count > 0,
          evidence:
            count > 0
              ? `${count} impact analysis record(s) found`
              : 'No impact analysis has been run',
        };
      }

      default:
        return { passed: false, evidence: 'Unknown checklist item' };
    }
  }

  // ---------------------------------------------------------------------------
  // Audit summary
  // ---------------------------------------------------------------------------

  async getAuditSummary(legislativeItemId: string): Promise<AuditSummary> {
    const checklist = await this.evaluateChecklist(legislativeItemId);

    const totalItems = checklist.length;
    const passedItems = checklist.filter((c) => c.passed).length;
    const requiredItems = checklist.filter((c) => c.item.required).length;
    const passedRequired = checklist.filter((c) => c.item.required && c.passed).length;

    let overallStatus: AuditOverallStatus;
    if (passedRequired === requiredItems && passedItems === totalItems) {
      overallStatus = 'READY';
    } else if (passedRequired === requiredItems) {
      overallStatus = 'PARTIAL'; // all required passed but some optional not
    } else if (passedRequired > 0) {
      overallStatus = 'PARTIAL'; // some required passed
    } else {
      overallStatus = 'NOT_READY';
    }

    return {
      legislativeItemId,
      totalItems,
      passedItems,
      requiredItems,
      passedRequired,
      overallStatus,
      checklist,
    };
  }

  // ---------------------------------------------------------------------------
  // Export audit report
  // ---------------------------------------------------------------------------

  async exportAuditReport(legislativeItemId: string): Promise<Record<string, unknown>> {
    const item = await this.prisma.legislativeItem.findUnique({
      where: { id: legislativeItemId },
      include: {
        ministry: { select: { id: true, name: true } },
      },
    });

    if (!item) {
      throw new NotFoundException(`Legislative item ${legislativeItemId} not found`);
    }

    const [checklist, workflowHistory, versions, documents, consultations, committeeReviews, auditLogs] =
      await Promise.all([
        this.evaluateChecklist(legislativeItemId),
        this.prisma.workflowHistory.findMany({
          where: { legislativeItemId },
          orderBy: { createdAt: 'asc' },
          include: { performedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
        }),
        this.prisma.version.findMany({
          where: { legislativeItemId },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.document.findMany({
          where: { legislativeItemId },
          select: {
            id: true,
            originalName: true,
            category: true,
            title: true,
            createdAt: true,
          },
        }),
        this.prisma.consultation.findMany({
          where: { legislativeItemId },
          include: { _count: { select: { feedback: true } } },
        }),
        this.prisma.committeeReview.findMany({
          where: { legislativeItemId },
          include: { committee: { select: { id: true, name: true } } },
        }),
        this.prisma.auditLog.findMany({
          where: { entityType: 'LegislativeItem', entityId: legislativeItemId },
          orderBy: { createdAt: 'asc' },
          take: 100,
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        }),
      ]);

    const passedRequired = checklist.filter((c) => c.item.required && c.passed).length;
    const requiredItems = checklist.filter((c) => c.item.required).length;
    const overallStatus: AuditOverallStatus =
      passedRequired === requiredItems ? 'READY' : passedRequired > 0 ? 'PARTIAL' : 'NOT_READY';

    return {
      reportGeneratedAt: new Date().toISOString(),
      legislativeItem: {
        id: item.id,
        title: item.title,
        type: item.type,
        status: item.status,
        referenceNumber: item.referenceNumber,
        ministry: item.ministry,
      },
      auditSummary: {
        overallStatus,
        passedRequired,
        requiredItems,
        totalChecklist: checklist.length,
        passedChecklist: checklist.filter((c) => c.passed).length,
      },
      checklist,
      workflowHistory,
      versions,
      documents,
      consultations,
      committeeReviews,
      auditLogs,
    };
  }
}
