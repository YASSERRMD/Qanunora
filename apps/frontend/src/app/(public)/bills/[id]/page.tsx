'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

interface StructureNode {
  id: string;
  type: string;
  number: string;
  title?: string;
  content?: string;
  order: number;
  parentId?: string;
}

interface Bill {
  id: string;
  referenceNumber: string;
  title: string;
  titleAr?: string;
  type: string;
  description?: string;
  objective?: string;
  publishedAt?: string;
  ministry: { name: string; nameAr?: string };
  consultations: { id: string; title: string; description?: string; closeDate?: string }[];
  _count: { amendments: number; consultations: number };
}

function buildTree(nodes: StructureNode[]) {
  const roots: StructureNode[] = [];
  const map = new Map<string, StructureNode & { children?: StructureNode[] }>();

  for (const n of nodes) {
    map.set(n.id, { ...n, children: [] });
  }
  for (const [, node] of map) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function StructureTree({ nodes }: { nodes: (StructureNode & { children?: StructureNode[] })[] }) {
  return (
    <ul className="space-y-2" role="tree">
      {nodes.map((node) => (
        <li key={node.id} role="treeitem">
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="rounded-full bg-[#1B2A4A]/10 px-2 py-0.5 text-xs font-medium text-[#1B2A4A]">
                {node.type}
              </span>
              <span className="text-sm font-semibold text-[#1B2A4A]">{node.number}</span>
              {node.title && <span className="text-sm text-gray-700">{node.title}</span>}
            </div>
            {node.content && (
              <p className="text-sm text-gray-600 line-clamp-3 mt-1">{node.content}</p>
            )}
          </div>
          {(node as { children?: StructureNode[] }).children && (node as { children?: StructureNode[] }).children!.length > 0 && (
            <div className="ml-6 mt-2">
              <StructureTree nodes={(node as { children?: StructureNode[] }).children!} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function BillDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [bill, setBill] = useState<Bill | null>(null);
  const [structure, setStructure] = useState<StructureNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      axios.get<Bill>(`${API_BASE}/public/bills/${id}`),
      axios.get<StructureNode[]>(`${API_BASE}/public/bills/${id}/structure`).catch(() => ({ data: [] })),
    ])
      .then(([b, s]) => {
        setBill(b.data);
        setStructure(s.data);
      })
      .catch(() => setError('This law could not be found or is not publicly available.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="py-20 text-center text-gray-500" aria-live="polite">Loading...</div>;
  if (error) return (
    <div className="py-20 text-center" role="alert">
      <p className="text-red-600 mb-4">{error}</p>
      <button onClick={() => router.back()} className="text-[#C9A84C] hover:underline text-sm">
        &larr; Go back
      </button>
    </div>
  );
  if (!bill) return null;

  const tree = buildTree(structure);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-gray-500">
        <ol className="flex items-center gap-2" role="list">
          <li><a href="/public" className="hover:text-[#C9A84C]">Home</a></li>
          <li aria-hidden="true">/</li>
          <li><a href="/public/bills" className="hover:text-[#C9A84C]">Published Laws</a></li>
          <li aria-hidden="true">/</li>
          <li className="text-gray-700 truncate max-w-48" aria-current="page">{bill.referenceNumber}</li>
        </ol>
      </nav>

      <article aria-labelledby="bill-title">
        <header className="mb-8 rounded-xl bg-[#1B2A4A] p-6 text-white">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium">
              {bill.type.replace(/_/g, ' ')}
            </span>
            <span className="font-mono text-xs text-white/60">{bill.referenceNumber}</span>
          </div>
          <h1 id="bill-title" className="text-2xl font-bold">{bill.title}</h1>
          {bill.titleAr && (
            <p className="mt-1 text-lg text-white/80" dir="rtl" lang="ar">{bill.titleAr}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-white/70">
            <span>{bill.ministry.name}</span>
            {bill.publishedAt && (
              <span>Published: {new Date(bill.publishedAt).toLocaleDateString()}</span>
            )}
          </div>
        </header>

        {bill.description && (
          <section aria-labelledby="desc-heading" className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
            <h2 id="desc-heading" className="text-lg font-semibold text-[#1B2A4A] mb-2">Overview</h2>
            <p className="text-gray-700 leading-relaxed">{bill.description}</p>
          </section>
        )}

        {bill.objective && (
          <section aria-labelledby="obj-heading" className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
            <h2 id="obj-heading" className="text-lg font-semibold text-[#1B2A4A] mb-2">Objective</h2>
            <p className="text-gray-700 leading-relaxed">{bill.objective}</p>
          </section>
        )}

        {/* Open Consultations */}
        {bill.consultations.length > 0 && (
          <section aria-labelledby="consultations-heading" className="mb-6 rounded-xl border border-[#C9A84C]/40 bg-amber-50 p-6">
            <h2 id="consultations-heading" className="text-lg font-semibold text-[#1B2A4A] mb-3">
              Open Consultations ({bill.consultations.length})
            </h2>
            <ul className="space-y-3" role="list">
              {bill.consultations.map((c) => (
                <li key={c.id}>
                  <a
                    href={`/public/consultations/${c.id}`}
                    className="flex items-center justify-between rounded-lg bg-white border border-[#C9A84C]/30 px-4 py-3 hover:border-[#C9A84C] transition-colors"
                    aria-label={`Participate in consultation: ${c.title}`}
                  >
                    <div>
                      <p className="font-medium text-[#1B2A4A]">{c.title}</p>
                      {c.closeDate && (
                        <p className="text-xs text-gray-500">Closes: {new Date(c.closeDate).toLocaleDateString()}</p>
                      )}
                    </div>
                    <span className="text-[#C9A84C] text-sm font-medium">Submit Feedback &rarr;</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Legal Structure */}
        {tree.length > 0 && (
          <section aria-labelledby="structure-heading" className="mb-6">
            <h2 id="structure-heading" className="text-lg font-semibold text-[#1B2A4A] mb-4">
              Legal Structure
            </h2>
            <StructureTree nodes={tree} />
          </section>
        )}
      </article>
    </div>
  );
}
