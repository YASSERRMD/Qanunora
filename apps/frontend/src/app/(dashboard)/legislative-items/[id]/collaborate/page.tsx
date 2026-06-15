'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface LockInfo {
  id: string;
  legislativeItemId: string;
  lockedById: string;
  lockedBy: { id: string; firstName: string; lastName: string };
  lockedAt: string;
  expiresAt: string;
  sessionId?: string;
}

interface AutosaveRecord {
  id: string;
  legislativeItemId: string;
  savedById: string;
  savedAt: string;
  savedBy: { firstName: string; lastName: string };
}

export default function CollaboratePage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [myUserId] = useState(() => {
    if (typeof window !== 'undefined') {
      // Try to get user ID from stored token (best-effort)
      return 'current-user';
    }
    return 'current-user';
  });
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll lock status every 15s
  const { data: lockInfo, refetch: refetchLock } = useQuery({
    queryKey: ['collab-lock', id],
    queryFn: async () => {
      const res = await apiClient.get<LockInfo | null>(`/collaboration/lock/${id}`);
      return res.data;
    },
    refetchInterval: 15_000,
  });

  // Autosave history
  const { data: autosaveHistory = [], refetch: refetchHistory } = useQuery({
    queryKey: ['collab-autosave', id],
    queryFn: async () => {
      const res = await apiClient.get<AutosaveRecord[]>(`/collaboration/autosave/${id}`);
      return res.data;
    },
  });

  // Presence
  const { data: presenceData } = useQuery({
    queryKey: ['collab-presence', id],
    queryFn: async () => {
      const res = await apiClient.get<{ documentId: string; activeUsers: string[] }>(
        `/collaboration/presence/${id}`,
      );
      return res.data;
    },
    refetchInterval: 15_000,
  });

  const acquireLockMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/collaboration/lock/${id}`, { sessionId: `session-${Date.now()}` });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collab-lock', id] });
    },
  });

  const releaseLockMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.delete(`/collaboration/lock/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collab-lock', id] });
    },
  });

  const autosaveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/collaboration/autosave/${id}`, { content });
      return res.data;
    },
    onSuccess: () => {
      refetchHistory();
    },
  });

  // Clear polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const isLockedByMe = lockInfo && lockInfo.lockedById === myUserId;
  const isLockedByOther = lockInfo && lockInfo.lockedById !== myUserId;

  function formatExpiry(expiresAt: string) {
    const remaining = new Date(expiresAt).getTime() - Date.now();
    if (remaining <= 0) return 'Expired';
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    return `${mins}m ${secs}s`;
  }

  return (
    <main className="flex-1 p-6" aria-labelledby="collaborate-heading">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <h1 id="collaborate-heading" className="text-2xl font-bold text-primary-navy">
            Collaborative Editing
          </h1>
          <p className="text-sm text-muted-foreground">Document locking, autosave, and presence tracking</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main editing area */}
          <div className="lg:col-span-2 space-y-4">
            {/* Lock status banner */}
            {lockInfo ? (
              <div
                className={`rounded-lg border px-4 py-3 flex items-center justify-between gap-3 ${
                  isLockedByMe
                    ? 'border-green-300 bg-green-50'
                    : 'border-amber-300 bg-amber-50'
                }`}
                role="status"
              >
                <div className="text-sm">
                  {isLockedByMe ? (
                    <span className="font-medium text-green-700">You have the document locked</span>
                  ) : (
                    <span className="font-medium text-amber-700">
                      Locked by {lockInfo.lockedBy.firstName} {lockInfo.lockedBy.lastName}
                    </span>
                  )}
                  <span className="ml-2 text-xs text-muted-foreground">
                    Expires in {formatExpiry(lockInfo.expiresAt)}
                  </span>
                </div>
                {isLockedByMe && (
                  <button
                    onClick={() => releaseLockMutation.mutate()}
                    disabled={releaseLockMutation.isPending}
                    className="rounded-md border border-amber-600 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                  >
                    Release Lock
                  </button>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Document is not locked</span>
                <button
                  onClick={() => acquireLockMutation.mutate()}
                  disabled={acquireLockMutation.isPending}
                  className="rounded-md bg-primary-navy px-3 py-1 text-xs font-medium text-white hover:bg-opacity-90 disabled:opacity-50"
                >
                  {acquireLockMutation.isPending ? 'Locking...' : 'Lock Document'}
                </button>
              </div>
            )}

            {/* Editor */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="doc-content" className="text-sm font-medium text-gray-700">
                  Document Content
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => autosaveMutation.mutate()}
                    disabled={!content.trim() || autosaveMutation.isPending || !!isLockedByOther}
                    className="rounded-md border border-primary-gold px-3 py-1 text-xs font-medium text-primary-gold hover:bg-primary-gold hover:text-white disabled:opacity-50 transition-colors"
                  >
                    {autosaveMutation.isPending ? 'Saving...' : 'Autosave'}
                  </button>
                </div>
              </div>
              <textarea
                id="doc-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={18}
                disabled={!!isLockedByOther}
                className="w-full rounded-lg border border-gray-300 p-4 font-mono text-sm resize-y focus:border-primary-gold focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder={isLockedByOther ? 'Document is locked by another user...' : 'Start typing your document content...'}
                aria-label="Document content"
              />
              <p className="mt-1 text-xs text-muted-foreground text-right">
                {content.length} characters
              </p>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            {/* Active Collaborators */}
            <div className="rounded-xl border border-border bg-white p-4">
              <h2 className="text-sm font-semibold text-primary-navy mb-3">Active Collaborators</h2>
              {!presenceData || presenceData.activeUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground">No active collaborators (REST polling only)</p>
              ) : (
                <ul className="space-y-1.5">
                  {presenceData.activeUsers.map((uid) => (
                    <li key={uid} className="flex items-center gap-2 text-sm">
                      <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-gray-700 font-mono text-xs">{uid}</span>
                    </li>
                  ))}
                </ul>
              )}
              <button
                onClick={() => queryClient.invalidateQueries({ queryKey: ['collab-presence', id] })}
                className="mt-3 text-xs text-primary-navy hover:underline"
              >
                Refresh presence
              </button>
            </div>

            {/* Autosave History */}
            <div className="rounded-xl border border-border bg-white p-4">
              <h2 className="text-sm font-semibold text-primary-navy mb-3">Autosave History</h2>
              {autosaveHistory.length === 0 ? (
                <p className="text-xs text-muted-foreground">No autosaves yet.</p>
              ) : (
                <ul className="space-y-2">
                  {autosaveHistory.map((snap, i) => (
                    <li key={snap.id} className="rounded-md border border-gray-100 bg-gray-50 p-2 text-xs">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-medium text-primary-navy">
                          Save #{autosaveHistory.length - i}
                        </span>
                        {i === 0 && (
                          <span className="rounded-full bg-green-100 text-green-700 px-1.5 py-0.5 text-xs">
                            Latest
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground">
                        by {snap.savedBy.firstName} {snap.savedBy.lastName}
                      </p>
                      <p className="text-muted-foreground">
                        {new Date(snap.savedAt).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Lock Info Card */}
            {lockInfo && (
              <div className="rounded-xl border border-border bg-white p-4 text-xs text-gray-600">
                <h2 className="text-sm font-semibold text-primary-navy mb-2">Lock Details</h2>
                <p><span className="font-medium">Held by:</span> {lockInfo.lockedBy.firstName} {lockInfo.lockedBy.lastName}</p>
                <p><span className="font-medium">Locked at:</span> {new Date(lockInfo.lockedAt).toLocaleString()}</p>
                <p><span className="font-medium">Expires at:</span> {new Date(lockInfo.expiresAt).toLocaleString()}</p>
                {lockInfo.sessionId && (
                  <p><span className="font-medium">Session:</span> {lockInfo.sessionId}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
