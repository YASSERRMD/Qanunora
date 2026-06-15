'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

interface TranslationRequest {
  id: string;
  sourceText: string;
  translatedText?: string;
  sourceLang: string;
  targetLang: string;
  status: string;
  confidenceScore?: number;
  provider?: string;
  createdAt: string;
  createdBy: { firstName: string; lastName: string };
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  UNDER_REVIEW: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
};

export default function AiTranslationPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [sourceText, setSourceText] = useState('');
  const [sourceLang, setSourceLang] = useState('ar');
  const [targetLang, setTargetLang] = useState('en');

  const { data: result, isLoading } = useQuery({
    queryKey: ['translations'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: TranslationRequest[]; total: number }>(
        '/ai-translation?limit=30',
      );
      return res.data;
    },
  });

  const translateMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/ai-translation/translate', { sourceText, sourceLang, targetLang, domain: 'legal' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['translations'] });
      setShowForm(false);
      setSourceText('');
    },
  });

  return (
    <main className="flex-1 p-8" aria-labelledby="translation-heading">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 id="translation-heading" className="text-2xl font-bold text-primary-navy">
              AI Translation
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Translate legal documents with AI assistance and formal legal language
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-primary-navy px-4 py-2 text-sm font-medium text-white hover:bg-opacity-90 transition-colors"
          >
            + New Translation
          </button>
        </header>

        {/* Inline translation form */}
        {showForm && (
          <section className="mb-6 rounded-xl border border-border bg-white p-6" aria-labelledby="form-heading">
            <h2 id="form-heading" className="font-semibold text-primary-navy mb-4">New Translation Request</h2>
            <div className="grid gap-4 sm:grid-cols-2 mb-4">
              <div>
                <label htmlFor="sourceLang" className="block text-sm font-medium text-gray-700 mb-1">
                  Source Language
                </label>
                <select
                  id="sourceLang"
                  value={sourceLang}
                  onChange={(e) => setSourceLang(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-gold focus:outline-none"
                >
                  <option value="ar">Arabic (العربية)</option>
                  <option value="en">English</option>
                  <option value="fr">French</option>
                </select>
              </div>
              <div>
                <label htmlFor="targetLang" className="block text-sm font-medium text-gray-700 mb-1">
                  Target Language
                </label>
                <select
                  id="targetLang"
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-gold focus:outline-none"
                >
                  <option value="en">English</option>
                  <option value="ar">Arabic (العربية)</option>
                  <option value="fr">French</option>
                </select>
              </div>
            </div>
            <div className="mb-4">
              <label htmlFor="sourceText" className="block text-sm font-medium text-gray-700 mb-1">
                Source Text
              </label>
              <textarea
                id="sourceText"
                rows={6}
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-gold focus:outline-none resize-y"
                placeholder="Enter the legal text to translate..."
                dir={sourceLang === 'ar' ? 'rtl' : 'ltr'}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => translateMutation.mutate()}
                disabled={!sourceText.trim() || translateMutation.isPending}
                className="rounded-md bg-primary-navy px-4 py-2 text-sm font-medium text-white hover:bg-opacity-90 disabled:opacity-50"
              >
                {translateMutation.isPending ? 'Translating...' : 'Translate'}
              </button>
            </div>
          </section>
        )}

        {/* Requests list */}
        {isLoading ? (
          <p className="py-12 text-center text-muted-foreground" aria-live="polite">Loading translations...</p>
        ) : !result?.data.length ? (
          <div className="py-16 text-center rounded-xl border border-border bg-white">
            <p className="text-muted-foreground">No translation requests yet. Create your first translation above.</p>
          </div>
        ) : (
          <ul className="space-y-3" role="list">
            {result.data.map((req) => (
              <li key={req.id}>
                <article
                  className="rounded-xl border border-border bg-white p-5 shadow-sm hover:border-primary-gold hover:shadow-md transition-all cursor-pointer"
                  onClick={() => router.push(`/ai-translation/${req.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && router.push(`/ai-translation/${req.id}`)}
                  tabIndex={0}
                  role="button"
                  aria-label={`Translation request from ${req.sourceLang} to ${req.targetLang}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            STATUS_COLORS[req.status] ?? 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {req.status.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {req.sourceLang.toUpperCase()} &rarr; {req.targetLang.toUpperCase()}
                        </span>
                        {req.confidenceScore !== undefined && req.confidenceScore !== null && (
                          <span className="text-xs text-muted-foreground">
                            Confidence: {Math.round(req.confidenceScore * 100)}%
                          </span>
                        )}
                        {req.provider && (
                          <span className="text-xs text-muted-foreground capitalize">via {req.provider}</span>
                        )}
                      </div>
                      <p
                        className="text-sm text-gray-700 line-clamp-2"
                        dir={req.sourceLang === 'ar' ? 'rtl' : 'ltr'}
                      >
                        {req.sourceText}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-muted-foreground">
                        {req.createdBy.firstName} {req.createdBy.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
