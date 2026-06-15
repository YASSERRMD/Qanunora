'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface LegislativeMetrics {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  publishedThisMonth: number;
  publishedThisYear: number;
  avgApprovalDays: number;
}

interface ConsultationMetrics {
  total: number;
  open: number;
  totalFeedback: number;
  avgFeedbackPerConsultation: number;
  moderationPendingCount: number;
}

interface AiUsageMetrics {
  totalAnalyses: number;
  byType: Record<string, number>;
  avgConfidence: number;
}

interface UserMetrics {
  total: number;
  byRole: Record<string, number>;
  activeLastMonth: number;
}

interface AnalyticsSnapshot {
  date: string;
  legislative: LegislativeMetrics;
  consultations: ConsultationMetrics;
  aiUsage: AiUsageMetrics;
  users: UserMetrics;
  amendments: { total: number; pending: number; incorporated: number };
  committees: { total: number; avgMembersPerCommittee: number };
  documents: { total: number; totalSizeMb: number };
}

interface ThroughputData {
  year: number;
  months: Array<{ month: number; monthName: string; count: number }>;
}

interface MinistryPerf {
  ministryId: string;
  name: string;
  itemCount: number;
  consultationCount: number;
  avgDaysToPublish: number;
}

function KpiCard({ label, value, subLabel, color = 'indigo' }: {
  label: string;
  value: string | number;
  subLabel?: string;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
  };
  return (
    <div className={`rounded-lg border p-4 ${colorMap[color] ?? colorMap.indigo}`}>
      <div className="text-3xl font-bold mb-1">{value}</div>
      <div className="text-sm font-medium">{label}</div>
      {subLabel && <div className="text-xs opacity-70 mt-0.5">{subLabel}</div>}
    </div>
  );
}

