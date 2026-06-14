'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

const ITEM_TYPES = [
  'DRAFT_LAW', 'BILL', 'AMENDMENT', 'REGULATION',
  'CABINET_DECISION', 'CIRCULAR', 'POLICY_DRAFT',
];

const STATUSES = [
  'DRAFTING', 'INTERNAL_REVIEW', 'COMMITTEE_REVIEW', 'PUBLIC_CONSULTATION',
  'LEGAL_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED',
];

const STATUS_COLORS: Record<string, string> = {
  DRAFTING: 'bg-gray-100 text-gray-700',
  INTERNAL_REVIEW: 'bg-blue-100 text-blue-700',
  COMMITTEE_REVIEW: 'bg-purple-100 text-purple-700',
  PUBLIC_CONSULTATION: 'bg-orange-100 text-orange-700',
  LEGAL_REVIEW: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  PUBLISHED: 'bg-teal-100 text-teal-700',
  ARCHIVED: 'bg-red-100 text-red-700',
};

interface LegislativeItem {
  id: string;
  referenceNumber: string;
  title: string;
  titleAr?: string;
  type: string;
  status: string;
  priority: string;
  confidentialityLevel: string;
  createdAt: string;
  ministry: { name: string; code: string };
  createdBy: { firstName: string; lastName: string };
  _count: { documents: number; workflowHistory: number };
}

export default function LegislativeItemsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['legislative-items', search, type, status, page],
    queryFn: async () => {
      const res = await apiClient.get<{
        data: LegislativeItem[];
        total: number;
        totalPages: number;
      }>('/legislative-items', {
        params: {
          search: search || undefined,
          type: type || undefined,
          status: status || undefined,
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
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary-navy">Legislative Items</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage and track all legislative drafts and bills
            </p>
          </div>
          <button
            onClick={() => router.push('/legislative-items/new')}
            className="rounded-lg bg-primary-navy px-4 py-2 text-sm font-medium text-white hover:bg-primary-navy/90 transition-colors"
          >
            + New Item
          </button>
        </div>

        <div className="mb-4 flex gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Search by title, reference..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-64 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30"
          />
          <select
            value={type}
            onChange={(e) => { setType(e.target.value); setPage(1); }}
            className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30"
          >
            <option value="">All Types</option>
            {ITEM_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30"
          >
            <option value="">All Statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading items...</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Reference</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Title</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ministry</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Docs</th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer"
                    onClick={() => router.push(`/legislative-items/${item.id}`)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {item.referenceNumber}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-primary-navy">{item.title}</p>
                      {item.titleAr && (
                        <p className="text-xs text-muted-foreground mt-0.5 text-right" dir="rtl">
                          {item.titleAr}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {item.type.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_COLORS[item.status] ?? 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {item.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {item.ministry?.name}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {item._count.documents}
                    </td>
                  </tr>
                ))}
                {!data?.data.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No legislative items found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {data && data.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{data.total} total items</p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded border border-border px-3 py-1 text-xs disabled:opacity-40 hover:bg-muted/30"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-xs text-muted-foreground">
                Page {page} of {data.totalPages}
              </span>
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
      </div>
    </main>
  );
}
