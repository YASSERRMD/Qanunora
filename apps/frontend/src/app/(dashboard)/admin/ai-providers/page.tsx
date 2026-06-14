'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';

const PROVIDERS = [
  { key: 'openai', label: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  { key: 'anthropic', label: 'Anthropic', models: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5'] },
  { key: 'gemini', label: 'Google Gemini', models: ['gemini-1.5-pro', 'gemini-1.5-flash'] },
];

export default function AiProvidersAdminPage() {
  const queryClient = useQueryClient();
  const [saveMsg, setSaveMsg] = useState('');
  const [localConfigs, setLocalConfigs] = useState<Record<string, { model: string }>>({});

  const { data: config, isLoading } = useQuery({
    queryKey: ['admin', 'ai-providers'],
    queryFn: async () => {
      const res = await apiClient.get<Record<string, unknown>>('/admin/ai-providers');
      return res.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ provider, data }: { provider: string; data: Record<string, unknown> }) =>
      apiClient.put(`/admin/ai-providers/${provider}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'ai-providers'] });
      setSaveMsg('Settings saved');
      setTimeout(() => setSaveMsg(''), 2500);
    },
  });

  const getModel = (provider: string) => {
    if (localConfigs[provider]?.model) return localConfigs[provider].model;
    const key = `${provider}.model`;
    return String(config?.[key] ?? '');
  };

  const setModel = (provider: string, model: string) => {
    setLocalConfigs((prev) => ({ ...prev, [provider]: { model } }));
  };

  const handleSave = (provider: string) => {
    const model = getModel(provider);
    if (!model) return;
    updateMutation.mutate({ provider, data: { model } });
  };

  const defaultProvider = String(config?.['default.provider'] ?? '');

  const handleSetDefault = (provider: string) => {
    updateMutation.mutate({ provider: 'default', data: { provider } });
  };

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center gap-3">
          <Link href="/admin" className="text-sm text-muted-foreground hover:text-primary-navy">
            ← Admin
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-2xl font-bold text-primary-navy">AI Provider Settings</h1>
          {saveMsg && <span className="text-sm text-green-600 font-medium ml-auto">{saveMsg}</span>}
        </div>

        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          API keys are managed via environment variables and are never displayed or stored here.
          Only model selection and non-sensitive settings can be configured from this page.
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Loading AI provider config...</div>
        ) : (
          <div className="space-y-4">
            {PROVIDERS.map((provider) => {
              const isDefault = defaultProvider === provider.key;
              const currentModel = getModel(provider.key);

              return (
                <div
                  key={provider.key}
                  className={`rounded-xl border bg-white p-6 shadow-sm ${
                    isDefault ? 'border-primary-gold' : 'border-border'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <h2 className="font-semibold text-primary-navy">{provider.label}</h2>
                      {isDefault && (
                        <span className="rounded-full bg-primary-gold/20 px-2 py-0.5 text-xs font-semibold text-primary-gold">
                          Default
                        </span>
                      )}
                    </div>
                    {!isDefault && (
                      <button
                        onClick={() => handleSetDefault(provider.key)}
                        className="text-xs font-medium text-muted-foreground hover:text-primary-gold transition-colors"
                      >
                        Set as default
                      </button>
                    )}
                  </div>

                  <div className="flex items-end gap-4">
                    <div className="flex-1">
                      <label className="mb-1 block text-sm font-medium text-slate-700">Model</label>
                      <select
                        value={currentModel}
                        onChange={(e) => setModel(provider.key, e.target.value)}
                        className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-gold"
                      >
                        <option value="">— select model —</option>
                        {provider.models.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => handleSave(provider.key)}
                      disabled={!currentModel || updateMutation.isPending}
                      className="rounded-lg bg-primary-gold px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
                    >
                      Save
                    </button>
                  </div>

                  <div className="mt-3">
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">API Key</label>
                    <input
                      type="text"
                      value="****"
                      readOnly
                      className="w-full rounded-lg border border-border bg-gray-50 px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Set via environment variable (e.g. {provider.key.toUpperCase()}_API_KEY)
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
