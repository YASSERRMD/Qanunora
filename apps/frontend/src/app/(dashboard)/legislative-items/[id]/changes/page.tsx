'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

type ChangeType = 'MINOR' | 'MODERATE' | 'MAJOR' | 'STRUCTURAL';

const CHANGE_TYPE_COLORS: Record<ChangeType, string> = {
  MINOR: 'bg-green-100 text-green-700',
  MODERATE: 'bg-yellow-100 text-yellow-700',
  MAJOR: 'bg-orange-100 text-orange-700',
  STRUCTURAL: 'bg-red-100 text-red-700',
};

const PROVIDERS = [
  { value: '', label: 'Default Provider' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'mistral', label: 'Mistral' },
  { value: 'groq', label: 'Groq' },
];

interface Version {
  id: string;
  versionNumber: number;
  label: string | null;
  createdAt: string;
}

interface SemanticDiffResult {
  hasChanges: boolean;
  changeType: ChangeType;
  addedObligations: string[];
  removedObligations: string[];
  modifiedProvisions: string[];
  newRisks: string[];
  resolvedRisks: string[];
  semanticSummary: string;
  confidenceScore: number;
  disclaimer: string;
}

interface AiAnalysis {
  id: string;
  analysisType: string;
  provider: string;
  model: string;
  result: SemanticDiffResult;
  confidenceScore: number | null;
  processingTimeMs: number | null;
  createdAt: string;
  requestedBy: { firstName: string; lastName: string };
}

