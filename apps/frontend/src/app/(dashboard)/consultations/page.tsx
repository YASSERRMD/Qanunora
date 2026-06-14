'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  OPEN: 'bg-green-100 text-green-700',
  CLOSED: 'bg-red-100 text-red-700',
  REVIEWING: 'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
};

interface Consultation {
  id: string;
  title: string;
  description?: string;
  status: string;
  openDate?: string;
  closeDate?: string;
  createdAt: string;
  legislativeItem: { referenceNumber: string; title: string };
  _count: { feedback: number };
}

export default function ConsultationsPage() {
  const router = useRouter();

  const { data: consultations, isLoading } = useQuery({
    queryKey: ['consultations'],
    queryFn: async () => {
      const res = await apiClient.get<Consultation[]>('/consultations');
      return res.data;
    },
  });

  const now = new Date();

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary-navy">Public Consultations</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage public feedback and stakeholder consultations
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground">Loading consultations...</div>
        ) : (
          <div className="space-y-3">
            {consultations?.map((consultation) => {
              const isOpen = consultation.status === 'OPEN';
              const closeDate = consultation.closeDate ? new Date(consultation.closeDate) : null;
              const daysLeft = closeDate ? Math.ceil((closeDate.getTime() - now.getTime()) / 86400000) : null;

              return (
                <div
                  key={consultation.id}
                  onClick={() => router.push(`/consultations/${consultation.id}`)}
                  className="rounded-xl border border-border bg-white p-5 shadow-sm cursor-pointer hover:border-primary-gold hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            STATUS_COLORS[consultation.status] ?? 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {consultation.status}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {consultation.legislativeItem.referenceNumber}
                        </span>
                        {isOpen && daysLeft !== null && (
                          <span
                            className={`text-xs font-medium ${
                              daysLeft <= 7 ? 'text-red-600' : 'text-muted-foreground'
                            }`}
                          >
                            {daysLeft > 0 ? `${daysLeft} days left` : 'Closing today'}
                          </span>
                        )}
                      </div>
                      <h2 className="font-semibold text-primary-navy">{consultation.title}</h2>
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">
                        {consultation.legislativeItem.title}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-2xl font-bold text-primary-navy">
                        {consultation._count.feedback}
                      </p>
                      <p className="text-xs text-muted-foreground">responses</p>
                    </div>
                  </div>

                  {(consultation.openDate || consultation.closeDate) && (
                    <div className="mt-3 pt-3 border-t border-border flex gap-6 text-xs text-muted-foreground">
                      {consultation.openDate && (
                        <span>
                          Opened: {new Date(consultation.openDate).toLocaleDateString()}
                        </span>
                      )}
                      {consultation.closeDate && (
                        <span>
                          Closes: {new Date(consultation.closeDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {!consultations?.length && (
              <div className="py-16 text-center text-muted-foreground">
                No consultations found
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
