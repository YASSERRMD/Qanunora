'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  OPEN: 'bg-green-100 text-green-700',
  CLOSED: 'bg-red-100 text-red-700',
  REVIEWING: 'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
};

const SENTIMENT_COLORS: Record<string, string> = {
  POSITIVE: 'bg-green-100 text-green-700',
  NEGATIVE: 'bg-red-100 text-red-700',
  NEUTRAL: 'bg-gray-100 text-gray-700',
  MIXED: 'bg-yellow-100 text-yellow-700',
};

interface Feedback {
  id: string;
  submitterName?: string;
  submitterEmail?: string;
  content: string;
  category?: string;
  sentiment?: string;
  isPublic: boolean;
  submittedAt: string;
  stakeholder?: { id: string; name: string; type: string };
  reviews: Array<{
    id: string;
    decision?: string;
    notes?: string;
    reviewedAt: string;
    reviewer: { firstName: string; lastName: string };
  }>;
}

interface Summary {
  total: number;
  byCategory: Record<string, number>;
  bySentiment: Record<string, number>;
}

interface ConsultationDetail {
  id: string;
  title: string;
  description?: string;
  status: string;
  openDate?: string;
  closeDate?: string;
  createdAt: string;
  legislativeItem: { referenceNumber: string; title: string };
  _count: { feedback: number };
}

export default function ConsultationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [page, setPage] = useState(1);

  const { data: consultation, isLoading: loadingConsultation } = useQuery({
    queryKey: ['consultation', id],
    queryFn: async () => {
      const res = await apiClient.get<ConsultationDetail>(`/consultations/${id}`);
      return res.data;
    },
  });

  const { data: feedbackData, isLoading: loadingFeedback } = useQuery({
    queryKey: ['consultation-feedback', id, page],
    queryFn: async () => {
      const res = await apiClient.get<{ data: Feedback[]; total: number; totalPages: number }>(
        `/consultations/${id}/feedback`,
        { params: { page, limit: 20 } },
      );
      return res.data;
    },
  });

  const { data: summary } = useQuery({
    queryKey: ['consultation-summary', id],
    queryFn: async () => {
      const res = await apiClient.get<Summary>(`/consultations/${id}/summary`);
      return res.data;
    },
  });

  if (loadingConsultation) {
    return (
      <main className="flex-1 p-8">
        <div className="flex items-center justify-center py-24 text-muted-foreground">Loading...</div>
      </main>
    );
  }

  if (!consultation) return null;

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-sm text-muted-foreground hover:text-primary-navy"
          >
            Back
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  STATUS_COLORS[consultation.status] ?? 'bg-gray-100 text-gray-700'
                }`}
              >
                {consultation.status}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {consultation.legislativeItem.referenceNumber}
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-bold text-primary-navy">{consultation.title}</h1>
          </div>
        </div>

        {summary && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="rounded-xl border border-border bg-white p-4 text-center col-span-1">
              <p className="text-2xl font-bold text-primary-navy">{summary.total}</p>
              <p className="text-xs text-muted-foreground mt-1">Total Responses</p>
            </div>
            {Object.entries(summary.bySentiment).map(([sentiment, count]) => (
              <div key={sentiment} className="rounded-xl border border-border bg-white p-4 text-center">
                <p className="text-2xl font-bold text-primary-navy">{count}</p>
                <p className="text-xs text-muted-foreground mt-1">{sentiment}</p>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-primary-navy">Feedback</h2>
              {feedbackData && (
                <span className="text-xs text-muted-foreground">{feedbackData.total} total</span>
              )}
            </div>

            {loadingFeedback ? (
              <div className="p-8 text-center text-muted-foreground">Loading feedback...</div>
            ) : (
              <>
                <div className="divide-y divide-border">
                  {feedbackData?.data.map((fb) => (
                    <div
                      key={fb.id}
                      onClick={() => setSelectedFeedback(fb)}
                      className={`px-5 py-4 cursor-pointer hover:bg-muted/20 transition-colors ${
                        selectedFeedback?.id === fb.id
                          ? 'bg-muted/30 border-l-2 border-primary-gold'
                          : ''
                      }`}
                    >
                      <div className="flex items-start gap-2 mb-1">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-primary-navy truncate">
                            {fb.submitterName ?? fb.stakeholder?.name ?? 'Anonymous'}
                          </p>
                          {fb.category && (
                            <p className="text-xs text-muted-foreground">{fb.category}</p>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {fb.sentiment && (
                            <span
                              className={`inline-flex rounded-full px-1.5 py-0.5 text-xs font-medium ${
                                SENTIMENT_COLORS[fb.sentiment] ?? 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {fb.sentiment}
                            </span>
                          )}
                          {fb.reviews.length > 0 && (
                            <span className="inline-flex rounded-full px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">
                              Reviewed
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{fb.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(fb.submittedAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                  {!feedbackData?.data.length && (
                    <div className="px-5 py-8 text-center text-muted-foreground">
                      No feedback yet
                    </div>
                  )}
                </div>

                {feedbackData && feedbackData.totalPages > 1 && (
                  <div className="px-5 py-3 border-t border-border flex gap-2 justify-end">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                      className="rounded border border-border px-3 py-1 text-xs disabled:opacity-40 hover:bg-muted/30"
                    >
                      Prev
                    </button>
                    <button
                      disabled={page >= feedbackData.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="rounded border border-border px-3 py-1 text-xs disabled:opacity-40 hover:bg-muted/30"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {selectedFeedback ? (
            <div className="rounded-xl border border-border bg-white shadow-sm p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="font-semibold text-primary-navy">
                    {selectedFeedback.submitterName ?? selectedFeedback.stakeholder?.name ?? 'Anonymous'}
                  </p>
                  {selectedFeedback.submitterEmail && (
                    <p className="text-xs text-muted-foreground">{selectedFeedback.submitterEmail}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  {selectedFeedback.sentiment && (
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        SENTIMENT_COLORS[selectedFeedback.sentiment] ?? 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {selectedFeedback.sentiment}
                    </span>
                  )}
                  {selectedFeedback.isPublic && (
                    <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-teal-100 text-teal-700">
                      Public
                    </span>
                  )}
                </div>
              </div>

              {selectedFeedback.category && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  {selectedFeedback.category}
                </p>
              )}

              <p className="text-sm text-muted-foreground leading-relaxed bg-muted/20 rounded-lg p-4 mb-4">
                {selectedFeedback.content}
              </p>

              {selectedFeedback.reviews.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-primary-navy uppercase tracking-wide mb-3">
                    Reviews ({selectedFeedback.reviews.length})
                  </h3>
                  <div className="space-y-3">
                    {selectedFeedback.reviews.map((review) => (
                      <div key={review.id} className="rounded-lg border border-border p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-medium text-primary-navy">
                            {review.reviewer.firstName} {review.reviewer.lastName}
                          </p>
                          {review.decision && (
                            <span className="text-xs font-medium text-primary-gold border border-primary-gold/40 rounded px-2 py-0.5">
                              {review.decision}
                            </span>
                          )}
                        </div>
                        {review.notes && (
                          <p className="text-xs text-muted-foreground">{review.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-muted/10 flex items-center justify-center min-h-[200px]">
              <p className="text-sm text-muted-foreground">Select a feedback item to review</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
