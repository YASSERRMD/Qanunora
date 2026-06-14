'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

const STAKEHOLDER_TYPES = [
  'GOVERNMENT_ENTITY',
  'PRIVATE_SECTOR',
  'NGO',
  'ACADEMIC',
  'PUBLIC_REPRESENTATIVE',
  'INDIVIDUAL',
  'INTERNATIONAL_ORGANIZATION',
];

const TYPE_COLORS: Record<string, string> = {
  GOVERNMENT_ENTITY: 'bg-primary-navy/10 text-primary-navy',
  PRIVATE_SECTOR: 'bg-primary-gold/20 text-primary-navy',
  NGO: 'bg-green-100 text-green-700',
  ACADEMIC: 'bg-blue-100 text-blue-700',
  PUBLIC_REPRESENTATIVE: 'bg-purple-100 text-purple-700',
  INDIVIDUAL: 'bg-gray-100 text-gray-700',
  INTERNATIONAL_ORGANIZATION: 'bg-teal-100 text-teal-700',
};

interface Stakeholder {
  id: string;
  name: string;
  nameAr?: string;
  type: string;
  contactEmail?: string;
  contactPhone?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  _count: { communicationLogs: number; consultationFeedback: number };
}

export default function StakeholdersPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['stakeholders', search, type, page],
    queryFn: async () => {
      const res = await apiClient.get<{
        data: Stakeholder[];
        total: number;
        totalPages: number;
      }>('/stakeholders', {
        params: {
          search: search || undefined,
          type: type || undefined,
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
            <h1 className="text-2xl font-bold text-primary-navy">Stakeholders</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage stakeholder registry and communication records
            </p>
          </div>
        </div>

        <div className="mb-4 flex gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Search by name or email..."
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
            {STAKEHOLDER_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading stakeholders...</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Contact</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Communications</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Feedback</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((stakeholder) => (
                  <tr
                    key={stakeholder.id}
                    onClick={() => router.push(`/stakeholders/${stakeholder.id}`)}
                    className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-primary-navy">{stakeholder.name}</p>
                      {stakeholder.nameAr && (
                        <p className="text-xs text-muted-foreground mt-0.5 text-right" dir="rtl">
                          {stakeholder.nameAr}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          TYPE_COLORS[stakeholder.type] ?? 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {stakeholder.type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {stakeholder.contactEmail ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-center text-muted-foreground">
                      {stakeholder._count.communicationLogs}
                    </td>
                    <td className="px-4 py-3 text-xs text-center text-muted-foreground">
                      {stakeholder._count.consultationFeedback}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          stakeholder.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {stakeholder.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
                {!data?.data.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No stakeholders found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {data && data.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{data.total} total stakeholders</p>
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
