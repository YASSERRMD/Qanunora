'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface RedlineChange {
  id: string;
  originalText: string;
  proposedText: string;
  changeType: 'INSERTION' | 'DELETION' | 'MODIFICATION' | 'COMMENT';
  articleRef?: string;
  rationale?: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';
  mentions: string[];
  createdAt: string;
  proposedBy: { firstName: string; lastName: string };
  reviewedBy?: { firstName: string; lastName: string } | null;
  reviewNote?: string | null;
}

interface RedlineStats {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
}

const TYPE_COLORS: Record<string, string> = {
  INSERTION: 'bg-green-100 text-green-700 border-green-300',
  DELETION: 'bg-red-100 text-red-700 border-red-300',
  MODIFICATION: 'bg-amber-100 text-amber-700 border-amber-300',
  COMMENT: 'bg-blue-100 text-blue-700 border-blue-300',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  ACCEPTED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  WITHDRAWN: 'bg-gray-100 text-gray-500',
};

export default function RedlinePage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [reviewNote, setReviewNote] = useState('');
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  // Propose modal
  const [showPropose, setShowPropose] = useState(false);
  const [proposeForm, setProposeForm] = useState({
    originalText: '',
    proposedText: '',
    changeType: 'MODIFICATION',
    articleRef: '',
    rationale: '',
    mentions: '',
  });

  const { data: changes = [], isLoading } = useQuery({
    queryKey: ['redline', id, statusFilter],
    queryFn: async () => {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const res = await apiClient.get<RedlineChange[]>(`/redline/${id}${params}`);
      return res.data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['redline-stats', id],
    queryFn: async () => {
      const res = await apiClient.get<RedlineStats>(`/redline/${id}/stats`);
      return res.data;
    },
  });

  const proposeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/redline/${id}`, {
        originalText: proposeForm.originalText,
        proposedText: proposeForm.proposedText,
        changeType: proposeForm.changeType,
        articleRef: proposeForm.articleRef || undefined,
        rationale: proposeForm.rationale || undefined,
        mentions: proposeForm.mentions
          ? proposeForm.mentions.split(',').map((m) => m.trim()).filter(Boolean)
          : [],
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redline', id] });
      queryClient.invalidateQueries({ queryKey: ['redline-stats', id] });
      setShowPropose(false);
      setProposeForm({ originalText: '', proposedText: '', changeType: 'MODIFICATION', articleRef: '', rationale: '', mentions: '' });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async ({ changeId, note }: { changeId: string; note?: string }) => {
      const res = await apiClient.patch(`/redline/change/${changeId}/accept`, { note });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redline', id] });
      queryClient.invalidateQueries({ queryKey: ['redline-stats', id] });
      setReviewingId(null);
      setReviewNote('');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ changeId, note }: { changeId: string; note?: string }) => {
      const res = await apiClient.patch(`/redline/change/${changeId}/reject`, { note });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redline', id] });
      queryClient.invalidateQueries({ queryKey: ['redline-stats', id] });
      setReviewingId(null);
      setReviewNote('');
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async (changeId: string) => {
      const res = await apiClient.delete(`/redline/change/${changeId}/withdraw`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redline', id] });
      queryClient.invalidateQueries({ queryKey: ['redline-stats', id] });
    },
  });

  const applyAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/redline/${id}/apply-accepted`);
      return res.data;
    },
    onSuccess: (data: { applied: number; message: string }) => {
      alert(data.message);
    },
  });

  return (
    <main className="flex-1 p-6" aria-labelledby="redline-heading">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 id="redline-heading" className="text-2xl font-bold text-primary-navy">
              Redline Review
            </h1>
            <p className="text-sm text-muted-foreground">Proposed changes and collaborative review</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => applyAllMutation.mutate()}
              disabled={applyAllMutation.isPending}
              className="rounded-md border border-green-600 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
            >
              Apply All Accepted
            </button>
            <button
              onClick={() => setShowPropose(true)}
              className="rounded-md bg-primary-navy px-4 py-1.5 text-sm font-medium text-white hover:bg-opacity-90"
            >
              Propose Change
            </button>
          </div>
        </header>

        {/* Stats bar */}
        {stats && (
          <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {['PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-lg border p-3 text-center transition-all ${
                  statusFilter === s ? 'border-primary-navy shadow-sm' : 'border-border'
                } bg-white`}
              >
                <p className="text-xl font-bold text-primary-navy">{stats.byStatus[s] ?? 0}</p>
                <p className={`text-xs font-medium mt-0.5 ${STATUS_COLORS[s]?.split(' ').join(' ') ?? ''}`}>{s}</p>
              </button>
            ))}
          </div>
        )}

        {/* Filter */}
        <div className="mb-4 flex gap-2 flex-wrap">
          <button
            onClick={() => setStatusFilter('')}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
              statusFilter === '' ? 'bg-primary-navy text-white border-primary-navy' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            All
          </button>
          {['PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                statusFilter === s ? 'bg-primary-navy text-white border-primary-navy' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Changes list */}
        {isLoading ? (
          <p className="py-12 text-center text-muted-foreground">Loading changes...</p>
        ) : changes.length === 0 ? (
          <div className="py-16 text-center rounded-xl border border-border bg-white">
            <p className="text-muted-foreground">No redline changes found for this filter.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {changes.map((change) => (
              <div
                key={change.id}
                className={`rounded-xl border bg-white overflow-hidden ${TYPE_COLORS[change.changeType] ?? ''}`}
                role="article"
                aria-label={`Redline change: ${change.changeType}`}
              >
                <div className="px-4 py-3 border-b flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${TYPE_COLORS[change.changeType] ?? ''}`}>
                      {change.changeType}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[change.status] ?? ''}`}>
                      {change.status}
                    </span>
                    {change.articleRef && (
                      <span className="text-xs text-muted-foreground bg-gray-100 rounded px-2 py-0.5">
                        {change.articleRef}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{change.proposedBy.firstName} {change.proposedBy.lastName}</span>
                    <span>{new Date(change.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Original text */}
                  <div>
                    <p className="text-xs font-semibold text-red-600 mb-1 uppercase tracking-wide">Original</p>
                    <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm font-mono whitespace-pre-wrap text-red-900">
                      {change.originalText}
                    </div>
                  </div>
                  {/* Proposed text */}
                  <div>
                    <p className="text-xs font-semibold text-green-600 mb-1 uppercase tracking-wide">Proposed</p>
                    <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm font-mono whitespace-pre-wrap text-green-900">
                      {change.proposedText}
                    </div>
                  </div>
                </div>

                {change.rationale && (
                  <div className="px-4 pb-3">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold">Rationale:</span> {change.rationale}
                    </p>
                  </div>
                )}

                {change.mentions.length > 0 && (
                  <div className="px-4 pb-2">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold">Mentions:</span> {change.mentions.join(', ')}
                    </p>
                  </div>
                )}

                {change.reviewNote && (
                  <div className="px-4 pb-3 text-xs text-muted-foreground">
                    <span className="font-semibold">Review note:</span> {change.reviewNote}
                    {change.reviewedBy && (
                      <span className="ml-1">— {change.reviewedBy.firstName} {change.reviewedBy.lastName}</span>
                    )}
                  </div>
                )}

                {/* Actions for PENDING changes */}
                {change.status === 'PENDING' && (
                  <div className="px-4 py-3 border-t bg-gray-50 flex items-center gap-2 flex-wrap">
                    {reviewingId === change.id ? (
                      <>
                        <input
                          type="text"
                          value={reviewNote}
                          onChange={(e) => setReviewNote(e.target.value)}
                          placeholder="Review note (optional)"
                          className="flex-1 min-w-36 rounded-md border border-gray-300 px-3 py-1 text-sm"
                          aria-label="Review note"
                        />
                        <button
                          onClick={() => acceptMutation.mutate({ changeId: change.id, note: reviewNote })}
                          disabled={acceptMutation.isPending}
                          className="rounded-md bg-green-600 px-3 py-1 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          Confirm Accept
                        </button>
                        <button
                          onClick={() => rejectMutation.mutate({ changeId: change.id, note: reviewNote })}
                          disabled={rejectMutation.isPending}
                          className="rounded-md bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          Confirm Reject
                        </button>
                        <button
                          onClick={() => { setReviewingId(null); setReviewNote(''); }}
                          className="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setReviewingId(change.id)}
                          className="rounded-md bg-green-600 px-3 py-1 text-sm font-medium text-white hover:bg-green-700"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => setReviewingId(change.id)}
                          className="rounded-md bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => withdrawMutation.mutate(change.id)}
                          disabled={withdrawMutation.isPending}
                          className="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Withdraw
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Propose modal */}
      {showPropose && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="propose-modal-title"
        >
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 id="propose-modal-title" className="text-lg font-semibold text-primary-navy">
                Propose Redline Change
              </h2>
              <button onClick={() => setShowPropose(false)} className="text-gray-400 hover:text-gray-600" aria-label="Close">
                &times;
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Change Type</label>
                <select
                  value={proposeForm.changeType}
                  onChange={(e) => setProposeForm((f) => ({ ...f, changeType: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  {['INSERTION', 'DELETION', 'MODIFICATION', 'COMMENT'].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Article Reference</label>
                <input
                  type="text"
                  value={proposeForm.articleRef}
                  onChange={(e) => setProposeForm((f) => ({ ...f, articleRef: e.target.value }))}
                  placeholder="e.g. Article 3, Clause 1"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Original Text</label>
                <textarea
                  rows={4}
                  value={proposeForm.originalText}
                  onChange={(e) => setProposeForm((f) => ({ ...f, originalText: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono resize-y"
                  placeholder="Paste the original text here..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Proposed Text</label>
                <textarea
                  rows={4}
                  value={proposeForm.proposedText}
                  onChange={(e) => setProposeForm((f) => ({ ...f, proposedText: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono resize-y"
                  placeholder="Paste your proposed replacement here..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rationale</label>
                <textarea
                  rows={2}
                  value={proposeForm.rationale}
                  onChange={(e) => setProposeForm((f) => ({ ...f, rationale: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-y"
                  placeholder="Why is this change needed?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mentions (comma-separated user IDs)</label>
                <input
                  type="text"
                  value={proposeForm.mentions}
                  onChange={(e) => setProposeForm((f) => ({ ...f, mentions: e.target.value }))}
                  placeholder="user-id-1, user-id-2"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowPropose(false)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => proposeMutation.mutate()}
                disabled={!proposeForm.originalText.trim() || !proposeForm.proposedText.trim() || proposeMutation.isPending}
                className="rounded-md bg-primary-navy px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-opacity-90"
              >
                {proposeMutation.isPending ? 'Proposing...' : 'Propose Change'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
