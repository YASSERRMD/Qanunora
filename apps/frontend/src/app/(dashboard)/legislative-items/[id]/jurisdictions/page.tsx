'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

interface JurisdictionProfile {
  code: string;
  name: string;
  region: string;
}

interface ComparisonResult {
  targetJurisdiction: string;
  similarities: string[];
  differences: string[];
  gaps: string[];
  bestPractices: string[];
  recommendations: string[];
  confidenceScore: number;
  disclaimer: string;
}

interface AiAnalysis {
  id: string;
  analysisType: string;
  provider: string;
  model: string;
  result: ComparisonResult;
  confidenceScore: number | null;
  processingTimeMs: number | null;
  createdAt: string;
  requestedBy: { firstName: string; lastName: string };
}

const REGION_COLORS: Record<string, string> = {
  GCC: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  Europe: 'bg-blue-50 border-blue-200 text-blue-800',
  Americas: 'bg-red-50 border-red-200 text-red-800',
  Asia: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  Oceania: 'bg-purple-50 border-purple-200 text-purple-800',
};

const PROVIDERS = [
  { value: '', label: 'Default Provider' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'mistral', label: 'Mistral' },
  { value: 'groq', label: 'Groq' },
];

export default function JurisdictionsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [selectedJurisdiction, setSelectedJurisdiction] = useState<string | null>(null);
  const [referenceContext, setReferenceContext] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: profiles } = useQuery<JurisdictionProfile[]>({
    queryKey: ['jurisdiction-profiles'],
    queryFn: async () => {
      const res = await apiClient.get<JurisdictionProfile[]>('/jurisdiction-profiles');
      return res.data;
    },
  });

  const { data: comparisons, isLoading } = useQuery<AiAnalysis[]>({
    queryKey: ['jurisdiction-comparisons', id],
    queryFn: async () => {
      const res = await apiClient.get<AiAnalysis[]>(`/legislative-items/${id}/jurisdiction-comparisons`);
      return res.data;
    },
  });

  const compareMutation = useMutation({
    mutationFn: async () => {
      if (!selectedJurisdiction) return;
      const res = await apiClient.post(`/legislative-items/${id}/jurisdiction-comparison`, {
        targetJurisdiction: selectedJurisdiction,
        referenceContext: referenceContext || undefined,
        provider: selectedProvider || undefined,
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['jurisdiction-comparisons', id] });
      if (data?.id) setExpandedId(data.id);
    },
  });

  // Group by region for profile grid
  const regionGroups: Record<string, JurisdictionProfile[]> = {};
  for (const p of profiles ?? []) {
    if (!regionGroups[p.region]) regionGroups[p.region] = [];
    regionGroups[p.region].push(p);
  }

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
            <h1 className="text-2xl font-bold text-primary-navy">Cross-Jurisdiction Comparison</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Compare this legislative item with legislation from other jurisdictions
            </p>
          </div>
        </div>

        {/* Jurisdiction Selector Grid */}
        <div className="mb-6 rounded-xl border border-border bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-primary-navy mb-4">Select Target Jurisdiction</h2>

          {Object.entries(regionGroups).map(([region, jurs]) => (
            <div key={region} className="mb-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {region}
              </p>
              <div className="flex flex-wrap gap-2">
                {jurs.map((j) => (
                  <button
                    key={j.code}
                    onClick={() => setSelectedJurisdiction(j.code === selectedJurisdiction ? null : j.code)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      selectedJurisdiction === j.code
                        ? 'border-primary-navy bg-primary-navy text-white'
                        : `${REGION_COLORS[region] ?? 'bg-gray-50 border-gray-200 text-gray-700'} hover:opacity-80`
                    }`}
                  >
                    {j.name}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {selectedJurisdiction && (
            <div className="mt-4 pt-4 border-t border-border space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Reference Context (optional)
                </label>
                <textarea
                  value={referenceContext}
                  onChange={(e) => setReferenceContext(e.target.value)}
                  rows={3}
                  placeholder="Provide any additional context or specific areas of interest..."
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30 resize-none"
                />
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
                  onClick={() => compareMutation.mutate()}
                  disabled={compareMutation.isPending}
                  className="rounded-lg bg-primary-navy px-4 py-2 text-sm font-medium text-white hover:bg-primary-navy/90 transition-colors disabled:opacity-50"
                >
                  {compareMutation.isPending ? 'Comparing...' : `Compare with ${selectedJurisdiction}`}
                </button>
                {compareMutation.isError && (
                  <p className="text-xs text-red-500">Comparison failed. Please try again.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Comparisons History */}
        <h2 className="text-sm font-semibold text-primary-navy mb-3">Comparison Results</h2>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : !comparisons?.length ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/10 py-10 text-center">
            <p className="text-sm text-muted-foreground">No comparisons yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Select a jurisdiction above to start.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {comparisons.map((analysis) => {
              const result = analysis.result as ComparisonResult;
              const isExpanded = expandedId === analysis.id;

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
                    <span className="font-semibold text-primary-navy text-sm">
                      {result?.targetJurisdiction ?? 'Unknown Jurisdiction'}
                    </span>
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

                  {/* Expanded */}
                  {isExpanded && result && (
                    <div className="border-t border-border px-5 py-5 space-y-5">
                      <div className="grid grid-cols-2 gap-6">
                        {/* Similarities */}
                        {result.similarities?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">
                              Similarities
                            </p>
                            <ul className="space-y-1">
                              {result.similarities.map((s, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-green-400" />
                                  {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Differences */}
                        {result.differences?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-2">
                              Differences
                            </p>
                            <ul className="space-y-1">
                              {result.differences.map((d, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />
                                  {d}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Gaps */}
                        {result.gaps?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">
                              Gaps
                            </p>
                            <ul className="space-y-1">
                              {result.gaps.map((g, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                                  {g}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Best Practices */}
                        {result.bestPractices?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-primary-navy uppercase tracking-wide mb-2">
                              Best Practices
                            </p>
                            <ul className="space-y-1">
                              {result.bestPractices.map((bp, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-gold" />
                                  {bp}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Recommendations */}
                      {result.recommendations?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-primary-navy uppercase tracking-wide mb-2">
                            Recommendations
                          </p>
                          <ul className="space-y-1">
                            {result.recommendations.map((r, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                                {r}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Disclaimer */}
                      <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
                        <p className="text-xs text-yellow-700 leading-relaxed">
                          <span className="font-semibold">Disclaimer: </span>
                          {result.disclaimer}
                        </p>
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
