'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

type SearchMode = 'hybrid' | 'keyword' | 'semantic';

interface SearchResult {
  itemId: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  referenceNumber?: string;
  score: number;
  source: 'keyword' | 'semantic' | 'hybrid';
}

const SOURCE_COLORS: Record<string, string> = {
  keyword: 'bg-blue-100 text-blue-700',
  semantic: 'bg-purple-100 text-purple-700',
  hybrid: 'bg-green-100 text-green-700',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  UNDER_REVIEW: 'bg-yellow-100 text-yellow-700',
  LEGAL_REVIEW: 'bg-orange-100 text-orange-700',
  COMMITTEE_REVIEW: 'bg-indigo-100 text-indigo-700',
  APPROVED: 'bg-green-100 text-green-700',
  PUBLISHED: 'bg-blue-100 text-blue-700',
  REJECTED: 'bg-red-100 text-red-700',
  ARCHIVED: 'bg-gray-100 text-gray-500',
};

const SEARCH_TIPS = [
  'Try searching for a law title or regulation name',
  'Use keywords like "tax", "health", "environment" to find related items',
  'Switch to Semantic mode for context-aware results',
  'Filter by type or status to narrow results',
];

export default function SearchPage() {
  const router = useRouter();
  const [inputValue, setInputValue] = useState('');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('hybrid');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Debounce: apply query 300ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(inputValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  const { data: results, isLoading } = useQuery({
    queryKey: ['semantic-search', query, mode, typeFilter, statusFilter],
    queryFn: async () => {
      if (!query.trim()) return [];
      const params: Record<string, string | number> = {
        q: query,
        mode,
        limit: 20,
      };
      if (typeFilter) params.type = typeFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await apiClient.get<SearchResult[]>('/search', { params });
      return res.data;
    },
    enabled: query.trim().length > 0,
  });

  const handleClear = useCallback(() => {
    setInputValue('');
    setQuery('');
  }, []);

  const truncate = (text: string, length = 150) =>
    text.length > length ? text.slice(0, length) + '…' : text;

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-primary-navy">Search Legislative Items</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Search across all legislative documents using keyword, semantic, or hybrid mode.
          </p>
        </div>

        {/* Search Input */}
        <div className="rounded-xl border border-border bg-white shadow-sm p-5 mb-4">
          <div className="relative mb-4">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Search legislative items..."
              className="w-full rounded-lg border border-border px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy"
              autoFocus
            />
            {inputValue && (
              <button
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary-navy text-lg"
              >
                ×
              </button>
            )}
          </div>

          {/* Mode Toggle + Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg border border-border overflow-hidden">
              {(['keyword', 'semantic', 'hybrid'] as SearchMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-4 py-1.5 text-xs font-medium capitalize transition-colors ${
                    mode === m
                      ? 'bg-primary-navy text-white'
                      : 'bg-white text-muted-foreground hover:bg-muted/20'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs bg-white text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary-navy"
            >
              <option value="">All Types</option>
              <option value="BILL">Bill</option>
              <option value="LAW">Law</option>
              <option value="REGULATION">Regulation</option>
              <option value="DECREE">Decree</option>
              <option value="RESOLUTION">Resolution</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs bg-white text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary-navy"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="LEGAL_REVIEW">Legal Review</option>
              <option value="APPROVED">Approved</option>
              <option value="PUBLISHED">Published</option>
            </select>
          </div>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            Searching...
          </div>
        ) : results && results.length > 0 ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {results.length} result{results.length !== 1 ? 's' : ''} for &quot;{query}&quot;
            </p>
            {results.map((result) => (
              <div
                key={result.itemId}
                onClick={() => router.push(`/legislative-items/${result.itemId}`)}
                className="rounded-xl border border-border bg-white shadow-sm p-5 cursor-pointer hover:border-primary-navy/40 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-semibold text-primary-navy flex-1">{result.title}</h3>
                  <div className="flex gap-1.5 shrink-0">
                    <span className="text-xs font-medium bg-gray-100 text-gray-600 rounded px-2 py-0.5">
                      {result.type}
                    </span>
                    <span
                      className={`text-xs font-medium rounded px-2 py-0.5 ${
                        STATUS_COLORS[result.status] ?? 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {result.status.replace('_', ' ')}
                    </span>
                    <span
                      className={`text-xs font-medium rounded px-2 py-0.5 ${
                        SOURCE_COLORS[result.source] ?? 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {result.source}
                    </span>
                  </div>
                </div>

                {result.referenceNumber && (
                  <p className="text-xs text-muted-foreground font-mono mb-1">
                    {result.referenceNumber}
                  </p>
                )}

                {result.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {truncate(result.description)}
                  </p>
                )}

                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Relevance: {Math.round(result.score * 100)}%
                  </span>
                  <span className="text-xs text-primary-navy font-medium">View details →</span>
                </div>
              </div>
            ))}
          </div>
        ) : query.trim().length > 0 && !isLoading ? (
          <div className="rounded-xl border border-dashed border-border bg-white p-12 text-center">
            <p className="text-muted-foreground font-medium mb-2">No results found for &quot;{query}&quot;</p>
            <p className="text-sm text-muted-foreground mb-4">
              Try a different search term or switch to semantic mode.
            </p>
            <div className="text-left max-w-sm mx-auto">
              <p className="text-xs font-medium text-muted-foreground mb-2">Search tips:</p>
              <ul className="space-y-1">
                {SEARCH_TIPS.map((tip) => (
                  <li key={tip} className="text-xs text-muted-foreground">
                    • {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-white p-12 text-center">
            <p className="text-muted-foreground font-medium mb-4">
              Start typing to search legislative items
            </p>
            <div className="text-left max-w-sm mx-auto">
              <p className="text-xs font-medium text-muted-foreground mb-2">Search tips:</p>
              <ul className="space-y-1">
                {SEARCH_TIPS.map((tip) => (
                  <li key={tip} className="text-xs text-muted-foreground">
                    • {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
