'use client';

import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useState } from 'react';

type GazetteStatus = 'PREPARING' | 'READINESS_CHECK' | 'PENDING_APPROVAL' | 'APPROVED' | 'PUBLISHED' | 'RETRACTED';

interface ChecklistItem {
  id: string;
  item: string;
  isCompleted: boolean;
  completedAt?: string;
  order: number;
}

interface GazetteEntry {
  id: string;
  gazetteNumber: string;
  title: string;
  titleAr?: string;
  effectiveDate?: string;
  issueDate?: string;
  publicationStatus: GazetteStatus;
  approvedAt?: string;
  publishedAt?: string;
  archiveUrl?: string;
  checklist: ChecklistItem[];
  legislativeItem: { title: string; referenceNumber: string; type: string; status: string };
  createdBy: { firstName: string; lastName: string };
  approvedBy?: { firstName: string; lastName: string };
}

interface PublicationPackage {
  gazetteNumber: string;
  issueDate?: string;
  title: string;
  titleAr?: string;
  effectiveDate?: string;
  legislativeItemRef: string;
  publicationStatus: string;
  checklistCompletion: { total: number; completed: number; pending: string[] };
  isReadyToPublish: boolean;
}

const STATUS_COLORS: Record<GazetteStatus, string> = {
  PREPARING: 'bg-gray-100 text-gray-600',
  READINESS_CHECK: 'bg-blue-100 text-blue-700',
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  PUBLISHED: 'bg-emerald-100 text-emerald-700',
  RETRACTED: 'bg-red-100 text-red-700',
};

