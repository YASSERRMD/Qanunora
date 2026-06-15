'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiClient } from '@/lib/api-client';

interface TranslationRequest {
  id: string;
  sourceText: string;
  translatedText?: string;
  sourceLang: string;
  targetLang: string;
  status: string;
  confidenceScore?: number;
  provider?: string;
  model?: string;
  isApproved: boolean;
  reviewNotes?: string;
  entityType?: string;
  entityId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: { firstName: string; lastName: string };
  reviewedBy?: { firstName: string; lastName: string };
  memoryEntry?: { id: string; usageCount: number };
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  UNDER_REVIEW: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
};

function ConfidenceBadge({ score }: { score?: number }) {
  if (score === undefined || score === null) return null;
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? 'bg-green-100 text-green-700' : pct >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`} aria-label={`AI confidence: ${pct}%`}>
      AI Confidence: {pct}%
    </span>
  );
}

export default function TranslationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');

  const { data: req, isLoading } = useQuery<TranslationRequest>({
    queryKey: ['translation', id],
    queryFn: async () => {
      const res = await apiClient.get<TranslationRequest>(`/ai-translation/${id}`);
      return res.data;
    },
  });

  const submitForReviewMutation = useMutation({
    mutationFn: async () => apiClient.post(`/ai-translation/${id}/submit-review`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['translation', id] }),
  });

  const approveMutation = useMutation({
    mutationFn: async () => apiClient.patch(`/ai-translation/${id}/approve`, { notes: note }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['translation', id] }),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => apiClient.patch(`/ai-translation/${id}/reject`, { notes: note }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['translation', id] }),
  });

  if (isLoading) return <div className="py-20 text-center text-muted-foreground" aria-live="polite">Loading...</div>;
  if (!req) return <div className="py-20 text-center text-red-500">Translation not found.</div>;

  const isRtlSource = req.sourceLang === 'ar';
  const isRtlTarget = req.targetLang === 'ar';

  return (
    <main className="flex-1 p-8" aria-labelledby="detail-heading">
      <div className="mx-auto max-w-5xl">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
          <ol className="flex items-center gap-2" role="list">
            <li>
              <button onClick={() => router.push('/ai-translation')} className="hover:text-primary-gold">
                AI Translation
              </button>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-gray-700">Request Detail</li>
          </ol>
        </nav>

        <header className="mb-6 flex flex-wrap items-start gap-3">
          <h1 id="detail-heading" className="text-2xl font-bold text-primary-navy flex-1">
            Translation Request
          </h1>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[req.status] ?? 'bg-gray-100'}`}>
              {req.status.replace(/_/g, ' ')}
            </span>
            <ConfidenceBadge score={req.confidenceScore} />
            {req.isApproved && (
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                Approved
              </span>
            )}
            {req.memoryEntry && (
              <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700">
                Memory ({req.memoryEntry.usageCount} uses)
              </span>
            )}
          </div>
        </header>

        {/* Metadata */}
        <dl className="mb-6 grid gap-4 sm:grid-cols-3 rounded-xl border border-border bg-white p-5">
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Direction</dt>
            <dd className="text-sm font-semibold text-primary-navy mt-0.5">
              {req.sourceLang.toUpperCase()} &rarr; {req.targetLang.toUpperCase()}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">AI Provider</dt>
            <dd className="text-sm text-gray-700 mt-0.5 capitalize">{req.provider ?? '—'} {req.model ? `(${req.model})` : ''}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Created By</dt>
            <dd className="text-sm text-gray-700 mt-0.5">{req.createdBy.firstName} {req.createdBy.lastName}</dd>
          </div>
          {req.entityType && (
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Linked Entity</dt>
              <dd className="text-sm text-gray-700 mt-0.5 capitalize">{req.entityType?.replace(/_/g, ' ')} #{req.entityId?.slice(0, 8)}</dd>
            </div>
          )}
          {req.reviewedBy && (
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Reviewed By</dt>
              <dd className="text-sm text-gray-700 mt-0.5">{req.reviewedBy.firstName} {req.reviewedBy.lastName}</dd>
            </div>
          )}
        </dl>

        {/* Side-by-side text */}
        <section aria-labelledby="texts-heading" className="mb-6">
          <h2 id="texts-heading" className="text-lg font-semibold text-primary-navy mb-4">Translation</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-white p-5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Source ({req.sourceLang.toUpperCase()})
              </h3>
              <p
                className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap"
                dir={isRtlSource ? 'rtl' : 'ltr'}
                lang={req.sourceLang}
              >
                {req.sourceText}
              </p>
            </div>

            <div className={`rounded-xl border p-5 ${req.translatedText ? 'border-green-200 bg-green-50' : 'border-border bg-gray-50'}`}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Translation ({req.targetLang.toUpperCase()})
              </h3>
              {req.translatedText ? (
                <p
                  className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap"
                  dir={isRtlTarget ? 'rtl' : 'ltr'}
                  lang={req.targetLang}
                >
                  {req.translatedText}
                </p>
              ) : (
                <p className="text-sm text-gray-400 italic">Translation pending...</p>
              )}
            </div>
          </div>
        </section>

        {/* Review actions */}
        {(req.status === 'COMPLETED' || req.status === 'UNDER_REVIEW') && (
          <section className="rounded-xl border border-border bg-white p-5" aria-labelledby="review-heading">
            <h2 id="review-heading" className="font-semibold text-primary-navy mb-4">Review Actions</h2>

            {req.reviewNotes && (
              <div className="mb-4 rounded-md bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-700">
                <span className="font-medium">Review notes:</span> {req.reviewNotes}
              </div>
            )}

            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-48">
                <label htmlFor="review-note" className="block text-sm font-medium text-gray-700 mb-1">
                  Reviewer Note (optional)
                </label>
                <input
                  id="review-note"
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-gold focus:outline-none"
                  placeholder="Add a review note..."
                />
              </div>

              {req.status === 'COMPLETED' && (
                <button
                  onClick={() => submitForReviewMutation.mutate()}
                  disabled={submitForReviewMutation.isPending}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Submit for Review
                </button>
              )}
              <button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                aria-label="Approve this translation"
              >
                Approve
              </button>
              <button
                onClick={() => rejectMutation.mutate()}
                disabled={rejectMutation.isPending}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                aria-label="Reject this translation"
              >
                Reject
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
