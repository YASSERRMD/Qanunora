export interface ChangeDetectionMessagePair {
  system: string;
  user: string;
}

const SEMANTIC_DIFF_SCHEMA = `{
  "hasChanges": boolean,
  "changeType": "MINOR | MODERATE | MAJOR | STRUCTURAL",
  "addedObligations": ["string"],
  "removedObligations": ["string"],
  "modifiedProvisions": ["string"],
  "newRisks": ["string"],
  "resolvedRisks": ["string"],
  "semanticSummary": "string",
  "confidenceScore": number,
  "disclaimer": "string"
}`;

/**
 * Ask AI to explain the semantic differences between two version snapshots.
 */
export function buildSemanticDiffPrompt(
  version1Content: string,
  version2Content: string,
): ChangeDetectionMessagePair {
  return {
    system: `You are a legislative document analyst specialising in semantic comparison.
Respond ONLY with valid JSON. No markdown fences, no extra text.
Required JSON structure:
${SEMANTIC_DIFF_SCHEMA}`,
    user: `Compare the following two versions of a legislative document and identify all semantic differences.

VERSION 1:
${version1Content}

VERSION 2:
${version2Content}

Analyse:
1. Whether there are meaningful changes (hasChanges)
2. The overall magnitude of change (MINOR/MODERATE/MAJOR/STRUCTURAL)
3. Obligations that were added in Version 2
4. Obligations that were removed from Version 1
5. Provisions that were modified between versions
6. New risks introduced in Version 2
7. Risks resolved from Version 1

Provide a plain-language semanticSummary and a confidenceScore (0-1).`,
  };
}

/**
 * Ask AI to identify changes that introduce new obligations or risks.
 */
export function buildRiskChangePrompt(
  v1Content: string,
  v2Content: string,
): ChangeDetectionMessagePair {
  return {
    system: `You are a legislative risk analyst. Your task is to identify changes between two document versions that introduce new legal obligations, liabilities, or compliance risks.
Respond ONLY with valid JSON. No markdown fences, no extra text.
Required JSON structure:
${SEMANTIC_DIFF_SCHEMA}`,
    user: `Analyse the following two versions of a legislative document with a focus on risk and obligation changes.

VERSION 1:
${v1Content}

VERSION 2:
${v2Content}

Focus specifically on:
1. New obligations imposed on individuals, organisations, or government bodies
2. Removed protections or rights
3. New penalties or enforcement mechanisms
4. Provisions that significantly increase compliance burden
5. Changes that introduce ambiguity or legal uncertainty

Classify the change type and provide specific findings for each category.
Provide a confidenceScore (0-1) and a brief semanticSummary.`,
  };
}
