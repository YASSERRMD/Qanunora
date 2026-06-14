export interface RegulatoryMessagePair {
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
 * Prompt to ask AI which existing laws are affected by a new legislative item.
 */
export function buildRegulationDetectionPrompt(
  item: LegislativeItemInput,
  existingLaws: string[],
): RegulatoryMessagePair {
  return {
    system: `You are a regulatory mapping specialist with expertise in legislative analysis.
Respond ONLY with valid JSON. No markdown fences, no extra text.
Required JSON structure:
{
  "affectedLaws": [
    {
      "name": "string",
      "referenceNumber": "string or null",
      "jurisdiction": "string or null",
      "dependencyType": "AMENDS | REPLACES | SUPPLEMENTS | CONFLICTS_WITH | REFERENCES | DEPENDENT_ON",
      "isConflicting": boolean,
      "description": "string explaining the relationship"
    }
  ]
}`,
    user: `Analyse the following legislative item and identify which of the existing laws listed below are affected.

Legislative Item:
Title: ${item.title}
Type: ${item.type}
${item.description ? `Description: ${item.description}` : ''}
${item.objective ? `Objective: ${item.objective}` : ''}

Existing Laws to Evaluate:
${existingLaws.map((law, i) => `${i + 1}. ${law}`).join('\n')}

For each affected law, determine:
- The type of dependency (AMENDS, REPLACES, SUPPLEMENTS, CONFLICTS_WITH, REFERENCES, DEPENDENT_ON)
- Whether there is a direct conflict (isConflicting)
- A brief explanation of the relationship

Only include laws that are genuinely affected.`,
  };
}

/**
 * Prompt to determine if there is a conflict between a legislative item and a specific reference.
 */
export function buildConflictDetectionPrompt(
  item: LegislativeItemInput,
  reference: { name: string; description?: string },
): RegulatoryMessagePair {
  return {
    system: `You are a legal conflict analyst specialising in legislative harmonisation.
Respond ONLY with valid JSON. No markdown fences, no extra text.
Required JSON structure:
{
  "isConflicting": boolean,
  "conflictType": "DIRECT | INDIRECT | NONE",
  "explanation": "string",
  "resolution": "string or null"
}`,
    user: `Assess whether the following legislative item conflicts with the specified regulation.

Legislative Item:
Title: ${item.title}
Type: ${item.type}
${item.description ? `Description: ${item.description}` : ''}
${item.objective ? `Objective: ${item.objective}` : ''}

Regulation:
Name: ${reference.name}
${reference.description ? `Description: ${reference.description}` : ''}

Determine if there is a direct or indirect conflict, explain the nature of any conflict, and suggest a possible resolution.`,
  };
}
