'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface UnitNode {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

interface DepartmentNode {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  isActive: boolean;
  units: UnitNode[];
}

interface MinistryNode {
  id: string;
  name: string;
  code: string;
  departments: DepartmentNode[];
}

function UnitRow({ unit }: { unit: UnitNode }) {
  return (
    <div className="flex items-center gap-2 py-1 pl-12 text-sm">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
      <span className="text-gray-700">{unit.name}</span>
      <span className="font-mono text-xs text-muted-foreground">{unit.code}</span>
      {!unit.isActive && (
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Inactive</span>
      )}
    </div>
  );
}

function DepartmentRow({ dept }: { dept: DepartmentNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 py-1.5 pl-6">
        <span className="h-2 w-2 rounded-full bg-blue-500" />
        <span className="font-medium text-primary-navy text-sm">{dept.name}</span>
        <span className="font-mono text-xs text-muted-foreground">{dept.code}</span>
        {!dept.isActive && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Inactive</span>
        )}
        {dept.units.length > 0 && (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
            {dept.units.length} unit{dept.units.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {dept.units.map((unit) => (
        <UnitRow key={unit.id} unit={unit} />
      ))}
    </div>
  );
}

function MinistrySection({ ministry }: { ministry: MinistryNode }) {
  const topLevel = ministry.departments.filter((d) => !d.parentId);
  const totalUnits = ministry.departments.reduce((acc, d) => acc + d.units.length, 0);

  return (
    <div className="rounded-xl border border-border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-navy text-white text-xs font-bold">
            {ministry.code.slice(0, 2)}
          </div>
          <div>
            <h2 className="font-semibold text-primary-navy">{ministry.name}</h2>
            <p className="text-xs text-muted-foreground font-mono">{ministry.code}</p>
          </div>
        </div>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>
            <span className="font-semibold text-primary-navy">{ministry.departments.length}</span> dept
            {ministry.departments.length !== 1 ? 's' : ''}
          </span>
          <span>
            <span className="font-semibold text-primary-navy">{totalUnits}</span> unit
            {totalUnits !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      <div className="py-2">
        {topLevel.length === 0 && (
          <p className="px-6 py-4 text-sm text-muted-foreground">No departments yet.</p>
        )}
        {topLevel.map((dept) => (
          <DepartmentRow key={dept.id} dept={dept} />
        ))}
      </div>
    </div>
  );
}

export default function OrganizationPage() {
  const { data: hierarchy, isLoading, error } = useQuery<MinistryNode[]>({
    queryKey: ['organization-hierarchy'],
    queryFn: async () => {
      const res = await apiClient.get('/organization/hierarchy');
      return res.data;
    },
    staleTime: 30_000,
  });

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-primary-navy">Organization Hierarchy</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ministry → Department → Unit structure
          </p>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            Loading hierarchy…
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Failed to load organization hierarchy.
          </div>
        )}

        {hierarchy && hierarchy.length === 0 && (
          <div className="rounded-lg border border-border bg-white p-12 text-center text-muted-foreground">
            No ministries found. Add ministries and departments via the API.
          </div>
        )}

        <div className="space-y-4">
          {hierarchy?.map((ministry) => (
            <MinistrySection key={ministry.id} ministry={ministry} />
          ))}
        </div>
      </div>
    </main>
  );
}
