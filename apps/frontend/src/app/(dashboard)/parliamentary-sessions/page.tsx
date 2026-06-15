'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

type SessionStatus = 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
type SessionType = 'ORDINARY' | 'EXTRAORDINARY' | 'EMERGENCY';

interface ParliamentarySession {
  id: string;
  sessionNumber: string;
  title: string;
  sessionType: SessionType;
  status: SessionStatus;
  startDate: string;
  endDate: string | null;
  createdBy: { id: string; firstName: string; lastName: string };
  _count?: { readingStages: number; debates: number };
}

interface SessionList {
  items: ParliamentarySession[];
  total: number;
  page: number;
  limit: number;
}

const STATUS_STYLES: Record<SessionStatus, string> = {
  UPCOMING: 'bg-blue-100 text-blue-700',
  ACTIVE: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-700',
};

const TYPE_STYLES: Record<SessionType, string> = {
  ORDINARY: 'bg-purple-100 text-purple-700',
  EXTRAORDINARY: 'bg-orange-100 text-orange-700',
  EMERGENCY: 'bg-red-100 text-red-800',
};

export default function ParliamentarySessionsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  const { data, isLoading, error } = useQuery<SessionList>({
    queryKey: ['parliamentary-sessions', statusFilter, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('sessionType', typeFilter);
      return (await apiClient.get(`/parliamentary-sessions?${params}`)).data;
    },
    staleTime: 30_000,
  });

  const sessions = data?.items ?? [];

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary-navy">Parliamentary Sessions</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track legislative reading stages and parliamentary debates
            </p>
          </div>
          <div className="rounded-lg border border-border bg-white px-4 py-2 text-sm text-muted-foreground shadow-sm">
            <span className="font-semibold text-primary-navy">{data?.total ?? 0}</span> session
            {(data?.total ?? 0) !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <div className="flex flex-wrap gap-2">
            {(['', 'UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-primary-navy text-white'
                    : 'border border-border bg-white text-muted-foreground hover:border-primary-navy'
                }`}
              >
                {s || 'All Status'}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {(['', 'ORDINARY', 'EXTRAORDINARY', 'EMERGENCY'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  typeFilter === t
                    ? 'bg-primary-navy text-white'
                    : 'border border-border bg-white text-muted-foreground hover:border-primary-navy'
                }`}
              >
                {t || 'All Types'}
              </button>
            ))}
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            Loading parliamentary sessions...
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Failed to load parliamentary sessions.
          </div>
        )}

        {!isLoading && sessions.length === 0 && (
          <div className="rounded-lg border border-border bg-white p-12 text-center text-muted-foreground">
            No parliamentary sessions found.
          </div>
        )}

        <div className="space-y-3">
          {sessions.map((session) => (
            <Link
              key={session.id}
              href={`/parliamentary-sessions/${session.id}`}
              className="group flex items-start justify-between gap-4 rounded-xl border border-border bg-white p-5 shadow-sm transition-all hover:border-primary-gold hover:shadow-md"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-muted-foreground">
                    {session.sessionNumber}
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[session.status]}`}>
                    {session.status}
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_STYLES[session.sessionType]}`}>
                    {session.sessionType}
                  </span>
                </div>
                <h2 className="mt-1 font-semibold text-primary-navy group-hover:text-primary-gold transition-colors truncate">
                  {session.title}
                </h2>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>
                    {new Date(session.startDate).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                    {session.endDate && ` – ${new Date(session.endDate).toLocaleDateString('en-GB', { dateStyle: 'medium' })}`}
                  </span>
                  {session._count && (
                    <>
                      <span>{session._count.readingStages} reading stage{session._count.readingStages !== 1 ? 's' : ''}</span>
                      <span>{session._count.debates} debate{session._count.debates !== 1 ? 's' : ''}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right text-xs text-muted-foreground">
                <p>{session.createdBy.firstName} {session.createdBy.lastName}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
