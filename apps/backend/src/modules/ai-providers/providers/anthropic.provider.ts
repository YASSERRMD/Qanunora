import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import { BaseAiProvider } from './base.provider';
import { AiCompletionOptions, AiCompletionResult, AiMessage } from '../interfaces/ai-provider.interface';

@Injectable()
export class AnthropicProvider extends BaseAiProvider {
  readonly name = 'anthropic';
  readonly supportedModels = [
    'claude-opus-4-5',
    'claude-sonnet-4-5',
    'claude-haiku-3-5',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
  ];

  private readonly apiKey: string;
  private readonly defaultModel: string;

  constructor(private readonly configService: ConfigService) {
    super();
    this.apiKey = this.configService.get<string>('ANTHROPIC_API_KEY', '');
    this.defaultModel = this.configService.get<string>('ANTHROPIC_MODEL', 'claude-haiku-3-5');
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async complete(options: AiCompletionOptions): Promise<AiCompletionResult> {
    const model = options.model ?? this.defaultModel;

    // Anthropic uses system as a top-level field; filter it out from messages
    const systemMessages = options.messages.filter((m) => m.role === 'system');
    const userMessages = options.messages.filter((m) => m.role !== 'system');

    const body: Record<string, unknown> = {
      model,
      max_tokens: options.maxTokens ?? 4096,
      messages: userMessages.map((m: AiMessage) => ({ role: m.role, content: m.content })),
    };

    if (systemMessages.length > 0) {
      body['system'] = systemMessages.map((m) => m.content).join('\n\n');
    }

    if (options.temperature !== undefined) {
      body['temperature'] = options.temperature;
    }

    const raw = await this.post('https://api.anthropic.com/v1/messages', body, {
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    });

    const content = (raw['content'] as { type: string; text: string }[]) ?? [];
    const textBlock = content.find((c) => c.type === 'text');
    const usage = raw['usage'] as {
      input_tokens: number;
      output_tokens: number;
    } | undefined;

    return {
      content: textBlock?.text ?? '',
      model,
      provider: this.name,
      usage: usage
        ? {
            promptTokens: usage.input_tokens,
            completionTokens: usage.output_tokens,
            totalTokens: usage.input_tokens + usage.output_tokens,
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
            catch { reject(new Error(`Failed to parse Anthropic response: ${data}`)); }
          });
        },
      );
      req.on('error', reject);
      req.write(bodyStr);
      req.end();
    });
  }
}
