'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface LegislativeItem {
  id: string;
  referenceNumber: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  updatedAt: string;
  ministry: { name: string };
}

interface WorkflowHistoryEntry {
  id: string;
  action: string;
  createdAt: string;
  performedBy: { firstName: string; lastName: string };
  legislativeItem: { id: string; title: string; referenceNumber: string };
}

interface Dashboard {
  assignedItems: LegislativeItem[];
  myDrafts: LegislativeItem[];
  myOpinions: unknown[];
  recentActivity: WorkflowHistoryEntry[];
  myReviews: WorkflowHistoryEntry[];
  pendingActions: LegislativeItem[];
}

interface SavedView {
  id: string;
  name: string;
  entityType: string;
  isDefault: boolean;
  createdAt: string;
}

interface QuickAction {
  id: string;
  label: string;
  actionType: string;
  actionData: Record<string, unknown>;
  order: number;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFTING: 'bg-blue-100 text-blue-700',
  INTERNAL_REVIEW: 'bg-yellow-100 text-yellow-700',
  COMMITTEE_REVIEW: 'bg-purple-100 text-purple-700',
  APPROVED: 'bg-green-100 text-green-700',
  PUBLISHED: 'bg-emerald-100 text-emerald-700',
  LEGAL_REVIEW: 'bg-orange-100 text-orange-700',
  PUBLIC_CONSULTATION: 'bg-cyan-100 text-cyan-700',
};

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: 'text-red-600',
  HIGH: 'text-orange-500',
  MEDIUM: 'text-blue-500',
  LOW: 'text-gray-400',
};

