export const DEFAULT_CHANGE_DISCLAIMER =
  'This change analysis is AI-generated. Automated semantic diff may miss nuanced legal implications. Human expert review is required before acting on these findings.';

export type ChangeType = 'MINOR' | 'MODERATE' | 'MAJOR' | 'STRUCTURAL';

export interface SemanticDiffResult {
  hasChanges: boolean;
  changeType: ChangeType;
  addedObligations: string[];
  removedObligations: string[];
  modifiedProvisions: string[];
  newRisks: string[];
  resolvedRisks: string[];
  semanticSummary: string;
  confidenceScore: number;
  disclaimer: string;
}

export interface RiskChangeDiffResult {
  hasChanges: boolean;
  changeType: ChangeType;
  addedObligations: string[];
  removedObligations: string[];
  modifiedProvisions: string[];
  newRisks: string[];
  resolvedRisks: string[];
  semanticSummary: string;
  confidenceScore: number;
  disclaimer: string;
}
