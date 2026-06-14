import { AiCompletionOptions, AiCompletionResult, IAiProvider } from '../interfaces/ai-provider.interface';

export abstract class BaseAiProvider implements IAiProvider {
  abstract readonly name: string;
  abstract readonly supportedModels: string[];
  abstract complete(options: AiCompletionOptions): Promise<AiCompletionResult>;
  abstract isConfigured(): boolean;

  protected buildJsonSystemPrompt(schema?: Record<string, unknown>): string {
    const base = 'Respond ONLY with valid JSON. No markdown fences, no explanation, no extra text.';
    if (!schema) return base;
    return `${base}\nThe response must match this schema:\n${JSON.stringify(schema, null, 2)}`;
  }

  protected extractJson<T>(text: string): T {
    // Strip markdown fences if present
    const cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();
    return JSON.parse(cleaned) as T;
  }
}
