'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

const TYPE_COLORS: Record<string, string> = {
  GOVERNMENT_ENTITY: 'bg-primary-navy/10 text-primary-navy',
  PRIVATE_SECTOR: 'bg-primary-gold/20 text-primary-navy',
  NGO: 'bg-green-100 text-green-700',
  ACADEMIC: 'bg-blue-100 text-blue-700',
  PUBLIC_REPRESENTATIVE: 'bg-purple-100 text-purple-700',
  INDIVIDUAL: 'bg-gray-100 text-gray-700',
  INTERNATIONAL_ORGANIZATION: 'bg-teal-100 text-teal-700',
};

const DIRECTION_COLORS: Record<string, string> = {
  OUTBOUND: 'bg-blue-100 text-blue-700',
  INBOUND: 'bg-green-100 text-green-700',
};

interface CommunicationLog {
  id: string;
  subject: string;
  content: string;
  channel: string;
  direction: string;
  sentAt?: string;
  createdAt: string;
}

interface StakeholderDetail {
  id: string;
  name: string;
  nameAr?: string;
  type: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  website?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { communicationLogs: number; consultationFeedback: number };
}

export default function StakeholderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: stakeholder, isLoading } = useQuery({
    queryKey: ['stakeholder', id],
    queryFn: async () => {
      const res = await apiClient.get<StakeholderDetail>(`/stakeholders/${id}`);
      return res.data;
    },
  });

  const { data: logs, isLoading: loadingLogs } = useQuery({
    queryKey: ['stakeholder-communications', id],
    queryFn: async () => {
      const res = await apiClient.get<CommunicationLog[]>(`/stakeholders/${id}/communications`);
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <main className="flex-1 p-8">
        <div className="flex items-center justify-center py-24 text-muted-foreground">Loading...</div>
      </main>
    );
  }

  if (!stakeholder) return null;

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-sm text-muted-foreground hover:text-primary-navy"
          >
            Back
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  TYPE_COLORS[stakeholder.type] ?? 'bg-gray-100 text-gray-700'
                }`}
              >
                {stakeholder.type.replace(/_/g, ' ')}
              </span>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  stakeholder.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {stakeholder.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-bold text-primary-navy">{stakeholder.name}</h1>
            {stakeholder.nameAr && (
              <p className="mt-0.5 text-sm text-muted-foreground text-right" dir="rtl">
                {stakeholder.nameAr}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="rounded-xl border border-border bg-white p-4 text-center">
            <p className="text-2xl font-bold text-primary-navy">{stakeholder._count.communicationLogs}</p>
            <p className="text-xs text-muted-foreground mt-1">Communications</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-4 text-center">
            <p className="text-2xl font-bold text-primary-navy">{stakeholder._count.consultationFeedback}</p>
            <p className="text-xs text-muted-foreground mt-1">Consultation Responses</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-white shadow-sm p-5">
            <h2 className="font-semibold text-primary-navy mb-4">Profile</h2>
            <dl className="space-y-3 text-sm">
              {stakeholder.contactEmail && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="font-medium text-primary-navy text-right">{stakeholder.contactEmail}</dd>
                </div>
              )}
              {stakeholder.contactPhone && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Phone</dt>
                  <dd className="font-medium text-primary-navy">{stakeholder.contactPhone}</dd>
                </div>
              )}
              {stakeholder.address && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Address</dt>
                  <dd className="font-medium text-primary-navy text-right max-w-[200px]">
                    {stakeholder.address}
                  </dd>
                </div>
              )}
              {stakeholder.website && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Website</dt>
                  <dd className="font-medium text-primary-navy">
                    <a
                      href={stakeholder.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-gold hover:underline"
                    >
                      {stakeholder.website}
                    </a>
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Registered</dt>
                <dd className="font-medium text-primary-navy">
                  {new Date(stakeholder.createdAt).toLocaleDateString()}
                </dd>
              </div>
            </dl>

            {stakeholder.description && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Description
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">{stakeholder.description}</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-primary-navy">Communication Log</h2>
            </div>

            {loadingLogs ? (
              <div className="p-6 text-center text-muted-foreground">Loading...</div>
            ) : !logs?.length ? (
              <div className="p-6 text-center text-muted-foreground">No communications logged yet</div>
            ) : (
              <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
                {logs.map((log) => (
                  <div key={log.id} className="px-5 py-3">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${
                          DIRECTION_COLORS[log.direction] ?? 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {log.direction}
                      </span>
                      <span className="text-xs text-muted-foreground">{log.channel}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {log.sentAt
                          ? new Date(log.sentAt).toLocaleDateString()
                          : new Date(log.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-primary-navy mb-0.5">{log.subject}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{log.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
