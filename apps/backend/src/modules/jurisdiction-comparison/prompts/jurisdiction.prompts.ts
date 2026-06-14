export interface JurisdictionMessagePair {
  system: string;
  user: string;
}

export interface LegislativeItemInput {
  title: string;
  type: string;
  description?: string | null;
  objective?: string | null;
}

/**
 * Prompt to compare a draft legislative item against legislation in a target jurisdiction.
 */
export function buildJurisdictionComparisonPrompt(
  item: LegislativeItemInput,
  targetJurisdiction: string,
  referenceContext?: string,
): JurisdictionMessagePair {
  return {
    system: `You are a comparative legislative analyst with expertise in international law and regulatory frameworks.
Respond ONLY with valid JSON. No markdown fences, no extra text.
Required JSON structure:
{
  "targetJurisdiction": "string",
  "similarities": ["string"],
  "differences": ["string"],
  "gaps": ["string"],
  "bestPractices": ["string"],
  "recommendations": ["string"],
  "confidenceScore": number,
  "disclaimer": "string"
}`,
    user: `Compare the following draft legislative item with existing legislation in ${targetJurisdiction}.

Draft Legislative Item:
Title: ${item.title}
Type: ${item.type}
${item.description ? `Description: ${item.description}` : ''}
${item.objective ? `Objective: ${item.objective}` : ''}
${referenceContext ? `\nAdditional Context:\n${referenceContext}` : ''}

Analyse:
1. Similarities with ${targetJurisdiction} legislation on the same subject
2. Key differences in approach, scope, or enforcement
3. Gaps in the draft compared to ${targetJurisdiction} best practices
4. Best practices from ${targetJurisdiction} that could be adopted
5. Specific recommendations for improving the draft

Provide a confidenceScore (0-1) reflecting your knowledge of ${targetJurisdiction} legislation on this topic.`,
  };
}
