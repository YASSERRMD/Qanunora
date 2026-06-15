'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface AnonFeedback {
  id: string;
  submitterName?: string;
  submitterEmail?: string;
  content: string;
  category?: string;
  moderationStatus: string;
  aiSpamScore?: number;
  aiOffensiveScore?: number;
  isSpam: boolean;
  isOffensive: boolean;
  createdAt: string;
  consultation: { id: string; title: string };
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  FLAGGED: 'bg-orange-100 text-orange-800',
};

function AiScoreBadge({ label, score }: { label: string; score?: number }) {
  if (score === undefined || score === null) return null;
  const pct = Math.round(score * 100);
  const color = pct > 60 ? 'bg-red-100 text-red-700' : pct > 30 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}
      title={`AI ${label} confidence: ${pct}%`}
      aria-label={`AI ${label} score: ${pct}%`}
    >
      <span aria-hidden="true">AI</span> {label}: {pct}%
    </span>
  );
}

export default function ModerationQueuePage() {
  const queryClient = useQueryClient();
  const [note, setNote] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: queue = [], isLoading } = useQuery<AnonFeedback[]>({
    queryKey: ['moderation-queue'],
    queryFn: async () => {
      const res = await apiClient.get<AnonFeedback[]>('/moderation/queue');
      return res.data;
    },
  });

  const makeAction = (action: 'approve' | 'reject' | 'flag') =>
    useMutation({
      mutationFn: async ({ id }: { id: string }) => {
        await apiClient.patch(`/moderation/${id}/${action}`, { note: note[id] });
      },
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['moderation-queue'] }),
    });

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const approveMutation = makeAction('approve');
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const rejectMutation = makeAction('reject');
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const flagMutation = makeAction('flag');

  return (
    <main className="flex-1 p-8" aria-labelledby="moderation-heading">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <h1 id="moderation-heading" className="text-2xl font-bold text-primary-navy">
            Moderation Queue
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review anonymous public feedback before publication
          </p>
        </header>

        {isLoading ? (
          <p className="py-16 text-center text-muted-foreground" aria-live="polite">Loading queue...</p>
        ) : queue.length === 0 ? (
          <div className="py-16 text-center rounded-xl border border-border bg-white">
            <p className="text-muted-foreground">No pending items in the moderation queue.</p>
          </div>
        ) : (
          <ul className="space-y-4" role="list" aria-label="Feedback items awaiting moderation">
            {queue.map((item) => (
              <li key={item.id}>
                <article
                  className="rounded-xl border border-border bg-white shadow-sm overflow-hidden"
                  aria-labelledby={`item-${item.id}-title`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4 p-5 pb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            STATUS_COLORS[item.moderationStatus] ?? 'bg-gray-100 text-gray-700'
                          }`}
                          aria-label={`Status: ${item.moderationStatus}`}
                        >
                          {item.moderationStatus}
                        </span>
                        {item.category && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                            {item.category}
                          </span>
                        )}
                        <AiScoreBadge label="Spam" score={item.aiSpamScore} />
                        <AiScoreBadge label="Offensive" score={item.aiOffensiveScore} />
                        {item.isSpam && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700" role="status">
                            Flagged Spam
                          </span>
                        )}
                        {item.isOffensive && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700" role="status">
                            Flagged Offensive
                          </span>
                        )}
                      </div>
                      <h2 id={`item-${item.id}-title`} className="text-sm font-semibold text-primary-navy">
                        {item.submitterName ?? 'Anonymous'} &mdash; {item.consultation.title}
                      </h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Submitted: {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                      className="shrink-0 text-xs text-primary-gold hover:underline"
                      aria-expanded={expandedId === item.id}
                      aria-controls={`content-${item.id}`}
                    >
                      {expandedId === item.id ? 'Collapse' : 'Expand'}
                    </button>
                  </div>

                  {/* Content (always visible truncated, expanded on toggle) */}
                  <div
                    id={`content-${item.id}`}
                    className={`px-5 pb-4 text-sm text-gray-700 ${expandedId !== item.id ? 'line-clamp-3' : ''}`}
                    aria-live="polite"
                  >
                    {item.content}
                  </div>

                  {/* Action bar */}
                  <div className="border-t border-border bg-gray-50 px-5 py-3 flex flex-wrap items-center gap-3">
                    <input
                      type="text"
                      placeholder="Moderator note (optional)"
                      value={note[item.id] ?? ''}
                      onChange={(e) => setNote((n) => ({ ...n, [item.id]: e.target.value }))}
                      className="flex-1 min-w-36 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-primary-gold focus:outline-none"
                      aria-label={`Moderator note for item from ${item.submitterName ?? 'anonymous'}`}
                    />
                    <button
                      onClick={() => approveMutation.mutate({ id: item.id })}
                      disabled={approveMutation.isPending}
                      className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                      aria-label="Approve this feedback"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => rejectMutation.mutate({ id: item.id })}
                      disabled={rejectMutation.isPending}
                      className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                      aria-label="Reject this feedback"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => flagMutation.mutate({ id: item.id })}
                      disabled={flagMutation.isPending}
                      className="rounded-md bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
                      aria-label="Flag this feedback for further review"
                    >
                      Flag
                    </button>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
