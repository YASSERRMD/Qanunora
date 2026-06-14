'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

type ImpactCategory = 'SOCIAL' | 'ECONOMIC' | 'ADMINISTRATIVE' | 'LEGAL' | 'OPERATIONAL' | 'ENVIRONMENTAL';
type ImpactSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NEGLIGIBLE';

const ALL_CATEGORIES: ImpactCategory[] = ['SOCIAL', 'ECONOMIC', 'ADMINISTRATIVE', 'LEGAL', 'OPERATIONAL', 'ENVIRONMENTAL'];

const SEVERITY_COLORS: Record<ImpactSeverity, string> = {
  CRITICAL: 'bg-red-100 text-red-700 border-red-200',
  HIGH: 'bg-orange-100 text-orange-700 border-orange-200',
  MEDIUM: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  LOW: 'bg-green-100 text-green-700 border-green-200',
  NEGLIGIBLE: 'bg-gray-100 text-gray-600 border-gray-200',
};

const SEVERITY_DOT: Record<ImpactSeverity, string> = {
  CRITICAL: 'bg-red-500',
  HIGH: 'bg-orange-500',
  MEDIUM: 'bg-yellow-500',
  LOW: 'bg-green-500',
  NEGLIGIBLE: 'bg-gray-400',
};

const PROVIDERS = [
  { value: '', label: 'Default Provider' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'mistral', label: 'Mistral' },
  { value: 'groq', label: 'Groq' },
  { value: 'deepseek', label: 'DeepSeek' },
];

interface ImpactResult {
  category: ImpactCategory;
  severity: ImpactSeverity;
  summary: string;
  affectedGroups: string[];
  positiveEffects: string[];
  negativeEffects: string[];
  risks: string[];
  recommendations: string[];
  confidenceScore: number;
  disclaimer: string;
}

interface AiAnalysis {
  id: string;
  analysisType: string;
  provider: string;
  model: string;
  result: ImpactResult;
  confidenceScore: number | null;
  processingTimeMs: number | null;
  createdAt: string;
  requestedBy: { firstName: string; lastName: string };
}

interface ImpactSummary {
  itemId: string;
  overallRiskLevel: ImpactSeverity;
  totalCategories: number;
  analyzedCategories: ImpactCategory[];
  severityBreakdown: Partial<Record<ImpactSeverity, number>>;
  topRisks: string[];
  topRecommendations: string[];
  averageConfidenceScore: number;
  analyses: Array<{
    id: string;
    category: ImpactCategory;
    severity: ImpactSeverity;
    summary: string;
    createdAt: string;
  }>;
}

