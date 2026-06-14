import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { AiProviderRegistry } from '../ai-provider.registry';
import { parseJsonResponse, buildJsonPrompt } from '../helpers/json-output.helper';
import { IAiProvider, AiCompletionOptions, AiCompletionResult } from '../interfaces/ai-provider.interface';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeProvider(name: string, configured = true): IAiProvider {
  return {
    name,
    supportedModels: [],
    isConfigured: () => configured,
    complete: async (_options: AiCompletionOptions): Promise<AiCompletionResult> => ({
      content: 'ok',
      model: 'test-model',
      provider: name,
    }),
  };
}

// ---------------------------------------------------------------------------
// Registry tests
// ---------------------------------------------------------------------------

describe('AiProviderRegistry', () => {
  let registry: AiProviderRegistry;
  let configService: ConfigService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AiProviderRegistry,
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string, def?: string) => (key === 'AI_DEFAULT_PROVIDER' ? 'openai' : def ?? '')) },
        },
      ],
    }).compile();

    registry = module.get<AiProviderRegistry>(AiProviderRegistry);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('registers and retrieves a provider by name', () => {
    const provider = makeProvider('openai');
    registry.register(provider);
    expect(registry.get('openai')).toBe(provider);
  });

  it('lists all registered providers', () => {
    registry.register(makeProvider('openai'));
    registry.register(makeProvider('anthropic'));
    expect(registry.list()).toEqual(expect.arrayContaining(['openai', 'anthropic']));
  });

  it('returns the default provider based on AI_DEFAULT_PROVIDER env var', () => {
    const provider = makeProvider('openai');
    registry.register(provider);
    expect(registry.getDefault()).toBe(provider);
  });

  it('throws NotFoundException when requesting an unknown provider', () => {
    expect(() => registry.get('nonexistent')).toThrow(NotFoundException);
  });

  it('throws NotFoundException from getDefault when default provider is not registered', () => {
    expect(() => registry.getDefault()).toThrow(NotFoundException);
  });
});

// ---------------------------------------------------------------------------
// JSON helper tests
// ---------------------------------------------------------------------------

describe('parseJsonResponse', () => {
  it('parses plain JSON', () => {
    const input = '{"foo":"bar","count":42}';
    expect(parseJsonResponse<{ foo: string; count: number }>(input)).toEqual({
      foo: 'bar',
      count: 42,
    });
  });

  it('strips ```json ... ``` fences', () => {
    const input = '```json\n{"key":"value"}\n```';
    expect(parseJsonResponse<{ key: string }>(input)).toEqual({ key: 'value' });
  });

  it('strips plain ``` ... ``` fences', () => {
    const input = '```\n{"num":1}\n```';
    expect(parseJsonResponse<{ num: number }>(input)).toEqual({ num: 1 });
  });

  it('throws SyntaxError on invalid JSON', () => {
    expect(() => parseJsonResponse('this is not json')).toThrow(SyntaxError);
  });
});

describe('buildJsonPrompt', () => {
  it('returns a string containing the schema', () => {
    const schema = { title: 'string', count: 'number' };
    const prompt = buildJsonPrompt(schema);
    expect(prompt).toContain(JSON.stringify(schema, null, 2));
    expect(prompt).toContain('Respond ONLY with valid JSON');
  });
});
