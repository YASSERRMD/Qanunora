'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
}

interface TenantStats {
  tenantId: string;
  userCount: number;
  ministryCount: number;
  itemCount: number;
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        active
          ? 'bg-green-100 text-green-800'
          : 'bg-gray-100 text-gray-600'
      }`}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function TenantStatsCell({ tenantId }: { tenantId: string }) {
  const { data, isLoading } = useQuery<TenantStats>({
    queryKey: ['tenant-stats', tenantId],
    queryFn: async () => {
      const res = await apiClient.get(`/tenants/${tenantId}/stats`);
      return res.data;
    },
    staleTime: 30_000,
  });

  if (isLoading) return <span className="text-muted-foreground text-xs">Loading…</span>;
  if (!data) return <span className="text-muted-foreground text-xs">—</span>;

  return (
    <div className="flex gap-4 text-sm">
      <span className="text-muted-foreground">
        <span className="font-medium text-primary-navy">{data.userCount}</span> users
      </span>
      <span className="text-muted-foreground">
        <span className="font-medium text-primary-navy">{data.ministryCount}</span> ministries
      </span>
      <span className="text-muted-foreground">
        <span className="font-medium text-primary-navy">{data.itemCount}</span> items
      </span>
    </div>
  );
}

export default function TenantsPage() {
  const { data: tenants, isLoading, error } = useQuery<Tenant[]>({
    queryKey: ['tenants'],
    queryFn: async () => {
      const res = await apiClient.get('/tenants');
      return res.data;
    },
    staleTime: 30_000,
  });

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary-navy">Tenants</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage platform tenants and their ministry isolation
            </p>
          </div>
          {tenants && (
            <div className="rounded-lg border border-border bg-white px-4 py-2 text-sm text-muted-foreground shadow-sm">
              <span className="font-semibold text-primary-navy">{tenants.length}</span> tenant
              {tenants.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            Loading tenants…
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Failed to load tenants.
          </div>
        )}

        {tenants && tenants.length === 0 && (
          <div className="rounded-lg border border-border bg-white p-12 text-center text-muted-foreground">
            No tenants found. Create the first tenant via the API.
          </div>
        )}

        {tenants && tenants.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50">
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Slug</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Stats</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-primary-navy">{tenant.name}</td>
                    <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                      {tenant.slug}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge active={tenant.isActive} />
                    </td>
                    <td className="px-6 py-4">
                      <TenantStatsCell tenantId={tenant.id} />
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {new Date(tenant.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
