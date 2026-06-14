'use client';

import { useAuthStore } from '@/stores/auth.store';

export default function DashboardPage() {
  const { user } = useAuthStore();

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-primary-navy">
            Welcome, {user?.firstName} {user?.lastName}
          </h1>
          <p className="mt-1 text-sm text-slate-navy">
            {user?.role?.replace(/_/g, ' ')} — Qanunora Legislative Intelligence Platform
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Legislative Items', value: '—', color: 'bg-primary-navy' },
            { label: 'Active Consultations', value: '—', color: 'bg-slate-navy' },
            { label: 'Pending Reviews', value: '—', color: 'bg-primary-gold' },
            { label: 'Published Laws', value: '—', color: 'bg-deep-navy' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-border bg-white p-6 shadow-sm">
              <div className={`mb-3 h-2 w-8 rounded-full ${stat.color}`} />
              <p className="text-2xl font-bold text-primary-navy">{stat.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-border bg-white p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Platform initializing — legislative data will appear here as modules are activated.
          </p>
        </div>
      </div>
    </main>
  );
}
