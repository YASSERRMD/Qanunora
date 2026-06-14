'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

interface AnalyticsData {
  total: number;
  bySentiment: { POSITIVE: number; NEGATIVE: number; NEUTRAL: number };
  byCategory: Record<string, number>;
  volumeByDate: { date: string; count: number }[];
  supportRatio: number;
  oppositionRatio: number;
  topTopics: { label: string; count: number; description: string }[];
}

interface StakeholderSentiment {
  type: string;
  POSITIVE: number;
  NEGATIVE: number;
  NEUTRAL: number;
  total: number;
}

export default function ConsultationAnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [openTopic, setOpenTopic] = useState<string | null>(null);

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['consultation-analytics', id],
    queryFn: async () => {
      const res = await apiClient.get<AnalyticsData>(`/consultations/${id}/analytics`);
      return res.data;
    },
  });

  const { data: stakeholderSentiment } = useQuery({
    queryKey: ['consultation-stakeholder-sentiment', id],
    queryFn: async () => {
      const res = await apiClient.get<StakeholderSentiment[]>(
        `/consultations/${id}/analytics/stakeholder-sentiment`,
      );
      return res.data;
    },
  });

  const sentimentMutation = useMutation({
    mutationFn: () => apiClient.post(`/consultations/${id}/analytics/sentiment`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['consultation-analytics', id] }),
  });

  const topicsMutation = useMutation({
    mutationFn: () => apiClient.post(`/consultations/${id}/analytics/topics`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['consultation-analytics', id] }),
  });

  if (isLoading) {
    return (
      <main className="flex-1 p-8">
        <div className="flex items-center justify-center py-24 text-muted-foreground">Loading...</div>
      </main>
    );
  }

  const total = analytics?.total ?? 0;
  const positive = analytics?.bySentiment?.POSITIVE ?? 0;
  const negative = analytics?.bySentiment?.NEGATIVE ?? 0;
  const neutral = analytics?.bySentiment?.NEUTRAL ?? 0;

  const positivePercent = total > 0 ? Math.round((positive / total) * 100) : 0;
  const negativePercent = total > 0 ? Math.round((negative / total) * 100) : 0;
  const neutralPercent = total > 0 ? Math.round((neutral / total) * 100) : 0;

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="text-sm text-muted-foreground hover:text-primary-navy"
            >
              Back
            </button>
            <h1 className="text-2xl font-bold text-primary-navy">Consultation Analytics</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => sentimentMutation.mutate()}
              disabled={sentimentMutation.isPending}
              className="rounded-lg bg-primary-navy px-4 py-2 text-sm font-medium text-white hover:bg-primary-navy/90 disabled:opacity-50"
            >
              {sentimentMutation.isPending ? 'Analyzing...' : 'Run Sentiment Analysis'}
            </button>
            <button
              onClick={() => topicsMutation.mutate()}
              disabled={topicsMutation.isPending}
              className="rounded-lg border border-primary-navy px-4 py-2 text-sm font-medium text-primary-navy hover:bg-muted/20 disabled:opacity-50"
            >
              {topicsMutation.isPending ? 'Clustering...' : 'Cluster Topics'}
            </button>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="rounded-xl border border-border bg-white p-5 text-center shadow-sm">
            <p className="text-3xl font-bold text-primary-navy">{total}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Feedback</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-5 text-center shadow-sm">
            <p className="text-3xl font-bold text-green-600">{positivePercent}%</p>
            <p className="text-xs text-muted-foreground mt-1">Positive</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-5 text-center shadow-sm">
            <p className="text-3xl font-bold text-red-500">{negativePercent}%</p>
            <p className="text-xs text-muted-foreground mt-1">Negative</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-5 text-center shadow-sm">
            <p className="text-3xl font-bold text-gray-500">{neutralPercent}%</p>
            <p className="text-xs text-muted-foreground mt-1">Neutral</p>
          </div>
        </div>

        {/* Sentiment Bar */}
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm mb-6">
          <h2 className="font-semibold text-primary-navy mb-3">Sentiment Distribution</h2>
          <div className="flex h-8 w-full overflow-hidden rounded-full">
            {positivePercent > 0 && (
              <div
                className="bg-green-500 flex items-center justify-center text-xs text-white font-medium"
                style={{ width: `${positivePercent}%` }}
              >
                {positivePercent > 5 && `${positivePercent}%`}
              </div>
            )}
            {neutralPercent > 0 && (
              <div
                className="bg-gray-400 flex items-center justify-center text-xs text-white font-medium"
                style={{ width: `${neutralPercent}%` }}
              >
                {neutralPercent > 5 && `${neutralPercent}%`}
              </div>
            )}
            {negativePercent > 0 && (
              <div
                className="bg-red-500 flex items-center justify-center text-xs text-white font-medium"
                style={{ width: `${negativePercent}%` }}
              >
                {negativePercent > 5 && `${negativePercent}%`}
              </div>
            )}
            {total === 0 && (
              <div className="w-full bg-gray-100 flex items-center justify-center text-xs text-muted-foreground">
                No data
              </div>
            )}
          </div>
          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full bg-green-500" /> Positive ({positive})
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full bg-gray-400" /> Neutral ({neutral})
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full bg-red-500" /> Negative ({negative})
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Volume Trend */}
          <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-primary-navy mb-3">Feedback Volume by Date</h2>
            {analytics?.volumeByDate?.length ? (
              <div className="space-y-2">
                {analytics.volumeByDate.map(({ date, count }) => (
                  <div key={date} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-24 shrink-0">{date}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-primary-navy h-2 rounded-full"
                        style={{
                          width: `${Math.min(
                            100,
                            (count / Math.max(...analytics.volumeByDate.map((d) => d.count))) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium text-primary-navy w-6 text-right">{count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No volume data available</p>
            )}
          </div>

          {/* Category Breakdown */}
          <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-primary-navy mb-3">Feedback by Category</h2>
            {analytics?.byCategory && Object.keys(analytics.byCategory).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(analytics.byCategory).map(([cat, count]) => (
                  <div key={cat} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{cat}</span>
                    <span className="text-sm font-semibold text-primary-navy">{count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No category data available</p>
            )}
          </div>
        </div>

        {/* Topic Clusters */}
        {analytics?.topTopics && analytics.topTopics.length > 0 && (
          <div className="rounded-xl border border-border bg-white p-5 shadow-sm mb-6">
            <h2 className="font-semibold text-primary-navy mb-3">Topic Clusters</h2>
            <div className="space-y-2">
              {analytics.topTopics.map((topic) => (
                <div key={topic.label} className="border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setOpenTopic(openTopic === topic.label ? null : topic.label)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-primary-navy text-sm">{topic.label}</span>
                      <span className="text-xs text-muted-foreground bg-muted/30 rounded-full px-2 py-0.5">
                        {topic.count} responses
                      </span>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {openTopic === topic.label ? '▲' : '▼'}
                    </span>
                  </button>
                  {openTopic === topic.label && (
                    <div className="px-4 pb-3 text-sm text-muted-foreground border-t border-border bg-muted/10">
                      {topic.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