export default function GazetteDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const [retractReason, setRetractReason] = useState('');
  const [showRetractForm, setShowRetractForm] = useState(false);
  const [showPackage, setShowPackage] = useState(false);

  const { data: entry, isLoading } = useQuery({
    queryKey: ['gazette-entry', id],
    queryFn: async () => {
      const res = await apiClient.get(`/gazette/${id}`);
      return res.data as GazetteEntry;
    },
  });

  const { data: pkg } = useQuery({
    queryKey: ['gazette-package', id],
    queryFn: async () => {
      const res = await apiClient.get(`/gazette/${id}/package`);
      return res.data as PublicationPackage;
    },
    enabled: showPackage,
  });

  const completeItem = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await apiClient.post(`/gazette/${id}/checklist/${itemId}/complete`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gazette-entry', id] }),
  });

  const uncompleteItem = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await apiClient.post(`/gazette/${id}/checklist/${itemId}/uncomplete`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gazette-entry', id] }),
  });

  const submitForApproval = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/gazette/${id}/submit`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gazette-entry', id] }),
  });

  const approve = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/gazette/${id}/approve`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gazette-entry', id] }),
  });

  const publish = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/gazette/${id}/publish`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gazette-entry', id] }),
  });

  const retract = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/gazette/${id}/retract`, { reason: retractReason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gazette-entry', id] });
      setShowRetractForm(false);
    },
  });

  if (isLoading) return <div className="p-8 text-center text-gray-400">Loading...</div>;
  if (!entry) return <div className="p-8 text-center text-gray-400">Entry not found</div>;

  const allComplete = entry.checklist.every((c) => c.isCompleted);
  const completedCount = entry.checklist.filter((c) => c.isCompleted).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900 font-mono">{entry.gazetteNumber}</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[entry.publicationStatus]}`}>
              {entry.publicationStatus.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-gray-700 font-medium">{entry.title}</p>
          <p className="text-sm text-gray-500">
            {entry.legislativeItem.referenceNumber} · {entry.legislativeItem.type}
          </p>
        </div>
        <button
          onClick={() => setShowPackage(!showPackage)}
          className="px-4 py-1.5 border border-indigo-300 text-indigo-700 rounded text-sm hover:bg-indigo-50"
        >
          {showPackage ? 'Hide Package' : 'View Publication Package'}
        </button>
      </div>

      {/* Publication Package Preview */}
      {showPackage && pkg && (
        <div className="bg-indigo-50 rounded-lg p-5 space-y-3 border border-indigo-200">
          <h2 className="font-semibold text-indigo-800">Publication Package</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-500">Gazette #:</span> <span className="font-mono font-semibold">{pkg.gazetteNumber}</span></div>
            <div><span className="text-gray-500">Status:</span> <span>{pkg.publicationStatus}</span></div>
            <div><span className="text-gray-500">Item Ref:</span> <span className="font-mono">{pkg.legislativeItemRef}</span></div>
            <div><span className="text-gray-500">Effective Date:</span> <span>{pkg.effectiveDate ? new Date(pkg.effectiveDate).toLocaleDateString() : '-'}</span></div>
            <div><span className="text-gray-500">Issue Date:</span> <span>{pkg.issueDate ? new Date(pkg.issueDate).toLocaleDateString() : '-'}</span></div>
            <div><span className="text-gray-500">Checklist:</span> <span>{pkg.checklistCompletion.completed}/{pkg.checklistCompletion.total} complete</span></div>
          </div>
          {pkg.checklistCompletion.pending.length > 0 && (
            <div>
              <p className="text-xs text-orange-600 font-medium mb-1">Pending items:</p>
              <ul className="text-xs text-orange-700 space-y-0.5">
                {pkg.checklistCompletion.pending.map((item) => (
                  <li key={item} className="flex items-center gap-1">
                    <span className="text-orange-400">•</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {pkg.isReadyToPublish && (
            <div className="bg-green-100 text-green-700 px-3 py-2 rounded text-sm font-medium">
              Ready to publish
            </div>
          )}
        </div>
      )}

      {/* Checklist */}
      <div className="bg-white rounded-lg shadow p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800">Publication Checklist</h2>
          <div className="flex items-center gap-2">
            <div className="w-32 bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${entry.checklist.length > 0 ? (completedCount / entry.checklist.length) * 100 : 0}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">{completedCount}/{entry.checklist.length}</span>
          </div>
        </div>
        <div className="space-y-2">
          {entry.checklist.map((item) => (
            <div
              key={item.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${item.isCompleted ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${item.isCompleted ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-500'}`}>
                  {item.isCompleted ? '✓' : item.order}
                </div>
                <span className={`text-sm ${item.isCompleted ? 'text-green-700 line-through' : 'text-gray-700'}`}>
                  {item.item}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {item.completedAt && (
                  <span className="text-xs text-gray-400">{new Date(item.completedAt).toLocaleDateString()}</span>
                )}
                {item.isCompleted ? (
                  <button
                    onClick={() => uncompleteItem.mutate(item.id)}
                    className="text-xs text-orange-600 hover:underline"
                  >
                    Undo
                  </button>
                ) : (
                  <button
                    onClick={() => completeItem.mutate(item.id)}
                    className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded hover:bg-green-200"
                  >
                    Complete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Workflow Actions */}
      <div className="bg-white rounded-lg shadow p-5">
        <h2 className="font-semibold text-gray-800 mb-4">Workflow Actions</h2>
        <div className="flex flex-wrap gap-3">
          {entry.publicationStatus === 'PREPARING' || entry.publicationStatus === 'READINESS_CHECK' ? (
            <button
              onClick={() => submitForApproval.mutate()}
              disabled={!allComplete || submitForApproval.isPending}
              className="px-4 py-2 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600 disabled:opacity-40"
            >
              Submit for Approval
            </button>
          ) : null}

          {entry.publicationStatus === 'PENDING_APPROVAL' && (
            <button
              onClick={() => approve.mutate()}
              disabled={approve.isPending}
              className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-40"
            >
              Approve
            </button>
          )}

          {entry.publicationStatus === 'APPROVED' && (
            <button
              onClick={() => publish.mutate()}
              disabled={publish.isPending}
              className="px-4 py-2 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700 disabled:opacity-40"
            >
              Publish to Gazette
            </button>
          )}

          {entry.publicationStatus === 'PUBLISHED' && (
            <button
              onClick={() => setShowRetractForm(true)}
              className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
            >
              Retract
            </button>
          )}
        </div>

        {!allComplete && (entry.publicationStatus === 'PREPARING' || entry.publicationStatus === 'READINESS_CHECK') && (
          <p className="mt-3 text-xs text-orange-600">
            All checklist items must be completed before submitting for approval.
          </p>
        )}

        {showRetractForm && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg space-y-3">
            <h3 className="text-sm font-medium text-red-800">Retraction Reason</h3>
            <textarea
              className="w-full border border-red-300 rounded px-3 py-2 text-sm"
              rows={3}
              placeholder="Provide reason for retraction..."
              value={retractReason}
              onChange={(e) => setRetractReason(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                onClick={() => retract.mutate()}
                disabled={!retractReason || retract.isPending}
                className="px-4 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-40"
              >
                Confirm Retraction
              </button>
              <button onClick={() => setShowRetractForm(false)} className="px-4 py-1.5 text-gray-500 text-sm">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="bg-white rounded-lg shadow p-5">
        <h2 className="font-semibold text-gray-800 mb-3">Details</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Created By:</span>{' '}
            <span>{entry.createdBy.firstName} {entry.createdBy.lastName}</span>
          </div>
          {entry.approvedBy && (
            <div>
              <span className="text-gray-500">Approved By:</span>{' '}
              <span>{entry.approvedBy.firstName} {entry.approvedBy.lastName}</span>
            </div>
          )}
          {entry.approvedAt && (
            <div>
              <span className="text-gray-500">Approved At:</span>{' '}
              <span>{new Date(entry.approvedAt).toLocaleString()}</span>
            </div>
          )}
          {entry.publishedAt && (
            <div>
              <span className="text-gray-500">Published At:</span>{' '}
              <span>{new Date(entry.publishedAt).toLocaleString()}</span>
            </div>
          )}
          {entry.effectiveDate && (
            <div>
              <span className="text-gray-500">Effective Date:</span>{' '}
              <span>{new Date(entry.effectiveDate).toLocaleDateString()}</span>
            </div>
          )}
          {entry.archiveUrl && (
            <div>
              <span className="text-gray-500">Archive URL:</span>{' '}
              <a href={entry.archiveUrl} className="text-indigo-600 hover:underline text-xs" target="_blank" rel="noopener noreferrer">
                View Archive
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
