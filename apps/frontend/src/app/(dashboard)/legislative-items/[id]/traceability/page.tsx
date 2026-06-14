'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

const LINK_TYPES = [
  'REQUIREMENT_TO_ARTICLE',
  'AMENDMENT_TO_DISCUSSION',
  'FEEDBACK_TO_CHANGE',
  'APPROVAL_TO_VERSION',
  'DECISION_TO_ITEM',
] as const;

const LINK_TYPE_COLORS: Record<string, string> = {
  REQUIREMENT_TO_ARTICLE: 'bg-blue-100 text-blue-700',
  AMENDMENT_TO_DISCUSSION: 'bg-orange-100 text-orange-700',
  FEEDBACK_TO_CHANGE: 'bg-teal-100 text-teal-700',
  APPROVAL_TO_VERSION: 'bg-green-100 text-green-700',
  DECISION_TO_ITEM: 'bg-purple-100 text-purple-700',
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
  VIEW: 'bg-gray-100 text-gray-700',
  APPROVE: 'bg-emerald-100 text-emerald-700',
  REJECT: 'bg-red-100 text-red-700',
  PUBLISH: 'bg-teal-100 text-teal-700',
  TRANSITION: 'bg-yellow-100 text-yellow-700',
};

interface TraceLink {
  id: string;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  linkType: string;
  description: string | null;
  createdAt: string;
}

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; email: string } | null;
}

export default function TraceabilityPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState({
    sourceType: '',
    sourceId: '',
    targetType: '',
    targetId: '',
    linkType: 'REQUIREMENT_TO_ARTICLE',
    description: '',
  });

  const { data: links, isLoading: linksLoading } = useQuery<TraceLink[]>({
    queryKey: ['trace-links', id],
    queryFn: async () => {
      const res = await apiClient.get<TraceLink[]>(`/legislative-items/${id}/trace-links`);
      return res.data;
    },
  });

  const { data: auditTrail, isLoading: auditLoading } = useQuery<AuditEntry[]>({
    queryKey: ['audit-trail', id],
    queryFn: async () => {
      const res = await apiClient.get<AuditEntry[]>(`/legislative-items/${id}/audit-trail`);
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/legislative-items/${id}/trace-links`, {
        ...form,
        description: form.description || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trace-links', id] });
      setShowCreateForm(false);
      setForm({
        sourceType: '',
        sourceId: '',
        targetType: '',
        targetId: '',
        linkType: 'REQUIREMENT_TO_ARTICLE',
        description: '',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (linkId: string) => {
      await apiClient.delete(`/trace-links/${linkId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trace-links', id] });
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
            <h1 className="text-2xl font-bold text-primary-navy">Legal Traceability</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track relationships between legislative entities and view the audit trail
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="rounded-lg bg-primary-navy px-4 py-2 text-sm font-medium text-white hover:bg-primary-navy/90 transition-colors"
          >
            + Create Link
          </button>
        </div>

        {/* Create Link Form */}
        {showCreateForm && (
          <div className="mb-6 rounded-xl border border-primary-gold/30 bg-primary-gold/5 p-5">
            <h2 className="text-sm font-semibold text-primary-navy mb-4">Create Trace Link</h2>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Source Type *</label>
                <input
                  type="text"
                  value={form.sourceType}
                  onChange={(e) => setForm({ ...form, sourceType: e.target.value })}
                  placeholder="e.g. REQUIREMENT, AMENDMENT"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Source ID *</label>
                <input
                  type="text"
                  value={form.sourceId}
                  onChange={(e) => setForm({ ...form, sourceId: e.target.value })}
                  placeholder="UUID or identifier"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Target Type *</label>
                <input
                  type="text"
                  value={form.targetType}
                  onChange={(e) => setForm({ ...form, targetType: e.target.value })}
                  placeholder="e.g. ARTICLE, VERSION"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Target ID *</label>
                <input
                  type="text"
                  value={form.targetId}
                  onChange={(e) => setForm({ ...form, targetId: e.target.value })}
                  placeholder="UUID or identifier"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Link Type *</label>
                <select
                  value={form.linkType}
                  onChange={(e) => setForm({ ...form, linkType: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30"
                >
                  {LINK_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional description"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => createMutation.mutate()}
                disabled={
                  createMutation.isPending ||
                  !form.sourceType ||
                  !form.sourceId ||
                  !form.targetType ||
                  !form.targetId
                }
                className="rounded-lg bg-primary-navy px-4 py-2 text-sm font-medium text-white hover:bg-primary-navy/90 transition-colors disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Link'}
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/30 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Trace Links Table */}
        <div className="mb-6 rounded-xl border border-border bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-primary-navy">Trace Links</h2>
          </div>

          {linksLoading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Loading...</div>
          ) : !links?.length ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No trace links yet. Create one to start tracking relationships.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/10 border-b border-border">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Source</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Link Type</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Target</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Description</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {links.map((link) => (
                  <tr key={link.id} className="hover:bg-muted/5">
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-primary-navy">{link.sourceType}</p>
                      <p className="font-mono text-xs text-muted-foreground">{link.sourceId.slice(0, 12)}...</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          LINK_TYPE_COLORS[link.linkType] ?? 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {link.linkType.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-primary-navy">{link.targetType}</p>
                      <p className="font-mono text-xs text-muted-foreground">{link.targetId.slice(0, 12)}...</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {link.description ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => deleteMutation.mutate(link.id)}
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

        {/* Audit Trail */}
        <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-primary-navy">Audit Trail</h2>
          </div>

          {auditLoading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Loading audit trail...</div>
          ) : !auditTrail?.length ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No audit log entries for this item.
            </div>
          ) : (
            <div className="px-5 py-4 space-y-3">
              {auditTrail.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3">
                  <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary-gold" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          ACTION_COLORS[entry.action] ?? 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {entry.action}
                      </span>
                      {entry.user && (
                        <span className="text-xs text-muted-foreground">
                          by {entry.user.firstName} {entry.user.lastName}
                        </span>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {entry.ipAddress && (
                      <p className="mt-0.5 text-xs text-muted-foreground">IP: {entry.ipAddress}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
