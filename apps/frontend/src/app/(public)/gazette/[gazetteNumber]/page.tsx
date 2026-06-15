'use client';

import { useParams } from 'next/navigation';
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
  archiveUrl?: string;
  publicationStatus: string;
  legislativeItem: { title: string; referenceNumber: string; type: string; status: string };
}

export default function PublicGazetteEntryPage() {
  const params = useParams();
  const gazetteNumber = params.gazetteNumber as string;

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['public-gazette-entry', gazetteNumber],
    queryFn: async () => {
      const res = await apiClient.get(`/gazette/archive?query=${encodeURIComponent(gazetteNumber)}`);
      return res.data as GazetteEntry[];
    },
  });

  const entry = entries.find((e) => e.gazetteNumber === gazetteNumber) ?? entries[0];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold text-gray-700">Gazette Entry Not Found</h1>
        <p className="text-gray-500">No published entry found for gazette number: {gazetteNumber}</p>
        <Link href="/gazette" className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">
          Back to Archive
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-indigo-900 text-white py-10 px-6">
        <div className="max-w-4xl mx-auto">
          <Link href="/gazette" className="text-indigo-300 text-sm hover:text-white mb-4 inline-block">
            ← Official Gazette Archive
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <span className="font-mono font-bold text-2xl">{entry.gazetteNumber}</span>
            <span className="px-3 py-1 bg-green-500 text-white rounded-full text-xs font-medium">
              {entry.publicationStatus}
            </span>
          </div>
          <h1 className="text-2xl font-bold mb-1">{entry.title}</h1>
          {entry.titleAr && (
            <p className="text-indigo-200 text-lg text-right" dir="rtl">{entry.titleAr}</p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Metadata Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="font-semibold text-gray-800 mb-4 text-lg">Publication Details</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 block text-xs uppercase tracking-wide mb-1">Gazette Number</span>
              <span className="font-mono font-bold text-indigo-700">{entry.gazetteNumber}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-xs uppercase tracking-wide mb-1">Reference Number</span>
              <span className="font-mono">{entry.legislativeItem.referenceNumber}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-xs uppercase tracking-wide mb-1">Type</span>
              <span>{entry.legislativeItem.type.replace(/_/g, ' ')}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-xs uppercase tracking-wide mb-1">Status</span>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs">{entry.publicationStatus}</span>
            </div>
            {entry.issueDate && (
              <div>
                <span className="text-gray-500 block text-xs uppercase tracking-wide mb-1">Issue Date</span>
                <span>{new Date(entry.issueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
            )}
            {entry.effectiveDate && (
              <div>
                <span className="text-gray-500 block text-xs uppercase tracking-wide mb-1">Effective Date</span>
                <span>{new Date(entry.effectiveDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
            )}
            {entry.publishedAt && (
              <div>
                <span className="text-gray-500 block text-xs uppercase tracking-wide mb-1">Date of Publication</span>
                <span>{new Date(entry.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
            )}
          </div>
        </div>

        {/* Archive URL */}
        {entry.archiveUrl && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="font-semibold text-gray-800 mb-3">Official Document</h2>
            <a
              href={entry.archiveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
            >
              Download Official Gazette Entry
            </a>
          </div>
        )}

        {/* Footer note */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          <strong>Note:</strong> This is the official digital publication of the gazette entry. For legal purposes,
          the printed official gazette remains the authoritative source. This portal provides access for information only.
        </div>

        <div className="text-center">
          <Link href="/gazette" className="text-indigo-600 text-sm hover:underline">
            ← Return to Official Gazette Archive
          </Link>
        </div>
      </div>
    </div>
  );
}
