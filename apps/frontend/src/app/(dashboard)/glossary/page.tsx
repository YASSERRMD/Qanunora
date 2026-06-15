'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface GlossaryTerm {
  id: string;
  termEn: string;
  termAr?: string;
  definition: string;
  definitionAr?: string;
  domain: string;
  category?: string;
  status: string;
  isPreferred: boolean;
  source?: string;
  createdAt: string;
  createdBy: { firstName: string; lastName: string };
}

interface SuggestResult {
  suggestions: { termEn: string; termAr?: string; definition: string; domain: string; category?: string }[];
  created: number;
  skipped: number;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  DEPRECATED: 'bg-gray-100 text-gray-500',
  PROPOSED: 'bg-yellow-100 text-yellow-700',
  REJECTED: 'bg-red-100 text-red-700',
};

const DOMAINS = ['general', 'legal', 'constitutional', 'administrative', 'contract_law', 'criminal', 'commercial', 'labor', 'environmental', 'international'];

export default function GlossaryPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [domain, setDomain] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [page, setPage] = useState(1);

  // Suggest modal state
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestText, setSuggestText] = useState('');
  const [suggestResult, setSuggestResult] = useState<SuggestResult | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['glossary', search, domain, status, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '30' });
      if (search) params.set('search', search);
      if (domain) params.set('domain', domain);
      if (status) params.set('status', status);
      const res = await apiClient.get<{ data: GlossaryTerm[]; total: number; totalPages: number }>(
        `/glossary?${params}`,
      );
      return res.data;
    },
  });

  const suggestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<SuggestResult>('/glossary/suggest', {
        text: suggestText,
        domain: 'legal',
      });
      return res.data;
    },
    onSuccess: (result) => {
      setSuggestResult(result);
      queryClient.invalidateQueries({ queryKey: ['glossary'] });
    },
  });

  const deprecateMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/glossary/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['glossary'] }),
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
  }

  return (
    <main className="flex-1 p-8" aria-labelledby="glossary-heading">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 id="glossary-heading" className="text-2xl font-bold text-primary-navy">
              Legal Terminology Glossary
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Bilingual EN/AR glossary of official legal and legislative terms
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { setShowSuggest(true); setSuggestResult(null); }}
              className="rounded-lg border border-primary-gold px-4 py-2 text-sm font-medium text-primary-gold hover:bg-primary-gold hover:text-white transition-colors"
              aria-haspopup="dialog"
            >
              Suggest from Text
            </button>
            <button
              onClick={() => window.open('/api/v1/glossary/export?format=json', '_blank')}
              className="rounded-lg bg-primary-navy px-4 py-2 text-sm font-medium text-white hover:bg-opacity-90 transition-colors"
              aria-label="Export glossary as JSON"
            >
              Export JSON
            </button>
          </div>
        </header>

        {/* Filters */}
        <form onSubmit={handleSearch} className="mb-6 flex flex-wrap gap-3" role="search" aria-label="Filter glossary terms">
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search English or Arabic term..."
            aria-label="Search terms"
            className="flex-1 min-w-48 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary-gold focus:outline-none"
          />
          <select
            value={domain}
            onChange={(e) => { setDomain(e.target.value); setPage(1); }}
            aria-label="Filter by domain"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none"
          >
            <option value="">All domains</option>
            {DOMAINS.map((d) => (
              <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            aria-label="Filter by status"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PROPOSED">Proposed</option>
            <option value="DEPRECATED">Deprecated</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </form>

        {/* Terms table */}
        {isLoading ? (
          <p className="py-12 text-center text-muted-foreground" aria-live="polite">Loading glossary...</p>
        ) : !data?.data.length ? (
          <div className="py-16 text-center rounded-xl border border-border bg-white">
            <p className="text-muted-foreground">No terms found.</p>
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted-foreground">{data.total} term{data.total !== 1 ? 's' : ''}</p>
            <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
              <table className="w-full text-sm" role="table" aria-label="Glossary terms">
                <thead>
                  <tr className="border-b border-border bg-gray-50">
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      English Term
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Arabic Term
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">
                      Definition
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">
                      Domain
                    </th>
                    <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.data.map((term) => (
                    <tr key={term.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-primary-navy">{term.termEn}</span>
                          {term.isPreferred && (
                            <span className="rounded bg-blue-50 px-1 py-0.5 text-xs text-blue-600" title="Preferred term">★</span>
                          )}
                        </div>
                        {term.category && (
                          <span className="text-xs text-muted-foreground">{term.category.replace(/_/g, ' ')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right" dir="rtl" lang="ar">
                        <span className="text-gray-700">{term.termAr ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell max-w-xs">
                        <p className="line-clamp-2">{term.definition}</p>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground capitalize">{term.domain.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[term.status] ?? 'bg-gray-100'}`}>
                          {term.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {term.status !== 'DEPRECATED' && (
                          <button
                            onClick={() => {
                              if (confirm(`Deprecate "${term.termEn}"?`)) {
                                deprecateMutation.mutate(term.id);
                              }
                            }}
                            className="text-xs text-red-500 hover:text-red-700 hover:underline"
                            aria-label={`Deprecate term: ${term.termEn}`}
                          >
                            Deprecate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <nav aria-label="Pagination" className="mt-6 flex justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50"
                aria-label="Previous page"
              >
                &larr; Prev
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-600">Page {page} of {data.totalPages}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= data.totalPages}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50"
                aria-label="Next page"
              >
                Next &rarr;
              </button>
            </nav>
          </>
        )}
      </div>

      {/* AI Suggest Modal */}
      {showSuggest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="suggest-modal-title"
        >
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 id="suggest-modal-title" className="text-lg font-semibold text-primary-navy">
                AI Term Suggestion
              </h2>
              <button
                onClick={() => { setShowSuggest(false); setSuggestResult(null); setSuggestText(''); }}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close dialog"
              >
                &times;
              </button>
            </div>

            {!suggestResult ? (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  Paste legal text and the AI will identify important terms to add to the glossary as PROPOSED entries.
                </p>
                <label htmlFor="suggest-text" className="block text-sm font-medium text-gray-700 mb-2">
                  Legal Text
                </label>
                <textarea
                  id="suggest-text"
                  rows={8}
                  value={suggestText}
                  onChange={(e) => setSuggestText(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-gold focus:outline-none resize-y"
                  placeholder="Paste legislative text, contract clauses, or regulatory language here..."
                  aria-label="Legal text for term extraction"
                />
                <div className="mt-4 flex justify-end gap-3">
                  <button
                    onClick={() => setShowSuggest(false)}
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => suggestMutation.mutate()}
                    disabled={suggestText.trim().length < 20 || suggestMutation.isPending}
                    className="rounded-md bg-primary-navy px-4 py-2 text-sm font-medium text-white hover:bg-opacity-90 disabled:opacity-50"
                  >
                    {suggestMutation.isPending ? 'Analysing...' : 'Suggest Terms'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-4 rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700" role="status">
                  Created {suggestResult.created} new term{suggestResult.created !== 1 ? 's' : ''} as PROPOSED
                  {suggestResult.skipped > 0 && ` (${suggestResult.skipped} already existed)`}.
                </div>
                <ul className="space-y-3" role="list">
                  {suggestResult.suggestions.map((s, i) => (
                    <li key={i} className="rounded-lg border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="font-semibold text-primary-navy">{s.termEn}</span>
                        {s.termAr && <span className="text-gray-600" dir="rtl" lang="ar">{s.termAr}</span>}
                      </div>
                      <p className="text-sm text-gray-600">{s.definition}</p>
                      <div className="mt-1 flex gap-2 text-xs text-muted-foreground">
                        <span>{s.domain}</span>
                        {s.category && <span>{s.category.replace(/_/g, ' ')}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => { setShowSuggest(false); setSuggestResult(null); setSuggestText(''); }}
                    className="rounded-md bg-primary-navy px-4 py-2 text-sm font-medium text-white hover:bg-opacity-90"
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
