'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface ChatSession {
  id: string;
  title: string;
  legislativeItemId?: string;
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number };
}

interface Citation {
  source: string;
  itemId: string;
  itemTitle: string;
  chunkText: string;
}

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  sources: Citation[];
  createdAt: string;
}

interface SessionDetail extends ChatSession {
  messages: ChatMessage[];
}

export default function AssistantPage() {
  const queryClient = useQueryClient();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [expandedCitations, setExpandedCitations] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sessions list
  const { data: sessions } = useQuery({
    queryKey: ['assistant-sessions'],
    queryFn: async () => {
      const res = await apiClient.get<ChatSession[]>('/assistant/sessions');
      return res.data;
    },
  });

  // Active session
  const { data: session } = useQuery({
    queryKey: ['assistant-session', selectedSessionId],
    queryFn: async () => {
      if (!selectedSessionId) return null;
      const res = await apiClient.get<SessionDetail>(`/assistant/sessions/${selectedSessionId}`);
      return res.data;
    },
    enabled: !!selectedSessionId,
    refetchInterval: false,
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages]);

  // Create session
  const createSessionMutation = useMutation({
    mutationFn: () => apiClient.post<ChatSession>('/assistant/sessions', { title: 'New Chat' }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['assistant-sessions'] });
      setSelectedSessionId(res.data.id);
    },
  });

  // Delete session
  const deleteSessionMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/assistant/sessions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assistant-sessions'] });
      setSelectedSessionId(null);
    },
  });

  // Chat
  const chatMutation = useMutation({
    mutationFn: (message: string) =>
      apiClient.post(`/assistant/sessions/${selectedSessionId}/chat`, { message }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assistant-session', selectedSessionId] });
      queryClient.invalidateQueries({ queryKey: ['assistant-sessions'] });
    },
  });

  const handleSend = () => {
    if (!inputMessage.trim() || !selectedSessionId || chatMutation.isPending) return;
    chatMutation.mutate(inputMessage);
    setInputMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <main className="flex-1 flex h-screen overflow-hidden bg-background">
      {/* Session Sidebar */}
      <div className="w-64 border-r border-border bg-white flex flex-col">
        <div className="p-4 border-b border-border">
          <button
            onClick={() => createSessionMutation.mutate()}
            disabled={createSessionMutation.isPending}
            className="w-full rounded-lg bg-primary-navy px-4 py-2 text-sm font-medium text-white hover:bg-primary-navy/90 disabled:opacity-50"
          >
            + New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {sessions?.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              No sessions yet. Start a new chat.
            </p>
          )}
          {sessions?.map((s) => (
            <div
              key={s.id}
              onClick={() => setSelectedSessionId(s.id)}
              className={`flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer mb-1 group transition-colors ${
                selectedSessionId === s.id
                  ? 'bg-primary-navy/10 text-primary-navy'
                  : 'hover:bg-muted/20 text-muted-foreground'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{s.title}</p>
                <p className="text-xs text-muted-foreground">
                  {s._count?.messages ?? 0} messages
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSessionMutation.mutate(s.id);
                }}
                className="ml-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-opacity"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Panel */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-border bg-white px-6 py-4">
          {/* Legal Disclaimer */}
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 mb-3">
            <p className="text-xs text-amber-700 font-medium">
              AI-assisted analysis — not legal advice. Responses are generated from indexed legislative documents and may not reflect current law.
            </p>
          </div>
          <h1 className="text-lg font-bold text-primary-navy">
            {session?.title ?? 'Legislative Assistant'}
          </h1>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!selectedSessionId ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-4xl mb-4">📚</div>
              <h2 className="text-xl font-semibold text-primary-navy mb-2">
                Legislative Intelligence Assistant
              </h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Ask questions about legislative items, regulations, and laws. The assistant will
                search indexed documents and provide cited responses.
              </p>
              <button
                onClick={() => createSessionMutation.mutate()}
                className="mt-6 rounded-lg bg-primary-navy px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-navy/90"
              >
                Start a New Chat
              </button>
            </div>
          ) : (
            <>
              {session?.messages?.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-1' : 'order-0'}`}>
                    {/* Message bubble */}
                    <div
                      className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-primary-navy text-white rounded-tr-sm'
                          : 'bg-white border border-border text-primary-navy rounded-tl-sm shadow-sm'
                      }`}
                    >
                      {msg.content}
                    </div>

                    {/* Citations (assistant messages only) */}
                    {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                      <div className="mt-2">
                        <button
                          onClick={() =>
                            setExpandedCitations(
                              expandedCitations === msg.id ? null : msg.id,
                            )
                          }
                          className="text-xs text-primary-gold hover:text-primary-gold/80 flex items-center gap-1"
                        >
                          {expandedCitations === msg.id ? '▼' : '▶'} {msg.sources.length} source
                          {msg.sources.length !== 1 ? 's' : ''}
                        </button>

                        {expandedCitations === msg.id && (
                          <div className="mt-2 space-y-2">
                            {msg.sources.map((citation, i) => (
                              <div
                                key={citation.itemId ?? i}
                                className="rounded-lg border border-border bg-white p-3 text-xs"
                              >
                                <p className="font-semibold text-primary-navy mb-1">
                                  [{i + 1}] {citation.itemTitle}
                                </p>
                                <p className="text-muted-foreground font-mono text-xs mb-1">
                                  {citation.source}
                                </p>
                                <p className="text-muted-foreground italic line-clamp-3">
                                  &quot;{citation.chunkText}&quot;
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <p className={`text-xs text-muted-foreground mt-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}

              {chatMutation.isPending && (
                <div className="flex justify-start">
                  <div className="bg-white border border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Bar */}
        {selectedSessionId && (
          <div className="border-t border-border bg-white p-4">
            <div className="flex gap-3 items-end">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about legislative items, laws, or regulations..."
                rows={2}
                className="flex-1 resize-none rounded-xl border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy"
              />
              <button
                onClick={handleSend}
                disabled={!inputMessage.trim() || chatMutation.isPending}
                className="rounded-xl bg-primary-navy px-5 py-3 text-sm font-medium text-white hover:bg-primary-navy/90 disabled:opacity-50 shrink-0"
              >
                Send
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Press Enter to send · Shift+Enter for new line
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
