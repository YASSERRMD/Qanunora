'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';

const DEFAULT_WORKFLOW_RULES = [
  { from: 'DRAFT', to: 'INTERNAL_REVIEW', action: 'SUBMIT' },
  { from: 'INTERNAL_REVIEW', to: 'LEGAL_REVIEW', action: 'SEND_TO_LEGAL' },
  { from: 'LEGAL_REVIEW', to: 'COMMITTEE_REVIEW', action: 'SEND_TO_COMMITTEE' },
  { from: 'COMMITTEE_REVIEW', to: 'MINISTERIAL_APPROVAL', action: 'FORWARD_TO_MINISTER' },
  { from: 'MINISTERIAL_APPROVAL', to: 'CABINET_REVIEW', action: 'SUBMIT_TO_CABINET' },
  { from: 'CABINET_REVIEW', to: 'PUBLISHED', action: 'PUBLISH' },
  { from: 'PUBLISHED', to: 'ENACTED', action: 'ENACT' },
];

export default function WorkflowConfigPage() {
  const queryClient = useQueryClient();
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saveMsg, setSaveMsg] = useState('');

  const { data: config, isLoading } = useQuery({
    queryKey: ['admin', 'workflow-config'],
    queryFn: async () => {
      const res = await apiClient.get<Record<string, unknown>>('/admin/workflow-config');
      return res.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      return apiClient.put('/admin/workflow-config', { config: { [key]: value } });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'workflow-config'] });
      setSaveMsg('Saved');
      setEditKey(null);
      setTimeout(() => setSaveMsg(''), 2000);
    },
  });

  const startEdit = (key: string) => {
    setEditKey(key);
    setEditValue(String(config?.[key] ?? ''));
  };

  const handleSave = () => {
    if (!editKey) return;
    const num = Number(editValue);
    updateMutation.mutate({ key: editKey, value: isNaN(num) ? editValue : num });
  };

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center gap-3">
          <Link href="/admin" className="text-sm text-muted-foreground hover:text-primary-navy">
            ← Admin
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-2xl font-bold text-primary-navy">Workflow Configuration</h1>
        </div>

        {/* Lifecycle rules (read-only visual) */}
        <div className="mb-6 rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-primary-navy">Lifecycle Transition Rules</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase text-muted-foreground">
                  <th className="pb-2 pr-4">From Status</th>
                  <th className="pb-2 pr-4">Action</th>
                  <th className="pb-2">To Status</th>
                </tr>
              </thead>
              <tbody>
                {DEFAULT_WORKFLOW_RULES.map((rule, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-4">
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono">
                        {rule.from}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-primary-gold font-medium">{rule.action}</td>
                    <td className="py-2">
                      <span className="rounded bg-primary-navy/10 px-2 py-0.5 text-xs font-mono text-primary-navy">
                        {rule.to}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Editable thresholds */}
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-primary-navy">Threshold Settings</h2>
            {saveMsg && <span className="text-sm text-green-600 font-medium">{saveMsg}</span>}
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : Object.keys(config ?? {}).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No workflow settings configured yet. Use PUT /admin/workflow-config to add them.
            </p>
          ) : (
            <div className="space-y-3">
              {Object.entries(config ?? {}).map(([key, value]) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-64 truncate font-mono text-sm text-slate-700">{key}</span>
                  {editKey === key ? (
                    <>
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1 rounded-lg border border-primary-gold px-3 py-1.5 text-sm focus:outline-none"
                      />
                      <button
                        onClick={handleSave}
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
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-slate-600">{String(value)}</span>
                      <button
                        onClick={() => startEdit(key)}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-primary-gold hover:text-primary-gold"
                      >
                        Edit
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
