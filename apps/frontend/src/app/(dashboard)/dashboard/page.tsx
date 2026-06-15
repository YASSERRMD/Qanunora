'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { apiClient } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PipelineEntry { status: string; count: number }
interface PipelineMetrics { pipeline: PipelineEntry[]; total: number }
interface DelayedItem {
  id: string; referenceNumber: string; title: string;
  status: string; priority: string; ageDays: number;
  ministry: { name: string; code: string };
}
interface Bottleneck { status: string; avgDays: number; sampleCount: number }
interface ConsultationMetrics {
  openCount: number; totalConsultations: number;
  totalFeedback: number; avgFeedback: number;
}
interface ActivityEntry {
  id: string; action: string; fromStatus: string | null; toStatus: string;
  comment: string | null; createdAt: string;
  legislativeItem: { id: string; title: string; referenceNumber: string };
  performedBy: { id: string; firstName: string; lastName: string };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  DRAFTING: 'bg-gray-300',
  INTERNAL_REVIEW: 'bg-blue-400',
  COMMITTEE_REVIEW: 'bg-indigo-400',
  PUBLIC_CONSULTATION: 'bg-amber-400',
  LEGAL_REVIEW: 'bg-orange-400',
  APPROVED: 'bg-green-500',
  PUBLISHED: 'bg-emerald-600',
  ARCHIVED: 'bg-gray-400',
};

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-700',
  HIGH: 'bg-orange-100 text-orange-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  LOW: 'bg-gray-100 text-gray-600',
};

