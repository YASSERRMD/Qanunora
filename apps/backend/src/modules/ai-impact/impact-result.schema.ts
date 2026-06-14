import { ImpactCategory, ImpactSeverity } from '@prisma/client';

export const DEFAULT_IMPACT_DISCLAIMER =
  'This impact assessment is AI-generated and intended for analytical purposes only. It does not constitute legal advice. Human review is recommended before acting on these findings.';

export interface ImpactResult {
  category: ImpactCategory;
  severity: ImpactSeverity;
  summary: string;
  affectedGroups: string[];
  positiveEffects: string[];
  negativeEffects: string[];
  risks: string[];
  recommendations: string[];
  confidenceScore: number;
  disclaimer: string;
}

export type OverallRiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NEGLIGIBLE';

export const SEVERITY_ORDER: Record<ImpactSeverity, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  NEGLIGIBLE: 1,
};

export interface ImpactSummary {
  itemId: string;
  overallRiskLevel: OverallRiskLevel;
  totalCategories: number;
  analyzedCategories: ImpactCategory[];
  severityBreakdown: Partial<Record<ImpactSeverity, number>>;
  topRisks: string[];
  topRecommendations: string[];
  averageConfidenceScore: number;
  analyses: Array<{
    id: string;
    category: ImpactCategory;
    severity: ImpactSeverity;
    summary: string;
    createdAt: Date;
  }>;
}
