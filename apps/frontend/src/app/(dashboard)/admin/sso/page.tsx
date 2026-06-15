'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

type IdpType = 'OIDC' | 'SAML' | 'LDAP';

interface IdentityProvider {
  id: string;
  name: string;
  type: IdpType;
  isActive: boolean;
  createdAt: string;
  groupMappings: GroupMapping[];
}

interface GroupMapping {
  id: string;
  groupName: string;
  role: string;
}

interface SimulateResult {
  action: string;
  role?: string;
  matchedGroups?: string[];
  wouldCreate?: boolean;
  existingEmail?: string;
  existingUserId?: string;
}

const TYPE_COLORS: Record<IdpType, string> = {
  OIDC: 'bg-blue-100 text-blue-700',
  SAML: 'bg-purple-100 text-purple-700',
  LDAP: 'bg-green-100 text-green-700',
};

const CONFIG_FIELDS: Record<IdpType, { key: string; label: string; placeholder: string }[]> = {
  OIDC: [
    { key: 'clientId', label: 'Client ID', placeholder: 'your-client-id' },
    { key: 'clientSecret', label: 'Client Secret', placeholder: 'your-client-secret' },
    { key: 'metadataUrl', label: 'Metadata URL', placeholder: 'https://idp.example.com/.well-known/openid-configuration' },
  ],
  SAML: [
    { key: 'entityId', label: 'Entity ID', placeholder: 'https://your-sp-entity-id' },
    { key: 'metadataUrl', label: 'IdP Metadata URL', placeholder: 'https://idp.example.com/metadata' },
    { key: 'acsUrl', label: 'ACS URL', placeholder: 'https://app.example.com/sso/acs' },
  ],
  LDAP: [
    { key: 'host', label: 'LDAP Host', placeholder: 'ldap.example.com' },
    { key: 'port', label: 'Port', placeholder: '389' },
    { key: 'baseDn', label: 'Base DN', placeholder: 'dc=example,dc=com' },
    { key: 'bindDn', label: 'Bind DN', placeholder: 'cn=admin,dc=example,dc=com' },
    { key: 'bindPassword', label: 'Bind Password', placeholder: '••••••••' },
  ],
};

