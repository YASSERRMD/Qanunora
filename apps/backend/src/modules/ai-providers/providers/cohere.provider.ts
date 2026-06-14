import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import { BaseAiProvider } from './base.provider';
import { AiCompletionOptions, AiCompletionResult } from '../interfaces/ai-provider.interface';

@Injectable()
export class CohereProvider extends BaseAiProvider {
  readonly name = 'cohere';
  readonly supportedModels = [
    'command-r-plus',
    'command-r',
    'command',
    'command-light',
  ];

  private readonly apiKey: string;
  private readonly defaultModel: string;

  constructor(private readonly configService: ConfigService) {
    super();
    this.apiKey = this.configService.get<string>('COHERE_API_KEY', '');
    this.defaultModel = this.configService.get<string>('COHERE_MODEL', 'command-r');
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async complete(options: AiCompletionOptions): Promise<AiCompletionResult> {
    const model = options.model ?? this.defaultModel;

    // Cohere v2 format: messages with role/content
    const body: Record<string, unknown> = {
      model,
      messages: options.messages.map((m) => ({ role: m.role, content: m.content })),
    };
    if (options.temperature !== undefined) body['temperature'] = options.temperature;
    if (options.maxTokens) body['max_tokens'] = options.maxTokens;

    const raw = await this.post('https://api.cohere.com/v2/chat', body, {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    });

    const message = raw['message'] as { content: { type: string; text: string }[] } | undefined;
    const textContent = message?.content?.find((c) => c.type === 'text');
    const usage = raw['usage'] as {
      billed_units?: { input_tokens: number; output_tokens: number };
    } | undefined;

    return {
      content: textContent?.text ?? '',
      model,
      provider: this.name,
      usage: usage?.billed_units
        ? {
            promptTokens: usage.billed_units.input_tokens,
            completionTokens: usage.billed_units.output_tokens,
            totalTokens: usage.billed_units.input_tokens + usage.billed_units.output_tokens,
          }
        : undefined,
      rawResponse: raw,
    };
  }

  private post(
    url: string,
    body: Record<string, unknown>,
    headers: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const bodyStr = JSON.stringify(body);
      const parsedUrl = new URL(url);
      const req = https.request(
        {
          hostname: parsedUrl.hostname,
          path: parsedUrl.pathname,
          method: 'POST',
          headers: { ...headers, 'Content-Length': Buffer.byteLength(bodyStr) },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          res.on('end', () => {
            try { resolve(JSON.parse(data) as Record<string, unknown>); }
            catch { reject(new Error(`Failed to parse Cohere response: ${data}`)); }
          });
        },
      );
      req.on('error', reject);
      req.write(bodyStr);
      req.end();
    });
  }
}
