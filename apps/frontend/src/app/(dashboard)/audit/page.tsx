'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

interface LegislativeItem {
  id: string;
  title: string;
  type: string;
  status: string;
  referenceNumber?: string;
  ministry?: { name: string };
}

interface AuditSummary {
  legislativeItemId: string;
  overallStatus: 'READY' | 'PARTIAL' | 'NOT_READY';
  passedRequired: number;
  requiredItems: number;
  passedItems: number;
  totalItems: number;
}

const STATUS_BADGE: Record<string, string> = {
  READY: 'bg-green-100 text-green-700',
  PARTIAL: 'bg-yellow-100 text-yellow-700',
  NOT_READY: 'bg-red-100 text-red-700',
};

export default function AuditDashboardPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const { data: items, isLoading } = useQuery({
    queryKey: ['legislative-items-audit'],
    queryFn: async () => {
      const res = await apiClient.get<LegislativeItem[]>('/legislative-items');
      return res.data;
    },
  });

  // Fetch audit summaries for all items
  const { data: summaries } = useQuery({
    queryKey: ['audit-summaries', items?.map((i) => i.id)],
    queryFn: async () => {
      if (!items?.length) return {};
      const results: Record<string, AuditSummary> = {};
      // Fetch summaries in parallel (limit to first 20 items for performance)
      const subset = items.slice(0, 20);
      await Promise.all(
        subset.map(async (item) => {
          try {
            const res = await apiClient.get<AuditSummary>(
              `/legislative-items/${item.id}/audit-summary`,
            );
            results[item.id] = res.data;
          } catch {
            // Skip if audit summary fails
          }
        }),
      );
      return results;
    },
    enabled: !!items?.length,
  });

  const filteredItems = (items ?? []).filter((item) => {
    if (typeFilter && item.type !== typeFilter) return false;
    if (statusFilter) {
      const summary = summaries?.[item.id];
      if (!summary || summary.overallStatus !== statusFilter) return false;
    }
    return true;
  });

  // Aggregate stats
  const readyCount = Object.values(summaries ?? {}).filter((s) => s.overallStatus === 'READY').length;
  const partialCount = Object.values(summaries ?? {}).filter((s) => s.overallStatus === 'PARTIAL').length;
  const notReadyCount = Object.values(summaries ?? {}).filter((s) => s.overallStatus === 'NOT_READY').length;

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-primary-navy">Audit Readiness Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review compliance status for all legislative items.
          </p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl border border-border bg-white p-5 text-center shadow-sm">
            <p className="text-3xl font-bold text-green-600">{readyCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Ready</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-5 text-center shadow-sm">
            <p className="text-3xl font-bold text-yellow-500">{partialCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Partial</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-5 text-center shadow-sm">
            <p className="text-3xl font-bold text-red-500">{notReadyCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Not Ready</p>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm mb-4 flex gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary-navy"
          >
            <option value="">All Audit Statuses</option>
            <option value="READY">Ready</option>
            <option value="PARTIAL">Partial</option>
            <option value="NOT_READY">Not Ready</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary-navy"
          >
            <option value="">All Types</option>
            <option value="BILL">Bill</option>
            <option value="LAW">Law</option>
            <option value="REGULATION">Regulation</option>
            <option value="DECREE">Decree</option>
          </select>
          <span className="ml-auto text-xs text-muted-foreground self-center">
            {filteredItems.length} items
          </span>
        </div>

        {/* Items Table */}
        <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">Loading...</div>
          ) : filteredItems.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-muted/20 border-b border-border">
                <tr>
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">Legislative Item</th>
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-5 py-3 text-center font-medium text-muted-foreground">Audit Status</th>
                  <th className="px-5 py-3 text-center font-medium text-muted-foreground">Pass Rate</th>
                  <th className="px-5 py-3 text-right font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredItems.map((item) => {
                  const summary = summaries?.[item.id];
                  return (
                    <tr
                      key={item.id}
                      onClick={() =>
                        router.push(`/legislative-items/${item.id}/audit`)
                      }
                      className="cursor-pointer hover:bg-muted/10 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium text-primary-navy">{item.title}</p>
                        {item.referenceNumber && (
                          <p className="text-xs text-muted-foreground font-mono">{item.referenceNumber}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{item.type}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs bg-muted/30 rounded px-2 py-0.5">{item.status}</span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        {summary ? (
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              STATUS_BADGE[summary.overallStatus] ?? 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {summary.overallStatus.replace('_', ' ')}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {summary ? (
                          <span className="text-sm font-semibold text-primary-navy">
                            {summary.passedItems}/{summary.totalItems}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/legislative-items/${item.id}/audit`);
                          }}
                          className="text-xs text-primary-navy font-medium hover:text-primary-gold"
                        >
                          View Audit →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              No legislative items found.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
