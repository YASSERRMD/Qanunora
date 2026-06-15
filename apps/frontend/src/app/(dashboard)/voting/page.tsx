'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

type VoteResult = 'PENDING' | 'PASSED' | 'FAILED' | 'TIED' | 'QUORUM_NOT_MET';

interface VoteEvent {
  id: string;
  title: string;
  description: string | null;
  voteDate: string;
  result: VoteResult;
  totalFor: number;
  totalAgainst: number;
  totalAbstain: number;
  quorumRequired: number | null;
  legislativeItem: { id: string; referenceNumber: string; title: string } | null;
  createdBy: { id: string; firstName: string; lastName: string };
  resolution: { id: string; refNumber: string; title: string } | null;
  _count?: { memberPositions: number };
}

interface VoteList {
  items: VoteEvent[];
  total: number;
  page: number;
  limit: number;
}

const RESULT_STYLES: Record<VoteResult, string> = {
  PENDING: 'bg-gray-100 text-gray-600',
  PASSED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  TIED: 'bg-amber-100 text-amber-700',
  QUORUM_NOT_MET: 'bg-orange-100 text-orange-700',
};

export default function VotingPage() {
  const [resultFilter, setResultFilter] = useState<string>('');

  const { data, isLoading, error } = useQuery<VoteList>({
    queryKey: ['votes', resultFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (resultFilter) params.set('result', resultFilter);
      return (await apiClient.get(`/votes?${params}`)).data;
    },
    staleTime: 30_000,
  });

  const votes = data?.items ?? [];
  const results: Array<VoteResult | ''> = ['', 'PENDING', 'PASSED', 'FAILED', 'TIED', 'QUORUM_NOT_MET'];

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary-navy">Voting Register</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track legislative votes, member positions, and official resolutions
            </p>
          </div>
          <div className="rounded-lg border border-border bg-white px-4 py-2 text-sm text-muted-foreground shadow-sm">
            <span className="font-semibold text-primary-navy">{data?.total ?? 0}</span> vote event
            {(data?.total ?? 0) !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {results.map((r) => (
            <button
              key={r}
              onClick={() => setResultFilter(r)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                resultFilter === r
                  ? 'bg-primary-navy text-white'
                  : 'border border-border bg-white text-muted-foreground hover:border-primary-navy'
              }`}
            >
              {r ? r.replace(/_/g, ' ') : 'All'}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            Loading vote events...
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Failed to load vote events.
          </div>
        )}

        {!isLoading && votes.length === 0 && (
          <div className="rounded-lg border border-border bg-white p-12 text-center text-muted-foreground">
            No vote events found.
          </div>
        )}

        <div className="space-y-3">
          {votes.map((vote) => {
            const total = vote.totalFor + vote.totalAgainst + vote.totalAbstain;
            return (
              <Link
                key={vote.id}
                href={`/voting/${vote.id}`}
                className="group block rounded-xl border border-border bg-white p-5 shadow-sm transition-all hover:border-primary-gold hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${RESULT_STYLES[vote.result]}`}>
                        {vote.result.replace(/_/g, ' ')}
                      </span>
                      {vote.resolution && (
                        <span className="shrink-0 rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-medium text-teal-700">
                          {vote.resolution.refNumber}
                        </span>
                      )}
                    </div>
                    <h2 className="mt-1 font-semibold text-primary-navy group-hover:text-primary-gold transition-colors truncate">
                      {vote.title}
                    </h2>
                    {vote.legislativeItem && (
                      <p className="mt-0.5 text-xs text-muted-foreground truncate">
                        {vote.legislativeItem.referenceNumber} — {vote.legislativeItem.title}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>{new Date(vote.voteDate).toLocaleDateString('en-GB', { dateStyle: 'medium' })}</span>
                      {total > 0 && (
                        <>
                          <span className="text-green-700">{vote.totalFor} for</span>
                          <span className="text-red-700">{vote.totalAgainst} against</span>
                          <span className="text-gray-500">{vote.totalAbstain} abstain</span>
                        </>
                      )}
                      {vote._count && <span>{vote._count.memberPositions} positions recorded</span>}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