function StatCard({
  label, value, sub, accent,
}: {
  label: string; value: string | number; sub?: string; accent: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
      <div className={`mb-3 h-1.5 w-10 rounded-full ${accent}`} />
      <p className="text-3xl font-bold text-primary-navy">{value}</p>
      <p className="mt-1 text-sm font-medium text-primary-navy">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Pipeline Bar Chart ───────────────────────────────────────────────────────

function PipelineChart({ data, total }: { data: PipelineEntry[]; total: number }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
      <h2 className="mb-4 font-semibold text-primary-navy">Pipeline by Status</h2>
      <div className="space-y-2">
        {data.map((entry) => (
          <div key={entry.status} className="flex items-center gap-3">
            <span className="w-44 text-xs text-muted-foreground truncate">
              {entry.status.replace(/_/g, ' ')}
            </span>
            <div className="flex-1 h-5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${STATUS_COLORS[entry.status] ?? 'bg-gray-400'} transition-all`}
                style={{ width: `${total === 0 ? 0 : (entry.count / maxCount) * 100}%` }}
              />
            </div>
            <span className="w-8 text-right text-xs font-semibold text-primary-navy">
              {entry.count}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Total: {total} items</p>
    </div>
  );
}

// ─── Delayed Items ────────────────────────────────────────────────────────────

function DelayedList({ items }: { items: DelayedItem[] }) {
  return (
    <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
      <h2 className="mb-4 font-semibold text-primary-navy">
        Delayed Items{' '}
        <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
          {items.length}
        </span>
      </h2>
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">No items delayed beyond 14 days.</p>
      )}
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-2 border-b border-border pb-3 last:border-0">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-primary-navy">{item.title}</p>
              <p className="text-xs text-muted-foreground">
                {item.referenceNumber} · {item.ministry.code} · {item.status.replace(/_/g, ' ')}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[item.priority] ?? 'bg-gray-100 text-gray-600'}`}>
                {item.priority}
              </span>
              <span className="text-xs font-semibold text-red-600">{item.ageDays}d</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Bottleneck Table ─────────────────────────────────────────────────────────

function BottleneckTable({ data }: { data: Bottleneck[] }) {
  return (
    <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
      <h2 className="mb-4 font-semibold text-primary-navy">Status Bottlenecks</h2>
      {data.length === 0 && (
        <p className="text-sm text-muted-foreground">No transition data available yet.</p>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="pb-2 text-left text-xs font-medium text-muted-foreground">Status</th>
            <th className="pb-2 text-right text-xs font-medium text-muted-foreground">Avg Days</th>
            <th className="pb-2 text-right text-xs font-medium text-muted-foreground">Samples</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.status} className="border-b border-border last:border-0">
              <td className="py-2 text-muted-foreground">{row.status.replace(/_/g, ' ')}</td>
              <td className="py-2 text-right font-semibold text-primary-navy">{row.avgDays}</td>
              <td className="py-2 text-right text-muted-foreground">{row.sampleCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Activity Feed ────────────────────────────────────────────────────────────

function ActivityFeed({ data }: { data: ActivityEntry[] }) {
  return (
    <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
      <h2 className="mb-4 font-semibold text-primary-navy">Recent Activity</h2>
      {data.length === 0 && (
        <p className="text-sm text-muted-foreground">No recent workflow activity.</p>
      )}
      <div className="space-y-4">
        {data.map((entry) => (
          <div key={entry.id} className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600">
              {entry.performedBy.firstName[0]}{entry.performedBy.lastName[0]}
            </div>
            <div className="min-w-0">
              <p className="text-sm text-primary-navy">
                <span className="font-medium">
                  {entry.performedBy.firstName} {entry.performedBy.lastName}
                </span>{' '}
                {entry.action.replace(/_/g, ' ').toLowerCase()}{' '}
                <span className="font-medium">{entry.legislativeItem.referenceNumber}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {entry.fromStatus
                  ? `${entry.fromStatus.replace(/_/g, ' ')} → ${entry.toStatus.replace(/_/g, ' ')}`
                  : entry.toStatus.replace(/_/g, ' ')
                }
                {' · '}{new Date(entry.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuthStore();

  const pipeline = useQuery<PipelineMetrics>({
    queryKey: ['dashboard-pipeline'],
    queryFn: async () => (await apiClient.get('/dashboard/pipeline')).data,
    staleTime: 30_000,
  });

  const delayed = useQuery<DelayedItem[]>({
    queryKey: ['dashboard-delayed'],
    queryFn: async () => (await apiClient.get('/dashboard/delayed')).data,
    staleTime: 30_000,
  });

  const bottlenecks = useQuery<Bottleneck[]>({
    queryKey: ['dashboard-bottlenecks'],
    queryFn: async () => (await apiClient.get('/dashboard/bottlenecks')).data,
    staleTime: 30_000,
  });

  const consultations = useQuery<ConsultationMetrics>({
    queryKey: ['dashboard-consultations'],
    queryFn: async () => (await apiClient.get('/dashboard/consultations')).data,
    staleTime: 30_000,
  });

  const activity = useQuery<ActivityEntry[]>({
    queryKey: ['dashboard-activity'],
    queryFn: async () => (await apiClient.get('/dashboard/activity')).data,
    staleTime: 30_000,
  });

  return (
    <main className="flex-1 overflow-auto p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-primary-navy">
            Welcome, {user?.firstName} {user?.lastName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {user?.role?.replace(/_/g, ' ')} — Qanunora Legislative Intelligence Platform
          </p>
        </div>

        {/* Top Stat Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Items"
            value={pipeline.data?.total ?? '—'}
            sub="across all statuses"
            accent="bg-primary-navy"
          />
          <StatCard
            label="Delayed Items"
            value={delayed.data?.length ?? '—'}
            sub=">14 days in review"
            accent="bg-red-500"
          />
          <StatCard
            label="Open Consultations"
            value={consultations.data?.openCount ?? '—'}
            sub={consultations.data ? `${consultations.data.totalFeedback} total feedback` : undefined}
            accent="bg-primary-gold"
          />
          <StatCard
            label="Avg Feedback/Consultation"
            value={consultations.data?.avgFeedback ?? '—'}
            accent="bg-slate-500"
          />
        </div>

        {/* Pipeline Chart */}
        {pipeline.data && (
          <div className="mb-6">
            <PipelineChart data={pipeline.data.pipeline} total={pipeline.data.total} />
          </div>
        )}

        {/* Middle Row: Delayed + Bottlenecks */}
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {delayed.data ? (
            <DelayedList items={delayed.data} />
          ) : (
            <div className="rounded-xl border border-border bg-white p-6 shadow-sm text-muted-foreground text-sm">
              Loading delayed items…
            </div>
          )}
          {bottlenecks.data ? (
            <BottleneckTable data={bottlenecks.data} />
          ) : (
            <div className="rounded-xl border border-border bg-white p-6 shadow-sm text-muted-foreground text-sm">
              Loading bottleneck data…
            </div>
          )}
        </div>

        {/* Activity Feed */}
        {activity.data ? (
          <ActivityFeed data={activity.data} />
        ) : (
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm text-muted-foreground text-sm">
            Loading activity feed…
          </div>
        )}
      </div>
    </main>
  );
}
