'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

type VoteResult = 'PENDING' | 'PASSED' | 'FAILED' | 'TIED' | 'QUORUM_NOT_MET';
type VotePosition = 'FOR' | 'AGAINST' | 'ABSTAIN';

interface MemberVotePosition {
  id: string;
  memberId: string;
  member: { id: string; firstName: string; lastName: string };
  position: VotePosition;
  note: string | null;
  votedAt: string;
}

interface Resolution {
  id: string;
  refNumber: string;
  title: string;
  text: string;
  effectiveDate: string | null;
  issuedAt: string | null;
}

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
  memberPositions: MemberVotePosition[];
  resolution: Resolution | null;
  createdAt: string;
}

interface VoteAnalytics {
  totalVotes: number;
  result: VoteResult;
  breakdown: {
    for: { count: number; percentage: number };
    against: { count: number; percentage: number };
    abstain: { count: number; percentage: number };
  };
  quorumRequired: number | null;
  quorumMet: boolean | null;
}

const RESULT_STYLES: Record<VoteResult, string> = {
  PENDING: 'bg-gray-100 text-gray-600',
  PASSED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  TIED: 'bg-amber-100 text-amber-700',
  QUORUM_NOT_MET: 'bg-orange-100 text-orange-700',
};

const POSITION_STYLES: Record<VotePosition, string> = {
  FOR: 'bg-green-100 text-green-700',
  AGAINST: 'bg-red-100 text-red-700',
  ABSTAIN: 'bg-gray-100 text-gray-600',
};

function VoteBar({ forPct, againstPct, abstainPct }: { forPct: number; againstPct: number; abstainPct: number }) {
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full">
      <div className="bg-green-500 transition-all" style={{ width: `${forPct}%` }} title={`For: ${forPct}%`} />
      <div className="bg-red-400 transition-all" style={{ width: `${againstPct}%` }} title={`Against: ${againstPct}%`} />
      <div className="bg-gray-300 transition-all" style={{ width: `${abstainPct}%` }} title={`Abstain: ${abstainPct}%`} />
    </div>
  );
}

export default function VoteDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: vote, isLoading } = useQuery<VoteEvent>({
    queryKey: ['vote', id],
    queryFn: async () => (await apiClient.get(`/votes/${id}`)).data,
    enabled: !!id,
    staleTime: 30_000,
  });

  const { data: analytics } = useQuery<VoteAnalytics>({
    queryKey: ['vote-analytics', id],
    queryFn: async () => (await apiClient.get(`/votes/${id}/analytics`)).data,
    enabled: !!id,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <main className="flex-1 p-8">
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          Loading vote event...
        </div>
      </main>
    );
  }

  if (!vote) {
    return (
      <main className="flex-1 p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Vote event not found.
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${RESULT_STYLES[vote.result]}`}>
                  {vote.result.replace(/_/g, ' ')}
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-bold text-primary-navy">{vote.title}</h1>
              {vote.description && (
                <p className="mt-1 text-sm text-muted-foreground">{vote.description}</p>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Vote Date</p>
              <p className="font-medium text-primary-navy">
                {new Date(vote.voteDate).toLocaleDateString('en-GB', { dateStyle: 'long' })}
              </p>
            </div>
            {vote.legislativeItem && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Legislative Item</p>
                <p className="font-medium text-primary-navy">
                  {vote.legislativeItem.referenceNumber} — {vote.legislativeItem.title}
                </p>
              </div>
            )}
            {vote.quorumRequired && (
              <div>
                <p className="text-xs text-muted-foreground">Quorum Required</p>
                <p className="font-medium text-primary-navy">{vote.quorumRequired} votes</p>
              </div>
            )}
          </div>
        </div>

        {/* Vote Analytics */}
        {analytics && (
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-semibold text-primary-navy">Vote Results</h2>

            <div className="mb-4">
              <VoteBar
                forPct={analytics.breakdown.for.percentage}
                againstPct={analytics.breakdown.against.percentage}
                abstainPct={analytics.breakdown.abstain.percentage}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{analytics.breakdown.for.count}</p>
                <p className="text-xs text-muted-foreground">For</p>
                <p className="text-sm font-medium text-green-700">{analytics.breakdown.for.percentage}%</p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
                <p className="text-2xl font-bold text-red-700">{analytics.breakdown.against.count}</p>
                <p className="text-xs text-muted-foreground">Against</p>
                <p className="text-sm font-medium text-red-700">{analytics.breakdown.against.percentage}%</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center">
                <p className="text-2xl font-bold text-gray-600">{analytics.breakdown.abstain.count}</p>
                <p className="text-xs text-muted-foreground">Abstain</p>
                <p className="text-sm font-medium text-gray-600">{analytics.breakdown.abstain.percentage}%</p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Total votes cast: <span className="font-medium text-primary-navy">{analytics.totalVotes}</span>
              </span>
              {analytics.quorumRequired !== null && (
                <span className={analytics.quorumMet ? 'text-green-700' : 'text-red-700'}>
                  Quorum {analytics.quorumMet ? 'met' : 'not met'} (required {analytics.quorumRequired})
                </span>
              )}
            </div>
          </div>
        )}

        {/* Resolution Panel */}
        {vote.resolution && (
          <div className="rounded-xl border border-teal-200 bg-teal-50 p-6 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-teal-800">Official Resolution</h2>
              <span className="font-mono text-sm font-semibold text-teal-700">
                {vote.resolution.refNumber}
              </span>
            </div>
            <h3 className="font-medium text-primary-navy mb-2">{vote.resolution.title}</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{vote.resolution.text}</p>
            <div className="mt-3 flex gap-4 text-xs text-teal-700">
              {vote.resolution.issuedAt && (
                <span>Issued: {new Date(vote.resolution.issuedAt).toLocaleDateString('en-GB')}</span>
              )}
              {vote.resolution.effectiveDate && (
                <span>Effective: {new Date(vote.resolution.effectiveDate).toLocaleDateString('en-GB')}</span>
              )}
            </div>
          </div>
        )}

        {/* Member Positions */}
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-primary-navy">
            Member Positions{' '}
            <span className="text-sm font-normal text-muted-foreground">
              ({vote.memberPositions.length})
            </span>
          </h2>

          {vote.memberPositions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No positions recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {vote.memberPositions.map((pos) => (
                <div
                  key={pos.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${POSITION_STYLES[pos.position]}`}>
                      {pos.position}
                    </span>
                    <span className="text-sm font-medium text-primary-navy">
                      {pos.member.firstName} {pos.member.lastName}
                    </span>
                  </div>
                  <div className="text-right">
                    {pos.note && (
                      <p className="text-xs text-muted-foreground italic">{pos.note}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(pos.votedAt).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
