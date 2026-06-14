import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import { BaseAiProvider } from './base.provider';
import { AiCompletionOptions, AiCompletionResult } from '../interfaces/ai-provider.interface';

@Injectable()
export class GroqProvider extends BaseAiProvider {
  readonly name = 'groq';
  readonly supportedModels = [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'mixtral-8x7b-32768',
    'gemma2-9b-it',
  ];

  private readonly apiKey: string;
  private readonly defaultModel: string;

  constructor(private readonly configService: ConfigService) {
    super();
    this.apiKey = this.configService.get<string>('GROQ_API_KEY', '');
    this.defaultModel = this.configService.get<string>('GROQ_MODEL', 'llama-3.1-8b-instant');
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async complete(options: AiCompletionOptions): Promise<AiCompletionResult> {
    const model = options.model ?? this.defaultModel;
    const body: Record<string, unknown> = {
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
    };
    if (options.maxTokens) body['max_tokens'] = options.maxTokens;

    // Groq uses OpenAI-compatible endpoint
    const raw = await this.post('https://api.groq.com/openai/v1/chat/completions', body, {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    });

    const choices = raw['choices'] as { message: { content: string } }[];
    const usage = raw['usage'] as {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    } | undefined;

    return {
      content: choices?.[0]?.message?.content ?? '',
      model,
      provider: this.name,
      usage: usage
        ? {
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
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
            catch { reject(new Error(`Failed to parse Groq response: ${data}`)); }
          });
        },
      );
      req.on('error', reject);
      req.write(bodyStr);
      req.end();
    });
  }
}
