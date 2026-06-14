'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

interface ChecklistItem {
  id: string;
  category: string;
  title: string;
  description: string;
  required: boolean;
}

interface ChecklistResult {
  item: ChecklistItem;
  passed: boolean;
  evidence: string;
}

interface AuditSummary {
  legislativeItemId: string;
  totalItems: number;
  passedItems: number;
  requiredItems: number;
  passedRequired: number;
  overallStatus: 'READY' | 'PARTIAL' | 'NOT_READY';
  checklist: ChecklistResult[];
}

const CATEGORY_ORDER = [
  'DOCUMENTATION',
  'WORKFLOW',
  'COMMITTEE',
  'CONSULTATION',
  'LEGAL',
  'APPROVAL',
  'VERSION',
  'TRACEABILITY',
  'AI_ANALYSIS',
];

const OVERALL_STATUS_STYLES: Record<string, string> = {
  READY: 'bg-green-100 text-green-700 border-green-200',
  PARTIAL: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  NOT_READY: 'bg-red-100 text-red-700 border-red-200',
};

export default function AuditChecklistPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: summary, isLoading } = useQuery({
    queryKey: ['audit-summary', id],
    queryFn: async () => {
      const res = await apiClient.get<AuditSummary>(`/legislative-items/${id}/audit-summary`);
      return res.data;
    },
  });

  const handleExport = async () => {
    const res = await apiClient.get(`/legislative-items/${id}/audit-report`);
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-report-${id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <main className="flex-1 p-8">
        <div className="flex items-center justify-center py-24 text-muted-foreground">Loading audit...</div>
      </main>
    );
  }

  // Group checklist by category
  const grouped: Record<string, ChecklistResult[]> = {};
  for (const result of summary?.checklist ?? []) {
    const cat = result.item.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(result);
  }

  const passRate =
    summary && summary.totalItems > 0
      ? Math.round((summary.passedItems / summary.totalItems) * 100)
      : 0;

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="text-sm text-muted-foreground hover:text-primary-navy"
            >
              Back
            </button>
            <h1 className="text-2xl font-bold text-primary-navy">Audit Checklist</h1>
          </div>
          <button
            onClick={handleExport}
            className="rounded-lg border border-primary-navy px-4 py-2 text-sm font-medium text-primary-navy hover:bg-muted/20"
          >
            Export Audit Report (JSON)
          </button>
        </div>

        {/* Summary Header */}
        {summary && (
          <div className="rounded-xl border border-border bg-white p-5 shadow-sm mb-6">
            <div className="flex items-center gap-4 mb-4">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold border ${
                  OVERALL_STATUS_STYLES[summary.overallStatus] ?? 'bg-gray-100 text-gray-700'
                }`}
              >
                {summary.overallStatus.replace('_', ' ')}
              </span>
              <div className="text-sm text-muted-foreground">
                <span className="font-semibold text-primary-navy">{passRate}%</span> pass rate
                &nbsp;·&nbsp;
                <span className="font-semibold text-primary-navy">{summary.passedItems}</span> of{' '}
                {summary.totalItems} items passed
                &nbsp;·&nbsp;
                <span className="font-semibold text-primary-navy">{summary.passedRequired}</span> of{' '}
                {summary.requiredItems} required items passed
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-3 rounded-full transition-all ${
                  summary.overallStatus === 'READY'
                    ? 'bg-green-500'
                    : summary.overallStatus === 'PARTIAL'
                    ? 'bg-yellow-400'
                    : 'bg-red-400'
                }`}
                style={{ width: `${passRate}%` }}
              />
            </div>
          </div>
        )}

        {/* Checklist by Category */}
        <div className="space-y-4">
          {CATEGORY_ORDER.filter((cat) => grouped[cat]).map((category) => (
            <div key={category} className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-muted/10 border-b border-border">
                <h2 className="font-semibold text-primary-navy text-sm tracking-wide uppercase">
                  {category.replace('_', ' ')}
                </h2>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  {grouped[category].map(({ item, passed, evidence }) => (
                    <tr key={item.id} className={passed ? '' : 'bg-red-50/30'}>
                      <td className="px-5 py-3 w-10">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                          }`}
                        >
                          {passed ? '✓' : '✗'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-medium text-primary-navy">{item.title}</span>
                          {item.required && (
                            <span className="text-xs bg-orange-100 text-orange-600 rounded-full px-1.5 py-0.5 font-medium">
                              Required
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <p
                          className={`text-xs ${
                            passed ? 'text-green-700' : 'text-red-600'
                          }`}
                        >
                          {evidence}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {!summary?.checklist?.length && (
          <div className="rounded-xl border border-dashed border-border bg-white p-12 text-center text-muted-foreground">
            No checklist data available.
          </div>
        )}
      </div>
    </main>
  );
}
