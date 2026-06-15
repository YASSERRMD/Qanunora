'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

type AuthType = 'API_KEY' | 'BEARER_TOKEN' | 'BASIC_AUTH' | 'OAUTH2' | 'NONE';

interface Integration {
  id: string;
  name: string;
  description?: string;
  baseUrl: string;
  authType: AuthType;
  isActive: boolean;
  createdAt: string;
  _count?: { webhooks: number; integrationLogs: number };
}

interface Webhook {
  id: string;
  integrationId: string;
  eventType: string;
  targetUrl: string;
  isActive: boolean;
  maxRetries: number;
  lastTriggeredAt?: string;
  createdAt: string;
}

interface LogEntry {
  id: string;
  eventType: string;
  direction: string;
  success: boolean;
  responseStatus?: number;
  errorMessage?: string;
  retryCount: number;
  targetUrl?: string;
  createdAt: string;
  integration?: { name: string };
}

interface InboundWebhook {
  id: string;
  source: string;
  eventType: string;
  processed: boolean;
  processedAt?: string;
  createdAt: string;
}

const AUTH_COLORS: Record<AuthType, string> = {
  API_KEY: 'bg-yellow-100 text-yellow-700',
  BEARER_TOKEN: 'bg-blue-100 text-blue-700',
  BASIC_AUTH: 'bg-purple-100 text-purple-700',
  OAUTH2: 'bg-green-100 text-green-700',
  NONE: 'bg-gray-100 text-gray-500',
};

