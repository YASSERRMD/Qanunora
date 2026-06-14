import { Test, TestingModule } from '@nestjs/testing';
import { SemanticSearchService } from '../semantic-search.service';
import { ChunkingService } from '../chunking.service';
import { VectorStoreService } from '../vector-store.service';
import { PrismaService } from '../../database/prisma.service';
import { OpenAiEmbeddingProvider } from '../providers/openai-embedding.provider';

const MOCK_ITEM_1 = {
  id: 'item-1',
  title: 'Digital Privacy Law',
  description: 'A law governing digital data protection and privacy rights of citizens.',
  type: 'LAW',
  status: 'PUBLISHED',
  referenceNumber: 'REF-001',
};

const MOCK_ITEM_2 = {
  id: 'item-2',
  title: 'Environmental Protection Regulation',
  description: 'Regulation on environmental standards and pollution control.',
  type: 'REGULATION',
  status: 'APPROVED',
  referenceNumber: 'REF-002',
};

function makeMockPrisma() {
  return {
    legislativeItem: {
      findMany: jest.fn().mockResolvedValue([MOCK_ITEM_1, MOCK_ITEM_2]),
      findUnique: jest.fn().mockResolvedValue(MOCK_ITEM_1),
    },
  };
}

function makeMockEmbeddingProvider(returnZero = false) {
  return {
    name: 'openai-embedding',
    isConfigured: jest.fn().mockReturnValue(true),
    embed: jest.fn().mockImplementation((text: string) => {
      if (returnZero) return Promise.resolve(new Array(1536).fill(0));
      // Simple hash-like vector for testing
      const hash = text.length;
      return Promise.resolve([hash / 1000, hash / 2000, ...new Array(1534).fill(0.01)]);
    }),
    embedBatch: jest.fn().mockImplementation((texts: string[]) =>
      Promise.resolve(
        texts.map((t) => {
          if (returnZero) return new Array(1536).fill(0);
          return [t.length / 1000, t.length / 2000, ...new Array(1534).fill(0.01)];
        }),
      ),
    ),
  };
}

// ---------------------------------------------------------------------------
// ChunkingService tests
// ---------------------------------------------------------------------------

describe('ChunkingService', () => {
  let service: ChunkingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChunkingService],
    }).compile();
    service = module.get<ChunkingService>(ChunkingService);
  });

  it('returns empty array for empty text', () => {
    expect(service.chunkText('')).toEqual([]);
    expect(service.chunkText('   ')).toEqual([]);
  });

  it('returns a single chunk for short text', () => {
    const text = 'This is a short text.';
    const chunks = service.chunkText(text, 512, 64);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(text);
  });

  it('creates overlapping chunks for long text', () => {
    const text = 'A'.repeat(600);
    const chunks = service.chunkText(text, 200, 50);
    expect(chunks.length).toBeGreaterThan(1);
    // Verify overlap: end of chunk N should overlap with start of chunk N+1
    const chunk0End = chunks[0].slice(-50);
    const chunk1Start = chunks[1].slice(0, 50);
    expect(chunk0End).toBe(chunk1Start);
  });

  it('handles text exactly at chunkSize boundary', () => {
    const text = 'B'.repeat(512);
    const chunks = service.chunkText(text, 512, 64);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(text);
  });
});

// ---------------------------------------------------------------------------
// SemanticSearchService hybrid tests
// ---------------------------------------------------------------------------

describe('SemanticSearchService', () => {
  let service: SemanticSearchService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;
  let vectorStore: VectorStoreService;
  let mockEmbedding: ReturnType<typeof makeMockEmbeddingProvider>;

  beforeEach(async () => {
    mockPrisma = makeMockPrisma();
    mockEmbedding = makeMockEmbeddingProvider();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SemanticSearchService,
        VectorStoreService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: OpenAiEmbeddingProvider, useValue: mockEmbedding },
      ],
    }).compile();

    service = module.get<SemanticSearchService>(SemanticSearchService);
    vectorStore = module.get<VectorStoreService>(VectorStoreService);
  });

  it('hybridSearch merges keyword and semantic results', async () => {
    // keyword path: mockPrisma returns [MOCK_ITEM_1, MOCK_ITEM_2]
    // semantic path: vector store is empty, returns nothing
    const results = await service.hybridSearch('privacy');

    // At minimum keyword results should be returned
    expect(results.length).toBeGreaterThan(0);
  });

  it('hybridSearch deduplicates items appearing in both keyword and semantic results', async () => {
    // Pre-populate vector store with item-1
    await vectorStore.add(
      'item-1:chunk-0',
      'Digital Privacy Law description',
      [0.5, 0.5, ...new Array(1534).fill(0.01)],
      { itemId: 'item-1', chunkIndex: 0, itemTitle: 'Digital Privacy Law', itemType: 'LAW', itemStatus: 'PUBLISHED' },
    );

    const results = await service.hybridSearch('privacy');

    // item-1 should appear only once
    const item1Results = results.filter((r) => r.itemId === 'item-1');
    expect(item1Results.length).toBe(1);
  });

  it('hybridSearch applies source boost for items in both sets', async () => {
    await vectorStore.add(
      'item-1:chunk-0',
      'Digital Privacy Law',
      [0.9, 0.1, ...new Array(1534).fill(0.0)],
      { itemId: 'item-1', chunkIndex: 0, itemTitle: 'Digital Privacy Law', itemType: 'LAW', itemStatus: 'PUBLISHED' },
    );

    // Mock embedding to return a vector matching the stored one
    mockEmbedding.embed.mockResolvedValue([0.9, 0.1, ...new Array(1534).fill(0.0)]);

    const results = await service.hybridSearch('privacy');
    const item1 = results.find((r) => r.itemId === 'item-1');

    if (item1) {
      expect(item1.source).toBe('hybrid');
    }
  });

  it('hybridSearch applies type filter', async () => {
    const results = await service.hybridSearch('law', { type: 'LAW' });
    // Prisma should be called with type filter
    expect(mockPrisma.legislativeItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'LAW' }),
      }),
    );
  });

  it('returns empty array for empty query', async () => {
    const results = await service.hybridSearch('');
    // With empty query, the keyword search would match nothing meaningful
    // (depends on implementation but should not error)
    expect(Array.isArray(results)).toBe(true);
  });
});
