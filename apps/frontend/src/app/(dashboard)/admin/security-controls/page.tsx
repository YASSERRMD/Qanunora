'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

type Tab = 'sessions' | 'login-history' | 'ip-rules' | 'suspicious';

interface UserSession {
  id: string;
  sessionToken: string;
  deviceInfo: { browser?: string; os?: string; deviceType?: string };
  ipAddress?: string;
  isActive: boolean;
  lastActivityAt: string;
  expiresAt: string;
  createdAt: string;
}

interface LoginHistoryEntry {
  id: string;
  email: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  failReason?: string;
  createdAt: string;
}

interface IpRestriction {
  id: string;
  ipAddress: string;
  type: 'BLOCK' | 'ALLOW';
  reason?: string;
  isActive: boolean;
  expiresAt?: string;
  createdBy: { firstName: string; lastName: string };
}

interface SuspiciousActivity {
  id: string;
  userId?: string;
  email?: string;
  ipAddress?: string;
  activityType: string;
  details: Record<string, unknown>;
  riskScore: number;
  isResolved: boolean;
  createdAt: string;
}

const SUSPICIOUS_COLORS: Record<string, string> = {
  BRUTE_FORCE: 'bg-red-100 text-red-700',
  MASS_EXPORT: 'bg-orange-100 text-orange-700',
  UNUSUAL_LOCATION: 'bg-yellow-100 text-yellow-700',
  PRIVILEGE_ESCALATION: 'bg-purple-100 text-purple-700',
  OFF_HOURS_ACCESS: 'bg-blue-100 text-blue-700',
};