export default function AnalyticsPage() {
  const { data: snapshot, isLoading } = useQuery({
    queryKey: ['analytics-snapshot'],
    queryFn: async () => {
      const res = await apiClient.get('/analytics/snapshot');
      return res.data as AnalyticsSnapshot;
    },
  });

  const { data: throughput } = useQuery({
    queryKey: ['analytics-throughput'],
    queryFn: async () => {
      const res = await apiClient.get('/analytics/throughput');
      return res.data as ThroughputData;
    },
  });

  const { data: ministryPerf = [] } = useQuery({
    queryKey: ['analytics-ministry'],
    queryFn: async () => {
      const res = await apiClient.get('/analytics/ministry-performance');
      return res.data as MinistryPerf[];
    },
  });

  const handleExport = async (format: 'json' | 'csv') => {
    const res = await apiClient.get(`/analytics/export?format=${format}`, {
      responseType: format === 'csv' ? 'text' : 'json',
    });
    const blob = new Blob(
      [format === 'csv' ? String(res.data) : JSON.stringify(res.data, null, 2)],
      { type: format === 'csv' ? 'text/csv' : 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qanunora-analytics.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading || !snapshot) {
    return <div className="p-8 text-center text-gray-400">Loading analytics...</div>;
  }

  const maxCount = Math.max(...(throughput?.months.map((m) => m.count) ?? [1]));

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-sm text-gray-500">As of {new Date(snapshot.date).toLocaleString()}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('json')}
            className="px-4 py-1.5 border border-indigo-300 text-indigo-700 rounded text-sm hover:bg-indigo-50"
          >
            Export JSON
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="px-4 py-1.5 border border-indigo-300 text-indigo-700 rounded text-sm hover:bg-indigo-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard
          label="Total Items"
          value={snapshot.legislative.total}
          subLabel={`${snapshot.legislative.publishedThisYear} this year`}
          color="indigo"
        />
        <KpiCard
          label="Published This Month"
          value={snapshot.legislative.publishedThisMonth}
          subLabel="legislative items"
          color="green"
        />
        <KpiCard
          label="Avg Approval Days"
          value={snapshot.legislative.avgApprovalDays}
          subLabel="from draft to approved"
          color="yellow"
        />
        <KpiCard
          label="Open Consultations"
          value={snapshot.consultations.open}
          subLabel={`${snapshot.consultations.total} total`}
          color="blue"
        />
        <KpiCard
          label="Total Feedback"
          value={snapshot.consultations.totalFeedback}
          subLabel={`${snapshot.consultations.moderationPendingCount} pending moderation`}
          color="purple"
        />
        <KpiCard
          label="Active Users"
          value={snapshot.users.total}
          subLabel={`${snapshot.users.activeLastMonth} active last 30d`}
          color="orange"
        />
      </div>

      {/* Throughput Chart + Ministry Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Legislative Throughput Bar Chart */}
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="font-semibold text-gray-800 mb-4">
            Legislative Throughput {throughput?.year ?? new Date().getFullYear()}
          </h2>
          {throughput ? (
            <div className="flex items-end gap-1 h-40">
              {throughput.months.map((m) => {
                const heightPct = maxCount > 0 ? (m.count / maxCount) * 100 : 0;
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-xs text-gray-500">{m.count > 0 ? m.count : ''}</div>
                    <div
                      className="w-full bg-indigo-500 rounded-t"
                      style={{ height: `${Math.max(heightPct, m.count > 0 ? 4 : 0)}%`, minHeight: m.count > 0 ? '4px' : '0' }}
                    />
                    <div className="text-xs text-gray-400">{m.monthName}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-300">No data</div>
          )}
        </div>

        {/* Status Breakdown */}
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Items by Status</h2>
          <div className="space-y-2">
            {Object.entries(snapshot.legislative.byStatus).map(([status, count]) => {
              const pct = snapshot.legislative.total > 0 ? Math.round((count / snapshot.legislative.total) * 100) : 0;
              return (
                <div key={status} className="flex items-center gap-3">
                  <div className="w-28 text-xs text-gray-500 text-right">{status.replace(/_/g, ' ')}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-3">
                    <div
                      className="bg-indigo-500 h-3 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="w-16 text-xs text-gray-600">{count} ({pct}%)</div>
                </div>
              );
            })}
            {Object.keys(snapshot.legislative.byStatus).length === 0 && (
              <div className="text-gray-300 text-sm text-center py-4">No data</div>
            )}
          </div>
        </div>
      </div>

      {/* Ministry Performance Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold text-gray-700">Ministry Performance</h2>
        </div>
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Ministry', 'Legislative Items', 'Consultations', 'Avg Days to Publish'].map((h) => (
                <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ministryPerf.map((m) => (
              <tr key={m.ministryId} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-medium text-gray-800">{m.name}</td>
                <td className="px-4 py-2 text-gray-600">{m.itemCount}</td>
                <td className="px-4 py-2 text-gray-600">{m.consultationCount}</td>
                <td className="px-4 py-2 text-gray-600">{m.avgDaysToPublish} days</td>
              </tr>
            ))}
            {ministryPerf.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No ministry data</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* AI Usage Card */}
      <div className="bg-white rounded-lg shadow p-5">
        <h2 className="font-semibold text-gray-800 mb-4">AI Analysis Usage</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-700">{snapshot.aiUsage.totalAnalyses}</div>
            <div className="text-xs text-purple-600">Total Analyses</div>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-700">
              {snapshot.aiUsage.avgConfidence > 0 ? `${Math.round(snapshot.aiUsage.avgConfidence * 100)}%` : 'N/A'}
            </div>
            <div className="text-xs text-purple-600">Avg Confidence</div>
          </div>
          {Object.entries(snapshot.aiUsage.byType).slice(0, 2).map(([type, count]) => (
            <div key={type} className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-700">{count}</div>
              <div className="text-xs text-purple-600">{type.replace(/_/g, ' ')}</div>
            </div>
          ))}
        </div>
        {Object.keys(snapshot.aiUsage.byType).length === 0 && (
          <div className="text-center text-gray-300 text-sm mt-2">No AI analyses recorded</div>
        )}
      </div>
    </div>
  );
}
