'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

interface Consultation {
  id: string;
  title: string;
  description?: string;
  status: string;
  openDate?: string;
  closeDate?: string;
  createdAt: string;
  legislativeItem: { id: string; referenceNumber: string; title: string; type: string };
  _count: { feedback: number };
}

export default function PublicConsultationsPage() {
  const router = useRouter();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get<Consultation[]>(`${API_BASE}/public/consultations`)
      .then((res) => setConsultations(res.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-[#1B2A4A]">Open Consultations</h1>
        <p className="mt-2 text-gray-600">
          Share your views on proposed legislation and help shape national policy.
        </p>
      </header>

      {loading ? (
        <p className="py-12 text-center text-gray-500" aria-live="polite">Loading consultations...</p>
      ) : consultations.length === 0 ? (
        <p className="py-12 text-center text-gray-500">No open consultations at this time.</p>
      ) : (
        <ul className="space-y-4" role="list">
          {consultations.map((c) => {
            const daysLeft = c.closeDate
              ? Math.ceil((new Date(c.closeDate).getTime() - Date.now()) / 86400000)
              : null;

            return (
              <li key={c.id}>
                <article
                  className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:border-[#C9A84C] hover:shadow-md transition-all cursor-pointer"
                  onClick={() => router.push(`/public/consultations/${c.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && router.push(`/public/consultations/${c.id}`)}
                  tabIndex={0}
                  aria-label={`Consultation: ${c.title}. ${c._count.feedback} responses.`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div>
                      <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 mb-2">
                        OPEN
                      </span>
                      <h2 className="text-lg font-semibold text-[#1B2A4A]">{c.title}</h2>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {c.legislativeItem.referenceNumber} — {c.legislativeItem.title}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-2xl font-bold text-[#1B2A4A]">{c._count.feedback}</p>
                      <p className="text-xs text-gray-500">responses</p>
                    </div>
                  </div>

                  {c.description && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">{c.description}</p>
                  )}

                  <footer className="flex flex-wrap gap-4 text-xs text-gray-400 pt-3 border-t border-gray-100">
                    {c.openDate && <span>Opened: {new Date(c.openDate).toLocaleDateString()}</span>}
                    {c.closeDate && (
                      <span className={daysLeft !== null && daysLeft <= 7 ? 'font-semibold text-red-500' : ''}>
                        Closes: {new Date(c.closeDate).toLocaleDateString()}
                        {daysLeft !== null && daysLeft > 0 && ` (${daysLeft} days left)`}
                        {daysLeft !== null && daysLeft <= 0 && ' (closing today)'}
                      </span>
                    )}
                    <span className="ml-auto text-[#C9A84C] font-medium">Submit feedback &rarr;</span>
                  </footer>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
