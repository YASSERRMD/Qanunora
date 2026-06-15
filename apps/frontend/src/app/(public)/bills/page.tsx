'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { Suspense } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

const ITEM_TYPES = [
  'DRAFT_LAW',
  'BILL',
  'AMENDMENT',
  'REGULATION',
  'CABINET_DECISION',
  'CIRCULAR',
  'POLICY_DRAFT',
];

interface Bill {
  id: string;
  referenceNumber: string;
  title: string;
  titleAr?: string;
  type: string;
  description?: string;
  publishedAt?: string;
  ministry: { name: string };
  _count: { consultations: number; amendments: number };
}

function BillsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [bills, setBills] = useState<Bill[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') ?? '');
  const [page, setPage] = useState(1);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '12' });
      if (search) params.set('search', search);
      if (typeFilter) params.set('type', typeFilter);
      const res = await axios.get<{ data: Bill[]; total: number }>(
        `${API_BASE}/public/bills?${params}`,
      );
      setBills(res.data.data);
      setTotal(res.data.total);
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, page]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    fetchBills();
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-[#1B2A4A]">Published Laws &amp; Regulations</h1>
        <p className="mt-2 text-gray-600">Browse all publicly available legislative documents.</p>
      </header>

      {/* Filters */}
      <form onSubmit={handleSearch} role="search" aria-label="Filter published laws" className="mb-8 flex flex-wrap gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, reference number..."
          aria-label="Search query"
          className="flex-1 min-w-48 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-[#C9A84C] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]"
        />
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          aria-label="Filter by type"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#C9A84C] focus:outline-none"
        >
          <option value="">All types</option>
          {ITEM_TYPES.map((t) => (
            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg bg-[#1B2A4A] px-5 py-2 text-sm font-medium text-white hover:bg-[#253d6b] transition-colors"
        >
          Search
        </button>
      </form>

      {loading ? (
        <p className="py-12 text-center text-gray-500" aria-live="polite">Loading...</p>
      ) : bills.length === 0 ? (
        <p className="py-12 text-center text-gray-500">No results found.</p>
      ) : (
        <>
          <p className="mb-4 text-sm text-gray-500">{total} result{total !== 1 ? 's' : ''}</p>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" role="list">
            {bills.map((bill) => (
              <li key={bill.id}>
                <article
                  className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-[#C9A84C] hover:shadow-md transition-all cursor-pointer h-full"
                  onClick={() => router.push(`/public/bills/${bill.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && router.push(`/public/bills/${bill.id}`)}
                  tabIndex={0}
                  role="button"
                  aria-label={`View ${bill.title}`}
                >
                  <div className="mb-3 flex items-start justify-between">
                    <span className="inline-flex rounded-full bg-[#1B2A4A]/10 px-2 py-0.5 text-xs font-medium text-[#1B2A4A]">
                      {bill.type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">{bill.referenceNumber}</span>
                  </div>
                  <h2 className="font-semibold text-[#1B2A4A] mb-1 line-clamp-2 flex-1">{bill.title}</h2>
                  {bill.titleAr && (
                    <p className="text-sm text-gray-500 text-right mb-1" dir="rtl">{bill.titleAr}</p>
                  )}
                  {bill.description && (
                    <p className="text-sm text-gray-600 line-clamp-2 mt-1">{bill.description}</p>
                  )}
                  <footer className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                    <span>{bill.ministry.name}</span>
                    {bill.publishedAt && (
                      <span>{new Date(bill.publishedAt).toLocaleDateString()}</span>
                    )}
                  </footer>
                </article>
              </li>
            ))}
          </ul>

          {/* Pagination */}
          <nav aria-label="Pagination" className="mt-8 flex justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50 transition-colors"
              aria-label="Previous page"
            >
              &larr; Prev
            </button>
            <span className="px-3 py-1.5 text-sm text-gray-600">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={bills.length < 12}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50 transition-colors"
              aria-label="Next page"
            >
              Next &rarr;
            </button>
          </nav>
        </>
      )}
    </div>
  );
}

export default function BillsPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-gray-500">Loading...</div>}>
      <BillsPageContent />
    </Suspense>
  );
}
