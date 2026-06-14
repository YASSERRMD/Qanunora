'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

interface StakeholderSentiment {
  type: string;
  POSITIVE: number;
  NEGATIVE: number;
  NEUTRAL: number;
  total: number;
}

export default function StakeholderSentimentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ['consultation-stakeholder-sentiment', id],
    queryFn: async () => {
      const res = await apiClient.get<StakeholderSentiment[]>(
        `/consultations/${id}/analytics/stakeholder-sentiment`,
      );
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
          <h1 className="text-2xl font-bold text-primary-navy">Stakeholder Sentiment Breakdown</h1>
        </div>

        <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-primary-navy">Sentiment by Stakeholder Type</h2>
          </div>
          {data && data.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-muted/20 border-b border-border">
                <tr>
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">Stakeholder Type</th>
                  <th className="px-5 py-3 text-right font-medium text-green-600">Positive</th>
                  <th className="px-5 py-3 text-right font-medium text-gray-500">Neutral</th>
                  <th className="px-5 py-3 text-right font-medium text-red-500">Negative</th>
                  <th className="px-5 py-3 text-right font-medium text-muted-foreground">Total</th>
                  <th className="px-5 py-3 text-right font-medium text-muted-foreground">Support Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((row) => {
                  const supportRate = row.total > 0 ? Math.round((row.POSITIVE / row.total) * 100) : 0;
                  return (
                    <tr key={row.type} className="hover:bg-muted/10">
                      <td className="px-5 py-3 font-medium text-primary-navy">{row.type}</td>
                      <td className="px-5 py-3 text-right text-green-600 font-semibold">{row.POSITIVE}</td>
                      <td className="px-5 py-3 text-right text-gray-500 font-semibold">{row.NEUTRAL}</td>
                      <td className="px-5 py-3 text-right text-red-500 font-semibold">{row.NEGATIVE}</td>
                      <td className="px-5 py-3 text-right text-muted-foreground">{row.total}</td>
                      <td className="px-5 py-3 text-right">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            supportRate >= 60
                              ? 'bg-green-100 text-green-700'
                              : supportRate >= 40
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {supportRate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="px-5 py-12 text-center text-muted-foreground">
              No stakeholder sentiment data available. Run sentiment analysis first.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
