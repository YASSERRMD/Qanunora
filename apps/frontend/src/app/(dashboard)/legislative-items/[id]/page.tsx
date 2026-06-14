'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

const STATUS_COLORS: Record<string, string> = {
  DRAFTING: 'bg-gray-100 text-gray-700',
  INTERNAL_REVIEW: 'bg-blue-100 text-blue-700',
  COMMITTEE_REVIEW: 'bg-purple-100 text-purple-700',
  PUBLIC_CONSULTATION: 'bg-orange-100 text-orange-700',
  LEGAL_REVIEW: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  PUBLISHED: 'bg-teal-100 text-teal-700',
  ARCHIVED: 'bg-red-100 text-red-700',
};

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: 'text-red-600',
  HIGH: 'text-orange-500',
  MEDIUM: 'text-yellow-500',
  LOW: 'text-green-500',
};

interface LegislativeItemDetail {
  id: string;
  referenceNumber: string;
  title: string;
  titleAr?: string;
  type: string;
  status: string;
  priority: string;
  confidentialityLevel: string;
  description?: string;
  objective?: string;
  targetEnactmentDate?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  ministry: { name: string; code: string };
  createdBy: { firstName: string; lastName: string; email: string };
  assignedTo?: { firstName: string; lastName: string; email: string };
  _count: { documents: number; workflowHistory: number; amendments: number };
}

export default function LegislativeItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: item, isLoading } = useQuery({
    queryKey: ['legislative-item', id],
    queryFn: async () => {
      const res = await apiClient.get<LegislativeItemDetail>(`/legislative-items/${id}`);
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <main className="flex-1 p-8">
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          Loading...
        </div>
      </main>
    );
  }

  if (!item) return null;

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-sm text-muted-foreground hover:text-primary-navy"
          >
            ← Back
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-muted-foreground border border-border rounded px-2 py-0.5">
                {item.referenceNumber}
              </span>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  STATUS_COLORS[item.status] ?? 'bg-gray-100 text-gray-700'
                }`}
              >
                {item.status.replace(/_/g, ' ')}
              </span>
              <span className={`text-xs font-medium ${PRIORITY_COLORS[item.priority] ?? ''}`}>
                {item.priority}
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-bold text-primary-navy">{item.title}</h1>
            {item.titleAr && (
              <p className="mt-0.5 text-sm text-muted-foreground text-right" dir="rtl">
                {item.titleAr}
              </p>
            )}
          </div>
          <button
            onClick={() => router.push(`/legislative-items/${id}/edit`)}
            className="rounded-lg border border-primary-gold px-4 py-2 text-sm font-medium text-primary-navy hover:bg-primary-gold/10 transition-colors"
          >
            Edit
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Documents', value: item._count.documents },
            { label: 'Workflow Events', value: item._count.workflowHistory },
            { label: 'Amendments', value: item._count.amendments },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-border bg-white p-4 shadow-sm text-center"
            >
              <p className="text-2xl font-bold text-primary-navy">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-primary-navy mb-4">Details</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Type</dt>
                <dd className="font-medium text-primary-navy">{item.type.replace(/_/g, ' ')}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Ministry</dt>
                <dd className="font-medium text-primary-navy">{item.ministry?.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Confidentiality</dt>
                <dd className="font-medium text-primary-navy">{item.confidentialityLevel}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Created By</dt>
                <dd className="font-medium text-primary-navy">
                  {item.createdBy.firstName} {item.createdBy.lastName}
                </dd>
              </div>
              {item.assignedTo && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Assigned To</dt>
                  <dd className="font-medium text-primary-navy">
                    {item.assignedTo.firstName} {item.assignedTo.lastName}
                  </dd>
                </div>
              )}
              {item.targetEnactmentDate && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Target Enactment</dt>
                  <dd className="font-medium text-primary-navy">
                    {new Date(item.targetEnactmentDate).toLocaleDateString()}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-primary-navy mb-4">Description & Objective</h2>
            {item.description ? (
              <p className="text-sm text-muted-foreground mb-4">{item.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground/60 italic mb-4">No description provided</p>
            )}
            {item.objective && (
              <>
                <h3 className="text-xs font-semibold text-primary-navy mb-2">Objective</h3>
                <p className="text-sm text-muted-foreground">{item.objective}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