export default function ChangesPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [versionId1, setVersionId1] = useState('');
  const [versionId2, setVersionId2] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: versionsData } = useQuery<{ data: Version[] }>({
    queryKey: ['versions', id],
    queryFn: async () => {
      const res = await apiClient.get<{ data: Version[] }>(`/legislative-items/${id}/versions`);
      return res.data;
    },
  });
  const versions = versionsData?.data ?? [];

  const { data: history, isLoading } = useQuery<AiAnalysis[]>({
    queryKey: ['change-history', id],
    queryFn: async () => {
      const res = await apiClient.get<AiAnalysis[]>(`/legislative-items/${id}/change-history`);
      return res.data;
    },
  });

  const detectMutation = useMutation({
    mutationFn: async (type: 'semantic' | 'risk') => {
      const endpoint =
        type === 'semantic' ? '/versions/detect-changes' : '/versions/detect-risk-changes';
      const res = await apiClient.post(endpoint, {
        versionId1,
        versionId2,
        provider: selectedProvider || undefined,
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['change-history', id] });
      if (data?.id) setExpandedId(data.id);
    },
  });

  const canDetect = versionId1 && versionId2 && versionId1 !== versionId2;

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-sm text-muted-foreground hover:text-primary-navy"
          >
            Back
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-primary-navy">Change Detection</h1>
            <p className="text-sm text-muted-foreground mt-1">
              AI-powered semantic comparison between two versions of this legislative item
            </p>
          </div>
        </div>

        {/* Version Comparison Selector */}
        <div className="mb-6 rounded-xl border border-border bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-primary-navy mb-4">Select Versions to Compare</h2>

          {versions.length < 2 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              At least 2 versions are required for comparison.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Base Version (v1)
                  </label>
                  <select
                    value={versionId1}
                    onChange={(e) => setVersionId1(e.target.value)}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30"
                  >
                    <option value="">Select base version</option>
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        v{v.versionNumber}{v.label ? ` — ${v.label}` : ''} &middot;{' '}
                        {new Date(v.createdAt).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Comparison Version (v2)
                  </label>
                  <select
                    value={versionId2}
                    onChange={(e) => setVersionId2(e.target.value)}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30"
                  >
                    <option value="">Select comparison version</option>
                    {versions.map((v) => (
                      <option key={v.id} value={v.id} disabled={v.id === versionId1}>
                        v{v.versionNumber}{v.label ? ` — ${v.label}` : ''} &middot;{' '}
                        {new Date(v.createdAt).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => detectMutation.mutate('semantic')}
                  disabled={detectMutation.isPending || !canDetect}
                  className="rounded-lg bg-primary-navy px-4 py-2 text-sm font-medium text-white hover:bg-primary-navy/90 transition-colors disabled:opacity-50"
                >
                  {detectMutation.isPending ? 'Analysing...' : 'Detect Changes'}
                </button>
                <button
                  onClick={() => detectMutation.mutate('risk')}
                  disabled={detectMutation.isPending || !canDetect}
                  className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  {detectMutation.isPending ? 'Analysing...' : 'Detect Risk Changes'}
                </button>
                {detectMutation.isError && (
                  <p className="text-xs text-red-500">Analysis failed. Please try again.</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Change History */}
        <h2 className="text-sm font-semibold text-primary-navy mb-3">Analysis History</h2>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : !history?.length ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/10 py-10 text-center">
            <p className="text-sm text-muted-foreground">No change analyses yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Select two versions above to start.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((analysis) => {
              const result = analysis.result as SemanticDiffResult;
              const isExpanded = expandedId === analysis.id;
              const isRisk = analysis.analysisType === 'RISK_CHANGE_DETECTION';

              return (
                <div
                  key={analysis.id}
                  className="rounded-xl border border-border bg-white shadow-sm overflow-hidden"
                >
                  {/* Header */}
                  <div
                    className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-muted/10 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : analysis.id)}
                  >
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        isRisk ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {isRisk ? 'Risk Changes' : 'Semantic Diff'}
                    </span>
                    {result?.changeType && (
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          CHANGE_TYPE_COLORS[result.changeType] ?? 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {result.changeType}
                      </span>
                    )}
                    {result?.hasChanges === false && (
                      <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                        No Changes
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">{analysis.provider}</span>
                    {analysis.confidenceScore !== null && (
                      <span className="ml-auto text-xs text-primary-gold font-medium">
                        {Math.round((analysis.confidenceScore ?? 0) * 100)}% confidence
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(analysis.createdAt).toLocaleDateString()}
                    </span>
                    <span className="text-xs text-muted-foreground">{isExpanded ? '▲' : '▼'}</span>
                  </div>

                  {/* Semantic Summary always visible */}
                  {result?.semanticSummary && (
                    <div className="px-5 pb-3">
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {result.semanticSummary}
                      </p>
                    </div>
                  )}

                  {/* Expanded */}
                  {isExpanded && result && (
                    <div className="border-t border-border px-5 py-5 space-y-5">
                      {/* Summary */}
                      {result.semanticSummary && (
                        <div>
                          <p className="text-xs font-semibold text-primary-navy uppercase tracking-wide mb-1">
                            Summary
                          </p>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {result.semanticSummary}
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-6">
                        {/* Added Obligations */}
                        {result.addedObligations?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">
                              Added Obligations
                            </p>
                            <ul className="space-y-1">
                              {result.addedObligations.map((o, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-green-400" />
                                  {o}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Removed Obligations */}
                        {result.removedObligations?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">
                              Removed Obligations
                            </p>
                            <ul className="space-y-1">
                              {result.removedObligations.map((o, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                                  {o}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Modified Provisions */}
                        {result.modifiedProvisions?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-2">
                              Modified Provisions
                            </p>
                            <ul className="space-y-1">
                              {result.modifiedProvisions.map((p, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />
                                  {p}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* New Risks */}
                        {result.newRisks?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">
                              New Risks
                            </p>
                            <ul className="space-y-1">
                              {result.newRisks.map((r, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                                  {r}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Resolved Risks */}
                        {result.resolvedRisks?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">
                              Resolved Risks
                            </p>
                            <ul className="space-y-1">
                              {result.resolvedRisks.map((r, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                                  {r}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Disclaimer */}
                      <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
                        <p className="text-xs text-yellow-700 leading-relaxed">
                          <span className="font-semibold">Disclaimer: </span>
                          {result.disclaimer}
                        </p>
                      </div>

                      {/* Meta */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
                        <span>
                          {analysis.requestedBy.firstName} {analysis.requestedBy.lastName} &middot;{' '}
                          {analysis.provider} &middot; {analysis.model}
                        </span>
                        {analysis.processingTimeMs && (
                          <span>{(analysis.processingTimeMs / 1000).toFixed(1)}s</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