export default function ImpactPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<ImpactCategory[]>(['SOCIAL', 'ECONOMIC']);
  const [selectedProvider, setSelectedProvider] = useState('');

  const { data: analyses, isLoading } = useQuery<AiAnalysis[]>({
    queryKey: ['impact-analyses', id],
    queryFn: async () => {
      const res = await apiClient.get<AiAnalysis[]>(`/legislative-items/${id}/impact-analysis`);
      return res.data;
    },
  });

  const { data: summary } = useQuery<ImpactSummary>({
    queryKey: ['impact-summary', id],
    queryFn: async () => {
      const res = await apiClient.get<ImpactSummary>(`/legislative-items/${id}/impact-analysis/summary`);
      return res.data;
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/legislative-items/${id}/impact-analysis`, {
        categories: selectedCategories,
        provider: selectedProvider || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['impact-analyses', id] });
      queryClient.invalidateQueries({ queryKey: ['impact-summary', id] });
      setShowGenerateForm(false);
    },
  });

  const toggleCategory = (cat: ImpactCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  // Group analyses by category — keep latest per category
  const latestByCategory = new Map<string, AiAnalysis>();
  if (analyses) {
    for (const a of [...analyses].reverse()) {
      const cat = a.analysisType.replace('IMPACT_', '');
      latestByCategory.set(cat, a);
    }
  }
  const categoryCards = Array.from(latestByCategory.values());

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-sm text-muted-foreground hover:text-primary-navy"
          >
            Back
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-primary-navy">Impact Analysis</h1>
            <p className="text-sm text-muted-foreground mt-1">
              AI-powered legislative impact assessment across key domains
            </p>
          </div>
          <button
            onClick={() => setShowGenerateForm(!showGenerateForm)}
            className="rounded-lg bg-primary-navy px-4 py-2 text-sm font-medium text-white hover:bg-primary-navy/90 transition-colors"
          >
            + Generate Analysis
          </button>
        </div>

        {/* Overall Risk Indicator */}
        {summary && summary.totalCategories > 0 && (
          <div className="mb-6 rounded-xl border border-border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Overall Risk Level
                </p>
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${
                      SEVERITY_COLORS[summary.overallRiskLevel] ?? SEVERITY_COLORS.NEGLIGIBLE
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${SEVERITY_DOT[summary.overallRiskLevel] ?? ''}`} />
                    {summary.overallRiskLevel}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {summary.totalCategories} categories analysed &middot;{' '}
                    {Math.round(summary.averageConfidenceScore * 100)}% avg confidence
                  </span>
                </div>
              </div>
              <div className="flex gap-4 text-center">
                {Object.entries(summary.severityBreakdown).map(([sev, count]) => (
                  <div key={sev}>
                    <p className="text-lg font-bold text-primary-navy">{count}</p>
                    <p className="text-xs text-muted-foreground">{sev.toLowerCase()}</p>
                  </div>
                ))}
              </div>
            </div>

            {summary.topRisks.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Top Risks
                </p>
                <ul className="space-y-1">
                  {summary.topRisks.map((risk, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Generate Form */}
        {showGenerateForm && (
          <div className="mb-6 rounded-xl border border-primary-gold/30 bg-primary-gold/5 p-5">
            <h2 className="text-sm font-semibold text-primary-navy mb-4">Generate Impact Analysis</h2>

            <div className="mb-4">
              <label className="block text-xs font-medium text-muted-foreground mb-2">
                Select Categories
              </label>
              <div className="flex flex-wrap gap-2">
                {ALL_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      selectedCategories.includes(cat)
                        ? 'border-primary-navy bg-primary-navy text-white'
                        : 'border-border bg-white text-muted-foreground hover:border-primary-navy/50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4 max-w-xs">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                AI Provider
              </label>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending || selectedCategories.length === 0}
                className="rounded-lg bg-primary-navy px-4 py-2 text-sm font-medium text-white hover:bg-primary-navy/90 transition-colors disabled:opacity-50"
              >
                {generateMutation.isPending ? 'Analysing...' : `Analyse ${selectedCategories.length} categories`}
              </button>
              <button
                onClick={() => setShowGenerateForm(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/30 transition-colors"
              >
                Cancel
              </button>
              {generateMutation.isError && (
                <p className="text-xs text-red-500">Analysis failed. Please try again.</p>
              )}
            </div>
          </div>
        )}

        {/* Category Cards Grid */}
        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Loading analyses...</div>
        ) : categoryCards.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/10 py-12 text-center">
            <p className="text-sm text-muted-foreground">No impact analyses yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Click &quot;Generate Analysis&quot; to create one.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {categoryCards.map((analysis) => {
              const result = analysis.result as ImpactResult;
              const isExpanded = expandedId === analysis.id;
              const category = analysis.analysisType.replace('IMPACT_', '') as ImpactCategory;
              const severity = result?.severity ?? 'NEGLIGIBLE';

              return (
                <div
                  key={analysis.id}
                  className="rounded-xl border border-border bg-white shadow-sm overflow-hidden"
                >
                  {/* Card Header */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/10 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : analysis.id)}
                  >
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {category}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${
                        SEVERITY_COLORS[severity as ImpactSeverity] ?? SEVERITY_COLORS.NEGLIGIBLE
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${SEVERITY_DOT[severity as ImpactSeverity] ?? ''}`} />
                      {severity}
                    </span>
                    <span className="text-xs text-muted-foreground">{isExpanded ? '▲' : '▼'}</span>
                  </div>

                  {/* Summary always visible */}
                  {result?.summary && (
                    <div className="px-4 pb-3">
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {result.summary}
                      </p>
                    </div>
                  )}

                  {/* Expanded Content */}
                  {isExpanded && result && (
                    <div className="border-t border-border px-4 py-4 space-y-4">
                      {/* Affected Groups */}
                      {result.affectedGroups?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-primary-navy uppercase tracking-wide mb-1">
                            Affected Groups
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {result.affectedGroups.map((g, i) => (
                              <span key={i} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                                {g}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Positive & Negative */}
                      <div className="grid grid-cols-2 gap-3">
                        {result.positiveEffects?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-green-700 mb-1">Positive</p>
                            <ul className="space-y-0.5">
                              {result.positiveEffects.map((e, i) => (
                                <li key={i} className="text-xs text-muted-foreground flex gap-1">
                                  <span className="text-green-500 shrink-0">+</span> {e}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {result.negativeEffects?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-red-700 mb-1">Negative</p>
                            <ul className="space-y-0.5">
                              {result.negativeEffects.map((e, i) => (
                                <li key={i} className="text-xs text-muted-foreground flex gap-1">
                                  <span className="text-red-500 shrink-0">-</span> {e}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Risks */}
                      {result.risks?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-primary-navy uppercase tracking-wide mb-1">
                            Risks
                          </p>
                          <ul className="space-y-0.5">
                            {result.risks.map((r, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />
                                {r}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Recommendations */}
                      {result.recommendations?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-primary-navy uppercase tracking-wide mb-1">
                            Recommendations
                          </p>
                          <ul className="space-y-0.5">
                            {result.recommendations.map((r, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-gold" />
                                {r}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Disclaimer */}
                      <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2">
                        <p className="text-xs text-yellow-700 leading-relaxed">
                          <span className="font-semibold">Disclaimer: </span>
                          {result.disclaimer}
                        </p>
                      </div>

                      {/* Meta */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
                        <span>
                          {analysis.provider} &middot; {new Date(analysis.createdAt).toLocaleDateString()}
                        </span>
                        {analysis.confidenceScore !== null && (
                          <span className="text-primary-gold font-medium">
                            {Math.round((analysis.confidenceScore ?? 0) * 100)}% confidence
                          </span>
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
