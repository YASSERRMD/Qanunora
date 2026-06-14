import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import * as http from 'http';
import { BaseAiProvider } from './base.provider';
import { AiCompletionOptions, AiCompletionResult, AiMessage } from '../interfaces/ai-provider.interface';

@Injectable()
export class OpenAiProvider extends BaseAiProvider {
  readonly name = 'openai';
  readonly supportedModels = [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo',
  ];

  private readonly logger = new Logger(OpenAiProvider.name);
  private readonly apiKey: string;
  private readonly defaultModel: string;

  constructor(private readonly configService: ConfigService) {
    super();
    this.apiKey = this.configService.get<string>('OPENAI_API_KEY', '');
    this.defaultModel = this.configService.get<string>('OPENAI_MODEL', 'gpt-4o-mini');
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async complete(options: AiCompletionOptions): Promise<AiCompletionResult> {
    const model = options.model ?? this.defaultModel;
    const body = this.buildRequestBody(options, model);
    const raw = await this.post('https://api.openai.com/v1/chat/completions', body, {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    });
    return this.mapResponse(raw, model);
  }

  /**
   * Streaming support: calls the OpenAI API with stream=true and invokes
   * onChunk for each text delta received via SSE. Other providers fall back
   * to the regular complete() method.
   */
  async completeStream(
    options: AiCompletionOptions,
    onChunk: (text: string) => void,
  ): Promise<void> {
    const model = options.model ?? this.defaultModel;
    const body = { ...this.buildRequestBody(options, model), stream: true };

    return new Promise((resolve, reject) => {
      const bodyStr = JSON.stringify(body);
      const url = new URL('https://api.openai.com/v1/chat/completions');
      const reqOptions: https.RequestOptions = {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
        },
      };

      const req = https.request(reqOptions, (res) => {
        res.on('data', (chunk: Buffer) => {
          const lines = chunk.toString().split('\n').filter((l) => l.startsWith('data: '));
          for (const line of lines) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') return;
            try {
              const parsed = JSON.parse(data) as {
                choices: { delta: { content?: string } }[];
              };
              const text = parsed.choices?.[0]?.delta?.content;
              if (text) onChunk(text);
            } catch {
              // ignore parse errors in stream
            }
          }
        });
        res.on('end', resolve);
        res.on('error', reject);
      });

      req.on('error', reject);
      req.write(bodyStr);
      req.end();
    });
  }

  private buildRequestBody(options: AiCompletionOptions, model: string): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
    };
    if (options.maxTokens) body['max_tokens'] = options.maxTokens;
    if (options.jsonMode) body['response_format'] = { type: 'json_object' };
    return body;
  }

  private mapResponse(raw: Record<string, unknown>, model: string): AiCompletionResult {
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

      const reqOptions = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: { ...headers, 'Content-Length': Buffer.byteLength(bodyStr) },
      };

      const req = lib.request(reqOptions, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data) as Record<string, unknown>);
          } catch (e) {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.write(bodyStr);
      req.end();
    });
  }
}
