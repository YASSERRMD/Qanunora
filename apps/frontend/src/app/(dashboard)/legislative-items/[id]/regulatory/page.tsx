'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

type DependencyType = 'AMENDS' | 'REPLACES' | 'SUPPLEMENTS' | 'CONFLICTS_WITH' | 'REFERENCES' | 'DEPENDENT_ON';

const DEPENDENCY_COLORS: Record<DependencyType, string> = {
  AMENDS: 'bg-blue-100 text-blue-700',
  REPLACES: 'bg-purple-100 text-purple-700',
  SUPPLEMENTS: 'bg-teal-100 text-teal-700',
  CONFLICTS_WITH: 'bg-red-100 text-red-700',
  REFERENCES: 'bg-gray-100 text-gray-700',
  DEPENDENT_ON: 'bg-orange-100 text-orange-700',
};

const PROVIDERS = [
  { value: '', label: 'Default Provider' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'mistral', label: 'Mistral' },
  { value: 'groq', label: 'Groq' },
];

interface RegulatoryReference {
  id: string;
  referenceType: string;
  referenceName: string;
  referenceNumber: string | null;
  jurisdiction: string | null;
  description: string | null;
  isConflicting: boolean;
  createdAt: string;
}

interface DependencyNode {
  id: string;
  label: string;
  type: 'ITEM' | 'REFERENCE';
}

interface DependencyEdge {
  from: string;
  to: string;
  label: string;
}

interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

