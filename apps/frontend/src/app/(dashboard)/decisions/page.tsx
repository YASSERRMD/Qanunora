'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

type DecisionStatus = 'ACTIVE' | 'SUPERSEDED' | 'REVOKED';

interface Decision {
  id: string;
  referenceNumber: string;
  title: string;
  description: string;
  decisionDate: string;
  status: DecisionStatus;
  owner: { id: string; firstName: string; lastName: string };
  createdBy: { id: string; firstName: string; lastName: string };
  createdAt: string;
}

interface DecisionList {
  items: Decision[];
  total: number;
  page: number;
  limit: number;
}

const STATUS_STYLES: Record<DecisionStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  SUPERSEDED: 'bg-amber-100 text-amber-700',
  REVOKED: 'bg-red-100 text-red-700',
};

export default function DecisionsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading, error } = useQuery<DecisionList>({
    queryKey: ['decisions', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      return (await apiClient.get(`/decisions?${params}`)).data;
    },
    staleTime: 30_000,
  });

  const decisions = data?.items ?? [];

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary-navy">Decision Register</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Official government decision records with traceability
            </p>
          </div>
          <div className="rounded-lg border border-border bg-white px-4 py-2 text-sm text-muted-foreground shadow-sm">
            <span className="font-semibold text-primary-navy">{data?.total ?? 0}</span> decision
            {(data?.total ?? 0) !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="mb-6 flex gap-2">
          {(['', 'ACTIVE', 'SUPERSEDED', 'REVOKED'] as const).map((s) => (
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
            Loading decisions...
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Failed to load decisions.
          </div>
        )}

        {!isLoading && decisions.length === 0 && (
          <div className="rounded-lg border border-border bg-white p-12 text-center text-muted-foreground">
            No decisions found.
          </div>
        )}

        <div className="space-y-3">
          {decisions.map((decision) => (
            <Link
              key={decision.id}
              href={`/decisions/${decision.id}`}
              className="group flex items-start justify-between gap-4 rounded-xl border border-border bg-white p-5 shadow-sm transition-all hover:border-primary-gold hover:shadow-md"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-muted-foreground">
                    {decision.referenceNumber}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[decision.status]}`}
                  >
                    {decision.status}
                  </span>
                </div>
                <h2 className="mt-1 font-semibold text-primary-navy group-hover:text-primary-gold transition-colors truncate">
                  {decision.title}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                  {decision.description}
                </p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>
                    {new Date(decision.decisionDate).toLocaleDateString('en-GB', {
                      dateStyle: 'medium',
                    })}
                  </span>
                  <span>
                    Owner: {decision.owner.firstName} {decision.owner.lastName}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
