'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

type ClassificationLevel = 'UNCLASSIFIED' | 'RESTRICTED' | 'CONFIDENTIAL' | 'SECRET' | 'TOP_SECRET';

interface Classification {
  id: string;
  legislativeItemId: string;
  classificationLevel: ClassificationLevel;
  sensitiveFlags: string[];
  reviewDueDate?: string;
  declassifiedAt?: string;
  justification?: string;
  legislativeItem?: { id: string; title: string; referenceNumber: string };
  classifiedBy: { firstName: string; lastName: string };
}

interface AccessException {
  id: string;
  legislativeItemId: string;
  reason: string;
  expiresAt: string;
  isActive: boolean;
  user: { firstName: string; lastName: string; email: string };
  grantedBy: { firstName: string; lastName: string };
}

interface AiDetectResult {
  flags: string[];
  reasoning: string;
  suggestedLevel: ClassificationLevel;
}

const LEVEL_STYLES: Record<ClassificationLevel, string> = {
  UNCLASSIFIED: 'bg-gray-100 text-gray-600',
  RESTRICTED: 'bg-yellow-100 text-yellow-700',
  CONFIDENTIAL: 'bg-orange-100 text-orange-700',
  SECRET: 'bg-red-100 text-red-700',
  TOP_SECRET: 'bg-red-900 text-white',
};

const LEVELS: ClassificationLevel[] = ['UNCLASSIFIED', 'RESTRICTED', 'CONFIDENTIAL', 'SECRET', 'TOP_SECRET'];

export default function ClassificationPage() {
  const queryClient = useQueryClient();
  const [selectedItemId, setSelectedItemId] = useState('');
  const [aiResult, setAiResult] = useState<AiDetectResult | null>(null);
  const [showDetectModal, setShowDetectModal] = useState(false);
  const [declassifyItemId, setDeclassifyItemId] = useState('');
  const [declassifyJustification, setDeclassifyJustification] = useState('');

  const { data: pendingReview = [], isLoading } = useQuery({
    queryKey: ['classification-pending'],
    queryFn: async () => {
      const res = await apiClient.get('/classification/pending-review');
      return res.data as Classification[];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['classification-stats'],
    queryFn: async () => {
      const res = await apiClient.get('/classification/stats');
      return res.data as { counts: Record<ClassificationLevel, number>; total: number };
    },
  });

  const { data: exceptions = [] } = useQuery({
    queryKey: ['access-exceptions'],
    queryFn: async () => {
      const res = await apiClient.get('/classification/exceptions');
      return res.data as AccessException[];
    },
  });

  const detectMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await apiClient.post(`/classification/${itemId}/detect`);
      return res.data as AiDetectResult;
    },
    onSuccess: (data) => {
      setAiResult(data);
      setShowDetectModal(true);
    },
  });

  const declassifyMutation = useMutation({
    mutationFn: async ({ itemId, justification }: { itemId: string; justification: string }) => {
      const res = await apiClient.delete(`/classification/${itemId}/declassify`, {
        data: { justification },
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classification-pending'] });
      setDeclassifyItemId('');
      setDeclassifyJustification('');
    },
  });

  const revokeException = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/classification/exceptions/${id}`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['access-exceptions'] }),
  });

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Classification & Confidentiality</h1>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-5 gap-3">
          {LEVELS.map((level) => (
            <div key={level} className={`rounded-lg px-4 py-3 text-center ${LEVEL_STYLES[level]}`}>
              <div className="text-2xl font-bold">{stats.counts[level] ?? 0}</div>
              <div className="text-xs mt-1">{level}</div>
            </div>
          ))}
        </div>
      )}

      {/* AI Detect Tool */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="font-semibold text-gray-700 mb-3">AI Sensitive Content Detection</h2>
        <div className="flex gap-3 items-center">
          <input
            className="border rounded px-3 py-1.5 text-sm flex-1 max-w-sm"
            placeholder="Legislative Item ID"
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
          />
          <button
            onClick={() => selectedItemId && detectMutation.mutate(selectedItemId)}
            disabled={!selectedItemId || detectMutation.isPending}
            className="px-4 py-1.5 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-40"
          >
            {detectMutation.isPending ? 'Detecting...' : 'AI Detect'}
          </button>
        </div>
      </div>

      {/* AI Detect Modal */}
      {showDetectModal && aiResult && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-lg">AI Classification Suggestion</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Suggested Level:</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${LEVEL_STYLES[aiResult.suggestedLevel]}`}>
                  {aiResult.suggestedLevel}
                </span>
              </div>
              {aiResult.flags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {aiResult.flags.map((f) => (
                    <span key={f} className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs">
                      {f}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-sm text-gray-600 bg-gray-50 rounded p-2">{aiResult.reasoning}</p>
            </div>
            <button
              onClick={() => setShowDetectModal(false)}
              className="w-full py-2 bg-gray-100 rounded text-sm hover:bg-gray-200"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Pending Declassification Review */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold text-gray-700">Pending Declassification Review</h2>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Item', 'Level', 'Flags', 'Review Due', 'Classified By', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pendingReview.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <div className="font-medium text-xs">{c.legislativeItem?.referenceNumber ?? c.legislativeItemId}</div>
                    <div className="text-gray-500 text-xs">{c.legislativeItem?.title?.slice(0, 40)}</div>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${LEVEL_STYLES[c.classificationLevel]}`}>
                      {c.classificationLevel}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {c.sensitiveFlags.map((f) => (
                        <span key={f} className="px-1 py-0.5 bg-red-50 text-red-600 rounded text-xs">
                          {f}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-xs text-red-500">
                    {c.reviewDueDate ? new Date(c.reviewDueDate).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-2 text-gray-600 text-xs">
                    {c.classifiedBy?.firstName} {c.classifiedBy?.lastName}
                  </td>
                  <td className="px-4 py-2">
                    {declassifyItemId === c.legislativeItemId ? (
                      <div className="space-y-1">
                        <input
                          className="border rounded px-2 py-0.5 text-xs w-full"
                          placeholder="Justification"
                          value={declassifyJustification}
                          onChange={(e) => setDeclassifyJustification(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              declassifyMutation.mutate({
                                itemId: c.legislativeItemId,
                                justification: declassifyJustification,
                              })
                            }
                            className="text-green-600 text-xs hover:underline"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeclassifyItemId('')}
                            className="text-gray-400 text-xs hover:underline"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeclassifyItemId(c.legislativeItemId)}
                        className="text-indigo-600 text-xs hover:underline"
                      >
                        Declassify
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {pendingReview.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No items pending declassification review
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Access Exceptions */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold text-gray-700">Access Exceptions</h2>
        </div>
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['User', 'Item ID', 'Reason', 'Expires', 'Active', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {exceptions.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-2">
                  <div className="font-medium text-xs">{e.user.firstName} {e.user.lastName}</div>
                  <div className="text-gray-400 text-xs">{e.user.email}</div>
                </td>
                <td className="px-4 py-2 text-gray-600 text-xs">{e.legislativeItemId.slice(0, 12)}...</td>
                <td className="px-4 py-2 text-gray-600 text-xs max-w-xs truncate">{e.reason}</td>
                <td className="px-4 py-2 text-xs">{new Date(e.expiresAt).toLocaleDateString()}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${e.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {e.isActive ? 'Active' : 'Revoked'}
                  </span>
                </td>
                <td className="px-4 py-2">
                  {e.isActive && (
                    <button
                      onClick={() => revokeException.mutate(e.id)}
                      className="text-red-600 text-xs hover:underline"
                    >
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {exceptions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No access exceptions
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
