'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

type RegistryType =
  | 'ENTITY_REGISTRY'
  | 'MINISTRY_REGISTRY'
  | 'GAZETTE_REGISTRY'
  | 'LEGAL_REFERENCE_REGISTRY'
  | 'PERSONNEL_REGISTRY';

interface RegistryAdapter {
  id: string;
  name: string;
  registryType: RegistryType;
  baseUrl?: string;
  isEnabled: boolean;
  lastSyncAt?: string;
  createdAt: string;
  _count?: { syncLogs: number };
}

interface SyncLog {
  id: string;
  adapterId: string;
  syncType: string;
  recordsIn: number;
  recordsOut: number;
  errors: string[];
  success: boolean;
  startedAt: string;
  completedAt?: string;
  adapter?: { name: string; registryType: string };
}

const TYPE_COLORS: Record<RegistryType, string> = {
  ENTITY_REGISTRY: 'bg-blue-100 text-blue-700',
  MINISTRY_REGISTRY: 'bg-purple-100 text-purple-700',
  GAZETTE_REGISTRY: 'bg-yellow-100 text-yellow-700',
  LEGAL_REFERENCE_REGISTRY: 'bg-green-100 text-green-700',
  PERSONNEL_REGISTRY: 'bg-orange-100 text-orange-700',
};

export default function RegistriesAdminPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ name: '', registryType: 'ENTITY_REGISTRY' as RegistryType, baseUrl: '' });

  const { data: adapters = [], isLoading } = useQuery({
    queryKey: ['registry-adapters'],
    queryFn: async () => {
      const res = await apiClient.get('/registries');
      return res.data as RegistryAdapter[];
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['registry-sync-logs', selectedId],
    queryFn: async () => {
      const url = selectedId ? `/registries/${selectedId}/logs` : '/registries/logs/all';
      const res = await apiClient.get(url);
      return res.data as SyncLog[];
    },
    enabled: !!selectedId,
  });

  const createAdapter = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/registries', form);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registry-adapters'] });
      setShowAddForm(false);
      setForm({ name: '', registryType: 'ENTITY_REGISTRY', baseUrl: '' });
    },
  });

  const toggleEnabled = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: string; isEnabled: boolean }) => {
      const endpoint = isEnabled ? `/registries/${id}/disable` : `/registries/${id}/enable`;
      const res = await apiClient.patch(endpoint);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['registry-adapters'] }),
  });

  const triggerSync = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/registries/${id}/sync`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registry-adapters'] });
      queryClient.invalidateQueries({ queryKey: ['registry-sync-logs', selectedId] });
    },
  });

  const selectedAdapter = adapters.find((a) => a.id === selectedId);

  const getDuration = (log: SyncLog) => {
    if (!log.completedAt) return 'In progress';
    const ms = new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime();
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Government Registry Adapters</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
        >
          Add Registry
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow p-5 space-y-4">
          <h2 className="font-semibold text-gray-700">New Registry Adapter</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name</label>
              <input
                className="border rounded px-3 py-1.5 text-sm w-full"
                placeholder="e.g. Main Entity Registry"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Registry Type</label>
              <select
                className="border rounded px-3 py-1.5 text-sm w-full"
                value={form.registryType}
                onChange={(e) => setForm({ ...form, registryType: e.target.value as RegistryType })}
              >
                {(['ENTITY_REGISTRY', 'MINISTRY_REGISTRY', 'GAZETTE_REGISTRY', 'LEGAL_REFERENCE_REGISTRY', 'PERSONNEL_REGISTRY'] as RegistryType[]).map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Base URL (optional)</label>
              <input
                className="border rounded px-3 py-1.5 text-sm w-full"
                placeholder="https://registry.example.gov"
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => createAdapter.mutate()}
              disabled={!form.name || createAdapter.isPending}
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

      {/* Adapter Cards */}
      {isLoading ? (
        <div className="p-8 text-center text-gray-400">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {adapters.map((adapter) => (
            <div
              key={adapter.id}
              className={`bg-white rounded-lg shadow p-4 cursor-pointer border-2 ${selectedId === adapter.id ? 'border-indigo-400' : 'border-transparent hover:border-gray-200'}`}
              onClick={() => setSelectedId(adapter.id === selectedId ? null : adapter.id)}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm">{adapter.name}</h3>
                  <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs ${TYPE_COLORS[adapter.registryType]}`}>
                    {adapter.registryType.replace(/_/g, ' ')}
                  </span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleEnabled.mutate({ id: adapter.id, isEnabled: adapter.isEnabled }); }}
                  className={`px-2 py-0.5 rounded-full text-xs ${adapter.isEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}
                >
                  {adapter.isEnabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
              {adapter.baseUrl && (
                <p className="text-xs text-gray-400 font-mono truncate mb-2">{adapter.baseUrl}</p>
              )}
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  {adapter.lastSyncAt
                    ? `Last sync: ${new Date(adapter.lastSyncAt).toLocaleDateString()}`
                    : 'Never synced'}
                </span>
                <span>{adapter._count?.syncLogs ?? 0} runs</span>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerSync.mutate(adapter.id);
                  }}
                  disabled={!adapter.isEnabled || triggerSync.isPending}
                  className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-40"
                >
                  {triggerSync.isPending ? 'Syncing...' : 'Sync Now'}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(adapter.id === selectedId ? null : adapter.id);
                  }}
                  className="px-3 py-1 text-xs border border-gray-200 rounded text-gray-600 hover:bg-gray-50"
                >
                  View Logs
                </button>
              </div>
            </div>
          ))}
          {adapters.length === 0 && (
            <div className="col-span-3 p-8 text-center text-gray-400">No registry adapters configured</div>
          )}
        </div>
      )}

      {/* Sync Log Table */}
      {selectedAdapter && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 border-b">
            <h2 className="font-semibold text-gray-700">
              Sync Logs — {selectedAdapter.name}
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${TYPE_COLORS[selectedAdapter.registryType]}`}>
                {selectedAdapter.registryType.replace(/_/g, ' ')}
              </span>
            </h2>
          </div>
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Sync Type', 'Records In', 'Records Out', 'Duration', 'Status', 'Errors', 'Started'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-2 font-mono text-xs">{log.syncType}</td>
                  <td className="px-4 py-2 text-xs text-center">{log.recordsIn}</td>
                  <td className="px-4 py-2 text-xs text-center">{log.recordsOut}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{getDuration(log)}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${log.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {log.success ? 'Success' : 'Failed'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-red-500">
                    {Array.isArray(log.errors) && log.errors.length > 0 ? log.errors.join('; ') : '-'}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-400">{new Date(log.startedAt).toLocaleString()}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-4 text-center text-gray-400 text-xs">No sync logs yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
