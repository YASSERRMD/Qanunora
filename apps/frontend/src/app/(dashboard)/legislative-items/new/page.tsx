'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

const ITEM_TYPES = [
  'DRAFT_LAW', 'BILL', 'AMENDMENT', 'REGULATION',
  'CABINET_DECISION', 'CIRCULAR', 'POLICY_DRAFT',
];

const PRIORITIES = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];
const CONFIDENTIALITY_LEVELS = ['PUBLIC', 'INTERNAL', 'RESTRICTED', 'CONFIDENTIAL', 'TOP_SECRET'];

interface FormState {
  title: string;
  titleAr: string;
  type: string;
  ministryId: string;
  priority: string;
  confidentialityLevel: string;
  description: string;
  objective: string;
  targetEnactmentDate: string;
}

export default function NewLegislativeItemPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const [form, setForm] = useState<FormState>({
    title: '',
    titleAr: '',
    type: '',
    ministryId: '',
    priority: 'MEDIUM',
    confidentialityLevel: 'INTERNAL',
    description: '',
    objective: '',
    targetEnactmentDate: '',
  });

  const create = useMutation({
    mutationFn: async (data: FormState) => {
      const payload = {
        ...data,
        titleAr: data.titleAr || undefined,
        description: data.description || undefined,
        objective: data.objective || undefined,
        targetEnactmentDate: data.targetEnactmentDate || undefined,
      };
      const res = await apiClient.post<{ id: string }>('/legislative-items', payload);
      return res.data;
    },
    onSuccess: (item) => {
      void queryClient.invalidateQueries({ queryKey: ['legislative-items'] });
      router.push(`/legislative-items/${item.id}`);
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string | string[] } } };
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Failed to create item'));
    },
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    create.mutate(form);
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
          <h1 className="text-2xl font-bold text-primary-navy">New Legislative Item</h1>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-white p-8 shadow-sm space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Title (English) *
              </label>
              <input
                name="title"
                required
                value={form.title}
                onChange={handleChange}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30"
                placeholder="e.g. Draft Consumer Protection Law"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Title (Arabic)
              </label>
              <input
                name="titleAr"
                value={form.titleAr}
                onChange={handleChange}
                dir="rtl"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30 text-right"
                placeholder="العنوان بالعربية"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Type *</label>
              <select
                name="type"
                required
                value={form.type}
                onChange={handleChange}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30"
              >
                <option value="">Select type...</option>
                {ITEM_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Ministry ID *
              </label>
              <input
                name="ministryId"
                required
                value={form.ministryId}
                onChange={handleChange}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30"
                placeholder="UUID of ministry"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Priority</label>
              <select
                name="priority"
                value={form.priority}
                onChange={handleChange}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Confidentiality Level
              </label>
              <select
                name="confidentialityLevel"
                value={form.confidentialityLevel}
                onChange={handleChange}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30"
              >
                {CONFIDENTIALITY_LEVELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Target Enactment Date
              </label>
              <input
                type="date"
                name="targetEnactmentDate"
                value={form.targetEnactmentDate}
                onChange={handleChange}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={3}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30 resize-none"
                placeholder="Describe the legislative item..."
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Objective
              </label>
              <textarea
                name="objective"
                value={form.objective}
                onChange={handleChange}
                rows={2}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30 resize-none"
                placeholder="State the legislative objective..."
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/30"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="rounded-lg bg-primary-navy px-6 py-2 text-sm font-medium text-white hover:bg-primary-navy/90 disabled:opacity-50"
            >
              {create.isPending ? 'Creating...' : 'Create Item'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
