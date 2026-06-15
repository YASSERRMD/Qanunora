'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

type SessionStatus = 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
type SessionType = 'ORDINARY' | 'EXTRAORDINARY' | 'EMERGENCY';

interface ReadingStage {
  id: string;
  stageNumber: number;
  stageName: string;
  scheduledDate: string | null;
  completedDate: string | null;
  outcome: string | null;
  legislativeItem: { id: string; referenceNumber: string; title: string };
}

interface Debate {
  id: string;
  topic: string;
  summary: string | null;
  speakerName: string | null;
  position: string | null;
  debateDate: string;
}

interface ParliamentarySession {
  id: string;
  sessionNumber: string;
  title: string;
  sessionType: SessionType;
  status: SessionStatus;
  startDate: string;
  endDate: string | null;
  notes: string | null;
  createdBy: { id: string; firstName: string; lastName: string };
  readingStages: ReadingStage[];
  debates: Debate[];
  createdAt: string;
}

const STATUS_STYLES: Record<SessionStatus, string> = {
  UPCOMING: 'bg-blue-100 text-blue-700',
  ACTIVE: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-700',
};

const TYPE_STYLES: Record<SessionType, string> = {
  ORDINARY: 'bg-purple-100 text-purple-700',
  EXTRAORDINARY: 'bg-orange-100 text-orange-700',
  EMERGENCY: 'bg-red-100 text-red-800',
};

export default function ParliamentarySessionDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: session, isLoading, error } = useQuery<ParliamentarySession>({
    queryKey: ['parliamentary-session', id],
    queryFn: async () => (await apiClient.get(`/parliamentary-sessions/${id}`)).data,
    enabled: !!id,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <main className="flex-1 p-8">
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          Loading session...
        </div>
      </main>
    );
  }

  if (error || !session) {
    return (
      <main className="flex-1 p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Parliamentary session not found.
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
                  {session.sessionNumber}
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[session.status]}`}>
                  {session.status}
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${TYPE_STYLES[session.sessionType]}`}>
                  {session.sessionType}
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-bold text-primary-navy">{session.title}</h1>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Start Date</p>
              <p className="font-medium text-primary-navy">
                {new Date(session.startDate).toLocaleDateString('en-GB', { dateStyle: 'long' })}
              </p>
            </div>
            {session.endDate && (
              <div>
                <p className="text-xs text-muted-foreground">End Date</p>
                <p className="font-medium text-primary-navy">
                  {new Date(session.endDate).toLocaleDateString('en-GB', { dateStyle: 'long' })}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Created By</p>
              <p className="font-medium text-primary-navy">
                {session.createdBy.firstName} {session.createdBy.lastName}
              </p>
            </div>
          </div>

          {session.notes && (
            <div className="mt-4 rounded-lg border border-border bg-gray-50 p-3 text-sm text-muted-foreground">
              {session.notes}
            </div>
          )}
        </div>

        {/* Reading Stages Timeline */}
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-primary-navy">
            Reading Stages{' '}
            <span className="text-sm font-normal text-muted-foreground">
              ({session.readingStages.length})
            </span>
          </h2>

          {session.readingStages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reading stages added yet.</p>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-border" />
              <div className="space-y-4">
                {session.readingStages.map((stage, idx) => (
                  <div key={stage.id} className="relative flex gap-4 pl-10">
                    {/* Timeline dot */}
                    <div
                      className={`absolute left-2.5 top-2 h-3 w-3 rounded-full border-2 ${
                        stage.completedDate
                          ? 'border-green-500 bg-green-500'
                          : 'border-blue-400 bg-white'
                      }`}
                    />
                    <div className={`flex-1 rounded-lg border p-3 ${
                      stage.completedDate ? 'border-green-200 bg-green-50' : 'border-border bg-gray-50'
                    }`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-primary-navy/10 px-1.5 py-0.5 text-xs font-semibold text-primary-navy">
                            Stage {stage.stageNumber}
                          </span>
                          <span className="font-medium text-sm text-primary-navy">
                            {stage.stageName}
                          </span>
                        </div>
                        {stage.completedDate && (
                          <span className="text-xs text-green-700 font-medium">Completed</span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {stage.legislativeItem.referenceNumber} — {stage.legislativeItem.title}
                      </p>
                      {stage.scheduledDate && !stage.completedDate && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Scheduled: {new Date(stage.scheduledDate).toLocaleDateString('en-GB')}
                        </p>
                      )}
                      {stage.completedDate && (
                        <p className="mt-1 text-xs text-green-700">
                          Completed: {new Date(stage.completedDate).toLocaleDateString('en-GB')}
                        </p>
                      )}
                      {stage.outcome && (
                        <p className="mt-1 text-xs text-muted-foreground italic">
                          Outcome: {stage.outcome}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Debates */}
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-primary-navy">
            Debates{' '}
            <span className="text-sm font-normal text-muted-foreground">
              ({session.debates.length})
            </span>
          </h2>

          {session.debates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No debates recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {session.debates.map((debate) => (
                <div key={debate.id} className="rounded-lg border border-border bg-gray-50 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-primary-navy">{debate.topic}</p>
                      {debate.speakerName && (
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-medium">{debate.speakerName}</span>
                          {debate.position && (
                            <span className="rounded bg-gray-200 px-1.5 py-0.5">{debate.position}</span>
                          )}
                        </div>
                      )}
                      {debate.summary && (
                        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{debate.summary}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(debate.debateDate).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                    </span>
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
