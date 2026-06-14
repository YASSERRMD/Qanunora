'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';

interface SystemSetting {
  id: string;
  key: string;
  value: unknown;
  description: string;
  isPublic: boolean;
  updatedAt: string;
}

export default function SystemSettingsPage() {
  const queryClient = useQueryClient();
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: async () => {
      const res = await apiClient.get<SystemSetting[]>('/admin/settings');
      return res.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ key, value, description }: { key: string; value: unknown; description?: string }) =>
      apiClient.put(`/admin/settings/${key}`, { value, description }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      setEditKey(null);
      setSaveMsg('Saved');
      setTimeout(() => setSaveMsg(''), 2000);
    },
  });

  const startEdit = (s: SystemSetting) => {
    setEditKey(s.key);
    setEditValue(typeof s.value === 'object' ? JSON.stringify(s.value) : String(s.value ?? ''));
    setEditDesc(s.description ?? '');
  };

  const handleSaveEdit = () => {
    if (!editKey) return;
    let parsedValue: unknown = editValue;
    try {
      parsedValue = JSON.parse(editValue);
    } catch {
      // not JSON, keep as string
    }
    updateMutation.mutate({ key: editKey, value: parsedValue, description: editDesc });
  };

  const handleCreate = () => {
    if (!newKey.trim()) return;
    let parsedValue: unknown = newValue;
    try {
      parsedValue = JSON.parse(newValue);
    } catch {
      // not JSON
    }
    updateMutation.mutate(
      { key: newKey.trim(), value: parsedValue, description: newDesc },
    );
    setNewKey('');
    setNewValue('');
    setNewDesc('');
    setShowNew(false);
  };

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-sm text-muted-foreground hover:text-primary-navy">
              ← Admin
            </Link>
            <span className="text-muted-foreground">/</span>
            <h1 className="text-2xl font-bold text-primary-navy">System Settings</h1>
            {saveMsg && <span className="text-sm text-green-600 font-medium">{saveMsg}</span>}
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="rounded-lg bg-primary-navy px-4 py-2 text-sm font-semibold text-white hover:bg-deep-navy transition-colors"
          >
            Add Setting
          </button>
        </div>

        {showNew && (
          <div className="mb-6 rounded-xl border border-primary-gold/40 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-primary-navy">New Setting</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Key *</label>
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="e.g. workflow.maxDays"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-gold"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Value</label>
                <input
                  type="text"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="JSON or plain string"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-gold"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-gold"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleCreate}
                disabled={!newKey.trim() || updateMutation.isPending}
                className="rounded-lg bg-primary-gold px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
              >
                Create
              </button>
              <button onClick={() => setShowNew(false)} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading settings...</div>
          ) : !settings?.length ? (
            <div className="py-12 text-center text-muted-foreground">No settings configured.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground w-64">Key</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Value</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Description</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {settings.map((s) => (
                  <tr key={s.key} className="border-b border-border/50 last:border-0 hover:bg-gray-50">
                    {editKey === s.key ? (
                      <td colSpan={4} className="px-4 py-3">
                        <div className="flex items-end gap-3">
                          <span className="font-mono text-sm text-primary-navy w-48 flex-shrink-0">{s.key}</span>
                          <div className="flex-1">
                            <label className="mb-1 block text-xs text-muted-foreground">Value (JSON or plain)</label>
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-full rounded-lg border border-primary-gold px-3 py-1.5 text-sm focus:outline-none"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="mb-1 block text-xs text-muted-foreground">Description</label>
                            <input
                              type="text"
                              value={editDesc}
                              onChange={(e) => setEditDesc(e.target.value)}
                              className="w-full rounded-lg border border-border px-3 py-1.5 text-sm focus:outline-none"
                            />
                          </div>
                          <button
                            onClick={handleSaveEdit}
                            className="rounded-lg bg-primary-gold px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditKey(null)}
                            className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-mono text-sm text-primary-navy">{s.key}</td>
                        <td className="px-4 py-3 max-w-xs truncate text-slate-600">
                          {typeof s.value === 'object' ? JSON.stringify(s.value) : String(s.value ?? '')}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{s.description ?? '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => startEdit(s)}
                            className="text-xs font-medium text-primary-gold hover:text-primary-navy transition-colors"
                          >
                            Edit
                          </button>
                        </td>
                      </>
                    )}
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
