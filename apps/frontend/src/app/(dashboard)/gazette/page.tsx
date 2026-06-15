'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';

type GazetteStatus = 'PREPARING' | 'READINESS_CHECK' | 'PENDING_APPROVAL' | 'APPROVED' | 'PUBLISHED' | 'RETRACTED';

interface GazetteEntry {
  id: string;
  gazetteNumber: string;
  title: string;
  publicationStatus: GazetteStatus;
  issueDate?: string;
  publishedAt?: string;
  createdAt: string;
  legislativeItem: { title: string; referenceNumber: string; type: string };
  createdBy: { firstName: string; lastName: string };
  _count?: { checklist: number };
}

const STATUS_COLORS: Record<GazetteStatus, string> = {
  PREPARING: 'bg-gray-100 text-gray-600',
  READINESS_CHECK: 'bg-blue-100 text-blue-700',
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  PUBLISHED: 'bg-emerald-100 text-emerald-700',
  RETRACTED: 'bg-red-100 text-red-700',
};

export default function GazettePage() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [legislativeItemId, setLegislativeItemId] = useState('');

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['gazette-entries', filterStatus],
    queryFn: async () => {
      const url = filterStatus ? `/gazette?status=${filterStatus}` : '/gazette';
      const res = await apiClient.get(url);
      return res.data as GazetteEntry[];
    },
  });

  const createEntry = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/gazette', { legislativeItemId });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gazette-entries'] });
      setShowCreateForm(false);
      setLegislativeItemId('');
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Official Gazette</h1>
          <p className="text-sm text-gray-500 mt-1">Manage gazette entries and publication workflow</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
        >
          Create Gazette Entry
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-white rounded-lg shadow p-5 space-y-4">
          <h2 className="font-semibold text-gray-700">New Gazette Entry</h2>
          <p className="text-sm text-gray-500">The legislative item must have PUBLISHED status.</p>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Legislative Item ID</label>
            <input
              className="border rounded px-3 py-1.5 text-sm w-full max-w-md"
              placeholder="Enter legislative item ID"
              value={legislativeItemId}
              onChange={(e) => setLegislativeItemId(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => createEntry.mutate()}
              disabled={!legislativeItemId || createEntry.isPending}
              className="px-4 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-40"
            >
              {createEntry.isPending ? 'Creating...' : 'Create Entry'}
            </button>
            <button onClick={() => setShowCreateForm(false)} className="px-4 py-1.5 text-gray-500 text-sm">Cancel</button>
          </div>
          {createEntry.isError && (
            <p className="text-sm text-red-600">Error: {(createEntry.error as Error)?.message}</p>
          )}
        </div>
      )}

      {/* Status Filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterStatus('')}
          className={`px-3 py-1 text-xs rounded-full ${!filterStatus ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          All
        </button>
        {(['PREPARING', 'READINESS_CHECK', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED', 'RETRACTED'] as GazetteStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 text-xs rounded-full ${filterStatus === s ? 'bg-indigo-600 text-white' : STATUS_COLORS[s] + ' hover:opacity-80'}`}
          >
            {s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Entries Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Gazette #', 'Title', 'Ref #', 'Status', 'Issue Date', 'Created By', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs font-semibold text-indigo-700">{entry.gazetteNumber}</td>
                  <td className="px-4 py-2">
                    <div className="font-medium text-gray-800 text-xs truncate max-w-48">{entry.title}</div>
                    <div className="text-xs text-gray-400">{entry.legislativeItem.type}</div>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500 font-mono">{entry.legislativeItem.referenceNumber}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[entry.publicationStatus]}`}>
                      {entry.publicationStatus.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-400">
                    {entry.issueDate ? new Date(entry.issueDate).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {entry.createdBy.firstName} {entry.createdBy.lastName}
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/gazette/${entry.id}`}
                      className="text-indigo-600 text-xs hover:underline"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No gazette entries found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
