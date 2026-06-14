'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

const ROLES = [
  'SUPER_ADMIN',
  'LEGISLATIVE_ADMIN',
  'MINISTRY_LEGAL_OFFICER',
  'DRAFTING_OFFICER',
  'REVIEWER',
  'COMMITTEE_MEMBER',
  'STAKEHOLDER_MANAGER',
  'PUBLIC_CONSULTATION_OFFICER',
  'AUDITOR',
  'VIEWER',
];

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['users', search],
    queryFn: async () => {
      const res = await apiClient.get<{ data: User[]; total: number }>('/users', {
        params: { search: search || undefined },
      });
      return res.data;
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      await apiClient.patch(`/users/${id}/role`, { role });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary-navy">User Management</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage user roles and access permissions
            </p>
          </div>
        </div>

        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30"
          />
        </div>

        <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading users...</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((user) => (
                  <tr key={user.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium text-primary-navy">
                      {user.firstName} {user.lastName}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                    <td className="px-4 py-3">
                      <select
                        value={user.role}
                        onChange={(e) => updateRole.mutate({ id: user.id, role: e.target.value })}
                        className="rounded border border-border px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-navy"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          user.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
                {!data?.data.length && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        {data && (
          <p className="mt-3 text-xs text-muted-foreground">
            {data.total} total users
          </p>
        )}
      </div>
    </main>
  );
}
