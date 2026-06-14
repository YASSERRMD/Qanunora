import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import * as http from 'http';
import { BaseAiProvider } from './base.provider';
import { AiCompletionOptions, AiCompletionResult } from '../interfaces/ai-provider.interface';

@Injectable()
export class AzureOpenAiProvider extends BaseAiProvider {
  readonly name = 'azure-openai';
  readonly supportedModels: string[] = [];

  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly deployment: string;
  private readonly apiVersion: string;

  constructor(private readonly configService: ConfigService) {
    super();
    this.endpoint = this.configService.get<string>('AZURE_OPENAI_ENDPOINT', '');
    this.apiKey = this.configService.get<string>('AZURE_OPENAI_API_KEY', '');
    this.deployment = this.configService.get<string>('AZURE_OPENAI_DEPLOYMENT', '');
    this.apiVersion = this.configService.get<string>('AZURE_OPENAI_API_VERSION', '2024-02-01');
  }

  isConfigured(): boolean {
    return !!(this.endpoint && this.apiKey && this.deployment);
  }

  async complete(options: AiCompletionOptions): Promise<AiCompletionResult> {
    const url = `${this.endpoint}/openai/deployments/${this.deployment}/chat/completions?api-version=${this.apiVersion}`;
    const body: Record<string, unknown> = {
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
    };
    if (options.maxTokens) body['max_tokens'] = options.maxTokens;
    if (options.jsonMode) body['response_format'] = { type: 'json_object' };

    const raw = await this.post(url, body, {
      'api-key': this.apiKey,
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
      model: this.deployment,
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
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'POST',
          headers: { ...headers, 'Content-Length': Buffer.byteLength(bodyStr) },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          res.on('end', () => {
            try { resolve(JSON.parse(data) as Record<string, unknown>); }
            catch { reject(new Error(`Failed to parse response: ${data}`)); }
          });
        },
      );
      req.on('error', reject);
      req.write(bodyStr);
      req.end();
    });
  }
}
