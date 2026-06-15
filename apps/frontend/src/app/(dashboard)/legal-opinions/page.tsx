'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

type OpinionStatus = 'REQUESTED' | 'ASSIGNED' | 'DRAFTING' | 'UNDER_REVIEW' | 'APPROVED' | 'ISSUED' | 'WITHDRAWN';
type Priority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';

interface LegalOpinion {
  id: string;
  referenceNumber: string;
  subject: string;
  status: OpinionStatus;
  priority: Priority;
  dueDate: string | null;
  requestedBy: { id: string; firstName: string; lastName: string };
  assignedTo: { id: string; firstName: string; lastName: string } | null;
  legislativeItem: { id: string; referenceNumber: string; title: string } | null;
  _count?: { versions: number };
  createdAt: string;
}

interface OpinionList {
  items: LegalOpinion[];
  total: number;
  page: number;
  limit: number;
}

const STATUS_STYLES: Record<OpinionStatus, string> = {
  REQUESTED: 'bg-gray-100 text-gray-600',
  ASSIGNED: 'bg-blue-100 text-blue-700',
  DRAFTING: 'bg-purple-100 text-purple-700',
  UNDER_REVIEW: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  ISSUED: 'bg-teal-100 text-teal-700',
  WITHDRAWN: 'bg-red-100 text-red-700',
};

const PRIORITY_STYLES: Record<Priority, string> = {
  URGENT: 'bg-red-100 text-red-700',
  HIGH: 'bg-orange-100 text-orange-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  LOW: 'bg-gray-100 text-gray-600',
};

export default function LegalOpinionsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading, error } = useQuery<OpinionList>({
    queryKey: ['legal-opinions', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      return (await apiClient.get(`/legal-opinions?${params}`)).data;
    },
    staleTime: 30_000,
  });

  const opinions = data?.items ?? [];
  const statuses: Array<OpinionStatus | ''> = ['', 'REQUESTED', 'ASSIGNED', 'DRAFTING', 'UNDER_REVIEW', 'APPROVED', 'ISSUED', 'WITHDRAWN'];

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary-navy">Legal Opinions</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Legal opinion management with versioning and approval workflow
            </p>
          </div>
          <div className="rounded-lg border border-border bg-white px-4 py-2 text-sm text-muted-foreground shadow-sm">
            <span className="font-semibold text-primary-navy">{data?.total ?? 0}</span> opinion
            {(data?.total ?? 0) !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-primary-navy text-white'
                  : 'border border-border bg-white text-muted-foreground hover:border-primary-navy'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            Loading legal opinions...
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Failed to load legal opinions.
          </div>
        )}

        {!isLoading && opinions.length === 0 && (
          <div className="rounded-lg border border-border bg-white p-12 text-center text-muted-foreground">
            No legal opinions found.
          </div>
        )}

        <div className="space-y-3">
          {opinions.map((opinion) => (
            <Link
              key={opinion.id}
              href={`/legal-opinions/${opinion.id}`}
              className="group flex items-start justify-between gap-4 rounded-xl border border-border bg-white p-5 shadow-sm transition-all hover:border-primary-gold hover:shadow-md"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-muted-foreground">
                    {opinion.referenceNumber}
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[opinion.status]}`}>
                    {opinion.status.replace(/_/g, ' ')}
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_STYLES[opinion.priority]}`}>
                    {opinion.priority}
                  </span>
                </div>
                <h2 className="mt-1 font-semibold text-primary-navy group-hover:text-primary-gold transition-colors truncate">
                  {opinion.subject}
                </h2>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>Requested by: {opinion.requestedBy.firstName} {opinion.requestedBy.lastName}</span>
                  {opinion.assignedTo && (
                    <span>Assigned to: {opinion.assignedTo.firstName} {opinion.assignedTo.lastName}</span>
                  )}
                  {opinion.dueDate && (
                    <span>Due: {new Date(opinion.dueDate).toLocaleDateString('en-GB')}</span>
                  )}
                  {opinion._count && <span>{opinion._count.versions} version{opinion._count.versions !== 1 ? 's' : ''}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