export default function WorkspacePage() {
  const queryClient = useQueryClient();
  const [viewsOpen, setViewsOpen] = useState(true);
  const [newViewForm, setNewViewForm] = useState({ name: '', entityType: 'legislative_items' });
  const [newAction, setNewAction] = useState({ label: '', actionType: 'navigate', url: '' });

  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ['workspace-dashboard'],
    queryFn: async () => {
      const res = await apiClient.get<Dashboard>('/workspace/dashboard');
      return res.data;
    },
  });

  const { data: savedViews = [], refetch: refetchViews } = useQuery({
    queryKey: ['workspace-views'],
    queryFn: async () => {
      const res = await apiClient.get<SavedView[]>('/workspace/views');
      return res.data;
    },
  });

  const { data: quickActions = [], refetch: refetchActions } = useQuery({
    queryKey: ['workspace-quick-actions'],
    queryFn: async () => {
      const res = await apiClient.get<QuickAction[]>('/workspace/quick-actions');
      return res.data;
    },
  });

  const createViewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/workspace/views', newViewForm);
      return res.data;
    },
    onSuccess: () => {
      refetchViews();
      setNewViewForm({ name: '', entityType: 'legislative_items' });
    },
  });

  const deleteViewMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/workspace/views/${id}`),
    onSuccess: () => refetchViews(),
  });

  const setDefaultViewMutation = useMutation({
    mutationFn: async (id: string) => apiClient.patch(`/workspace/views/${id}/set-default`),
    onSuccess: () => refetchViews(),
  });

  const addActionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/workspace/quick-actions', {
        label: newAction.label,
        actionType: newAction.actionType,
        actionData: { url: newAction.url },
      });
      return res.data;
    },
    onSuccess: () => {
      refetchActions();
      setNewAction({ label: '', actionType: 'navigate', url: '' });
    },
  });

  const deleteActionMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/workspace/quick-actions/${id}`),
    onSuccess: () => refetchActions(),
  });

  function handleQuickAction(action: QuickAction) {
    if (action.actionType === 'navigate' && action.actionData.url) {
      window.location.href = action.actionData.url as string;
    }
  }

  return (
    <main className="flex-1 flex overflow-hidden" aria-labelledby="workspace-heading">
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Quick Actions Bar */}
        <div className="border-b border-border bg-white px-6 py-3 flex items-center gap-2 overflow-x-auto">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide shrink-0 mr-1">
            Quick Actions:
          </span>
          {quickActions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleQuickAction(action)}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary-navy/5 border border-primary-navy/20 px-3 py-1 text-xs font-medium text-primary-navy hover:bg-primary-navy hover:text-white transition-colors shrink-0"
            >
              {action.label}
            </button>
          ))}
          {/* Add quick action */}
          <details className="relative ml-auto shrink-0">
            <summary className="cursor-pointer rounded-full border border-dashed border-gray-300 px-3 py-1 text-xs text-gray-500 hover:border-primary-gold hover:text-primary-gold list-none">
              + Add
            </summary>
            <div className="absolute right-0 top-full mt-2 z-20 w-64 rounded-xl border border-border bg-white shadow-lg p-3 space-y-2">
              <input
                type="text"
                value={newAction.label}
                onChange={(e) => setNewAction((f) => ({ ...f, label: e.target.value }))}
                placeholder="Label"
                className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
              />
              <input
                type="text"
                value={newAction.url}
                onChange={(e) => setNewAction((f) => ({ ...f, url: e.target.value }))}
                placeholder="URL (e.g. /legislative-items/new)"
                className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
              />
              <button
                onClick={() => addActionMutation.mutate()}
                disabled={!newAction.label.trim() || addActionMutation.isPending}
                className="w-full rounded-md bg-primary-navy py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                Add Action
              </button>
            </div>
          </details>
        </div>

        {/* Dashboard heading */}
        <div className="px-6 py-4 border-b border-border">
          <h1 id="workspace-heading" className="text-xl font-bold text-primary-navy">
            My Workspace
          </h1>
          <p className="text-sm text-muted-foreground">Your personal dashboard</p>
        </div>

        {dashLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        ) : !dashboard ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Unable to load dashboard.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Widget 1: My Assigned Items */}
              <Widget title="My Assigned Items" count={dashboard.assignedItems.length}>
                {dashboard.assignedItems.length === 0 ? (
                  <EmptyState message="No assigned items" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs" aria-label="Assigned items table">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="py-2 pr-3 text-left font-semibold">Title</th>
                          <th className="py-2 pr-3 text-left font-semibold">Status</th>
                          <th className="py-2 text-left font-semibold">Priority</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {dashboard.assignedItems.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="py-2 pr-3">
                              <Link href={`/legislative-items/${item.id}`} className="text-primary-navy hover:underline font-medium">
                                {item.title}
                              </Link>
                              <p className="text-muted-foreground">{item.referenceNumber}</p>
                            </td>
                            <td className="py-2 pr-3">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[item.status] ?? 'bg-gray-100 text-gray-700'}`}>
                                {item.status}
                              </span>
                            </td>
                            <td className={`py-2 font-medium ${PRIORITY_COLORS[item.priority] ?? ''}`}>
                              {item.priority}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Widget>

              {/* Widget 2: My Drafts */}
              <Widget title="My Drafts" count={dashboard.myDrafts.length}>
                {dashboard.myDrafts.length === 0 ? (
                  <EmptyState message="No drafts in progress" />
                ) : (
                  <ul className="space-y-2">
                    {dashboard.myDrafts.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-2 rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-primary-navy truncate">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.referenceNumber} · {item.ministry.name}</p>
                        </div>
                        <Link
                          href={`/legislative-items/${item.id}/edit`}
                          className="text-xs text-primary-gold hover:underline shrink-0"
                        >
                          Edit
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Widget>

              {/* Widget 3: Recent Activity */}
              <Widget title="Recent Activity" count={dashboard.recentActivity.length}>
                {dashboard.recentActivity.length === 0 ? (
                  <EmptyState message="No recent activity" />
                ) : (
                  <ol className="space-y-3 relative pl-4 border-l border-gray-200">
                    {dashboard.recentActivity.map((entry) => (
                      <li key={entry.id} className="relative">
                        <div className="absolute -left-5 top-1 h-3 w-3 rounded-full bg-primary-navy/20 border-2 border-primary-navy" />
                        <p className="text-xs font-semibold text-primary-navy">
                          {entry.performedBy.firstName} {entry.performedBy.lastName}
                          <span className="font-normal text-muted-foreground ml-1">{entry.action.replace(/_/g, ' ')}</span>
                        </p>
                        <Link href={`/legislative-items/${entry.legislativeItem.id}`} className="text-xs text-primary-gold hover:underline">
                          {entry.legislativeItem.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleString()}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </Widget>

              {/* Widget 4: Pending Actions */}
              <Widget title="Pending Actions" count={dashboard.pendingActions.length}>
                {dashboard.pendingActions.length === 0 ? (
                  <EmptyState message="No pending actions" />
                ) : (
                  <ul className="space-y-2">
                    {dashboard.pendingActions.map((item) => (
                      <li key={item.id} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-primary-navy truncate">{item.title}</p>
                            <p className="text-xs text-muted-foreground">{item.referenceNumber}</p>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${STATUS_COLORS[item.status] ?? 'bg-gray-100 text-gray-700'}`}>
                            {item.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <Link href={`/legislative-items/${item.id}`} className="mt-1 inline-block text-xs text-primary-gold hover:underline">
                          Review Now
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Widget>
            </div>
          </div>
        )}
      </div>

      {/* Right: Saved Views Panel */}
      <aside
        className={`border-l border-border bg-white flex flex-col shrink-0 transition-all ${viewsOpen ? 'w-72' : 'w-10'}`}
        aria-label="Saved views"
      >
        <button
          onClick={() => setViewsOpen((v) => !v)}
          className="px-3 py-3 text-xs font-semibold text-primary-navy hover:bg-gray-50 flex items-center gap-1 border-b border-border"
          aria-expanded={viewsOpen}
        >
          {viewsOpen ? '→' : '←'}
          {viewsOpen && <span>Saved Views</span>}
        </button>

        {viewsOpen && (
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
            {/* Create new view form */}
            <div className="rounded-md border border-dashed border-gray-300 p-2.5 space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">New View</p>
              <input
                type="text"
                value={newViewForm.name}
                onChange={(e) => setNewViewForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="View name"
                className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
              />
              <select
                value={newViewForm.entityType}
                onChange={(e) => setNewViewForm((f) => ({ ...f, entityType: e.target.value }))}
                className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
              >
                {['legislative_items', 'consultations', 'committees', 'legal_opinions', 'meetings'].map((et) => (
                  <option key={et} value={et}>{et.replace(/_/g, ' ')}</option>
                ))}
              </select>
              <button
                onClick={() => createViewMutation.mutate()}
                disabled={!newViewForm.name.trim() || createViewMutation.isPending}
                className="w-full rounded bg-primary-navy py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                Save View
              </button>
            </div>

            {/* Existing views */}
            {savedViews.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No saved views yet.</p>
            ) : (
              <div className="space-y-2">
                {savedViews.map((view) => (
                  <div
                    key={view.id}
                    className={`rounded-md border p-2.5 text-xs ${view.isDefault ? 'border-primary-gold bg-amber-50' : 'border-gray-200 bg-gray-50'}`}
                  >
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <div className="min-w-0">
                        <p className="font-semibold text-primary-navy truncate">{view.name}</p>
                        <span className="inline-block text-xs text-muted-foreground bg-gray-100 rounded px-1 py-0.5 mt-0.5">
                          {view.entityType.replace(/_/g, ' ')}
                        </span>
                      </div>
                      {view.isDefault && (
                        <span className="rounded-full bg-primary-gold px-1.5 py-0.5 text-white text-xs font-medium shrink-0">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1 mt-2">
                      {!view.isDefault && (
                        <button
                          onClick={() => setDefaultViewMutation.mutate(view.id)}
                          disabled={setDefaultViewMutation.isPending}
                          className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-700 hover:bg-blue-200 disabled:opacity-50"
                        >
                          Set Default
                        </button>
                      )}
                      <button
                        onClick={() => deleteViewMutation.mutate(view.id)}
                        disabled={deleteViewMutation.isPending}
                        className="rounded bg-red-100 px-1.5 py-0.5 text-red-600 hover:bg-red-200 disabled:opacity-50 ml-auto"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quick Actions management */}
            {quickActions.length > 0 && (
              <div className="mt-2 border-t border-border pt-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Quick Actions</p>
                {quickActions.map((action) => (
                  <div key={action.id} className="flex items-center justify-between text-xs py-1">
                    <span className="text-gray-700">{action.label}</span>
                    <button
                      onClick={() => deleteActionMutation.mutate(action.id)}
                      className="text-red-400 hover:text-red-600 ml-2"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </aside>
    </main>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Widget({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-white shadow-sm flex flex-col" aria-labelledby={`widget-${title.replace(/\s+/g, '-').toLowerCase()}`}>
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h2 id={`widget-${title.replace(/\s+/g, '-').toLowerCase()}`} className="text-sm font-semibold text-primary-navy">
          {title}
        </h2>
        <span className="rounded-full bg-primary-navy/10 px-2 py-0.5 text-xs font-bold text-primary-navy">
          {count}
        </span>
      </div>
      <div className="p-4 flex-1 overflow-y-auto max-h-72">
        {children}
      </div>
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="py-6 text-center text-xs text-muted-foreground">{message}</p>
  );
}
