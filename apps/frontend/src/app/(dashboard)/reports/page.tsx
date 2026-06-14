'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api-client';

type ReportType = 'lifecycle' | 'consultation' | 'impact' | 'amendments' | 'audit' | 'ministry';
type ReportFormat = 'json' | 'text' | 'csv';

interface ReportHistoryEntry {
  id: number;
  type: ReportType;
  entityId: string;
  format: ReportFormat;
  generatedAt: string;
}

const REPORT_TYPES: { value: ReportType; label: string; idLabel: string; idPlaceholder: string }[] = [
  { value: 'lifecycle', label: 'Lifecycle', idLabel: 'Item ID', idPlaceholder: 'Legislative item UUID' },
  { value: 'consultation', label: 'Consultation', idLabel: 'Consultation ID', idPlaceholder: 'Consultation UUID' },
  { value: 'impact', label: 'Impact Analysis', idLabel: 'Item ID', idPlaceholder: 'Legislative item UUID' },
  { value: 'amendments', label: 'Amendments', idLabel: 'Item ID', idPlaceholder: 'Legislative item UUID' },
  { value: 'audit', label: 'Audit', idLabel: 'Item ID', idPlaceholder: 'Legislative item UUID' },
  { value: 'ministry', label: 'Ministry Summary', idLabel: 'Ministry ID', idPlaceholder: 'Ministry UUID' },
];

let historyCounter = 0;

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('lifecycle');
  const [entityId, setEntityId] = useState('');
  const [format, setFormat] = useState<ReportFormat>('json');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jsonPreview, setJsonPreview] = useState<unknown | null>(null);
  const [history, setHistory] = useState<ReportHistoryEntry[]>([]);

  const selectedType = REPORT_TYPES.find((r) => r.value === reportType)!;

  const getApiPath = () => {
    if (reportType === 'consultation') return `/reports/${reportType}/${entityId}`;
    return `/reports/${reportType}/${entityId}`;
  };

  const handleGenerate = async () => {
    if (!entityId.trim()) {
      setError('Please enter an ID');
      return;
    }
    setLoading(true);
    setError(null);
    setJsonPreview(null);

    try {
      const params: Record<string, string> = { format };
      if (reportType === 'ministry') {
        if (dateFrom) params.dateFrom = dateFrom;
        if (dateTo) params.dateTo = dateTo;
      }

      if (format === 'json') {
        const res = await apiClient.get(getApiPath(), { params });
        setJsonPreview(res.data);
      } else {
        // For text/csv — trigger a download
        const res = await apiClient.get(getApiPath(), {
          params,
          responseType: 'blob',
        });
        const blob = new Blob([res.data as BlobPart]);
        const contentDisposition = res.headers['content-disposition'] as string | undefined;
        const filenameMatch = contentDisposition?.match(/filename="([^"]+)"/);
        const filename = filenameMatch?.[1] ?? `report-${Date.now()}.${format === 'csv' ? 'csv' : 'txt'}`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }

      setHistory((prev) => [
        {
          id: ++historyCounter,
          type: reportType,
          entityId: entityId.trim(),
          format,
          generatedAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to generate report';
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-primary-navy">Reports & Exports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate legislative lifecycle, consultation, impact, and audit reports
          </p>
        </div>

        {/* Report generator card */}
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm mb-6">
          <h2 className="mb-4 text-base font-semibold text-primary-navy">Generate Report</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Report type */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Report Type</label>
              <select
                value={reportType}
                onChange={(e) => { setReportType(e.target.value as ReportType); setJsonPreview(null); setError(null); }}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-gold"
              >
                {REPORT_TYPES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Entity ID */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {selectedType.idLabel}
              </label>
              <input
                type="text"
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                placeholder={selectedType.idPlaceholder}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-gold"
              />
            </div>

            {/* Format */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Format</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as ReportFormat)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-gold"
              >
                <option value="json">JSON (preview)</option>
                <option value="text">Text (download)</option>
                <option value="csv">CSV (download)</option>
              </select>
            </div>

            {/* Ministry date range */}
            {reportType === 'ministry' && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Date From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-gold"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Date To</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-gold"
                  />
                </div>
              </>
            )}
          </div>

          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="rounded-lg bg-primary-navy px-5 py-2 text-sm font-semibold text-white hover:bg-deep-navy transition-colors disabled:opacity-50"
            >
              {loading ? 'Generating…' : 'Generate Report'}
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </div>

        {/* JSON preview */}
        {jsonPreview && (
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-primary-navy">Report Preview</h2>
              <button
                onClick={() => setJsonPreview(null)}
                className="text-xs text-muted-foreground hover:text-slate-700"
              >
                Clear
              </button>
            </div>
            <pre className="max-h-96 overflow-auto rounded-lg bg-gray-50 p-4 text-xs text-slate-700">
              {JSON.stringify(jsonPreview, null, 2)}
            </pre>
          </div>
        )}

        {/* Recent reports */}
        {history.length > 0 && (
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-primary-navy">
              Session History
            </h2>
            <div className="space-y-2">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-block rounded-full bg-primary-navy/10 px-2 py-0.5 text-xs font-semibold text-primary-navy">
                      {entry.type.toUpperCase()}
                    </span>
                    <span className="text-sm text-slate-700 font-mono">{entry.entityId}</span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                      {entry.format.toUpperCase()}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(entry.generatedAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
