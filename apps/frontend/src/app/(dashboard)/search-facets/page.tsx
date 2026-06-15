'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface FacetItem {
  id?: string;
  name?: string;
  count: number;
}

interface FacetResult {
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byMinistry: FacetItem[];
  byConfidentiality: Record<string, number>;
  byPriority: Record<string, number>;
  byYear: { year: number; count: number }[];
}

interface LegislativeItem {
  id: string;
  referenceNumber: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  confidentialityLevel: string;
  createdAt: string;
  ministry: { id: string; name: string };
}

interface SearchResult {
  data: LegislativeItem[];
  total: number;
  page: number;
  totalPages: number;
  facets: FacetResult;
}

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  hitCount: number;
  lastRunAt: string | null;
  searchType: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFTING: 'bg-blue-100 text-blue-700',
  INTERNAL_REVIEW: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  PUBLISHED: 'bg-emerald-100 text-emerald-700',
  ARCHIVED: 'bg-gray-100 text-gray-500',
};

export default function SearchFacetsPage() {
  const queryClient = useQueryClient();

  // Search state
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);

  // Save search modal
  const [showSave, setShowSave] = useState(false);
  const [saveName, setSaveName] = useState('');

  // Saved searches panel
  const [savedOpen, setSavedOpen] = useState(true);

  const { data: facets } = useQuery({
    queryKey: ['search-facets-base'],
    queryFn: async () => {
      const res = await apiClient.get<FacetResult>('/search-facets/facets');
      return res.data;
    },
  });

  const { data: savedSearches = [], refetch: refetchSaved } = useQuery({
    queryKey: ['saved-searches'],
    queryFn: async () => {
      const res = await apiClient.get<SavedSearch[]>('/search-facets/saved');
      return res.data;
    },
  });

  const executeSearch = useCallback(async (pg = 1) => {
    setSearching(true);
    try {
      const res = await apiClient.post<SearchResult>('/search-facets/search', {
        query: query || undefined,
        status: filters['status']?.length ? filters['status'] : undefined,
        type: filters['type']?.length ? filters['type'] : undefined,
        ministryId: filters['ministryId']?.length ? filters['ministryId'] : undefined,
        priority: filters['priority']?.length ? filters['priority'] : undefined,
        page: pg,
        limit: 20,
      });
      setResults(res.data);
      setPage(pg);
    } finally {
      setSearching(false);
    }
  }, [query, filters]);

  function toggleFilter(dimension: string, value: string) {
    setFilters((prev) => {
      const current = prev[dimension] ?? [];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [dimension]: updated };
    });
  }

  function removeFilter(dimension: string, value: string) {
    toggleFilter(dimension, value);
  }

  function isFilterActive(dimension: string, value: string) {
    return (filters[dimension] ?? []).includes(value);
  }

  const activeFiltersList = Object.entries(filters).flatMap(([dim, vals]) =>
    vals.map((v) => ({ dim, v })),
  );

  const saveSearchMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/search-facets/saved', {
        name: saveName,
        query,
        filters,
        searchType: 'keyword',
      });
      return res.data;
    },
    onSuccess: () => {
      setShowSave(false);
      setSaveName('');
      refetchSaved();
    },
  });

  const deleteSavedMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/search-facets/saved/${id}`),
    onSuccess: () => refetchSaved(),
  });

  const runSavedMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post<SearchResult>(`/search-facets/saved/${id}/run`);
      return res.data;
    },
    onSuccess: (data) => {
      setResults(data);
      refetchSaved();
    },
  });

  const displayFacets = results?.facets ?? facets;

  return (
    <main className="flex-1 flex overflow-hidden" aria-labelledby="search-facets-heading">
      {/* Left: Facet Sidebar */}
      <aside
        className="w-64 border-r border-border bg-white flex flex-col overflow-y-auto shrink-0"
        aria-label="Search facets"
      >
        <div className="px-4 py-4 border-b border-border">
          <h1 id="search-facets-heading" className="text-base font-bold text-primary-navy">
            Advanced Search
          </h1>
        </div>

        {displayFacets && (
          <div className="flex-1 p-4 space-y-5 text-sm">
            {/* Status facet */}
            <FacetGroup
              title="Status"
              items={Object.entries(displayFacets.byStatus).map(([k, v]) => ({ label: k, count: v }))}
              activeValues={filters['status'] ?? []}
              onToggle={(v) => toggleFilter('status', v)}
            />

            {/* Type facet */}
            <FacetGroup
              title="Type"
              items={Object.entries(displayFacets.byType).map(([k, v]) => ({ label: k, count: v }))}
              activeValues={filters['type'] ?? []}
              onToggle={(v) => toggleFilter('type', v)}
            />

            {/* Ministry facet */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Ministry</p>
              <div className="space-y-1.5">
                {displayFacets.byMinistry.slice(0, 8).map((m) => (
                  <label key={m.id} className="flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded px-1.5 py-1 gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isFilterActive('ministryId', m.id!)}
                        onChange={() => toggleFilter('ministryId', m.id!)}
                        className="accent-primary-navy"
                      />
                      <span className="text-xs text-gray-700 truncate max-w-28">{m.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{m.count}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Priority facet */}
            <FacetGroup
              title="Priority"
              items={Object.entries(displayFacets.byPriority).map(([k, v]) => ({ label: k, count: v }))}
              activeValues={filters['priority'] ?? []}
              onToggle={(v) => toggleFilter('priority', v)}
            />

            {/* Year facet */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Year</p>
              <div className="space-y-1.5">
                {displayFacets.byYear.map(({ year, count }) => (
                  <div key={year} className="flex items-center justify-between text-xs px-1.5 py-0.5">
                    <span className="text-gray-700">{year}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search bar */}
        <div className="border-b border-border bg-white px-6 py-4">
          <div className="flex gap-3">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') executeSearch(1); }}
              placeholder="Search by title..."
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary-gold focus:outline-none"
              aria-label="Search query"
            />
            <button
              onClick={() => executeSearch(1)}
              disabled={searching}
              className="rounded-lg bg-primary-navy px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
            {results && (
              <button
                onClick={() => setShowSave(true)}
                className="rounded-lg border border-primary-gold px-4 py-2 text-sm font-medium text-primary-gold hover:bg-primary-gold hover:text-white transition-colors"
              >
                Save Search
              </button>
            )}
          </div>

          {/* Active filter chips */}
          {activeFiltersList.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Active filters">
              {activeFiltersList.map(({ dim, v }) => (
                <span
                  key={`${dim}-${v}`}
                  className="inline-flex items-center gap-1 rounded-full bg-primary-navy/10 px-2.5 py-0.5 text-xs text-primary-navy"
                >
                  <span className="text-muted-foreground capitalize">{dim.replace(/([A-Z])/g, ' $1').trim()}:</span>
                  <span className="font-medium">{v}</span>
                  <button
                    onClick={() => removeFilter(dim, v)}
                    className="ml-1 hover:text-red-600"
                    aria-label={`Remove ${dim} ${v} filter`}
                  >
                    &times;
                  </button>
                </span>
              ))}
              <button
                onClick={() => { setFilters({}); }}
                className="text-xs text-red-500 hover:underline ml-1"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6">
          {!results ? (
            <div className="py-20 text-center text-muted-foreground">
              <p className="text-lg">Enter a search query or select facets to begin</p>
            </div>
          ) : results.data.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">No results found.</p>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                {results.total} result{results.total !== 1 ? 's' : ''} found
              </p>
              <div className="space-y-3">
                {results.data.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border bg-white p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground mb-0.5">{item.referenceNumber}</p>
                        <h3 className="text-sm font-semibold text-primary-navy truncate">{item.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.ministry.name}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap shrink-0">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[item.status] ?? 'bg-gray-100 text-gray-700'}`}>
                          {item.status}
                        </span>
                        <span className="text-xs text-muted-foreground">{item.type.replace(/_/g, ' ')}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {results.totalPages > 1 && (
                <nav className="mt-6 flex justify-center gap-2" aria-label="Pagination">
                  <button
                    onClick={() => executeSearch(page - 1)}
                    disabled={page === 1 || searching}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    &larr; Prev
                  </button>
                  <span className="px-3 py-1.5 text-sm text-gray-600">
                    Page {page} of {results.totalPages}
                  </span>
                  <button
                    onClick={() => executeSearch(page + 1)}
                    disabled={page >= results.totalPages || searching}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    Next &rarr;
                  </button>
                </nav>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right: Saved Searches */}
      <aside
        className={`border-l border-border bg-white flex flex-col shrink-0 transition-all ${savedOpen ? 'w-64' : 'w-10'}`}
        aria-label="Saved searches"
      >
        <button
          onClick={() => setSavedOpen((v) => !v)}
          className="px-3 py-3 text-xs font-semibold text-primary-navy hover:bg-gray-50 flex items-center gap-1 border-b border-border"
          aria-expanded={savedOpen}
        >
          {savedOpen ? '→' : '←'}
          {savedOpen && <span>Saved Searches</span>}
        </button>
        {savedOpen && (
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {savedSearches.length === 0 ? (
              <p className="text-xs text-muted-foreground">No saved searches yet.</p>
            ) : (
              savedSearches.map((ss) => (
                <div key={ss.id} className="rounded-md border border-gray-200 bg-gray-50 p-2.5 text-xs">
                  <p className="font-semibold text-primary-navy truncate">{ss.name}</p>
                  <p className="text-muted-foreground truncate">{ss.query || '(no query)'}</p>
                  <div className="flex items-center justify-between mt-1.5 gap-1">
                    <span className="text-muted-foreground">{ss.hitCount} runs</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => runSavedMutation.mutate(ss.id)}
                        disabled={runSavedMutation.isPending}
                        className="rounded bg-primary-navy px-1.5 py-0.5 text-white hover:bg-opacity-90 disabled:opacity-50"
                      >
                        Run
                      </button>
                      <button
                        onClick={() => deleteSavedMutation.mutate(ss.id)}
                        disabled={deleteSavedMutation.isPending}
                        className="rounded bg-red-100 px-1.5 py-0.5 text-red-600 hover:bg-red-200 disabled:opacity-50"
                      >
                        Del
                      </button>
                    </div>
                  </div>
                  {ss.lastRunAt && (
                    <p className="mt-1 text-muted-foreground">
                      Last run: {new Date(ss.lastRunAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </aside>

      {/* Save search modal */}
      {showSave && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-search-title"
        >
          <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 id="save-search-title" className="text-base font-semibold text-primary-navy">
                Save This Search
              </h2>
              <button onClick={() => setShowSave(false)} className="text-gray-400 hover:text-gray-600" aria-label="Close">
                &times;
              </button>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search Name</label>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm mb-4"
              placeholder="e.g. Banking Regulations 2025"
              aria-label="Search name"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSave(false)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => saveSearchMutation.mutate()}
                disabled={!saveName.trim() || saveSearchMutation.isPending}
                className="rounded-md bg-primary-navy px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saveSearchMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ── Facet Group Component ──────────────────────────────────────────────────

function FacetGroup({
  title,
  items,
  activeValues,
  onToggle,
}: {
  title: string;
  items: { label: string; count: number }[];
  activeValues: string[];
  onToggle: (v: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{title}</p>
      <div className="space-y-1.5">
        {items.map(({ label, count }) => (
          <label key={label} className="flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded px-1.5 py-1 gap-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={activeValues.includes(label)}
                onChange={() => onToggle(label)}
                className="accent-primary-navy"
              />
              <span className="text-xs text-gray-700 capitalize">{label.replace(/_/g, ' ')}</span>
            </div>
            <span className="text-xs text-muted-foreground">{count}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
