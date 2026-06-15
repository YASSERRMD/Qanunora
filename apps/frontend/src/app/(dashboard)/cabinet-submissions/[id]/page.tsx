'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

type SubmissionStatus = 'PREPARING' | 'UNDER_REVIEW' | 'APPROVED' | 'SUBMITTED' | 'RETURNED';

interface ChecklistItem {
  id: string;
  item: string;
  category: string;
  isCompleted: boolean;
  completedAt: string | null;
  evidence: string | null;
  order: number;
}

interface CabinetSubmission {
  id: string;
  referenceNumber: string;
  title: string;
  status: SubmissionStatus;
  notes: string | null;
  legislativeItem: { id: string; referenceNumber: string; title: string; type: string; status: string };
  preparedBy: { id: string; firstName: string; lastName: string };
  checklist: ChecklistItem[];
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
}

interface PackageSummary {
  referenceNumber: string;
  title: string;
  status: string;
  checklist: {
    total: number;
    completed: number;
    pending: number;
    completionPercentage: number;
  };
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
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-muted-foreground">Overall completion</span>
        <span className="font-semibold text-primary-navy">{percentage}%</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-gray-100">
        <div className={`h-2.5 rounded-full transition-all ${color}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

export default function CabinetSubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: submission, isLoading } = useQuery<CabinetSubmission>({
    queryKey: ['cabinet-submission', id],
    queryFn: async () => (await apiClient.get(`/cabinet-submissions/${id}`)).data,
    enabled: !!id,
    staleTime: 30_000,
  });

  const { data: summary } = useQuery<PackageSummary>({
    queryKey: ['cabinet-submission-summary', id],
    queryFn: async () => (await apiClient.get(`/cabinet-submissions/${id}/summary`)).data,
    enabled: !!id,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <main className="flex-1 p-8">
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          Loading cabinet submission...
        </div>
      </main>
    );
  }

  if (!submission) {
    return (
      <main className="flex-1 p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Cabinet submission not found.
        </div>
      </main>
    );
  }

  const checklistByCategory = submission.checklist.reduce<Record<string, ChecklistItem[]>>(
    (acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    },
    {},
  );

  const completedCount = submission.checklist.filter((c) => c.isCompleted).length;
  const percentage = submission.checklist.length > 0
    ? Math.round((completedCount / submission.checklist.length) * 100)
    : 0;

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm text-muted-foreground">
                  {submission.referenceNumber}
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[submission.status]}`}>
                  {submission.status.replace(/_/g, ' ')}
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-bold text-primary-navy">{submission.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {submission.legislativeItem.referenceNumber} — {submission.legislativeItem.title}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Prepared By</p>
              <p className="font-medium text-primary-navy">
                {submission.preparedBy.firstName} {submission.preparedBy.lastName}
              </p>
            </div>
            {submission.submittedAt && (
              <div>
                <p className="text-xs text-muted-foreground">Submitted</p>
                <p className="font-medium text-primary-navy">
                  {new Date(submission.submittedAt).toLocaleDateString('en-GB', { dateStyle: 'long' })}
                </p>
              </div>
            )}
            {submission.approvedAt && (
              <div>
                <p className="text-xs text-muted-foreground">Approved</p>
                <p className="font-medium text-primary-navy">
                  {new Date(submission.approvedAt).toLocaleDateString('en-GB', { dateStyle: 'long' })}
                </p>
              </div>
            )}
          </div>

          <div className="mt-4">
            <ProgressBar percentage={percentage} />
            <p className="mt-1 text-xs text-muted-foreground">
              {completedCount} of {submission.checklist.length} items completed
            </p>
          </div>

          {submission.notes && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <p className="font-medium text-xs mb-1">Notes</p>
              {submission.notes}
            </div>
          )}
        </div>

        {/* Checklist */}
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-primary-navy">
            Submission Checklist
          </h2>

          <div className="space-y-4">
            {Object.entries(checklistByCategory).map(([category, items]) => (
              <div key={category}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {category}
                </h3>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3 rounded-lg border p-3 ${
                        item.isCompleted
                          ? 'border-green-200 bg-green-50'
                          : 'border-border bg-gray-50'
                      }`}
                    >
                      <div className={`mt-0.5 h-4 w-4 shrink-0 rounded border-2 ${
                        item.isCompleted
                          ? 'border-green-500 bg-green-500'
                          : 'border-gray-300 bg-white'
                      }`}>
                        {item.isCompleted && (
                          <svg viewBox="0 0 12 12" fill="none" className="h-full w-full p-0.5">
                            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium ${item.isCompleted ? 'text-green-800' : 'text-primary-navy'}`}>
                          {item.item}
                        </p>
                        {item.evidence && (
                          <p className="mt-0.5 text-xs text-muted-foreground">Evidence: {item.evidence}</p>
                        )}
                      </div>
                      {item.completedAt && (
                        <span className="shrink-0 text-xs text-green-700">
                          {new Date(item.completedAt).toLocaleDateString('en-GB')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Package Summary Panel */}
        {summary && (
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-semibold text-primary-navy">Package Summary</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-border bg-gray-50 p-3 text-center">
                <p className="text-2xl font-bold text-primary-navy">{summary.checklist.total}</p>
                <p className="text-xs text-muted-foreground">Total Items</p>
              </div>
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{summary.checklist.completed}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
                <p className="text-2xl font-bold text-amber-700">{summary.checklist.pending}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center">
                <p className="text-2xl font-bold text-blue-700">
                  {summary.checklist.completionPercentage}%
                </p>
                <p className="text-xs text-muted-foreground">Complete</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
