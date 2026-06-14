'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

type SummaryType = 'EXECUTIVE' | 'CITIZEN' | 'LEGAL_OFFICER' | 'AMENDMENT' | 'BILL';

const SUMMARY_TYPES: { value: SummaryType; label: string; description: string }[] = [
  { value: 'EXECUTIVE', label: 'Executive', description: 'High-level summary for decision makers' },
  { value: 'CITIZEN', label: 'Citizen', description: 'Plain language for the public' },
  { value: 'LEGAL_OFFICER', label: 'Legal Officer', description: 'Detailed legal analysis' },
  { value: 'AMENDMENT', label: 'Amendment', description: 'Amendment-focused analysis' },
  { value: 'BILL', label: 'Bill', description: 'Full bill structure and provisions' },
];

const PROVIDERS = [
  { value: '', label: 'Default Provider' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'mistral', label: 'Mistral' },
  { value: 'cohere', label: 'Cohere' },
  { value: 'groq', label: 'Groq' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'together', label: 'Together AI' },
  { value: 'ollama', label: 'Ollama (Local)' },
];

const SUMMARY_TYPE_COLORS: Record<SummaryType, string> = {
  EXECUTIVE: 'bg-blue-100 text-blue-700',
  CITIZEN: 'bg-green-100 text-green-700',
  LEGAL_OFFICER: 'bg-purple-100 text-purple-700',
  AMENDMENT: 'bg-orange-100 text-orange-700',
  BILL: 'bg-yellow-100 text-yellow-700',
};

interface SummaryResult {
  title: string;
  summaryType: SummaryType;
  keyPoints: string[];
  summary: string;
  wordCount: number;
  confidenceScore: number;
  disclaimer: string;
  sources: string[];
}

interface AiAnalysis {
  id: string;
  analysisType: string;
  provider: string;
  model: string;
  result: SummaryResult;
  confidenceScore: number | null;
  processingTimeMs: number | null;
  isAiGenerated: boolean;
  reviewedByHuman: boolean;
  disclaimer: string;
  createdAt: string;
  requestedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export default function SummariesPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [selectedType, setSelectedType] = useState<SummaryType>('EXECUTIVE');
  const [selectedProvider, setSelectedProvider] = useState('');

  const { data: summaries, isLoading } = useQuery<AiAnalysis[]>({
    queryKey: ['summaries', id],
    queryFn: async () => {
      const res = await apiClient.get<AiAnalysis[]>(`/legislative-items/${id}/summaries`);
      return res.data;
    },
  });

