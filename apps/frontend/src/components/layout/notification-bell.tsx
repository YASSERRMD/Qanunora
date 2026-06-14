'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const res = await apiClient.get<{ count: number }>('/notifications/unread-count');
      return res.data;
    },
    refetchInterval: 30000,
  });

  const { data: recent } = useQuery({
    queryKey: ['notifications', 'recent'],
    queryFn: async () => {
      const res = await apiClient.get<Notification[]>('/notifications');
      return res.data.slice(0, 5);
    },
    enabled: open,
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = unreadData?.count ?? 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-border bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="font-semibold text-primary-navy text-sm">Notifications</span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
                {unreadCount} unread
              </span>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {!recent?.length ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No notifications
              </div>
            ) : (
              recent.map((n) => (
                <div
                  key={n.id}
                  className={`border-b border-border/50 px-4 py-3 last:border-b-0 ${
                    n.isRead ? 'opacity-60' : 'bg-primary-gold/5'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                        n.isRead ? 'bg-gray-300' : 'bg-primary-gold'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-primary-navy leading-tight">
                        {n.title}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{n.body}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-border px-4 py-2">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-sm font-medium text-primary-gold hover:text-primary-navy transition-colors"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
