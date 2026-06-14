'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';

const SECURITY_FIELDS: {
  key: string;
  label: string;
  description: string;
  type: 'number' | 'text';
  default: string;
}[] = [
  {
    key: 'rateLimit.windowMs',
    label: 'Rate Limit Window (ms)',
    description: 'Time window for rate limiting in milliseconds',
    type: 'number',
    default: '60000',
  },
  {
    key: 'rateLimit.maxRequests',
    label: 'Max Requests per Window',
    description: 'Maximum number of requests allowed per time window',
    type: 'number',
    default: '100',
  },
  {
    key: 'session.durationMinutes',
    label: 'Session Duration (minutes)',
    description: 'How long a user session remains active',
    type: 'number',
    default: '60',
  },
  {
    key: 'session.maxConcurrent',
    label: 'Max Concurrent Sessions',
    description: 'Maximum simultaneous sessions per user',
    type: 'number',
    default: '5',
  },
  {
    key: 'password.minLength',
    label: 'Minimum Password Length',
    description: 'Minimum character length for user passwords',
    type: 'number',
    default: '12',
  },
  {
    key: 'auth.mfaEnabled',
    label: 'MFA Required',
    description: 'Whether multi-factor authentication is enforced',
    type: 'text',
    default: 'false',
  },
];

export default function SecuritySettingsPage() {
  const queryClient = useQueryClient();
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [saveMsg, setSaveMsg] = useState('');
  const [dirty, setDirty] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ['admin', 'security'],
    queryFn: async () => {
      const res = await apiClient.get<Record<string, unknown>>('/admin/security');
      return res.data;
    },
  });

  useEffect(() => {
    if (config) {
      const initial: Record<string, string> = {};
      for (const field of SECURITY_FIELDS) {
        const serverValue = config[field.key];
        initial[field.key] = serverValue !== undefined ? String(serverValue) : field.default;
      }
      setFormValues(initial);
      setDirty(false);
    }
  }, [config]);

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.put('/admin/security', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'security'] });
      setSaveMsg('Security settings saved');
      setDirty(false);
      setTimeout(() => setSaveMsg(''), 2500);
    },
  });

  const handleChange = (key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    const payload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(formValues)) {
      const num = Number(v);
      payload[k] = isNaN(num) ? v : num;
    }
    updateMutation.mutate(payload);
  };

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-3">
          <Link href="/admin" className="text-sm text-muted-foreground hover:text-primary-navy">
            ← Admin
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-2xl font-bold text-primary-navy">Security Settings</h1>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Loading security settings...</div>
        ) : (
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-base font-semibold text-primary-navy">Platform Security Configuration</h2>
              {saveMsg && <span className="text-sm text-green-600 font-medium">{saveMsg}</span>}
            </div>

            <div className="space-y-5">
              {SECURITY_FIELDS.map((field) => (
                <div key={field.key}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-slate-700">{field.label}</label>
                    <span className="text-xs font-mono text-muted-foreground">{field.key}</span>
                  </div>
                  <input
                    type={field.type}
                    value={formValues[field.key] ?? field.default}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-gold"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">{field.description}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-4 border-t border-border pt-4">
              <button
                onClick={handleSave}
                disabled={!dirty || updateMutation.isPending}
                className="rounded-lg bg-primary-navy px-5 py-2 text-sm font-semibold text-white hover:bg-deep-navy transition-colors disabled:opacity-40"
              >
                {updateMutation.isPending ? 'Saving…' : 'Save Settings'}
              </button>
              {dirty && (
                <span className="text-xs text-amber-600">You have unsaved changes</span>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
