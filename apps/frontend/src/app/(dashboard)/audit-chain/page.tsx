'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface AuditEntry {
  id: string;
  sequenceNumber: number;
  eventType: string;
  actorId?: string;
  actorEmail?: string;
  entityType: string;
  entityId: string;
  action: string;
  ipAddress?: string;
  createdAt: string;
  entryHash: string;
}

interface VerifyResult {
  valid: boolean;
  checked: number;
  firstBrokenAt?: number;
}

interface RetentionPolicy {
  id: string;
  entityType: string;
  retentionDays: number;
  isActive: boolean;
}

export default function AuditChainPage() {
  const queryClient = useQueryClient();
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [actorIdFilter, setActorIdFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [evidenceEntityType, setEvidenceEntityType] = useState('');
  const [evidenceEntityId, setEvidenceEntityId] = useState('');
  const [evidenceFormat, setEvidenceFormat] = useState<'json' | 'csv'>('json');
  const [editingPolicy, setEditingPolicy] = useState<{ entityType: string; days: string } | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [evidenceResult, setEvidenceResult] = useState<string | null>(null);

  const { data: entriesData, isLoading: entriesLoading } = useQuery({
    queryKey: ['audit-entries', entityTypeFilter, actorIdFilter, fromDate, toDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (entityTypeFilter) params.set('entityType', entityTypeFilter);
      if (actorIdFilter) params.set('actorId', actorIdFilter);
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);
      const res = await apiClient.get(`/audit-chain/entries?${params}`);
      return res.data;
    },
  });

  const { data: retentionPolicies, isLoading: policiesLoading } = useQuery({
    queryKey: ['audit-retention-policies'],
    queryFn: async () => {
      const res = await apiClient.get('/audit-chain/retention');
      return res.data as RetentionPolicy[];
    },
  });

  const upsertPolicy = useMutation({
    mutationFn: async ({ entityType, retentionDays }: { entityType: string; retentionDays: number }) => {
      const res = await apiClient.put(`/audit-chain/retention/${entityType}`, { retentionDays });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-retention-policies'] });
      setEditingPolicy(null);
    },
  });

  const handleVerify = async () => {
    const res = await apiClient.get('/audit-chain/verify');
    setVerifyResult(res.data);
  };

  const handleExportEvidence = async () => {
    if (!evidenceEntityType || !evidenceEntityId) return;
    const res = await apiClient.get(
      `/audit-chain/evidence/${evidenceEntityType}/${evidenceEntityId}?format=${evidenceFormat}`,
    );
    setEvidenceResult(
      evidenceFormat === 'json'
        ? JSON.stringify(res.data, null, 2)
        : res.data.content,
    );
  };

  const entries: AuditEntry[] = entriesData?.data ?? [];

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Advanced Audit Chain</h1>

      {/* Filters & Verify */}
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="flex flex-wrap gap-3">
          <input
            className="border rounded px-3 py-1.5 text-sm w-48"
            placeholder="Entity Type"
            value={entityTypeFilter}
            onChange={(e) => setEntityTypeFilter(e.target.value)}
          />
          <input
            className="border rounded px-3 py-1.5 text-sm w-48"
            placeholder="Actor ID"
            value={actorIdFilter}
            onChange={(e) => setActorIdFilter(e.target.value)}
          />
          <input
            type="date"
            className="border rounded px-3 py-1.5 text-sm"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <input
            type="date"
            className="border rounded px-3 py-1.5 text-sm"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
          <button
            onClick={handleVerify}
            className="px-4 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
          >
            Verify Chain
          </button>
          {verifyResult && (
            <span
              className={`px-3 py-1.5 rounded text-sm font-medium ${
                verifyResult.valid
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {verifyResult.valid
                ? `Chain valid (${verifyResult.checked} entries checked)`
                : `Chain broken at #${verifyResult.firstBrokenAt} (${verifyResult.checked} checked)`}
            </span>
          )}
        </div>
      </div>

      {/* Audit Entries Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold text-gray-700">
            Audit Entries ({entriesData?.total ?? 0})
          </h2>
        </div>
        {entriesLoading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['#', 'Event Type', 'Actor', 'Entity', 'Action', 'IP', 'Date', 'Hash'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-500">{e.sequenceNumber}</td>
                  <td className="px-3 py-2 font-medium">{e.eventType}</td>
                  <td className="px-3 py-2 text-gray-600">{e.actorEmail ?? e.actorId ?? '-'}</td>
                  <td className="px-3 py-2 text-gray-600">
                    {e.entityType}:{e.entityId.slice(0, 8)}
                  </td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs">
                      {e.action}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-400 text-xs">{e.ipAddress ?? '-'}</td>
                  <td className="px-3 py-2 text-gray-400 text-xs">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-400">
                    {e.entryHash.slice(0, 12)}...
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                    No audit entries found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Export Evidence */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="font-semibold text-gray-700 mb-3">Export Evidence</h2>
        <div className="flex flex-wrap gap-3 items-center">
          <input
            className="border rounded px-3 py-1.5 text-sm w-40"
            placeholder="Entity Type"
            value={evidenceEntityType}
            onChange={(e) => setEvidenceEntityType(e.target.value)}
          />
          <input
            className="border rounded px-3 py-1.5 text-sm w-48"
            placeholder="Entity ID"
            value={evidenceEntityId}
            onChange={(e) => setEvidenceEntityId(e.target.value)}
          />
          <select
            className="border rounded px-3 py-1.5 text-sm"
            value={evidenceFormat}
            onChange={(e) => setEvidenceFormat(e.target.value as 'json' | 'csv')}
          >
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
          <button
            onClick={handleExportEvidence}
            className="px-4 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700"
          >
            Export Evidence
          </button>
        </div>
        {evidenceResult && (
          <pre className="mt-3 p-3 bg-gray-50 rounded text-xs overflow-auto max-h-60">
            {evidenceResult}
          </pre>
        )}
      </div>

      {/* Retention Policies */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold text-gray-700">Retention Policies</h2>
        </div>
        {policiesLoading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Entity Type', 'Retention Days', 'Active', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(retentionPolicies ?? []).map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 font-medium">{p.entityType}</td>
                  <td className="px-4 py-2">
                    {editingPolicy?.entityType === p.entityType ? (
                      <input
                        type="number"
                        className="border rounded px-2 py-0.5 w-20 text-sm"
                        value={editingPolicy.days}
                        onChange={(e) =>
                          setEditingPolicy({ entityType: p.entityType, days: e.target.value })
                        }
                      />
                    ) : (
                      p.retentionDays
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${
                        p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {p.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {editingPolicy?.entityType === p.entityType ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            upsertPolicy.mutate({
                              entityType: p.entityType,
                              retentionDays: parseInt(editingPolicy.days, 10),
                            })
                          }
                          className="text-green-600 text-xs hover:underline"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingPolicy(null)}
                          className="text-gray-400 text-xs hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() =>
                          setEditingPolicy({ entityType: p.entityType, days: p.retentionDays.toString() })
                        }
                        className="text-indigo-600 text-xs hover:underline"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {(retentionPolicies ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                    No retention policies configured
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
