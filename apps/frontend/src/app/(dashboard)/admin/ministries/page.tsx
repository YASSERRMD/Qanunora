'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';

interface Ministry {
  id: string;
  name: string;
  code: string;
  description?: string;
}

export default function MinistriesAdminPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', code: '', description: '' });
  const [error, setError] = useState('');

  const { data: ministries, isLoading } = useQuery({
    queryKey: ['admin', 'ministries'],
    queryFn: async () => {
      const res = await apiClient.get<Ministry[]>('/admin/ministries');
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (dto: { name: string; code: string; description?: string }) =>
      apiClient.post('/admin/ministries', dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'ministries'] });
      setShowForm(false);
      setForm({ name: '', code: '', description: '' });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to create ministry';
      setError(String(msg));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...dto }: { id: string; name?: string; code?: string; description?: string }) =>
      apiClient.patch(`/admin/ministries/${id}`, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'ministries'] });
      setEditId(null);
      setForm({ name: '', code: '', description: '' });
    },
  });

  const handleSubmit = () => {
    setError('');
    if (!form.name.trim() || !form.code.trim()) {
      setError('Name and code are required');
      return;
    }
    if (editId) {
      updateMutation.mutate({ id: editId, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const startEdit = (m: Ministry) => {
    setEditId(m.id);
    setForm({ name: m.name, code: m.code, description: m.description ?? '' });
    setShowForm(true);
    setError('');
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm({ name: '', code: '', description: '' });
    setError('');
  };

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-sm text-muted-foreground hover:text-primary-navy">
              ← Admin
            </Link>
            <span className="text-muted-foreground">/</span>
            <h1 className="text-2xl font-bold text-primary-navy">Ministries</h1>
          </div>
          <button
            onClick={() => { setShowForm(true); setEditId(null); setForm({ name: '', code: '', description: '' }); }}
            className="rounded-lg bg-primary-navy px-4 py-2 text-sm font-semibold text-white hover:bg-deep-navy transition-colors"
          >
            Add Ministry
          </button>
        </div>

        {showForm && (
          <div className="mb-6 rounded-xl border border-primary-gold/40 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-primary-navy">
              {editId ? 'Edit Ministry' : 'New Ministry'}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-gold"
                  placeholder="Ministry of Justice"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Code *</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-gold"
                  placeholder="MOJ"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-gold"
                  placeholder="Optional description"
                />
              </div>
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="rounded-lg bg-primary-gold px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {editId ? 'Update' : 'Create'}
              </button>
              <button onClick={cancelForm} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-slate-700">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading ministries...</div>
          ) : !ministries?.length ? (
            <div className="py-12 text-center text-muted-foreground">No ministries yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Description</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ministries.map((m) => (
                  <tr key={m.id} className="border-b border-border/50 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-primary-navy">{m.name}</td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-primary-navy/10 px-2 py-0.5 text-xs font-mono text-primary-navy">
                        {m.code}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{m.description ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => startEdit(m)}
                        className="text-xs font-medium text-primary-gold hover:text-primary-navy transition-colors"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
