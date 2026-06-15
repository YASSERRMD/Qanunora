'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

type Tab = 'rules' | 'holds' | 'archive';

interface RetentionRule {
  id: string;
  name: string;
  entityType: string;
  condition: Record<string, unknown>;
  action: string;
  retentionYears: number;
  isActive: boolean;
  lastRunAt?: string;
}

interface LegalHold {
  id: string;
  entityType: string;
  entityId: string;
  reason: string;
  isActive: boolean;
  expiresAt?: string;
  heldBy: { firstName: string; lastName: string; email: string };
}

interface ArchivedItem {
  id: string;
  entityType: string;
  entityId: string;
  archiveReason: string;
  archivedAt: string;
  restoredAt?: string;
  archivedBy: { firstName: string; lastName: string; email: string };
}

const ACTION_COLORS: Record<string, string> = {
  ARCHIVE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
  EXPORT_AND_DELETE: 'bg-orange-100 text-orange-700',
};

export default function RetentionAdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('rules');
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading: rulesLoading } = useQuery({
    queryKey: ['retention-rules'],
    queryFn: async () => {
      const res = await apiClient.get('/retention/rules');
      return res.data as RetentionRule[];
    },
    enabled: activeTab === 'rules',
  });

  const { data: holds = [], isLoading: holdsLoading } = useQuery({
    queryKey: ['legal-holds'],
    queryFn: async () => {
      const res = await apiClient.get('/retention/holds');
      return res.data as LegalHold[];
    },
    enabled: activeTab === 'holds',
  });

  const { data: archived = [], isLoading: archiveLoading } = useQuery({
    queryKey: ['archived-items'],
    queryFn: async () => {
      const res = await apiClient.get('/retention/archived');
      return res.data as ArchivedItem[];
    },
    enabled: activeTab === 'archive',
  });

  const runRule = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/retention/rules/${id}/run`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['retention-rules'] }),
  });

  const releaseHold = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/retention/holds/${id}`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['legal-holds'] }),
  });

  const restoreItem = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/retention/archived/${id}/restore`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['archived-items'] }),
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: 'rules', label: 'Retention Rules' },
    { key: 'holds', label: 'Legal Holds' },
    { key: 'archive', label: 'Archive' },
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Data Retention & Archival</h1>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Retention Rules Tab */}
      {activeTab === 'rules' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {rulesLoading ? (
            <div className="p-8 text-center text-gray-400">Loading...</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Name', 'Entity', 'Action', 'Years', 'Status', 'Last Run', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rules.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{r.name}</td>
                    <td className="px-4 py-2 text-gray-600">{r.entityType}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${ACTION_COLORS[r.action] ?? ''}`}>
                        {r.action}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-600">{r.retentionYears}y</td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs ${
                          r.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {r.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-400 text-xs">
                      {r.lastRunAt ? new Date(r.lastRunAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => runRule.mutate(r.id)}
                        disabled={!r.isActive || runRule.isPending}
                        className="text-indigo-600 text-xs hover:underline disabled:opacity-40"
                      >
                        Run Now
                      </button>
                    </td>
                  </tr>
                ))}
                {rules.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                      No retention rules configured
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Legal Holds Tab */}
      {activeTab === 'holds' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {holdsLoading ? (
            <div className="p-8 text-center text-gray-400">Loading...</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Entity', 'Reason', 'Held By', 'Expires', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {holds.map((h) => (
                  <tr key={h.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <div className="font-medium">{h.entityType}</div>
                      <div className="text-gray-400 text-xs">{h.entityId.slice(0, 12)}...</div>
                    </td>
                    <td className="px-4 py-2 text-gray-600 max-w-xs truncate">{h.reason}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {h.heldBy.firstName} {h.heldBy.lastName}
                    </td>
                    <td className="px-4 py-2 text-gray-400 text-xs">
                      {h.expiresAt ? new Date(h.expiresAt).toLocaleDateString() : 'No expiry'}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs ${
                          h.isActive ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {h.isActive ? 'Active Hold' : 'Released'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {h.isActive && (
                        <button
                          onClick={() => releaseHold.mutate(h.id)}
                          disabled={releaseHold.isPending}
                          className="text-red-600 text-xs hover:underline disabled:opacity-40"
                        >
                          Release
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {holds.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      No legal holds
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Archive Tab */}
      {activeTab === 'archive' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {archiveLoading ? (
            <div className="p-8 text-center text-gray-400">Loading...</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Entity', 'Reason', 'Archived By', 'Date', 'Restored', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {archived.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <div className="font-medium">{a.entityType}</div>
                      <div className="text-gray-400 text-xs">{a.entityId.slice(0, 12)}...</div>
                    </td>
                    <td className="px-4 py-2 text-gray-600 max-w-xs truncate">{a.archiveReason}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {a.archivedBy.firstName} {a.archivedBy.lastName}
                    </td>
                    <td className="px-4 py-2 text-gray-400 text-xs">
                      {new Date(a.archivedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {a.restoredAt ? (
                        <span className="text-green-600">
                          {new Date(a.restoredAt).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {!a.restoredAt && (
                        <button
                          onClick={() => restoreItem.mutate(a.id)}
                          disabled={restoreItem.isPending}
                          className="text-indigo-600 text-xs hover:underline disabled:opacity-40"
                        >
                          Restore
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {archived.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      No archived items
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
