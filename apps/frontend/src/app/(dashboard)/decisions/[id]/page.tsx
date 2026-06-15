'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

type DecisionStatus = 'ACTIVE' | 'SUPERSEDED' | 'REVOKED';

interface DecisionLink {
  id: string;
  entityType: string;
  entityId: string;
  linkNote: string | null;
  createdAt: string;
}

interface Decision {
  id: string;
  referenceNumber: string;
  title: string;
  description: string;
  rationale: string | null;
  decisionDate: string;
  status: DecisionStatus;
  owner: { id: string; firstName: string; lastName: string; email: string };
  createdBy: { id: string; firstName: string; lastName: string };
  linkedItems: DecisionLink[];
  createdAt: string;
  updatedAt: string;
}

const STATUS_STYLES: Record<DecisionStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  SUPERSEDED: 'bg-amber-100 text-amber-700',
  REVOKED: 'bg-red-100 text-red-700',
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  legislative_item: 'Legislative Item',
  amendment: 'Amendment',
  document: 'Document',
  meeting: 'Meeting',
};

export default function DecisionDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: decision, isLoading, error } = useQuery<Decision>({
    queryKey: ['decision', id],
    queryFn: async () => (await apiClient.get(`/decisions/${id}`)).data,
    enabled: !!id,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <main className="flex-1 p-8">
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          Loading decision...
        </div>
      </main>
    );
  }

  if (error || !decision) {
    return (
      <main className="flex-1 p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Decision not found.
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
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono text-sm text-muted-foreground">
                  {decision.referenceNumber}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[decision.status]}`}
                >
                  {decision.status}
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-bold text-primary-navy">{decision.title}</h1>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Decision Date</p>
              <p className="font-medium text-primary-navy">
                {new Date(decision.decisionDate).toLocaleDateString('en-GB', {
                  dateStyle: 'long',
                })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Owner</p>
              <p className="font-medium text-primary-navy">
                {decision.owner.firstName} {decision.owner.lastName}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Created By</p>
              <p className="font-medium text-primary-navy">
                {decision.createdBy.firstName} {decision.createdBy.lastName}
              </p>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-3 font-semibold text-primary-navy">Description</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{decision.description}</p>
        </div>

        {/* Rationale */}
        {decision.rationale && (
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="mb-3 font-semibold text-primary-navy">Rationale</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{decision.rationale}</p>
          </div>
        )}

        {/* Linked Entities */}
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-primary-navy">
            Linked Entities{' '}
            <span className="text-sm font-normal text-muted-foreground">
              ({decision.linkedItems.length})
            </span>
          </h2>

          {decision.linkedItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No linked entities.</p>
          ) : (
            <div className="space-y-2">
              {decision.linkedItems.map((link) => (
                <div
                  key={link.id}
                  className="flex items-start gap-3 rounded-lg border border-border p-3"
                >
                  <span className="shrink-0 rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                    {ENTITY_TYPE_LABELS[link.entityType] ?? link.entityType}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs text-muted-foreground">{link.entityId}</p>
                    {link.linkNote && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{link.linkNote}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(link.createdAt).toLocaleDateString('en-GB')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
