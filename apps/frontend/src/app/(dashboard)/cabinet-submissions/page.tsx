'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

type SubmissionStatus = 'PREPARING' | 'UNDER_REVIEW' | 'APPROVED' | 'SUBMITTED' | 'RETURNED';

interface CabinetSubmission {
  id: string;
  referenceNumber: string;
  title: string;
  status: SubmissionStatus;
  completionPercentage: number;
  legislativeItem: { id: string; referenceNumber: string; title: string };
  preparedBy: { id: string; firstName: string; lastName: string };
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
}

interface SubmissionList {
  items: CabinetSubmission[];
  total: number;
  page: number;
  limit: number;
}

const STATUS_STYLES: Record<SubmissionStatus, string> = {
  PREPARING: 'bg-gray-100 text-gray-600',
  UNDER_REVIEW: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  RETURNED: 'bg-red-100 text-red-700',
};

function ProgressBar({ percentage }: { percentage: number }) {
  const color =
    percentage === 100
      ? 'bg-green-500'
      : percentage >= 80
      ? 'bg-blue-500'
      : percentage >= 50
      ? 'bg-amber-500'
      : 'bg-red-400';

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
        <span>Checklist completion</span>
        <span className="font-medium">{percentage}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-100">
        <div
          className={`h-1.5 rounded-full transition-all ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default function CabinetSubmissionsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading, error } = useQuery<SubmissionList>({
    queryKey: ['cabinet-submissions', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      return (await apiClient.get(`/cabinet-submissions?${params}`)).data;
    },
    staleTime: 30_000,
  });

  const submissions = data?.items ?? [];
  const statuses: Array<SubmissionStatus | ''> = ['', 'PREPARING', 'UNDER_REVIEW', 'APPROVED', 'SUBMITTED', 'RETURNED'];

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary-navy">Cabinet Submissions</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage cabinet submission packages with checklist tracking
            </p>
          </div>
          <div className="rounded-lg border border-border bg-white px-4 py-2 text-sm text-muted-foreground shadow-sm">
            <span className="font-semibold text-primary-navy">{data?.total ?? 0}</span> submission
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
            Loading cabinet submissions...
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Failed to load cabinet submissions.
          </div>
        )}

        {!isLoading && submissions.length === 0 && (
          <div className="rounded-lg border border-border bg-white p-12 text-center text-muted-foreground">
            No cabinet submissions found.
          </div>
        )}

        <div className="space-y-3">
          {submissions.map((submission) => (
            <Link
              key={submission.id}
              href={`/cabinet-submissions/${submission.id}`}
              className="group block rounded-xl border border-border bg-white p-5 shadow-sm transition-all hover:border-primary-gold hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-muted-foreground">
                      {submission.referenceNumber}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[submission.status]}`}
                    >
                      {submission.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <h2 className="mt-1 font-semibold text-primary-navy group-hover:text-primary-gold transition-colors truncate">
                    {submission.title}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground truncate">
                    {submission.legislativeItem.referenceNumber} — {submission.legislativeItem.title}
                  </p>
                  <ProgressBar percentage={submission.completionPercentage} />
                </div>
                <div className="shrink-0 text-right text-xs text-muted-foreground">
                  <p>{submission.preparedBy.firstName} {submission.preparedBy.lastName}</p>
                  {submission.submittedAt && (
                    <p className="mt-1">
                      Submitted: {new Date(submission.submittedAt).toLocaleDateString('en-GB')}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
