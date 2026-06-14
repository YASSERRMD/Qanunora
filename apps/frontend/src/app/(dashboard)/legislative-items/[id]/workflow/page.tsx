'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

const STATUS_COLORS: Record<string, string> = {
  DRAFTING: 'bg-gray-100 text-gray-700 border-gray-300',
  INTERNAL_REVIEW: 'bg-blue-100 text-blue-700 border-blue-300',
  COMMITTEE_REVIEW: 'bg-purple-100 text-purple-700 border-purple-300',
  PUBLIC_CONSULTATION: 'bg-orange-100 text-orange-700 border-orange-300',
  LEGAL_REVIEW: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  APPROVED: 'bg-green-100 text-green-700 border-green-300',
  PUBLISHED: 'bg-teal-100 text-teal-700 border-teal-300',
  ARCHIVED: 'bg-red-100 text-red-700 border-red-300',
};

interface HistoryEntry {
  id: string;
  fromStatus?: string;
  toStatus: string;
  action: string;
  comment?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  performedBy: { firstName: string; lastName: string; email: string };
}

interface AvailableTransition {
  action: string;
  toStatus: string;
}

export default function WorkflowPage() {
  const { id: itemId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [selectedAction, setSelectedAction] = useState('');
  const [comment, setComment] = useState('');
  const [newComment, setNewComment] = useState('');
  const [transitionError, setTransitionError] = useState('');

  const { data: history, isLoading } = useQuery({
    queryKey: ['workflow-history', itemId],
    queryFn: async () => {
      const res = await apiClient.get<{ data: HistoryEntry[]; total: number }>(
        `/legislative-items/${itemId}/workflow-history`,
      );
      return res.data;
    },
  });

  const { data: actions } = useQuery({
    queryKey: ['workflow-actions', itemId],
    queryFn: async () => {
      const res = await apiClient.get<{
        currentStatus: string;
        availableTransitions: AvailableTransition[];
      }>(`/legislative-items/${itemId}/available-actions`);
      return res.data;
    },
  });

  const transition = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/legislative-items/${itemId}/transition`, {
        action: selectedAction,
        comment: comment || undefined,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workflow-history', itemId] });
      void queryClient.invalidateQueries({ queryKey: ['workflow-actions', itemId] });
      void queryClient.invalidateQueries({ queryKey: ['legislative-item', itemId] });
      setSelectedAction('');
      setComment('');
      setTransitionError('');
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string | string[] } } };
      const msg = err.response?.data?.message;
      setTransitionError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Transition failed'));
    },
  });

  const addComment = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/legislative-items/${itemId}/workflow-comment`, {
        comment: newComment,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workflow-history', itemId] });
      setNewComment('');
    },
  });

  const isComment = (entry: HistoryEntry) =>
    entry.fromStatus === entry.toStatus &&
    (entry.metadata as { type?: string } | null)?.type === 'COMMENT';

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-primary-navy">Workflow & Lifecycle</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage the legislative process and track status transitions
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-primary-navy mb-3">Current Status</h2>
            {actions && (
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${
                  STATUS_COLORS[actions.currentStatus] ?? 'bg-gray-100 text-gray-700 border-gray-300'
                }`}
              >
                {actions.currentStatus.replace(/_/g, ' ')}
              </span>
            )}
          </div>

          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-primary-navy mb-3">Perform Transition</h2>
            {transitionError && (
              <div className="mb-3 text-sm text-red-600">{transitionError}</div>
            )}
            {actions?.availableTransitions.length ? (
              <div className="space-y-3">
                <select
                  value={selectedAction}
                  onChange={(e) => setSelectedAction(e.target.value)}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30"
                >
                  <option value="">Select action...</option>
                  {actions.availableTransitions.map((t) => (
                    <option key={t.action} value={t.action}>
                      {t.action.replace(/_/g, ' ')} → {t.toStatus.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Optional comment..."
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30"
                />
                <button
                  onClick={() => transition.mutate()}
                  disabled={!selectedAction || transition.isPending}
                  className="w-full rounded-lg bg-primary-navy px-4 py-2 text-sm font-medium text-white hover:bg-primary-navy/90 disabled:opacity-50"
                >
                  {transition.isPending ? 'Processing...' : 'Apply Transition'}
                </button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {actions ? 'No actions available for your role at this stage.' : 'Loading...'}
              </p>
            )}
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-primary-navy mb-3">Add Comment</h2>
          <div className="flex gap-3">
            <input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Type a comment..."
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30"
            />
            <button
              onClick={() => addComment.mutate()}
              disabled={!newComment.trim() || addComment.isPending}
              className="rounded-lg border border-primary-gold px-4 py-2 text-sm font-medium text-primary-navy hover:bg-primary-gold/10 disabled:opacity-40"
            >
              {addComment.isPending ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-primary-navy mb-4">Timeline</h2>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading history...</div>
          ) : history?.data.length ? (
            <div className="relative space-y-0">
              {history.data.map((entry, idx) => (
                <div key={entry.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className={`mt-1 h-3 w-3 rounded-full border-2 flex-shrink-0 ${
                        isComment(entry)
                          ? 'border-gray-400 bg-white'
                          : 'border-primary-gold bg-primary-gold'
                      }`}
                    />
                    {idx < history.data.length - 1 && (
                      <div className="w-0.5 flex-1 bg-border mt-1" />
                    )}
                  </div>
                  <div className={`pb-6 flex-1 ${idx === 0 ? 'pt-0' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        {isComment(entry) ? (
                          <p className="text-sm font-medium text-primary-navy">Comment</p>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[entry.fromStatus ?? ''] ?? 'bg-gray-100 text-gray-700 border-gray-300'}`}>
                              {(entry.fromStatus ?? '').replace(/_/g, ' ')}
                            </span>
                            <span className="text-xs text-muted-foreground">→</span>
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[entry.toStatus] ?? 'bg-gray-100 text-gray-700 border-gray-300'}`}>
                              {entry.toStatus.replace(/_/g, ' ')}
                            </span>
                            <span className="text-xs font-mono text-muted-foreground">
                              [{entry.action.replace(/_/g, ' ')}]
                            </span>
                          </div>
                        )}
                        {entry.comment && (
                          <p className="mt-1 text-sm text-muted-foreground italic">
                            &ldquo;{entry.comment}&rdquo;
                          </p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {entry.performedBy.firstName} {entry.performedBy.lastName}
                        </p>
                      </div>
                      <time className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(entry.createdAt).toLocaleString()}
                      </time>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No workflow events recorded yet
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