export default function SsoPage() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<IdpType>('OIDC');
  const [newConfig, setNewConfig] = useState<Record<string, string>>({});
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupRole, setNewGroupRole] = useState('VIEWER');
  const [simExternalId, setSimExternalId] = useState('');
  const [simGroups, setSimGroups] = useState('');
  const [simResult, setSimResult] = useState<SimulateResult | null>(null);

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['sso-providers'],
    queryFn: async () => {
      const res = await apiClient.get('/sso/providers');
      return res.data as IdentityProvider[];
    },
  });

  const createProvider = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/sso/providers', {
        name: newName,
        type: newType,
        config: newConfig,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-providers'] });
      setShowAddForm(false);
      setNewName('');
      setNewConfig({});
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const endpoint = isActive ? `/sso/providers/${id}/deactivate` : `/sso/providers/${id}/activate`;
      const res = await apiClient.patch(endpoint);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sso-providers'] }),
  });

  const deleteProvider = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/sso/providers/${id}`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sso-providers'] }),
  });

  const addGroupMapping = useMutation({
    mutationFn: async ({ providerId, groupName, role }: { providerId: string; groupName: string; role: string }) => {
      const res = await apiClient.post(`/sso/providers/${providerId}/group-mappings`, { groupName, role });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-providers'] });
      setNewGroupName('');
    },
  });

  const deleteGroupMapping = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/sso/group-mappings/${id}`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sso-providers'] }),
  });

  const simulateJit = async () => {
    if (!selectedProviderId || !simExternalId) return;
    const res = await apiClient.post('/sso/jit/simulate', {
      providerId: selectedProviderId,
      externalId: simExternalId,
      externalGroups: simGroups ? simGroups.split(',').map((s) => s.trim()) : [],
    });
    setSimResult(res.data as SimulateResult);
  };

  const selectedProvider = providers.find((p) => p.id === selectedProviderId);

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">SSO Integration</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
        >
          Add Provider
        </button>
      </div>

      {/* Add Provider Form */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow p-5 space-y-4">
          <h2 className="font-semibold text-gray-700">New Identity Provider</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name</label>
              <input
                className="border rounded px-3 py-1.5 text-sm w-full"
                placeholder="e.g. Corporate LDAP"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Type</label>
              <select
                className="border rounded px-3 py-1.5 text-sm w-full"
                value={newType}
                onChange={(e) => { setNewType(e.target.value as IdpType); setNewConfig({}); }}
              >
                <option value="OIDC">OIDC</option>
                <option value="SAML">SAML</option>
                <option value="LDAP">LDAP</option>
              </select>
            </div>
          </div>
          <div className="space-y-3">
            {CONFIG_FIELDS[newType].map((field) => (
              <div key={field.key}>
                <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                <input
                  className="border rounded px-3 py-1.5 text-sm w-full"
                  placeholder={field.placeholder}
                  type={field.key.toLowerCase().includes('secret') || field.key.toLowerCase().includes('password') ? 'password' : 'text'}
                  value={newConfig[field.key] ?? ''}
                  onChange={(e) => setNewConfig({ ...newConfig, [field.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => createProvider.mutate()}
              disabled={!newName || createProvider.isPending}
              className="px-4 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-40"
            >
              Create Provider
            </button>
            <button onClick={() => setShowAddForm(false)} className="px-4 py-1.5 text-gray-500 hover:text-gray-700 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Provider List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold text-gray-700">Identity Providers</h2>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Type', 'Groups', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {providers.map((p) => (
                <tr
                  key={p.id}
                  className={`hover:bg-gray-50 cursor-pointer ${selectedProviderId === p.id ? 'bg-indigo-50' : ''}`}
                  onClick={() => setSelectedProviderId(p.id === selectedProviderId ? null : p.id)}
                >
                  <td className="px-4 py-2 font-medium">{p.name}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${TYPE_COLORS[p.type]}`}>{p.type}</span>
                  </td>
                  <td className="px-4 py-2 text-gray-400 text-xs">{p.groupMappings.length} mappings</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleActive.mutate({ id: p.id, isActive: p.isActive }); }}
                      className={`px-2 py-0.5 rounded-full text-xs cursor-pointer ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {p.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteProvider.mutate(p.id); }}
                      className="text-red-600 text-xs hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {providers.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No identity providers configured</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Group Mappings Panel */}
      {selectedProvider && (
        <div className="bg-white rounded-lg shadow p-5 space-y-4">
          <h2 className="font-semibold text-gray-700">
            Group Mappings — {selectedProvider.name}
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${TYPE_COLORS[selectedProvider.type]}`}>
              {selectedProvider.type}
            </span>
          </h2>

          {/* Add mapping */}
          <div className="flex gap-3 items-center">
            <input
              className="border rounded px-3 py-1.5 text-sm w-48"
              placeholder="IdP Group Name"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
            />
            <select
              className="border rounded px-3 py-1.5 text-sm"
              value={newGroupRole}
              onChange={(e) => setNewGroupRole(e.target.value)}
            >
              {['VIEWER', 'REVIEWER', 'DRAFTING_OFFICER', 'COMMITTEE_MEMBER', 'MINISTRY_LEGAL_OFFICER', 'STAKEHOLDER_MANAGER', 'PUBLIC_CONSULTATION_OFFICER', 'AUDITOR', 'LEGISLATIVE_ADMIN', 'SUPER_ADMIN'].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <button
              onClick={() => addGroupMapping.mutate({ providerId: selectedProvider.id, groupName: newGroupName, role: newGroupRole })}
              disabled={!newGroupName || addGroupMapping.isPending}
              className="px-4 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-40"
            >
              Add Mapping
            </button>
          </div>

          {/* Mapping table */}
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['IdP Group', 'Qanunora Role', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {selectedProvider.groupMappings.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2 font-mono text-xs">{m.groupName}</td>
                  <td className="px-4 py-2">
                    <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs">{m.role}</span>
                  </td>
                  <td className="px-4 py-2">
                    <button onClick={() => deleteGroupMapping.mutate(m.id)} className="text-red-600 text-xs hover:underline">Remove</button>
                  </td>
                </tr>
              ))}
              {selectedProvider.groupMappings.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-4 text-center text-gray-400 text-xs">No group mappings</td></tr>
              )}
            </tbody>
          </table>

          {/* JIT Simulate */}
          <div className="border-t pt-4 space-y-3">
            <h3 className="font-medium text-sm text-gray-700">Simulate JIT Provisioning</h3>
            <div className="flex flex-wrap gap-3 items-center">
              <input
                className="border rounded px-3 py-1.5 text-sm w-48"
                placeholder="External ID"
                value={simExternalId}
                onChange={(e) => setSimExternalId(e.target.value)}
              />
              <input
                className="border rounded px-3 py-1.5 text-sm flex-1 min-w-48"
                placeholder="Groups (comma-separated)"
                value={simGroups}
                onChange={(e) => setSimGroups(e.target.value)}
              />
              <button
                onClick={simulateJit}
                disabled={!simExternalId}
                className="px-4 py-1.5 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-40"
              >
                Simulate
              </button>
            </div>
            {simResult && (
              <div className={`p-3 rounded text-sm ${simResult.wouldCreate ? 'bg-blue-50 text-blue-800' : 'bg-green-50 text-green-800'}`}>
                <div className="font-medium">{simResult.action}</div>
                {simResult.role && <div>Role: <span className="font-mono">{simResult.role}</span></div>}
                {simResult.matchedGroups && simResult.matchedGroups.length > 0 && (
                  <div>Matched groups: {simResult.matchedGroups.join(', ')}</div>
                )}
                {simResult.existingEmail && <div>Existing user: {simResult.existingEmail}</div>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
