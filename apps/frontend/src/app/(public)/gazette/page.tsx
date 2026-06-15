'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';

interface GazetteEntry {
  id: string;
  gazetteNumber: string;
  title: string;
  titleAr?: string;
  effectiveDate?: string;
  issueDate?: string;
  publishedAt?: string;
  legislativeItem: { title: string; referenceNumber: string; type: string };
}

export default function PublicGazetteArchivePage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [query, setQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['public-gazette', year, query],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('year', String(year));
      if (query) params.set('query', query);
      const res = await apiClient.get(`/gazette/archive?${params.toString()}`);
      return res.data as GazetteEntry[];
    },
  });

  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-indigo-900 text-white py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">Official Gazette Archive</h1>
          <p className="text-indigo-200">Published legislative instruments and official notices</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-64">
            <input
              className="w-full border rounded px-4 py-2 text-sm"
              placeholder="Search by title or gazette number..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setQuery(searchInput); }}
            />
          </div>
          <button
            onClick={() => setQuery(searchInput)}
            className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
          >
            Search
          </button>
          <div className="flex gap-2">
            {years.map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`px-3 py-1.5 rounded text-sm ${year === y ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-4">
        {isLoading ? (
          <div className="text-center text-gray-400 py-12">Loading gazette entries...</div>
        ) : entries.length === 0 ? (
          <div className="text-center text-gray-400 py-12">No published gazette entries found for {year}</div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="bg-white rounded-lg shadow p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono font-bold text-indigo-700 text-sm">{entry.gazetteNumber}</span>
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                      {entry.legislativeItem.type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <h2 className="text-lg font-semibold text-gray-800 mb-1">{entry.title}</h2>
                  {entry.titleAr && (
                    <p className="text-gray-600 text-sm mb-2 text-right" dir="rtl">{entry.titleAr}</p>
                  )}
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>Ref: {entry.legislativeItem.referenceNumber}</span>
                    {entry.issueDate && <span>Issue Date: {new Date(entry.issueDate).toLocaleDateString()}</span>}
                    {entry.effectiveDate && <span>Effective: {new Date(entry.effectiveDate).toLocaleDateString()}</span>}
                    {entry.publishedAt && <span>Published: {new Date(entry.publishedAt).toLocaleDateString()}</span>}
                  </div>
                </div>
                <Link
                  href={`/gazette/${entry.gazetteNumber}`}
                  className="ml-4 px-4 py-2 border border-indigo-300 text-indigo-700 rounded text-sm hover:bg-indigo-50 whitespace-nowrap"
                >
                  View Entry
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
