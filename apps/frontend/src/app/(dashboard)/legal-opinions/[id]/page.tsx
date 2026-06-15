'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

type OpinionStatus = 'REQUESTED' | 'ASSIGNED' | 'DRAFTING' | 'UNDER_REVIEW' | 'APPROVED' | 'ISSUED' | 'WITHDRAWN';
type Priority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';

interface OpinionVersion {
  id: string;
  versionNumber: number;
  content: string;
  isApproved: boolean;
  approvedAt: string | null;
  author: { id: string; firstName: string; lastName: string };
  createdAt: string;
}

interface LegalOpinion {
  id: string;
  referenceNumber: string;
  subject: string;
  status: OpinionStatus;
  priority: Priority;
  dueDate: string | null;
  references: string[];
  requestedBy: { id: string; firstName: string; lastName: string; email: string };
  assignedTo: { id: string; firstName: string; lastName: string; email: string } | null;
  legislativeItem: { id: string; referenceNumber: string; title: string } | null;
  versions: OpinionVersion[];
  createdAt: string;
  updatedAt: string;
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

export default function LegalOpinionDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: opinion, isLoading, error } = useQuery<LegalOpinion>({
    queryKey: ['legal-opinion', id],
    queryFn: async () => (await apiClient.get(`/legal-opinions/${id}`)).data,
    enabled: !!id,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <main className="flex-1 p-8">
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          Loading legal opinion...
        </div>
      </main>
    );
  }

  if (error || !opinion) {
    return (
      <main className="flex-1 p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Legal opinion not found.
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
                <span className="font-mono text-sm text-muted-foreground">
                  {opinion.referenceNumber}
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[opinion.status]}`}>
                  {opinion.status.replace(/_/g, ' ')}
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${PRIORITY_STYLES[opinion.priority]}`}>
                  {opinion.priority}
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-bold text-primary-navy">{opinion.subject}</h1>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Requested By</p>
              <p className="font-medium text-primary-navy">
                {opinion.requestedBy.firstName} {opinion.requestedBy.lastName}
              </p>
            </div>
            {opinion.assignedTo && (
              <div>
                <p className="text-xs text-muted-foreground">Assigned To</p>
                <p className="font-medium text-primary-navy">
                  {opinion.assignedTo.firstName} {opinion.assignedTo.lastName}
                </p>
              </div>
            )}
            {opinion.dueDate && (
              <div>
                <p className="text-xs text-muted-foreground">Due Date</p>
                <p className="font-medium text-primary-navy">
                  {new Date(opinion.dueDate).toLocaleDateString('en-GB', { dateStyle: 'long' })}
                </p>
              </div>
            )}
            {opinion.legislativeItem && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Related Legislative Item</p>
                <p className="font-medium text-primary-navy">
                  {opinion.legislativeItem.referenceNumber} — {opinion.legislativeItem.title}
                </p>
              </div>
            )}
          </div>

          {opinion.references.length > 0 && (
            <div className="mt-4">
              <p className="mb-1 text-xs text-muted-foreground">References</p>
              <div className="flex flex-wrap gap-2">
                {opinion.references.map((ref, i) => (
                  <span key={i} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                    {ref}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Version History */}
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-primary-navy">
            Version History{' '}
            <span className="text-sm font-normal text-muted-foreground">
              ({opinion.versions.length} version{opinion.versions.length !== 1 ? 's' : ''})
            </span>
          </h2>

          {opinion.versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No versions yet.</p>
          ) : (
            <div className="space-y-4">
              {opinion.versions.map((v) => (
                <div
                  key={v.id}
                  className={`rounded-lg border p-4 ${
                    v.isApproved
                      ? 'border-green-200 bg-green-50'
                      : 'border-border bg-gray-50'
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-primary-navy text-sm">
                        Version {v.versionNumber}
                      </span>
                      {v.isApproved && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          Approved
                        </span>
                      )}
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{v.author.firstName} {v.author.lastName}</p>
                      <p>{new Date(v.createdAt).toLocaleDateString('en-GB')}</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">
                    {v.content}
                  </p>
                  {v.approvedAt && (
                    <p className="mt-2 text-xs text-green-700">
                      Approved on {new Date(v.approvedAt).toLocaleDateString('en-GB')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
