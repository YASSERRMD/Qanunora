'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgendaItem {
  id: string; title: string; description: string | null;
  order: number; duration: number | null; presenter: string | null;
}

interface MeetingMinutes {
  id: string; content: string; recordedBy: string; approvedAt: string | null;
}

interface MeetingDecision {
  id: string; description: string; decisionRef: string | null;
  ownerId: string | null; dueDate: string | null;
}

interface ActionItem {
  id: string; description: string; assigneeId: string | null;
  dueDate: string | null; status: string;
}

interface Attendee {
  id: string; attended: boolean;
  user: { id: string; firstName: string; lastName: string; email: string };
}

interface Meeting {
  id: string;
  title: string;
  description: string | null;
  meetingDate: string;
  location: string | null;
  status: string;
  committee?: { id: string; name: string } | null;
  createdBy: { id: string; firstName: string; lastName: string };
  agendaItems: AgendaItem[];
  minutes: MeetingMinutes | null;
  decisions: MeetingDecision[];
  actionItems: ActionItem[];
  attendees: Attendee[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

const ACTION_STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-blue-50 text-blue-600',
  IN_PROGRESS: 'bg-amber-50 text-amber-600',
  COMPLETED: 'bg-green-50 text-green-600',
  CANCELLED: 'bg-gray-50 text-gray-400',
};

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-white shadow-sm">
      <div className="border-b border-border px-6 py-4">
        <h2 className="font-semibold text-primary-navy">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: meeting, isLoading, error } = useQuery<Meeting>({
    queryKey: ['meeting', id],
    queryFn: async () => (await apiClient.get(`/meetings/${id}`)).data,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <main className="flex-1 p-8">
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          Loading meeting…
        </div>
      </main>
    );
  }

  if (error || !meeting) {
    return (
      <main className="flex-1 p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load meeting.
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-auto p-8">
      <div className="mx-auto max-w-4xl">
        {/* Breadcrumb */}
        <div className="mb-6 text-sm text-muted-foreground">
          <Link href="/meetings" className="hover:text-primary-navy">Meetings</Link>
          <span className="mx-2">/</span>
          <span className="text-primary-navy font-medium">{meeting.title}</span>
        </div>

        {/* Header */}
        <div className="mb-8 rounded-xl border border-border bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-primary-navy">{meeting.title}</h1>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[meeting.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {meeting.status.replace(/_/g, ' ')}
                </span>
              </div>
              {meeting.description && (
                <p className="mt-2 text-sm text-muted-foreground">{meeting.description}</p>
              )}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Date</p>
              <p className="font-medium text-primary-navy">
                {new Date(meeting.meetingDate).toLocaleDateString('en-GB', { dateStyle: 'long' })}
              </p>
            </div>
            {meeting.location && (
              <div>
                <p className="text-xs text-muted-foreground">Location</p>
                <p className="font-medium text-primary-navy">{meeting.location}</p>
              </div>
            )}
            {meeting.committee && (
              <div>
                <p className="text-xs text-muted-foreground">Committee</p>
                <p className="font-medium text-primary-navy">{meeting.committee.name}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Created by</p>
              <p className="font-medium text-primary-navy">
                {meeting.createdBy.firstName} {meeting.createdBy.lastName}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Agenda */}
          <SectionCard title={`Agenda (${meeting.agendaItems.length})`}>
            {meeting.agendaItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No agenda items.</p>
            ) : (
              <ol className="space-y-3">
                {meeting.agendaItems.map((item) => (
                  <li key={item.id} className="flex gap-4">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-navy text-white text-xs font-bold">
                      {item.order}
                    </span>
                    <div>
                      <p className="font-medium text-primary-navy">{item.title}</p>
                      {item.description && (
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      )}
                      <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                        {item.duration && <span>{item.duration} min</span>}
                        {item.presenter && <span>Presenter: {item.presenter}</span>}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>

          {/* Attendees */}
          <SectionCard title={`Attendees (${meeting.attendees.length})`}>
            {meeting.attendees.length === 0 ? (
              <p className="text-sm text-muted-foreground">No attendees registered.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {meeting.attendees.map((a) => (
                  <div key={a.id} className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full ${a.attended ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <div>
                      <p className="text-sm font-medium text-primary-navy">
                        {a.user.firstName} {a.user.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">{a.user.email}</p>
                    </div>
                    {a.attended && (
                      <span className="ml-auto text-xs text-green-600 font-medium">Attended</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Minutes */}
          <SectionCard title="Meeting Minutes">
            {!meeting.minutes ? (
              <p className="text-sm text-muted-foreground">No minutes recorded yet.</p>
            ) : (
              <div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                  <span>Recorded by: {meeting.minutes.recordedBy}</span>
                  {meeting.minutes.approvedAt && (
                    <span>Approved: {new Date(meeting.minutes.approvedAt).toLocaleDateString()}</span>
                  )}
                </div>
                <div className="prose prose-sm max-w-none text-sm text-primary-navy whitespace-pre-wrap">
                  {meeting.minutes.content}
                </div>
              </div>
            )}
          </SectionCard>

          {/* Decisions */}
          <SectionCard title={`Decisions (${meeting.decisions.length})`}>
            {meeting.decisions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No decisions recorded.</p>
            ) : (
              <div className="space-y-3">
                {meeting.decisions.map((d) => (
                  <div key={d.id} className="rounded-lg bg-blue-50 p-3">
                    <p className="text-sm font-medium text-primary-navy">{d.description}</p>
                    <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
                      {d.decisionRef && <span>Ref: {d.decisionRef}</span>}
                      {d.dueDate && <span>Due: {new Date(d.dueDate).toLocaleDateString()}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Action Items */}
          <SectionCard title={`Action Items (${meeting.actionItems.length})`}>
            {meeting.actionItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No action items.</p>
            ) : (
              <div className="space-y-3">
                {meeting.actionItems.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-3">
                    <p className="text-sm text-primary-navy flex-1">{item.description}</p>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_STATUS_STYLES[item.status] ?? 'bg-gray-50 text-gray-400'}`}>
                        {item.status.replace(/_/g, ' ')}
                      </span>
                      {item.dueDate && (
                        <span className="text-xs text-muted-foreground">
                          Due: {new Date(item.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </main>
  );
}