  const generateMutation = useMutation({
    mutationFn: async ({ summaryType, provider }: { summaryType: SummaryType; provider?: string }) => {
      const res = await apiClient.post<AiAnalysis>(`/legislative-items/${id}/summaries`, {
        summaryType,
        provider: provider || undefined,
      });
      return res.data;
    },
    onSuccess: (newAnalysis) => {
      queryClient.invalidateQueries({ queryKey: ['summaries', id] });
      setShowGenerateForm(false);
      setExpandedId(newAnalysis.id);
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async (analysisId: string) => {
      const res = await apiClient.post<AiAnalysis>(`/ai-analyses/${analysisId}/regenerate`, {});
      return res.data;
    },
    onSuccess: (newAnalysis) => {
      queryClient.invalidateQueries({ queryKey: ['summaries', id] });
      setExpandedId(newAnalysis.id);
    },
  });

  const handleGenerate = () => {
    generateMutation.mutate({ summaryType: selectedType, provider: selectedProvider });
  };

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
            <h1 className="text-2xl font-bold text-primary-navy">AI Summaries</h1>
            <p className="text-sm text-muted-foreground mt-1">
              AI-generated analysis and summaries for this legislative item
            </p>
          </div>
          <button
            onClick={() => setShowGenerateForm(!showGenerateForm)}
            className="rounded-lg bg-primary-navy px-4 py-2 text-sm font-medium text-white hover:bg-primary-navy/90 transition-colors"
          >
            + Generate Summary
          </button>
        </div>

        {/* Generate Form */}
        {showGenerateForm && (
          <div className="mb-6 rounded-xl border border-primary-gold/30 bg-primary-gold/5 p-5">
            <h2 className="text-sm font-semibold text-primary-navy mb-4">Generate New Summary</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Summary Type
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value as SummaryType)}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30"
                >
                  {SUMMARY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label} — {t.description}
                    </option>
                  ))}
                </select>
              </div>
              <div>
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
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
                className="rounded-lg bg-primary-navy px-4 py-2 text-sm font-medium text-white hover:bg-primary-navy/90 transition-colors disabled:opacity-50"
              >
                {generateMutation.isPending ? 'Generating...' : 'Generate'}
              </button>
              <button
                onClick={() => setShowGenerateForm(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/30 transition-colors"
              >
                Cancel
              </button>
              {generateMutation.isError && (
                <p className="text-xs text-red-500">
                  Failed to generate summary. Please try again.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Summaries List */}
        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Loading summaries...</div>
        ) : !summaries?.length ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/10 py-12 text-center">
            <p className="text-sm text-muted-foreground">No AI summaries yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Click &quot;Generate Summary&quot; to create one.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {summaries.map((analysis) => {
              const result = analysis.result as SummaryResult;
              const isExpanded = expandedId === analysis.id;
              const summaryType = result?.summaryType ?? ('EXECUTIVE' as SummaryType);

              return (
                <div
                  key={analysis.id}
                  className="rounded-xl border border-border bg-white shadow-sm overflow-hidden"
                >
                  {/* Card Header */}
                  <div
                    className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-muted/10 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : analysis.id)}
                  >
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        SUMMARY_TYPE_COLORS[summaryType] ?? 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {summaryType.replace(/_/g, ' ')}
                    </span>
                    <span className="inline-flex rounded border border-border bg-muted/20 px-2 py-0.5 text-xs text-muted-foreground">
                      {analysis.provider}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {analysis.model}
                    </span>
                    {analysis.confidenceScore !== null && (
                      <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="text-primary-gold font-medium">
                          {Math.round((analysis.confidenceScore ?? 0) * 100)}%
                        </span>
                        confidence
                      </span>
                    )}
                    {analysis.processingTimeMs && (
                      <span className="text-xs text-muted-foreground">
                        {(analysis.processingTimeMs / 1000).toFixed(1)}s
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(analysis.createdAt).toLocaleDateString()}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        regenerateMutation.mutate(analysis.id);
                      }}
                      disabled={regenerateMutation.isPending}
                      className="ml-2 text-xs text-primary-gold hover:underline disabled:opacity-50"
                    >
                      Regenerate
                    </button>
                    <span className="text-xs text-muted-foreground">
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && result && (
                    <div className="border-t border-border px-5 py-5 space-y-5">
                      {/* Key Points */}
                      {result.keyPoints?.length > 0 && (
                        <div>
                          <h3 className="text-xs font-semibold text-primary-navy uppercase tracking-wide mb-2">
                            Key Points
                          </h3>
                          <ul className="space-y-1">
                            {result.keyPoints.map((point, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-gold" />
                                {point}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Summary Text */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xs font-semibold text-primary-navy uppercase tracking-wide">
                            Summary
                          </h3>
                          {result.wordCount && (
                            <span className="text-xs text-muted-foreground">
                              {result.wordCount} words
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {result.summary}
                        </p>
                      </div>

                      {/* Sources */}
                      {result.sources?.length > 0 && (
                        <div>
                          <h3 className="text-xs font-semibold text-primary-navy uppercase tracking-wide mb-2">
                            Sources
                          </h3>
                          <ul className="space-y-0.5">
                            {result.sources.map((source, i) => (
                              <li key={i} className="text-xs text-muted-foreground">
                                {source}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Disclaimer */}
                      <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
                        <p className="text-xs text-yellow-700 leading-relaxed">
                          <span className="font-semibold">Disclaimer: </span>
                          {result.disclaimer || analysis.disclaimer}
                        </p>
                      </div>

                      {/* Metadata Footer */}
                      <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          Requested by {analysis.requestedBy.firstName} {analysis.requestedBy.lastName}
                        </span>
                        <div className="flex items-center gap-3">
                          {analysis.isAiGenerated && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-blue-600">
                              AI Generated
                            </span>
                          )}
                          {analysis.reviewedByHuman && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-green-600">
                              Human Reviewed
                            </span>
                          )}
                        </div>
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
