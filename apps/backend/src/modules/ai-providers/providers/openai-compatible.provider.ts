import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import * as http from 'http';
import { BaseAiProvider } from './base.provider';
import { AiCompletionOptions, AiCompletionResult } from '../interfaces/ai-provider.interface';

/**
 * Generic OpenAI-compatible provider for custom endpoints (e.g. LM Studio,
 * vLLM, LocalAI, OpenRouter, etc.). Configure via:
 *   CUSTOM_AI_BASE_URL  — base URL of the API
 *   CUSTOM_AI_API_KEY   — bearer token (may be empty for local servers)
 *   CUSTOM_AI_MODEL     — model identifier
 */
@Injectable()
export class OpenAiCompatibleProvider extends BaseAiProvider {
  readonly name = 'openai-compatible';
  readonly supportedModels: string[] = [];

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly defaultModel: string;

  constructor(private readonly configService: ConfigService) {
    super();
    this.baseUrl = this.configService.get<string>('CUSTOM_AI_BASE_URL', '');
    this.apiKey = this.configService.get<string>('CUSTOM_AI_API_KEY', '');
    this.defaultModel = this.configService.get<string>('CUSTOM_AI_MODEL', 'default');
  }

  isConfigured(): boolean {
    return !!this.baseUrl;
  }

  async complete(options: AiCompletionOptions): Promise<AiCompletionResult> {
    const model = options.model ?? this.defaultModel;
    const url = `${this.baseUrl}/v1/chat/completions`;

    const body: Record<string, unknown> = {
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
    };
    if (options.maxTokens) body['max_tokens'] = options.maxTokens;
    if (options.jsonMode) body['response_format'] = { type: 'json_object' };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

    const raw = await this.post(url, body, headers);

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
      const isHttps = parsedUrl.protocol === 'https:';
      const lib = isHttps ? https : http;

      const req = lib.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (isHttps ? 443 : 80),
          path: parsedUrl.pathname,
          method: 'POST',
          headers: { ...headers, 'Content-Length': Buffer.byteLength(bodyStr) },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          res.on('end', () => {
            try { resolve(JSON.parse(data) as Record<string, unknown>); }
            catch { reject(new Error(`Failed to parse OpenAI-compatible response: ${data}`)); }
          });
        },
      );
      req.on('error', reject);
      req.write(bodyStr);
      req.end();
    });
  }
}
