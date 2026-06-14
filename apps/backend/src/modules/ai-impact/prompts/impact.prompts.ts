import { ImpactCategory } from '@prisma/client';

export interface ImpactMessagePair {
  system: string;
  user: string;
}

export interface LegislativeItemInput {
  title: string;
  type: string;
  description?: string | null;
  objective?: string | null;
}

export function buildImpactAnalysisPrompt(
  item: LegislativeItemInput,
  category: ImpactCategory,
): ImpactMessagePair {
  const categoryLabel = category.charAt(0) + category.slice(1).toLowerCase();

  return {
    system: `You are a legislative impact analyst. Respond only with valid JSON.
No markdown fences, no extra text.
Required JSON structure:
{
  "category": "${category}",
  "severity": "CRITICAL | HIGH | MEDIUM | LOW | NEGLIGIBLE",
  "summary": "string",
  "affectedGroups": ["string"],
  "positiveEffects": ["string"],
  "negativeEffects": ["string"],
  "risks": ["string"],
  "recommendations": ["string"],
  "confidenceScore": number,
  "disclaimer": "string"
}`,
    user: `Analyse the ${categoryLabel} impact of the following legislative item:

Title: ${item.title}
Type: ${item.type}
${item.description ? `Description: ${item.description}` : ''}
${item.objective ? `Objective: ${item.objective}` : ''}

Provide a detailed ${categoryLabel} impact assessment covering:
- Overall severity of the ${categoryLabel} impact
- Who or what is affected
- Positive and negative effects
- Risks introduced
- Actionable recommendations

Return a confidenceScore between 0 and 1 reflecting your certainty.`,
  };
}
