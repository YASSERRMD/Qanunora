'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface Meeting {
  id: string;
  title: string;
  description: string | null;
  meetingDate: string;
  location: string | null;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  committee?: { id: string; name: string } | null;
  createdBy: { id: string; firstName: string; lastName: string };
  _count?: { agendaItems: number; attendees: number; actionItems: number };
}

const STATUS_STYLES: Record<Meeting['status'], string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500 line-through',
};

export default function MeetingsPage() {
  const { data: meetings = [], isLoading, error } = useQuery<Meeting[]>({
    queryKey: ['meetings'],
    queryFn: async () => (await apiClient.get('/meetings')).data,
    staleTime: 30_000,
  });

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary-navy">Meetings</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Committee and stakeholder meeting management
            </p>
          </div>
          <div className="rounded-lg border border-border bg-white px-4 py-2 text-sm text-muted-foreground shadow-sm">
            <span className="font-semibold text-primary-navy">{meetings.length}</span> meeting
            {meetings.length !== 1 ? 's' : ''}
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            Loading meetings…
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Failed to load meetings.
          </div>
        )}

        {!isLoading && meetings.length === 0 && (
          <div className="rounded-lg border border-border bg-white p-12 text-center text-muted-foreground">
            No meetings found.
          </div>
        )}

        <div className="space-y-3">
          {meetings.map((meeting) => (
            <Link
              key={meeting.id}
              href={`/meetings/${meeting.id}`}
              className="group flex items-start justify-between gap-4 rounded-xl border border-border bg-white p-5 shadow-sm transition-all hover:border-primary-gold hover:shadow-md"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold text-primary-navy group-hover:text-primary-gold transition-colors truncate">
                    {meeting.title}
                  </h2>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[meeting.status]}`}>
                    {meeting.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>{new Date(meeting.meetingDate).toLocaleDateString('en-GB', { dateStyle: 'medium' })}</span>
                  {meeting.location && <span>📍 {meeting.location}</span>}
                  {meeting.committee && <span>🏛 {meeting.committee.name}</span>}
                </div>
                {meeting._count && (
                  <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                    <span>{meeting._count.agendaItems} agenda items</span>
                    <span>{meeting._count.attendees} attendees</span>
                    <span>{meeting._count.actionItems} action items</span>
                  </div>
                )}
              </div>
              <div className="shrink-0 text-xs text-muted-foreground text-right">
                <p>{meeting.createdBy.firstName} {meeting.createdBy.lastName}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