export default function IntegrationsAdminPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'webhooks' | 'logs' | 'inbound'>('webhooks');
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ name: '', baseUrl: '', authType: 'API_KEY' as AuthType, description: '' });
  const [webhookForm, setWebhookForm] = useState({ eventType: '', targetUrl: '', secret: '' });
  const [showWebhookForm, setShowWebhookForm] = useState(false);

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: async () => {
      const res = await apiClient.get('/integrations');
      return res.data as Integration[];
    },
  });

  const { data: webhooks = [] } = useQuery({
    queryKey: ['integrations', selectedId, 'webhooks'],
    queryFn: async () => {
      const res = await apiClient.get(`/integrations/${selectedId}/webhooks`);
      return res.data as Webhook[];
    },
    enabled: !!selectedId && activeTab === 'webhooks',
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['integration-logs', selectedId],
    queryFn: async () => {
      const url = selectedId ? `/integrations/logs?integrationId=${selectedId}` : '/integrations/logs';
      const res = await apiClient.get(url);
      return res.data as LogEntry[];
    },
    enabled: activeTab === 'logs',
  });

  const { data: inbound = [] } = useQuery({
    queryKey: ['inbound-webhooks'],
    queryFn: async () => {
      const res = await apiClient.get('/integrations/inbound');
      return res.data as InboundWebhook[];
    },
    enabled: activeTab === 'inbound',
  });

  const createIntegration = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/integrations', form);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      setShowAddForm(false);
      setForm({ name: '', baseUrl: '', authType: 'API_KEY', description: '' });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiClient.patch(`/integrations/${id}`, { isActive: !isActive });
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['integrations'] }),
  });

  const deleteIntegration = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/integrations/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      setSelectedId(null);
    },
  });

  const createWebhook = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/integrations/${selectedId}/webhooks`, webhookForm);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', selectedId, 'webhooks'] });
      setShowWebhookForm(false);
      setWebhookForm({ eventType: '', targetUrl: '', secret: '' });
    },
  });

  const deleteWebhook = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/integrations/webhooks/${id}`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['integrations', selectedId, 'webhooks'] }),
  });

  const retryLog = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/integrations/logs/${id}/retry`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['integration-logs', selectedId] }),
  });

  const processInbound = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/integrations/inbound-process/${id}`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inbound-webhooks'] }),
  });

  const selectedIntegration = integrations.find((i) => i.id === selectedId);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">API Integrations</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
        >
          Add Integration
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow p-5 space-y-4">
          <h2 className="font-semibold text-gray-700">New External Integration</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name</label>
              <input
                className="border rounded px-3 py-1.5 text-sm w-full"
                placeholder="e.g. Ministry ERP"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Base URL</label>
              <input
                className="border rounded px-3 py-1.5 text-sm w-full"
                placeholder="https://api.example.com"
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Auth Type</label>
              <select
                className="border rounded px-3 py-1.5 text-sm w-full"
                value={form.authType}
                onChange={(e) => setForm({ ...form, authType: e.target.value as AuthType })}
              >
                {(['API_KEY', 'BEARER_TOKEN', 'BASIC_AUTH', 'OAUTH2', 'NONE'] as AuthType[]).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Description</label>
              <input
                className="border rounded px-3 py-1.5 text-sm w-full"
                placeholder="Optional description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => createIntegration.mutate()}
              disabled={!form.name || !form.baseUrl || createIntegration.isPending}
              className="px-4 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-40"
            >
              Create
            </button>
            <button onClick={() => setShowAddForm(false)} className="px-4 py-1.5 text-gray-500 text-sm hover:text-gray-700">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Integrations Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold text-gray-700">Configured Integrations</h2>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Base URL', 'Auth Type', 'Webhooks', 'Logs', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {integrations.map((i) => (
                <tr
                  key={i.id}
                  className={`hover:bg-gray-50 cursor-pointer ${selectedId === i.id ? 'bg-indigo-50' : ''}`}
                  onClick={() => setSelectedId(i.id === selectedId ? null : i.id)}
                >
                  <td className="px-4 py-2 font-medium">{i.name}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs font-mono truncate max-w-48">{i.baseUrl}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${AUTH_COLORS[i.authType]}`}>{i.authType}</span>
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{i._count?.webhooks ?? 0}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{i._count?.integrationLogs ?? 0}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleActive.mutate({ id: i.id, isActive: i.isActive }); }}
                      className={`px-2 py-0.5 rounded-full text-xs ${i.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}
                    >
                      {i.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteIntegration.mutate(i.id); }}
                      className="text-red-600 text-xs hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {integrations.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No integrations configured</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Panel */}
      {selectedIntegration && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-4">
            <h2 className="font-semibold text-gray-700">{selectedIntegration.name}</h2>
            <div className="flex gap-2">
              {(['webhooks', 'logs', 'inbound'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 rounded text-xs capitalize ${activeTab === tab ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {tab === 'inbound' ? 'Inbound Queue' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Webhooks Tab */}
          {activeTab === 'webhooks' && (
            <div className="p-4 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium text-gray-700">Webhook Subscriptions</h3>
                <button
                  onClick={() => setShowWebhookForm(true)}
                  className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
                >
                  Add Webhook
                </button>
              </div>
              {showWebhookForm && (
                <div className="border rounded p-4 space-y-3 bg-gray-50">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Event Type</label>
                      <input
                        className="border rounded px-3 py-1.5 text-sm w-full"
                        placeholder="legislative_item.published"
                        value={webhookForm.eventType}
                        onChange={(e) => setWebhookForm({ ...webhookForm, eventType: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Target URL</label>
                      <input
                        className="border rounded px-3 py-1.5 text-sm w-full"
                        placeholder="https://..."
                        value={webhookForm.targetUrl}
                        onChange={(e) => setWebhookForm({ ...webhookForm, targetUrl: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Secret (optional)</label>
                      <input
                        type="password"
                        className="border rounded px-3 py-1.5 text-sm w-full"
                        placeholder="HMAC signing secret"
                        value={webhookForm.secret}
                        onChange={(e) => setWebhookForm({ ...webhookForm, secret: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => createWebhook.mutate()}
                      disabled={!webhookForm.eventType || !webhookForm.targetUrl || createWebhook.isPending}
                      className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-40"
                    >
                      Save
                    </button>
                    <button onClick={() => setShowWebhookForm(false)} className="px-3 py-1.5 text-xs text-gray-500">Cancel</button>
                  </div>
                </div>
              )}
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Event Type', 'Target URL', 'Max Retries', 'Last Triggered', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {webhooks.map((w) => (
                    <tr key={w.id}>
                      <td className="px-4 py-2 font-mono text-xs">{w.eventType}</td>
                      <td className="px-4 py-2 text-xs text-gray-500 truncate max-w-48">{w.targetUrl}</td>
                      <td className="px-4 py-2 text-xs text-center">{w.maxRetries}</td>
                      <td className="px-4 py-2 text-xs text-gray-400">
                        {w.lastTriggeredAt ? new Date(w.lastTriggeredAt).toLocaleString() : 'Never'}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${w.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                          {w.isActive ? 'Active' : 'Paused'}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <button onClick={() => deleteWebhook.mutate(w.id)} className="text-red-600 text-xs hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))}
                  {webhooks.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-4 text-center text-gray-400 text-xs">No webhooks configured</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === 'logs' && (
            <div className="p-4">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Event Type', 'Direction', 'Status', 'HTTP', 'Retries', 'Error', 'Time', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((l) => (
                    <tr key={l.id}>
                      <td className="px-4 py-2 font-mono text-xs">{l.eventType}</td>
                      <td className="px-4 py-2 text-xs">
                        <span className={`px-2 py-0.5 rounded-full ${l.direction === 'OUTBOUND' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                          {l.direction}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {l.success ? (
                          <span className="text-green-600">Success</span>
                        ) : (
                          <span className="text-red-600">Failed</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500">{l.responseStatus ?? '-'}</td>
                      <td className="px-4 py-2 text-xs text-center">{l.retryCount}</td>
                      <td className="px-4 py-2 text-xs text-red-500 truncate max-w-32">{l.errorMessage ?? '-'}</td>
                      <td className="px-4 py-2 text-xs text-gray-400">{new Date(l.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-2">
                        {!l.success && (
                          <button
                            onClick={() => retryLog.mutate(l.id)}
                            disabled={retryLog.isPending}
                            className="text-indigo-600 text-xs hover:underline disabled:opacity-40"
                          >
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-4 text-center text-gray-400 text-xs">No logs</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Inbound Queue */}
          {activeTab === 'inbound' && (
            <div className="p-4">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Source', 'Event Type', 'Received', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {inbound.map((w) => (
                    <tr key={w.id}>
                      <td className="px-4 py-2 font-mono text-xs">{w.source}</td>
                      <td className="px-4 py-2 text-xs">{w.eventType}</td>
                      <td className="px-4 py-2 text-xs text-gray-400">{new Date(w.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${w.processed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {w.processed ? 'Processed' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        {!w.processed && (
                          <button
                            onClick={() => processInbound.mutate(w.id)}
                            disabled={processInbound.isPending}
                            className="text-indigo-600 text-xs hover:underline disabled:opacity-40"
                          >
                            Mark Processed
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {inbound.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-4 text-center text-gray-400 text-xs">No inbound webhooks</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
