import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { RagChatService } from '../rag-chat.service';
import { PrismaService } from '../../database/prisma.service';
import { AiProviderFactory } from '../../ai-providers/ai-provider.factory';
import { RetrievalService } from '../retrieval.service';
import { CitationService } from '../citation.service';
import { Citation } from '../citation.service';

const USER_ID = 'user-uuid-1';
const SESSION_ID = 'session-uuid-1';
const ITEM_ID = 'item-uuid-1';

const MOCK_SESSION = {
  id: SESSION_ID,
  userId: USER_ID,
  legislativeItemId: ITEM_ID,
  title: 'Test Chat',
  createdAt: new Date(),
  updatedAt: new Date(),
  messages: [],
};

const MOCK_MESSAGES = [
  {
    id: 'msg-1',
    sessionId: SESSION_ID,
    role: 'user',
    content: 'What does this law say?',
    sources: [],
    createdAt: new Date(),
  },
  {
    id: 'msg-2',
    sessionId: SESSION_ID,
    role: 'assistant',
    content: 'Based on the documents, this law covers...',
    sources: [
      {
        source: 'REF-001',
        itemId: ITEM_ID,
        itemTitle: 'Test Law',
        chunkText: 'This is the relevant text',
      },
    ],
    createdAt: new Date(),
  },
];

function makeMockPrisma() {
  return {
    chatSession: {
      create: jest.fn().mockResolvedValue({ ...MOCK_SESSION, messages: [] }),
      findMany: jest.fn().mockResolvedValue([MOCK_SESSION]),
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string }; include?: unknown }) => {
        if (where.id === SESSION_ID) {
          return Promise.resolve({ ...MOCK_SESSION, messages: MOCK_MESSAGES });
        }
        return Promise.resolve(null);
      }),
      update: jest.fn().mockResolvedValue(MOCK_SESSION),
      delete: jest.fn().mockResolvedValue(MOCK_SESSION),
    },
    chatMessage: {
      create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: `msg-${Date.now()}`, ...args.data, createdAt: new Date() }),
      ),
      deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
  };
}

function makeMockRetrievalService() {
  return {
    retrieve: jest.fn().mockResolvedValue([
      {
        id: 'chunk-1',
        text: 'This law covers data protection and privacy rights',
        score: 0.92,
        metadata: {
          itemId: ITEM_ID,
          itemTitle: 'Test Law',
          itemType: 'LAW',
          referenceNumber: 'REF-001',
        },
      },
    ]),
  };
}

function makeMockCitationService() {
  return {
    buildCitations: jest.fn().mockReturnValue([
      {
        source: 'REF-001',
        itemId: ITEM_ID,
        itemTitle: 'Test Law',
        chunkText: 'This law covers data protection',
      } as Citation,
    ]),
  };
}

function makeMockProviderFactory() {
  return {
    getProvider: jest.fn().mockReturnValue({
      name: 'openai',
      complete: jest.fn().mockResolvedValue({
        content: 'Based on the documents, this law covers data protection rights [1].',
        model: 'gpt-4o-mini',
        provider: 'openai',
      }),
    }),
  };
}

describe('RagChatService', () => {
  let service: RagChatService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;
  let mockProviderFactory: ReturnType<typeof makeMockProviderFactory>;
  let mockRetrievalService: ReturnType<typeof makeMockRetrievalService>;
  let mockCitationService: ReturnType<typeof makeMockCitationService>;

  beforeEach(async () => {
    mockPrisma = makeMockPrisma();
    mockProviderFactory = makeMockProviderFactory();
    mockRetrievalService = makeMockRetrievalService();
    mockCitationService = makeMockCitationService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagChatService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AiProviderFactory, useValue: mockProviderFactory },
        { provide: RetrievalService, useValue: mockRetrievalService },
        { provide: CitationService, useValue: mockCitationService },
      ],
    }).compile();

    service = module.get<RagChatService>(RagChatService);
  });

  // ---------------------------------------------------------------------------
  // createSession
  // ---------------------------------------------------------------------------

  describe('createSession', () => {
    it('saves a new ChatSession to the DB', async () => {
      const session = await service.createSession(USER_ID, ITEM_ID, 'My Test Session');

      expect(mockPrisma.chatSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: USER_ID,
            legislativeItemId: ITEM_ID,
            title: 'My Test Session',
          }),
        }),
      );
      expect(session).toBeDefined();
      expect(session.userId).toBe(USER_ID);
    });

    it('uses default title when none provided', async () => {
      await service.createSession(USER_ID);
      expect(mockPrisma.chatSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ title: 'New Chat' }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getSession
  // ---------------------------------------------------------------------------

  describe('getSession', () => {
    it('returns session with messages', async () => {
      const session = await service.getSession(SESSION_ID);
      expect(session).toBeDefined();
      expect(session.messages).toHaveLength(2);
    });

    it('throws NotFoundException for unknown session', async () => {
      await expect(service.getSession('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // chat
  // ---------------------------------------------------------------------------

  describe('chat', () => {
    it('builds citations and saves user + assistant messages', async () => {
      const result = await service.chat(SESSION_ID, USER_ID, 'What does this law do?', 'VIEWER');

      // User message saved
      expect(mockPrisma.chatMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: 'user',
            content: 'What does this law do?',
          }),
        }),
      );

      // Retrieval called
      expect(mockRetrievalService.retrieve).toHaveBeenCalled();

      // Citations built
      expect(mockCitationService.buildCitations).toHaveBeenCalled();

      // AI provider called
      expect(mockProviderFactory.getProvider).toHaveBeenCalled();

      // Assistant response saved
      expect(mockPrisma.chatMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: 'assistant',
          }),
        }),
      );

      expect(result.citations).toBeDefined();
      expect(result.response).toContain('Based on the documents');
    });

    it('throws ForbiddenException when user does not own the session', async () => {
      await expect(
        service.chat(SESSION_ID, 'other-user-id', 'message', 'VIEWER'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for unknown session', async () => {
      await expect(
        service.chat('nonexistent', USER_ID, 'message', 'VIEWER'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