export default function SecurityControlsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('sessions');
  const [newIp, setNewIp] = useState('');
  const [newIpType, setNewIpType] = useState<'BLOCK' | 'ALLOW'>('BLOCK');
  const [newIpReason, setNewIpReason] = useState('');
  const queryClient = useQueryClient();

  const { data: sessions = [] } = useQuery({
    queryKey: ['security-sessions'],
    queryFn: async () => { const r = await apiClient.get('/security/sessions'); return r.data as UserSession[]; },
    enabled: activeTab === 'sessions',
  });

  const { data: loginHistory = [] } = useQuery({
    queryKey: ['security-login-history'],
    queryFn: async () => { const r = await apiClient.get('/security/login-history'); return r.data as LoginHistoryEntry[]; },
    enabled: activeTab === 'login-history',
  });

  const { data: ipRules = [] } = useQuery({
    queryKey: ['security-ip-rules'],
    queryFn: async () => { const r = await apiClient.get('/security/ip-restrictions'); return r.data as IpRestriction[]; },
    enabled: activeTab === 'ip-rules',
  });

  const { data: suspicious = [] } = useQuery({
    queryKey: ['security-suspicious'],
    queryFn: async () => { const r = await apiClient.get('/security/suspicious?isResolved=false'); return r.data as SuspiciousActivity[]; },
    enabled: activeTab === 'suspicious',
  });

  const revokeSession = useMutation({
    mutationFn: async (id: string) => { const r = await apiClient.delete(`/security/sessions/${id}`); return r.data; },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['security-sessions'] }),
  });

  const revokeAll = useMutation({
    mutationFn: async () => { const r = await apiClient.delete('/security/sessions'); return r.data; },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['security-sessions'] }),
  });

  const createIpRule = useMutation({
    mutationFn: async () => {
      const r = await apiClient.post('/security/ip-restrictions', { ipAddress: newIp, type: newIpType, reason: newIpReason });
      return r.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-ip-rules'] });
      setNewIp(''); setNewIpReason('');
    },
  });

  const deleteIpRule = useMutation({
    mutationFn: async (id: string) => { const r = await apiClient.delete(`/security/ip-restrictions/${id}`); return r.data; },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['security-ip-rules'] }),
  });

  const resolveActivity = useMutation({
    mutationFn: async (id: string) => { const r = await apiClient.patch(`/security/suspicious/${id}/resolve`); return r.data; },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['security-suspicious'] }),
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: 'sessions', label: 'Active Sessions' },
    { key: 'login-history', label: 'Login History' },
    { key: 'ip-rules', label: 'IP Rules' },
    { key: 'suspicious', label: 'Suspicious Activity' },
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Advanced Security Controls</h1>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Active Sessions */}
      {activeTab === 'sessions' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => revokeAll.mutate()}
              disabled={revokeAll.isPending}
              className="px-4 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-40"
            >
              Revoke All Sessions
            </button>
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Device', 'IP Address', 'Last Activity', 'Expires', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <div className="text-xs">{(s.deviceInfo as { browser?: string }).browser ?? 'Unknown'}</div>
                      <div className="text-gray-400 text-xs">{(s.deviceInfo as { os?: string }).os ?? ''}</div>
                    </td>
                    <td className="px-4 py-2 text-gray-600 text-xs">{s.ipAddress ?? '-'}</td>
                    <td className="px-4 py-2 text-gray-400 text-xs">{new Date(s.lastActivityAt).toLocaleString()}</td>
                    <td className="px-4 py-2 text-gray-400 text-xs">{new Date(s.expiresAt).toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => revokeSession.mutate(s.id)}
                        className="text-red-600 text-xs hover:underline"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No active sessions</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Login History */}
      {activeTab === 'login-history' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Email', 'IP', 'Status', 'Reason', 'Date'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loginHistory.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-xs">{l.email}</td>
                  <td className="px-4 py-2 text-gray-400 text-xs">{l.ipAddress ?? '-'}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${l.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {l.success ? 'Success' : 'Failed'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-400 text-xs">{l.failReason ?? '-'}</td>
                  <td className="px-4 py-2 text-gray-400 text-xs">{new Date(l.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {loginHistory.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No login history</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* IP Rules */}
      {activeTab === 'ip-rules' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold text-sm mb-3">Add IP Rule</h3>
            <div className="flex flex-wrap gap-3 items-center">
              <input
                className="border rounded px-3 py-1.5 text-sm w-48"
                placeholder="IP Address"
                value={newIp}
                onChange={(e) => setNewIp(e.target.value)}
              />
              <select
                className="border rounded px-3 py-1.5 text-sm"
                value={newIpType}
                onChange={(e) => setNewIpType(e.target.value as 'BLOCK' | 'ALLOW')}
              >
                <option value="BLOCK">Block</option>
                <option value="ALLOW">Allow</option>
              </select>
              <input
                className="border rounded px-3 py-1.5 text-sm flex-1 min-w-48"
                placeholder="Reason (optional)"
                value={newIpReason}
                onChange={(e) => setNewIpReason(e.target.value)}
              />
              <button
                onClick={() => createIpRule.mutate()}
                disabled={!newIp || createIpRule.isPending}
                className="px-4 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-40"
              >
                Add Rule
              </button>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['IP Address', 'Type', 'Reason', 'Created By', 'Expires', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ipRules.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs">{r.ipAddress}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${r.type === 'BLOCK' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {r.type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-600 text-xs">{r.reason ?? '-'}</td>
                    <td className="px-4 py-2 text-gray-400 text-xs">{r.createdBy.firstName} {r.createdBy.lastName}</td>
                    <td className="px-4 py-2 text-gray-400 text-xs">{r.expiresAt ? new Date(r.expiresAt).toLocaleDateString() : 'Never'}</td>
                    <td className="px-4 py-2">
                      <button onClick={() => deleteIpRule.mutate(r.id)} className="text-red-600 text-xs hover:underline">Delete</button>
                    </td>
                  </tr>
                ))}
                {ipRules.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No IP rules configured</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Suspicious Activity */}
      {activeTab === 'suspicious' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Type', 'User/Email', 'IP', 'Risk Score', 'Details', 'Date', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {suspicious.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${SUSPICIOUS_COLORS[a.activityType] ?? 'bg-gray-100'}`}>
                      {a.activityType}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-600 text-xs">{a.email ?? a.userId ?? '-'}</td>
                  <td className="px-4 py-2 text-gray-400 text-xs">{a.ipAddress ?? '-'}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5 w-16">
                        <div
                          className={`h-1.5 rounded-full ${a.riskScore >= 0.8 ? 'bg-red-500' : a.riskScore >= 0.5 ? 'bg-yellow-500' : 'bg-green-500'}`}
                          style={{ width: `${a.riskScore * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600">{(a.riskScore * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-gray-400 text-xs max-w-xs truncate">
                    {JSON.stringify(a.details).slice(0, 60)}...
                  </td>
                  <td className="px-4 py-2 text-gray-400 text-xs">{new Date(a.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    {!a.isResolved && (
                      <button
                        onClick={() => resolveActivity.mutate(a.id)}
                        className="text-green-600 text-xs hover:underline"
                      >
                        Resolve
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {suspicious.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No suspicious activities</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
