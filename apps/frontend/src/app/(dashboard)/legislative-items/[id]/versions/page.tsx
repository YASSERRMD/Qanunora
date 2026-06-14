'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

interface Version {
  id: string;
  versionNumber: number;
  label?: string;
  notes?: string;
  createdAt: string;
  document?: { originalName: string; mimeType: string };
}

interface DiffEntry {
  field: string;
  v1Value: unknown;
  v2Value: unknown;
  changed: boolean;
}

interface CompareResult {
  v1: { versionNumber: number; label?: string };
  v2: { versionNumber: number; label?: string };
  diff: DiffEntry[];
  totalChanges: number;
}

export default function VersionsPage() {
  const { id: legislativeItemId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [selectedV1, setSelectedV1] = useState('');
  const [selectedV2, setSelectedV2] = useState('');
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [compareError, setCompareError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['versions', legislativeItemId],
    queryFn: async () => {
      const res = await apiClient.get<{ data: Version[]; total: number }>(
        `/legislative-items/${legislativeItemId}/versions`,
      );
      return res.data;
    },
  });

  const snapshot = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/legislative-items/${legislativeItemId}/versions`, {
        label: `Snapshot ${new Date().toISOString()}`,
        contentSnapshot: { snapshotTakenAt: new Date().toISOString() },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['versions', legislativeItemId] });
    },
  });

  const restore = useMutation({
    mutationFn: async (versionId: string) => {
      await apiClient.post(
        `/legislative-items/${legislativeItemId}/versions/restore/${versionId}`,
        {},
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['versions', legislativeItemId] });
    },
  });

  const compare = async () => {
    if (!selectedV1 || !selectedV2) return;
    setCompareError('');
    try {
      const res = await apiClient.get<CompareResult>('/versions/compare', {
        params: { v1: selectedV1, v2: selectedV2 },
      });
      setCompareResult(res.data);
    } catch {
      setCompareError('Failed to compare versions');
    }
  };

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary-navy">Version History</h1>
            <p className="text-sm text-muted-foreground mt-1">Track and restore snapshots of this legislative item</p>
          </div>
          <button
            onClick={() => snapshot.mutate()}
            disabled={snapshot.isPending}
            className="rounded-lg bg-primary-navy px-4 py-2 text-sm font-medium text-white hover:bg-primary-navy/90 disabled:opacity-50"
          >
            {snapshot.isPending ? 'Saving...' : 'Save Snapshot'}
          </button>
        </div>

        {data && data.total >= 2 && (
          <div className="mb-6 rounded-xl border border-primary-gold/40 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-primary-navy mb-4">Compare Versions</h2>
            {compareError && (
              <div className="mb-3 text-sm text-red-600">{compareError}</div>
            )}
            <div className="flex gap-3 items-end flex-wrap">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Version 1</label>
                <select
                  value={selectedV1}
                  onChange={(e) => setSelectedV1(e.target.value)}
                  className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30"
                >
                  <option value="">Select version...</option>
                  {data.data.map((v) => (
                    <option key={v.id} value={v.id}>
                      v{v.versionNumber}{v.label ? ` — ${v.label}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Version 2</label>
                <select
                  value={selectedV2}
                  onChange={(e) => setSelectedV2(e.target.value)}
                  className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30"
                >
                  <option value="">Select version...</option>
                  {data.data.map((v) => (
                    <option key={v.id} value={v.id}>
                      v{v.versionNumber}{v.label ? ` — ${v.label}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={compare}
                disabled={!selectedV1 || !selectedV2 || selectedV1 === selectedV2}
                className="rounded-lg border border-primary-gold px-4 py-2 text-sm font-medium text-primary-navy hover:bg-primary-gold/10 disabled:opacity-40"
              >
                Compare
              </button>
            </div>

            {compareResult && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-primary-navy mb-2">
                  {compareResult.totalChanges} change(s) between v{compareResult.v1.versionNumber} and v{compareResult.v2.versionNumber}
                </p>
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Field</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">v{compareResult.v1.versionNumber}</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">v{compareResult.v2.versionNumber}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compareResult.diff.map((entry) => (
                        <tr
                          key={entry.field}
                          className={`border-b border-border last:border-0 ${entry.changed ? 'bg-yellow-50' : ''}`}
                        >
                          <td className="px-3 py-2 font-medium text-primary-navy">{entry.field}</td>
                          <td className="px-3 py-2 text-muted-foreground font-mono">
                            {entry.v1Value !== null ? String(entry.v1Value) : '—'}
                          </td>
                          <td className={`px-3 py-2 font-mono ${entry.changed ? 'text-green-700 font-semibold' : 'text-muted-foreground'}`}>
                            {entry.v2Value !== null ? String(entry.v2Value) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading versions...</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Version</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Label</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Notes</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Document</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((version) => (
                  <tr key={version.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <span className="rounded bg-primary-navy/10 px-2 py-0.5 text-xs font-bold text-primary-navy">
                        v{version.versionNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-primary-navy">
                      {version.label ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">
                      {version.notes ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {version.document?.originalName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(version.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => restore.mutate(version.id)}
                        disabled={restore.isPending}
                        className="text-xs text-primary-navy hover:underline disabled:opacity-50"
                      >
                        Restore
                      </button>
                    </td>
                  </tr>
                ))}
                {!data?.data.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No versions yet. Save a snapshot to start tracking changes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
