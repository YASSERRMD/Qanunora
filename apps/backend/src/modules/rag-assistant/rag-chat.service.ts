import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AiProviderFactory } from '../ai-providers/ai-provider.factory';
import { RetrievalService } from './retrieval.service';
import { CitationService } from './citation.service';
import { buildRagPrompt } from './prompts/rag.prompts';

@Injectable()
export class RagChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProviderFactory: AiProviderFactory,
    private readonly retrievalService: RetrievalService,
    private readonly citationService: CitationService,
  ) {}

  // ---------------------------------------------------------------------------
  // Session management
  // ---------------------------------------------------------------------------

  async createSession(
    userId: string,
    legislativeItemId?: string,
    title?: string,
  ) {
    return this.prisma.chatSession.create({
      data: {
        userId,
        legislativeItemId: legislativeItemId ?? null,
        title: title ?? 'New Chat',
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 0,
        },
      },
    });
  }

  async getSessions(userId: string) {
    return this.prisma.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { messages: true } },
      },
    });
  }

  async getSession(id: string) {
    const session = await this.prisma.chatSession.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!session) throw new NotFoundException(`Chat session ${id} not found`);
    return session;
  }

  async deleteSession(id: string, userId: string) {
    const session = await this.prisma.chatSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException(`Chat session ${id} not found`);
    if (session.userId !== userId) throw new ForbiddenException('Cannot delete another user\'s session');

    // Delete all messages first
    await this.prisma.chatMessage.deleteMany({ where: { sessionId: id } });
    return this.prisma.chatSession.delete({ where: { id } });
  }

  // ---------------------------------------------------------------------------
  // Chat
  // ---------------------------------------------------------------------------

  async chat(
    sessionId: string,
    userId: string,
    message: string,
    userRole: string,
    providerName?: string,
  ) {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 10,
        },
      },
    });

    if (!session) throw new NotFoundException(`Chat session ${sessionId} not found`);
    if (session.userId !== userId) throw new ForbiddenException('Access denied to this session');

    // 1. Save user message
    await this.prisma.chatMessage.create({
      data: {
        sessionId,
        role: 'user',
        content: message,
        sources: [],
      },
    });

    // 2. Retrieve relevant context chunks
    const chunks = await this.retrievalService.retrieve(
      message,
      userRole,
      session.legislativeItemId ?? undefined,
      5,
    );

    // 3. Build citations
    const citations = this.citationService.buildCitations(chunks);

    // 4. Build context string from chunks
    const context = chunks.map((c) => c.text).join('\n\n---\n\n');

    // 5. Build conversation history (last 5 messages for context window)
    const historyMessages = session.messages.slice(-5).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // 6. Build RAG prompt
    const { system, user } = buildRagPrompt(message, context, citations, userRole);

    // 7. Call AI provider
    const provider = this.aiProviderFactory.getProvider(providerName);
    const completion = await provider.complete({
      messages: [
        { role: 'system', content: system },
        ...historyMessages,
        { role: 'user', content: user },
      ],
      temperature: 0.2,
      maxTokens: 2048,
    });

    const responseText = completion.content;

    // 8. Save assistant response
    const assistantMessage = await this.prisma.chatMessage.create({
      data: {
        sessionId,
        role: 'assistant',
        content: responseText,
        sources: citations as unknown as object[],
      },
    });

    // 9. Update session updatedAt
    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });

    return {
      message: assistantMessage,
      citations,
      response: responseText,
    };
  }
}
