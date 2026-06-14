import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import { BaseAiProvider } from './base.provider';
import { AiCompletionOptions, AiCompletionResult, AiMessage } from '../interfaces/ai-provider.interface';

@Injectable()
export class GeminiProvider extends BaseAiProvider {
  readonly name = 'gemini';
  readonly supportedModels = [
    'gemini-2.0-flash-exp',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-pro',
  ];

  private readonly apiKey: string;
  private readonly defaultModel: string;

  constructor(private readonly configService: ConfigService) {
    super();
    this.apiKey = this.configService.get<string>('GOOGLE_AI_API_KEY', '');
    this.defaultModel = this.configService.get<string>('GEMINI_MODEL', 'gemini-1.5-flash');
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async complete(options: AiCompletionOptions): Promise<AiCompletionResult> {
    const model = options.model ?? this.defaultModel;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

    // Map messages to Gemini contents format
    const systemMessages = options.messages.filter((m) => m.role === 'system');
    const nonSystemMessages = options.messages.filter((m) => m.role !== 'system');

    const body: Record<string, unknown> = {
      contents: nonSystemMessages.map((m: AiMessage) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    };

    if (systemMessages.length > 0) {
      body['systemInstruction'] = {
        parts: [{ text: systemMessages.map((m) => m.content).join('\n\n') }],
      };
    }

    if (options.temperature !== undefined || options.maxTokens !== undefined) {
      body['generationConfig'] = {
        ...(options.temperature !== undefined && { temperature: options.temperature }),
        ...(options.maxTokens !== undefined && { maxOutputTokens: options.maxTokens }),
      };
    }

    const raw = await this.post(url, body);
    const candidates = raw['candidates'] as {
      content: { parts: { text: string }[] };
    }[];

    const usageMeta = raw['usageMetadata'] as {
      promptTokenCount: number;
      candidatesTokenCount: number;
      totalTokenCount: number;
    } | undefined;

    return {
      content: candidates?.[0]?.content?.parts?.[0]?.text ?? '',
      model,
      provider: this.name,
      usage: usageMeta
        ? {
            promptTokens: usageMeta.promptTokenCount,
            completionTokens: usageMeta.candidatesTokenCount,
            totalTokens: usageMeta.totalTokenCount,
          }
        : undefined,
      rawResponse: raw,
    };
  }

  private post(url: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const bodyStr = JSON.stringify(body);
      const parsedUrl = new URL(url);

      const req = https.request(
        {
          hostname: parsedUrl.hostname,
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(bodyStr),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          res.on('end', () => {
            try { resolve(JSON.parse(data) as Record<string, unknown>); }
            catch { reject(new Error(`Failed to parse Gemini response: ${data}`)); }
          });
        },
      );
      req.on('error', reject);
      req.write(bodyStr);
      req.end();
    });
  }
}
