import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IEmbeddingProvider } from '../interfaces/embedding-provider.interface';

const EMBEDDING_DIMENSIONS = 1536;
const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';

@Injectable()
export class OpenAiEmbeddingProvider implements IEmbeddingProvider {
  readonly name = 'openai-embedding';

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    const key = this.configService.get<string>('OPENAI_API_KEY');
    return !!key && key.length > 10;
  }

  async embed(text: string): Promise<number[]> {
    if (!this.isConfigured()) {
      return this.zeroVector();
    }

    const key = this.configService.get<string>('OPENAI_API_KEY')!;
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: OPENAI_EMBEDDING_MODEL,
        input: text,
      }),
    });

    if (!response.ok) {
      return this.zeroVector();
    }

    const json = (await response.json()) as {
      data: { embedding: number[] }[];
    };
    return json.data[0]?.embedding ?? this.zeroVector();
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.isConfigured() || !texts.length) {
      return texts.map(() => this.zeroVector());
    }

    const key = this.configService.get<string>('OPENAI_API_KEY')!;
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: OPENAI_EMBEDDING_MODEL,
        input: texts,
      }),
    });

    if (!response.ok) {
      return texts.map(() => this.zeroVector());
    }

    const json = (await response.json()) as {
      data: { embedding: number[]; index: number }[];
    };

    // Sort by index to preserve order
    const sorted = [...json.data].sort((a, b) => a.index - b.index);
    return sorted.map((d) => d.embedding);
  }

  private zeroVector(): number[] {
    return new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  }
}
