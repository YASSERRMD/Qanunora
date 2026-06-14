export const DEFAULT_JURISDICTION_DISCLAIMER =
  'This cross-jurisdiction comparison is AI-generated for reference purposes only. It does not represent a formal legal opinion. Verify all comparisons with qualified legal experts in the relevant jurisdictions.';

export interface ComparisonResult {
  targetJurisdiction: string;
  similarities: string[];
  differences: string[];
  gaps: string[];
  bestPractices: string[];
  recommendations: string[];
  confidenceScore: number;
  disclaimer: string;
}
