/**
 * Build a system prompt instruction that constrains AI output to valid JSON
 * matching the provided schema.
 */
export function buildJsonPrompt(schema: Record<string, unknown>): string {
  return `Respond ONLY with valid JSON matching this schema. No markdown, no explanation:\n${JSON.stringify(schema, null, 2)}`;
}

/**
 * Parse a JSON response from an AI provider, stripping markdown code fences
 * (` ```json ... ``` ` or ` ``` ... ``` `) if present.
 * Throws a SyntaxError if the resulting text is not valid JSON.
 */
export function parseJsonResponse<T>(text: string): T {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  return JSON.parse(cleaned) as T;
}
