'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

interface Consultation {
  id: string;
  title: string;
  description?: string;
  closeDate?: string;
  legislativeItem: { referenceNumber: string; title: string };
  _count: { feedback: number };
}

interface Bill {
  id: string;
  referenceNumber: string;
  title: string;
  type: string;
  publishedAt?: string;
  ministry: { name: string };
}

export default function PublicPortalHome() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      axios.get<Consultation[]>(`${API_BASE}/public/consultations`),
      axios.get<{ data: Bill[] }>(`${API_BASE}/public/bills?limit=6`),
    ])
      .then(([c, b]) => {
        setConsultations(c.data.slice(0, 4));
        setBills(b.data.data);
      })
      .finally(() => setLoading(false));
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (search.trim()) {
      router.push(`/public/bills?search=${encodeURIComponent(search)}`);
    }
  }

  return (
    <div>
      {/* Hero */}
      <section className="bg-[#1B2A4A] py-20 text-center" aria-labelledby="portal-heading">
        <div className="mx-auto max-w-3xl px-4">
          <h1 id="portal-heading" className="text-4xl font-bold text-white mb-4">
            Legislative Transparency Portal
          </h1>
          <p className="text-lg text-gray-300 mb-8">
            Access published laws, participate in consultations, and shape your country&apos;s legislation.
          </p>
          <form onSubmit={handleSearch} role="search" aria-label="Search published laws">
            <div className="flex overflow-hidden rounded-lg shadow-lg">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search published laws and regulations..."
                aria-label="Search query"
                className="flex-1 px-5 py-3 text-gray-900 focus:outline-none text-sm"
              />
              <button
                type="submit"
                className="bg-[#C9A84C] px-6 py-3 text-sm font-semibold text-white hover:bg-[#b8973b] transition-colors"
              >
                Search
              </button>
            </div>
          </form>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-12">
        {/* Open Consultations */}
        <section aria-labelledby="consultations-heading">
          <div className="flex items-center justify-between mb-6">
            <h2 id="consultations-heading" className="text-2xl font-bold text-[#1B2A4A]">
              Open Consultations
            </h2>
            <a href="/public/consultations" className="text-sm font-medium text-[#C9A84C] hover:underline">
              View all &rarr;
            </a>
          </div>

          {loading ? (
            <p className="text-gray-500" aria-live="polite">Loading consultations...</p>
          ) : consultations.length === 0 ? (
            <p className="text-gray-500">No open consultations at this time.</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2" role="list">
              {consultations.map((c) => (
                <li key={c.id}>
                  <a
                    href={`/public/consultations/${c.id}`}
                    className="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-[#C9A84C] hover:shadow-md transition-all"
                    aria-label={`Consultation: ${c.title}`}
                  >
                    <h3 className="font-semibold text-[#1B2A4A] mb-1">{c.title}</h3>
                    <p className="text-xs text-gray-500 mb-2">{c.legislativeItem.referenceNumber} — {c.legislativeItem.title}</p>
                    {c.description && (
                      <p className="text-sm text-gray-600 line-clamp-2">{c.description}</p>
                    )}
                    <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                      <span>{c._count.feedback} responses</span>
                      {c.closeDate && (
                        <span>Closes: {new Date(c.closeDate).toLocaleDateString()}</span>
                      )}
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent Published Laws */}
        <section aria-labelledby="bills-heading">
          <div className="flex items-center justify-between mb-6">
            <h2 id="bills-heading" className="text-2xl font-bold text-[#1B2A4A]">
              Recently Published Laws
            </h2>
            <a href="/public/bills" className="text-sm font-medium text-[#C9A84C] hover:underline">
              Browse all &rarr;
            </a>
          </div>

          {loading ? (
            <p className="text-gray-500" aria-live="polite">Loading laws...</p>
          ) : bills.length === 0 ? (
            <p className="text-gray-500">No published laws found.</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
              {bills.map((bill) => (
                <li key={bill.id}>
                  <a
                    href={`/public/bills/${bill.id}`}
                    className="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-[#C9A84C] hover:shadow-md transition-all h-full"
                    aria-label={`Law: ${bill.title}`}
                  >
                    <span className="inline-flex rounded-full bg-[#1B2A4A]/10 px-2 py-0.5 text-xs font-medium text-[#1B2A4A] mb-2">
                      {bill.type.replace(/_/g, ' ')}
                    </span>
                    <h3 className="font-semibold text-[#1B2A4A] mb-1 line-clamp-2">{bill.title}</h3>
                    <p className="text-xs text-gray-500 font-mono">{bill.referenceNumber}</p>
                    <p className="text-xs text-gray-400 mt-1">{bill.ministry.name}</p>
                    {bill.publishedAt && (
                      <p className="text-xs text-gray-400 mt-2">
                        Published: {new Date(bill.publishedAt).toLocaleDateString()}
                      </p>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
