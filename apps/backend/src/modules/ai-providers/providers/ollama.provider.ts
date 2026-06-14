import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as http from 'http';
import * as https from 'https';
import { BaseAiProvider } from './base.provider';
import { AiCompletionOptions, AiCompletionResult } from '../interfaces/ai-provider.interface';

@Injectable()
export class OllamaProvider extends BaseAiProvider {
  readonly name = 'ollama';
  readonly supportedModels = [
    'llama3.2',
    'llama3.1',
    'mistral',
    'codellama',
    'phi3',
    'gemma2',
  ];

  private readonly baseUrl: string;
  private readonly defaultModel: string;

  constructor(private readonly configService: ConfigService) {
    super();
    this.baseUrl = this.configService.get<string>('OLLAMA_BASE_URL', 'http://localhost:11434');
    this.defaultModel = this.configService.get<string>('OLLAMA_MODEL', 'llama3.2');
  }

  isConfigured(): boolean {
    // Ollama is always "configured" if a base URL is set; no API key required
    return !!this.baseUrl;
  }

  async complete(options: AiCompletionOptions): Promise<AiCompletionResult> {
    const model = options.model ?? this.defaultModel;
    const chatUrl = `${this.baseUrl}/api/chat`;

    // Ollama format: { model, messages, stream: false }
    const body: Record<string, unknown> = {
      model,
      messages: options.messages,
      stream: false,
    };

    if (options.temperature !== undefined || options.maxTokens !== undefined) {
      body['options'] = {
        ...(options.temperature !== undefined && { temperature: options.temperature }),
        ...(options.maxTokens !== undefined && { num_predict: options.maxTokens }),
      };
    }

    const raw = await this.post(chatUrl, body);

    const message = raw['message'] as { role: string; content: string } | undefined;

    return {
      content: message?.content ?? '',
      model,
      provider: this.name,
      rawResponse: raw,
    };
  }

  private post(url: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
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
            catch { reject(new Error(`Failed to parse Ollama response: ${data}`)); }
          });
        },
      );
      req.on('error', reject);
      req.write(bodyStr);
      req.end();
    });
  }
}
