'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

const ITEM_TYPES = [
  'DRAFT_LAW', 'BILL', 'AMENDMENT', 'REGULATION',
  'CABINET_DECISION', 'CIRCULAR', 'POLICY_DRAFT',
];
const STATUSES = [
  'DRAFTING', 'INTERNAL_REVIEW', 'COMMITTEE_REVIEW', 'PUBLIC_CONSULTATION',
  'LEGAL_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED',
];
const PRIORITIES = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];
const CONFIDENTIALITY_LEVELS = ['PUBLIC', 'INTERNAL', 'RESTRICTED', 'CONFIDENTIAL', 'TOP_SECRET'];

interface LegislativeItemDetail {
  id: string;
  title: string;
  titleAr?: string;
  type: string;
  status: string;
  priority: string;
  confidentialityLevel: string;
  description?: string;
  objective?: string;
  targetEnactmentDate?: string;
  ministry: { id: string; name: string };
}

export default function EditLegislativeItemPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const { data: item } = useQuery({
    queryKey: ['legislative-item', id],
    queryFn: async () => {
      const res = await apiClient.get<LegislativeItemDetail>(`/legislative-items/${id}`);
      return res.data;
    },
  });

  const [form, setForm] = useState({
    title: '',
    titleAr: '',
    type: '',
    status: '',
    priority: 'MEDIUM',
    confidentialityLevel: 'INTERNAL',
    description: '',
    objective: '',
    targetEnactmentDate: '',
  });

  useEffect(() => {
    if (item) {
      setForm({
        title: item.title,
        titleAr: item.titleAr ?? '',
        type: item.type,
        status: item.status,
        priority: item.priority,
        confidentialityLevel: item.confidentialityLevel,
        description: item.description ?? '',
        objective: item.objective ?? '',
        targetEnactmentDate: item.targetEnactmentDate
          ? new Date(item.targetEnactmentDate).toISOString().split('T')[0]
          : '',
      });
    }
  }, [item]);

  const update = useMutation({
    mutationFn: async (data: typeof form) => {
      const payload = {
        ...data,
        titleAr: data.titleAr || undefined,
        description: data.description || undefined,
        objective: data.objective || undefined,
        targetEnactmentDate: data.targetEnactmentDate || undefined,
      };
      const res = await apiClient.patch<{ id: string }>(`/legislative-items/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['legislative-items'] });
      void queryClient.invalidateQueries({ queryKey: ['legislative-item', id] });
      router.push(`/legislative-items/${id}`);
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string | string[] } } };
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Failed to update item'));
    },
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    update.mutate(form);
  };

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-sm text-muted-foreground hover:text-primary-navy"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-primary-navy">Edit Legislative Item</h1>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-white p-8 shadow-sm space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Title *</label>
              <input
                name="title"
                required
                value={form.title}
                onChange={handleChange}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Title (Arabic)</label>
              <input
                name="titleAr"
                value={form.titleAr}
                onChange={handleChange}
                dir="rtl"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30 text-right"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Type</label>
              <select name="type" value={form.type} onChange={handleChange} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30">
                {ITEM_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
              <select name="status" value={form.status} onChange={handleChange} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30">
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Priority</label>
              <select name="priority" value={form.priority} onChange={handleChange} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30">
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Confidentiality</label>
              <select name="confidentialityLevel" value={form.confidentialityLevel} onChange={handleChange} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30">
                {CONFIDENTIALITY_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Target Enactment Date</label>
              <input type="date" name="targetEnactmentDate" value={form.targetEnactmentDate} onChange={handleChange} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
              <textarea name="description" value={form.description} onChange={handleChange} rows={3} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30 resize-none" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Objective</label>
              <textarea name="objective" value={form.objective} onChange={handleChange} rows={2} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30 resize-none" />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={() => router.back()} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/30">
              Cancel
            </button>
            <button type="submit" disabled={update.isPending} className="rounded-lg bg-primary-navy px-6 py-2 text-sm font-medium text-white hover:bg-primary-navy/90 disabled:opacity-50">
              {update.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