export default function RegulatoryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [existingLaws, setExistingLaws] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState({
    referenceType: 'REFERENCES',
    referenceName: '',
    referenceNumber: '',
    jurisdiction: '',
    description: '',
    isConflicting: false,
  });

  const { data: references, isLoading } = useQuery<RegulatoryReference[]>({
    queryKey: ['regulatory-references', id],
    queryFn: async () => {
      const res = await apiClient.get<RegulatoryReference[]>(`/legislative-items/${id}/regulatory-references`);
      return res.data;
    },
  });

  const { data: graph } = useQuery<DependencyGraph>({
    queryKey: ['dependency-graph', id],
    queryFn: async () => {
      const res = await apiClient.get<DependencyGraph>(`/legislative-items/${id}/dependency-graph`);
      return res.data;
    },
  });

  const detectMutation = useMutation({
    mutationFn: async () => {
      const laws = existingLaws
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const res = await apiClient.post(`/legislative-items/${id}/regulatory-mapping/detect`, {
        existingLaws: laws,
        provider: selectedProvider || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regulatory-references', id] });
      queryClient.invalidateQueries({ queryKey: ['dependency-graph', id] });
      setExistingLaws('');
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/legislative-items/${id}/regulatory-references`, {
        ...manualForm,
        referenceNumber: manualForm.referenceNumber || undefined,
        jurisdiction: manualForm.jurisdiction || undefined,
        description: manualForm.description || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regulatory-references', id] });
      queryClient.invalidateQueries({ queryKey: ['dependency-graph', id] });
      setShowManualForm(false);
      setManualForm({
        referenceType: 'REFERENCES',
        referenceName: '',
        referenceNumber: '',
        jurisdiction: '',
        description: '',
        isConflicting: false,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (refId: string) => {
      await apiClient.delete(`/regulatory-references/${refId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regulatory-references', id] });
      queryClient.invalidateQueries({ queryKey: ['dependency-graph', id] });
    },
  });

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-sm text-muted-foreground hover:text-primary-navy"
          >
            Back
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-primary-navy">Regulatory Mapping</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Map this legislative item to existing regulations and detect conflicts
            </p>
          </div>
          <button
            onClick={() => setShowManualForm(!showManualForm)}
            className="rounded-lg border border-primary-navy px-4 py-2 text-sm font-medium text-primary-navy hover:bg-primary-navy/5 transition-colors"
          >
            + Add Reference
          </button>
        </div>

        {/* AI Detection Section */}
        <div className="mb-6 rounded-xl border border-border bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-primary-navy mb-3">AI Detection</h2>
          <div className="mb-3">
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Existing Laws (one per line)
            </label>
            <textarea
              value={existingLaws}
              onChange={(e) => setExistingLaws(e.target.value)}
              rows={4}
              placeholder="Civil Code 2015&#10;Labour Law No. 14 of 2004&#10;Commercial Companies Law"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30 resize-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <div>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => detectMutation.mutate()}
              disabled={detectMutation.isPending || !existingLaws.trim()}
              className="rounded-lg bg-primary-navy px-4 py-2 text-sm font-medium text-white hover:bg-primary-navy/90 transition-colors disabled:opacity-50"
            >
              {detectMutation.isPending ? 'Detecting...' : 'Detect Affected Laws'}
            </button>
            {detectMutation.isError && (
              <p className="text-xs text-red-500">Detection failed. Please try again.</p>
            )}
            {detectMutation.isSuccess && (
              <p className="text-xs text-green-600">Detection complete.</p>
            )}
          </div>
        </div>

        {/* Manual Reference Form */}
        {showManualForm && (
          <div className="mb-6 rounded-xl border border-primary-gold/30 bg-primary-gold/5 p-5">
            <h2 className="text-sm font-semibold text-primary-navy mb-4">Add Reference Manually</h2>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Reference Name *</label>
                <input
                  type="text"
                  value={manualForm.referenceName}
                  onChange={(e) => setManualForm({ ...manualForm, referenceName: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30"
                  placeholder="Law name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Reference Number</label>
                <input
                  type="text"
                  value={manualForm.referenceNumber}
                  onChange={(e) => setManualForm({ ...manualForm, referenceNumber: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30"
                  placeholder="e.g. No. 14 of 2004"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Dependency Type</label>
                <select
                  value={manualForm.referenceType}
                  onChange={(e) => setManualForm({ ...manualForm, referenceType: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30"
                >
                  {['AMENDS', 'REPLACES', 'SUPPLEMENTS', 'CONFLICTS_WITH', 'REFERENCES', 'DEPENDENT_ON'].map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Jurisdiction</label>
                <input
                  type="text"
                  value={manualForm.jurisdiction}
                  onChange={(e) => setManualForm({ ...manualForm, jurisdiction: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30"
                  placeholder="e.g. Qatar"
                />
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
              <textarea
                value={manualForm.description}
                onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30 resize-none"
              />
            </div>
            <div className="mb-4 flex items-center gap-2">
              <input
                type="checkbox"
                id="isConflicting"
                checked={manualForm.isConflicting}
                onChange={(e) => setManualForm({ ...manualForm, isConflicting: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="isConflicting" className="text-xs text-muted-foreground">Mark as conflicting</label>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !manualForm.referenceName.trim()}
                className="rounded-lg bg-primary-navy px-4 py-2 text-sm font-medium text-white hover:bg-primary-navy/90 transition-colors disabled:opacity-50"
              >
                {createMutation.isPending ? 'Saving...' : 'Save Reference'}
              </button>
              <button
                onClick={() => setShowManualForm(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/30 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* References Table */}
        <div className="mb-6 rounded-xl border border-border bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-primary-navy">Regulatory References</h2>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Loading...</div>
          ) : !references?.length ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No references yet. Use AI Detection or add manually.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/10 border-b border-border">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Reference No.</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Jurisdiction</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Type</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Conflict</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {references.map((ref) => (
                  <tr key={ref.id} className="hover:bg-muted/5">
                    <td className="px-4 py-3 font-medium text-primary-navy">{ref.referenceName}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {ref.referenceNumber ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{ref.jurisdiction ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          DEPENDENCY_COLORS[ref.referenceType as DependencyType] ?? 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {ref.referenceType.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {ref.isConflicting ? (
                        <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                          Conflicting
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => deleteMutation.mutate(ref.id)}
                        disabled={deleteMutation.isPending}
                        className="text-xs text-red-500 hover:underline disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Dependency Graph — Text Tree */}
        {graph && graph.nodes.length > 0 && (
          <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-primary-navy mb-4">Dependency Graph</h2>
            <div className="font-mono text-xs text-muted-foreground space-y-1">
              {graph.nodes
                .filter((n) => n.type === 'ITEM')
                .map((root) => (
                  <div key={root.id}>
                    <span className="text-primary-navy font-semibold">[THIS ITEM] {root.label}</span>
                    {graph.edges
                      .filter((e) => e.from === root.id)
                      .map((edge) => {
                        const target = graph.nodes.find((n) => n.id === edge.to);
                        return (
                          <div key={edge.to} className="ml-4 mt-1">
                            <span className="text-primary-gold">{edge.label}</span>
                            {' → '}
                            <span>{target?.label ?? edge.to}</span>
                          </div>
                        );
                      })}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
