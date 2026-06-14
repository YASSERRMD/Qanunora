import { Injectable } from '@nestjs/common';
import { AiProviderRegistry } from './ai-provider.registry';
import { IAiProvider } from './interfaces/ai-provider.interface';

@Injectable()
export class AiProviderFactory {
  constructor(private readonly registry: AiProviderRegistry) {}

  getProvider(name?: string): IAiProvider {
    return name ? this.registry.get(name) : this.registry.getDefault();
  }
}
