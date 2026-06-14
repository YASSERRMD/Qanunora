'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

const TYPE_COLORS: Record<string, string> = {
  WORKFLOW_TRANSITION: 'bg-blue-100 text-blue-700',
  REVIEW_REMINDER: 'bg-yellow-100 text-yellow-700',
  CONSULTATION_DEADLINE: 'bg-red-100 text-red-700',
  DOCUMENT_UPLOADED: 'bg-purple-100 text-purple-700',
  COMMENT_ADDED: 'bg-green-100 text-green-700',
  ASSIGNMENT: 'bg-indigo-100 text-indigo-700',
  ESCALATION: 'bg-orange-100 text-orange-700',
  SYSTEM: 'bg-gray-100 text-gray-700',
};

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  entityType?: string;
  entityId?: string;
  createdAt: string;
}

export default function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const queryClient = useQueryClient();

  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const res = await apiClient.get<{ count: number }>('/notifications/unread-count');
      return res.data;
    },
    refetchInterval: 30000,
  });

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications', { unreadOnly }],
    queryFn: async () => {
      const res = await apiClient.get<Notification[]>('/notifications', {
        params: { unreadOnly: unreadOnly ? 'true' : undefined },
      });
      return res.data;
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiClient.patch('/notifications/read-all'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/notifications/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary-navy flex items-center gap-3">
              Notifications
              {(unreadData?.count ?? 0) > 0 && (
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-2 text-xs font-bold text-white">
                  {unreadData?.count}
                </span>
              )}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              System alerts, reminders, and updates
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(e) => setUnreadOnly(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Unread only
            </label>
            <button
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending || (unreadData?.count ?? 0) === 0}
              className="rounded-lg border border-primary-gold bg-white px-4 py-2 text-sm font-medium text-primary-gold hover:bg-primary-gold hover:text-white transition-colors disabled:opacity-40"
            >
              Mark all read
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground">Loading notifications...</div>
        ) : !notifications?.length ? (
          <div className="rounded-xl border border-border bg-white p-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <span className="text-xl">🔔</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {unreadOnly ? 'No unread notifications.' : 'No notifications yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`rounded-xl border bg-white p-4 shadow-sm transition-all ${
                  n.isRead ? 'border-border opacity-70' : 'border-primary-gold/40 shadow-md'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1 flex-shrink-0">
                    <div
                      className={`h-2 w-2 rounded-full ${n.isRead ? 'bg-gray-300' : 'bg-primary-gold'}`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                          TYPE_COLORS[n.type] ?? 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {n.type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(n.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1 font-medium text-primary-navy">{n.title}</p>
                    <p className="mt-0.5 text-sm text-slate-600">{n.body}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!n.isRead && (
                      <button
                        onClick={() => markReadMutation.mutate(n.id)}
                        className="rounded px-2 py-1 text-xs font-medium text-primary-navy hover:bg-primary-navy hover:text-white transition-colors"
                      >
                        Mark read
                      </button>
                    )}
                    <button
                      onClick={() => deleteMutation.mutate(n.id)}
                      className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
