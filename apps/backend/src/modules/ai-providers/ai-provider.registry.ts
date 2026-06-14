import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IAiProvider } from './interfaces/ai-provider.interface';

@Injectable()
export class AiProviderRegistry {
  private providers = new Map<string, IAiProvider>();

  constructor(private readonly configService: ConfigService) {}

  register(provider: IAiProvider): void {
    this.providers.set(provider.name, provider);
  }

  get(name: string): IAiProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new NotFoundException(
        `AI provider "${name}" is not registered. Available: ${this.list().join(', ')}`,
      );
    }
    return provider;
  }

  getDefault(): IAiProvider {
    const defaultName = this.configService.get<string>('AI_DEFAULT_PROVIDER', 'openai');
    return this.get(defaultName);
  }

  list(): string[] {
    return Array.from(this.providers.keys());
  }
}
