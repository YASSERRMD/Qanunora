'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

const DOCUMENT_CATEGORIES = [
  'DRAFT', 'FINAL', 'SUPPORTING', 'REFERENCE',
  'IMPACT_ANALYSIS', 'COMMITTEE_REPORT', 'CONSULTATION_FEEDBACK', 'LEGAL_OPINION',
];

const MIME_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
  'text/plain': 'TXT',
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

interface Document {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: string;
  category: string;
  title?: string;
  description?: string;
  isCurrentVersion: boolean;
  createdAt: string;
  uploadedBy: { firstName: string; lastName: string };
}

export default function DocumentsPage() {
  const { id: legislativeItemId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState('DRAFT');
  const [title, setTitle] = useState('');
  const [uploadError, setUploadError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['documents', legislativeItemId],
    queryFn: async () => {
      const res = await apiClient.get<{ data: Document[]; total: number }>('/documents', {
        params: { legislativeItemId },
      });
      return res.data;
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('legislativeItemId', legislativeItemId);
      fd.append('category', category);
      if (title) fd.append('title', title);
      await apiClient.post('/documents', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['documents', legislativeItemId] });
      setTitle('');
      setUploadError('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string | string[] } } };
      const msg = err.response?.data?.message;
      setUploadError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Upload failed'));
    },
  });

  const deleteDoc = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/documents/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['documents', legislativeItemId] });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload.mutate(file);
  };

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-primary-navy">Documents</h1>
          <p className="text-sm text-muted-foreground mt-1">Upload and manage documents for this legislative item</p>
        </div>

        <div className="mb-6 rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-primary-navy mb-4">Upload Document</h2>
          {uploadError && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {uploadError}
            </div>
          )}
          <div className="flex gap-3 flex-wrap items-end">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30"
              >
                {DOCUMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-48">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Title (optional)</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Document title..."
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-navy/30"
              />
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.txt,.png,.jpg,.jpeg"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
                  upload.isPending
                    ? 'bg-primary-navy/50 cursor-not-allowed'
                    : 'bg-primary-navy hover:bg-primary-navy/90'
                }`}
              >
                {upload.isPending ? 'Uploading...' : 'Choose & Upload'}
              </label>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Max 50 MB. Allowed: PDF, DOCX, DOC, XLSX, XLS, PPTX, TXT, PNG, JPEG</p>
        </div>

        <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading documents...</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">File</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Size</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Uploaded By</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((doc) => (
                  <tr key={doc.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-primary-gold/20 px-1.5 py-0.5 text-xs font-bold text-primary-navy">
                          {MIME_LABELS[doc.mimeType] ?? 'FILE'}
                        </span>
                        <div>
                          <p className="font-medium text-primary-navy">{doc.title ?? doc.originalName}</p>
                          {doc.title && <p className="text-xs text-muted-foreground">{doc.originalName}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {doc.category.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatBytes(Number(doc.sizeBytes))}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {doc.uploadedBy.firstName} {doc.uploadedBy.lastName}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <a
                          href={`/api/v1/documents/${doc.id}/download`}
                          className="text-xs text-primary-navy hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Download
                        </a>
                        <button
                          onClick={() => deleteDoc.mutate(doc.id)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!data?.data.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No documents uploaded yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        {data && (
          <p className="mt-3 text-xs text-muted-foreground">{data.total} document(s)</p>
        )}
      </div>
    </main>
  );
}
