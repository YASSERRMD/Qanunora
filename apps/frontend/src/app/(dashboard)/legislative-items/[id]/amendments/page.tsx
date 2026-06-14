'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

const STATUS_COLORS: Record<string, string> = {
  PROPOSED: 'bg-blue-100 text-blue-700',
  UNDER_REVIEW: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  INCORPORATED: 'bg-purple-100 text-purple-700',
};

const AMENDMENT_STATUSES = ['PROPOSED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'INCORPORATED'];

interface Amendment {
  id: string;
  title: string;
  description: string;
  reason: string;
  articleReference?: string;
  sectionReference?: string;
  status: string;
  impactSummary?: string;
  createdAt: string;
  proposedBy: { firstName: string; lastName: string; email: string };
  approvedBy?: { firstName: string; lastName: string };
  approvedAt?: string;
}

export default function AmendmentsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Amendment | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['amendments', id, statusFilter, page],
    queryFn: async () => {
      const res = await apiClient.get<{
        data: Amendment[];
        total: number;
        totalPages: number;
      }>(`/legislative-items/${id}/amendments`, {
        params: {
          status: statusFilter || undefined,
          page,
          limit: 20,
        },
      });
      return res.data;
    },
  });

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
            <h1 className="text-2xl font-bold text-primary-navy">Amendments</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track and manage proposed amendments for this legislative item
            </p>
          </div>
        </div>

        <div className="mb-4 flex gap-3">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30"
          >
            <option value="">All Statuses</option>
            {AMENDMENT_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading amendments...</div>
            ) : (
              <>
                <div className="divide-y divide-border">
                  {data?.data.map((amendment) => (
                    <div
                      key={amendment.id}
                      onClick={() => setSelected(amendment)}
                      className={`px-5 py-4 cursor-pointer hover:bg-muted/20 transition-colors ${
                        selected?.id === amendment.id ? 'bg-muted/30 border-l-2 border-primary-gold' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-medium text-primary-navy text-sm leading-snug">
                          {amendment.title}
                        </p>
                        <span
                          className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            STATUS_COLORS[amendment.status] ?? 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {amendment.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      {(amendment.articleReference || amendment.sectionReference) && (
                        <p className="text-xs text-muted-foreground mb-1">
                          {amendment.articleReference}
                          {amendment.articleReference && amendment.sectionReference ? ' / ' : ''}
                          {amendment.sectionReference}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Proposed by {amendment.proposedBy.firstName} {amendment.proposedBy.lastName}
                        {' '}· {new Date(amendment.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                  {!data?.data.length && (
                    <div className="px-5 py-8 text-center text-muted-foreground">
                      No amendments found
                    </div>
                  )}
                </div>

                {data && data.totalPages > 1 && (
                  <div className="px-5 py-3 border-t border-border flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{data.total} total</span>
                    <div className="flex gap-2">
                      <button
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                        className="rounded border border-border px-3 py-1 text-xs disabled:opacity-40 hover:bg-muted/30"
                      >
                        Prev
                      </button>
                      <button
                        disabled={page >= data.totalPages}
                        onClick={() => setPage((p) => p + 1)}
                        className="rounded border border-border px-3 py-1 text-xs disabled:opacity-40 hover:bg-muted/30"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {selected ? (
            <div className="rounded-xl border border-border bg-white shadow-sm p-5">
              <div className="flex items-start justify-between mb-4">
                <h2 className="font-semibold text-primary-navy">{selected.title}</h2>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    STATUS_COLORS[selected.status] ?? 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {selected.status.replace(/_/g, ' ')}
                </span>
              </div>

              <dl className="space-y-4 text-sm">
                {(selected.articleReference || selected.sectionReference) && (
                  <div>
                    <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                      Reference
                    </dt>
                    <dd className="text-primary-navy">
                      {[selected.articleReference, selected.sectionReference].filter(Boolean).join(' / ')}
                    </dd>
                  </div>
                )}

                <div>
                  <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Description
                  </dt>
                  <dd className="text-primary-navy leading-relaxed">{selected.description}</dd>
                </div>

                <div>
                  <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Reason
                  </dt>
                  <dd className="text-muted-foreground leading-relaxed">{selected.reason}</dd>
                </div>

                {selected.impactSummary && (
                  <div>
                    <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                      Impact Summary
                    </dt>
                    <dd className="text-muted-foreground leading-relaxed bg-yellow-50 rounded p-3">
                      {selected.impactSummary}
                    </dd>
                  </div>
                )}

                <div className="pt-4 border-t border-border space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Proposed by</span>
                    <span className="text-primary-navy font-medium">
                      {selected.proposedBy.firstName} {selected.proposedBy.lastName}
                    </span>
                  </div>
                  {selected.approvedBy && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Approved by</span>
                      <span className="text-primary-navy font-medium">
                        {selected.approvedBy.firstName} {selected.approvedBy.lastName}
                      </span>
                    </div>
                  )}
                  {selected.approvedAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Approved at</span>
                      <span className="text-primary-navy font-medium">
                        {new Date(selected.approvedAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </dl>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-muted/10 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Select an amendment to view details</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
