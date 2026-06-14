import { Global, Module, OnModuleInit } from '@nestjs/common';
import { AiProviderRegistry } from './ai-provider.registry';
import { AiProviderFactory } from './ai-provider.factory';
import { OpenAiProvider } from './providers/openai.provider';
import { AzureOpenAiProvider } from './providers/azure-openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { MistralProvider } from './providers/mistral.provider';
import { CohereProvider } from './providers/cohere.provider';
import { GroqProvider } from './providers/groq.provider';
import { DeepSeekProvider } from './providers/deepseek.provider';
import { TogetherProvider } from './providers/together.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider';

const PROVIDERS = [
  OpenAiProvider,
  AzureOpenAiProvider,
  AnthropicProvider,
  GeminiProvider,
  MistralProvider,
  CohereProvider,
  GroqProvider,
  DeepSeekProvider,
  TogetherProvider,
  OllamaProvider,
  OpenAiCompatibleProvider,
];

@Global()
@Module({
  providers: [
    AiProviderRegistry,
    AiProviderFactory,
    ...PROVIDERS,
  ],
  exports: [AiProviderFactory, AiProviderRegistry],
})
export class AiProvidersModule implements OnModuleInit {
  constructor(
    private readonly registry: AiProviderRegistry,
    private readonly openAiProvider: OpenAiProvider,
    private readonly azureOpenAiProvider: AzureOpenAiProvider,
    private readonly anthropicProvider: AnthropicProvider,
    private readonly geminiProvider: GeminiProvider,
    private readonly mistralProvider: MistralProvider,
    private readonly cohereProvider: CohereProvider,
    private readonly groqProvider: GroqProvider,
    private readonly deepSeekProvider: DeepSeekProvider,
    private readonly togetherProvider: TogetherProvider,
    private readonly ollamaProvider: OllamaProvider,
    private readonly openAiCompatibleProvider: OpenAiCompatibleProvider,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.openAiProvider);
    this.registry.register(this.azureOpenAiProvider);
    this.registry.register(this.anthropicProvider);
    this.registry.register(this.geminiProvider);
    this.registry.register(this.mistralProvider);
    this.registry.register(this.cohereProvider);
    this.registry.register(this.groqProvider);
    this.registry.register(this.deepSeekProvider);
    this.registry.register(this.togetherProvider);
    this.registry.register(this.ollamaProvider);
    this.registry.register(this.openAiCompatibleProvider);
  }
}
