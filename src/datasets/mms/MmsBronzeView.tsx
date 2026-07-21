import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

import MmsDataView from './MmsDataView';
import {
  getMmsBronzeStats,
  ingestMmsBatch,
  listMmsBatches,
  MmsBatch,
  MmsBronzeStats,
  MmsStoredStatus,
} from './mmsService';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface MmsBronzeViewProps {
  refreshTrigger: number;
}

const MMS_SCHEMA: { column: string; description: string }[] = [
  { column: 'DATE', description: 'Raw transaction date text exactly as supplied; may be blank or malformed' },
  { column: 'TRANSACTION NUMBER', description: 'Raw transaction identifier text; may be blank' },
  { column: 'REGISTER NUMBER', description: 'Raw register or POS identifier text; may be blank' },
  { column: 'STORE CODE', description: 'Raw store identifier text; may be blank' },
  { column: 'STORE CATEGORIZATION', description: 'Raw store category text; may be blank' },
  { column: 'SKU CODE', description: 'Raw product SKU identifier text; may be blank' },
  { column: 'TRANSACTION TYPE', description: 'Raw transaction-type text; may be blank' },
  { column: 'MMS SALES', description: 'Raw sales-value text exactly as supplied; may be blank or nonnumeric' },
  { column: 'QTY SOLD', description: 'Raw quantity-sold text exactly as supplied; may be blank or nonnumeric' },
  { column: 'MARGIN', description: 'Raw margin-value text exactly as supplied; may be blank or nonnumeric' },
];

const STATUS_DISPLAY: Record<MmsStoredStatus, { label: string; className: string }> = {
  uploaded: { label: 'Uploaded', className: 'bg-gray-100 text-gray-800' },
  ingested: { label: 'Ingested', className: 'bg-green-100 text-green-800' },
  ingestion_failed: { label: 'Ingestion failed', className: 'bg-red-100 text-red-800' },
  invalid_multi_store: { label: 'Invalid: multiple stores', className: 'bg-red-100 text-red-800' },
  invalid_multi_month: { label: 'Invalid: multiple months', className: 'bg-red-100 text-red-800' },
  duplicate_suspected: { label: 'Duplicate suspected', className: 'bg-yellow-100 text-yellow-800' },
};

function canIngest(status: MmsStoredStatus | null): boolean {
  return status === 'uploaded' || status === 'ingestion_failed';
}

function safeText(value: string | null): string {
  return value && value.trim() ? value : '—';
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null) return '—';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${parseFloat((bytes / Math.pow(1024, unitIndex)).toFixed(2))} ${units[unitIndex]}`;
}

function formatCreatedAt(value: string | null): string {
  if (!value) return '—';
  const createdAt = new Date(value);
  if (Number.isNaN(createdAt.getTime())) return '—';
  return createdAt.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function safeIngestionError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('not found')) return 'This MMS batch could not be found. Refresh the batch list and try again.';
  if (message.includes('ingestion engine URL is not configured')) {
    return 'The MMS ingestion service is not configured. Please contact the application administrator.';
  }
  if (
    message.includes('Schema mismatch')
    || message.includes('MMS file contains no data rows')
    || message.includes('multiple populated stores')
    || message.includes('multiple detected calendar months')
    || message.includes('Could not parse MMS CSV')
  ) {
    return 'MMS validation failed. Review the file structure and values, then upload a corrected file.';
  }
  return 'MMS ingestion could not be completed. Please refresh and try again.';
}

function toastClassName(type: ToastType): string {
  if (type === 'success') return 'bg-green-50 text-green-800 border-green-200';
  if (type === 'error') return 'bg-red-50 text-red-800 border-red-200';
  if (type === 'warning') return 'bg-yellow-50 text-yellow-800 border-yellow-200';
  return 'bg-blue-50 text-blue-800 border-blue-200';
}

function StatusBadge({ status }: { status: MmsStoredStatus | null }) {
  if (!status) return <span className="text-[13px] text-text-muted">—</span>;
  const display = STATUS_DISPLAY[status];
  return (
    <span className={`inline-flex px-2 py-1 rounded-full text-[11px] font-medium ${display.className}`}>
      {display.label}
    </span>
  );
}

export default function MmsBronzeView({ refreshTrigger }: MmsBronzeViewProps) {
  const [batches, setBatches] = useState<MmsBatch[]>([]);
  const [totalBatchCount, setTotalBatchCount] = useState<number | null>(null);
  const [stats, setStats] = useState<MmsBronzeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [ingesting, setIngesting] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'batches' | 'data'>('batches');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const overviewRequestSequence = useRef(0);
  const ingestionLocks = useRef(new Set<string>());

  const showToast = (message: string, type: ToastType) => setToast({ message, type });

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadOverview = async () => {
    const requestSequence = overviewRequestSequence.current + 1;
    overviewRequestSequence.current = requestSequence;
    setLoading(true);
    setLoadError('');

    try {
      const [batchResult, bronzeStats] = await Promise.all([
        listMmsBatches(),
        getMmsBronzeStats(),
      ]);
      if (requestSequence !== overviewRequestSequence.current) return;
      setBatches(batchResult.batches);
      setTotalBatchCount(batchResult.total_count);
      setStats(bronzeStats);
    } catch {
      if (requestSequence !== overviewRequestSequence.current) return;
      setLoadError('The MMS batch overview could not be loaded. Please try again.');
    } finally {
      if (requestSequence === overviewRequestSequence.current) setLoading(false);
    }
  };

  useEffect(() => {
    void loadOverview();
    return () => {
      overviewRequestSequence.current += 1;
    };
  }, [refreshTrigger]);

  const handleIngest = async (batchId: string) => {
    if (ingestionLocks.current.has(batchId)) return;
    ingestionLocks.current.add(batchId);
    setIngesting(previous => ({ ...previous, [batchId]: true }));

    try {
      const result = await ingestMmsBatch(batchId);
      if (result.status === 'ingested') {
        showToast(`Ingested ${result.rows_ingested} MMS rows.`, 'success');
      } else if (result.status === 'duplicate_suspected') {
        showToast(
          `Store ${result.store_code} for ${result.year_month} already has an ingested batch. No rows were added.`,
          'warning',
        );
      } else if (result.status === 'already_ingested') {
        showToast('This MMS batch was already ingested. No rows were added.', 'info');
      }
    } catch (ingestionError) {
      showToast(safeIngestionError(ingestionError), 'error');
    } finally {
      await loadOverview();
      ingestionLocks.current.delete(batchId);
      setIngesting(previous => ({ ...previous, [batchId]: false }));
    }
  };

  const recentBatchSizeBytes = batches.reduce((total, batch) => total + (batch.file_size_bytes || 0), 0);

  return (
    <div className="space-y-6 relative">
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-[8px] border shadow-lg z-50 ${toastClassName(toast.type)}`}>
          <p className="text-[14px] font-medium">{toast.message}</p>
        </div>
      )}

      {viewMode === 'data' ? (
        <MmsDataView onBack={() => setViewMode('batches')} showToast={showToast} />
      ) : (
        <>
          <div className="flex justify-between items-center gap-4">
            <h2 className="text-[18px] font-semibold text-text-main">Bronze MMS Data</h2>
            <button
              type="button"
              onClick={() => setViewMode('data')}
              className="inline-flex items-center justify-center h-9 px-4 rounded-[6px] text-[13px] font-medium bg-[#0054A6] text-white hover:bg-[#004385] transition-colors"
            >
              View Data
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-6">
              <h3 className="text-[13px] font-semibold text-text-muted uppercase tracking-wider mb-2">Total Batches</h3>
              <p className="text-[28px] font-bold text-text-main">{loading ? '—' : totalBatchCount ?? '—'}</p>
            </div>
            <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-6">
              <h3 className="text-[13px] font-semibold text-text-muted uppercase tracking-wider mb-2">Total Rows</h3>
              <p className="text-[28px] font-bold text-text-main">{stats ? stats.total_rows : '—'}</p>
            </div>
            <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-6">
              <h3 className="text-[13px] font-semibold text-text-muted uppercase tracking-wider mb-2">Recent Batch Size</h3>
              <p className="text-[28px] font-bold text-text-main">{loading ? '—' : formatFileSize(recentBatchSizeBytes)}</p>
            </div>
          </div>

          {loadError && (
            <div className="bg-error/10 border border-error/20 rounded-[8px] p-4 flex items-center justify-between gap-4">
              <p className="text-[13px] font-medium text-error">{loadError}</p>
              <button
                type="button"
                onClick={() => void loadOverview()}
                disabled={loading}
                className="h-8 px-3 rounded-[6px] text-[13px] font-medium border border-error/30 bg-white text-error hover:bg-error/5 disabled:opacity-50"
              >
                Retry
              </button>
            </div>
          )}

          <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle overflow-hidden">
            <div className="px-6 py-5 border-b border-border-subtle">
              <h3 className="text-[16px] font-semibold text-text-main">Recent batches</h3>
              {totalBatchCount !== null && totalBatchCount > batches.length && (
                <p className="text-[12px] text-text-muted mt-1">
                  Showing the {batches.length} most recent of {totalBatchCount} total batches.
                </p>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max text-left border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-bg">
                    {['Batch ID', 'File Name', 'Status', 'Store', 'Year/Month', 'Rows', 'Size', 'Uploaded By', 'Created', 'Action'].map(label => (
                      <th
                        key={label}
                        className={`px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap ${label === 'Action' ? 'text-right' : ''}`}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center">
                        <Loader2 className="w-6 h-6 animate-spin text-text-muted mx-auto" />
                        <p className="text-[13px] text-text-muted mt-2">Loading MMS batches...</p>
                      </td>
                    </tr>
                  ) : batches.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center text-[13px] text-text-muted">
                        No MMS batches have been uploaded yet.
                      </td>
                    </tr>
                  ) : (
                    batches.map(batch => {
                      const isIngesting = Boolean(ingesting[batch.id]);
                      const showAction = canIngest(batch.status);
                      return (
                        <tr key={batch.id} className="hover:bg-surface-bg transition-colors">
                          <td className="px-6 py-4 text-[12px] font-mono text-text-muted whitespace-nowrap">{batch.id}</td>
                          <td className="px-6 py-4 text-[13px] font-medium text-text-main whitespace-nowrap">{safeText(batch.file_name)}</td>
                          <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={batch.status} /></td>
                          <td className="px-6 py-4 text-[13px] text-text-main whitespace-nowrap">{safeText(batch.store_code)}</td>
                          <td className="px-6 py-4 text-[13px] text-text-main whitespace-nowrap">{safeText(batch.year_month)}</td>
                          <td className="px-6 py-4 text-[13px] text-text-main whitespace-nowrap">{batch.row_count ?? '—'}</td>
                          <td className="px-6 py-4 text-[13px] text-text-muted whitespace-nowrap">{formatFileSize(batch.file_size_bytes)}</td>
                          <td className="px-6 py-4 text-[13px] text-text-muted whitespace-nowrap">{safeText(batch.uploaded_by)}</td>
                          <td className="px-6 py-4 text-[13px] text-text-muted whitespace-nowrap">{formatCreatedAt(batch.created_at)}</td>
                          <td className="px-6 py-4 text-right whitespace-nowrap">
                            {showAction && (
                              <button
                                type="button"
                                onClick={() => void handleIngest(batch.id)}
                                disabled={isIngesting}
                                className={`inline-flex items-center justify-center h-8 px-3 rounded-[6px] text-[13px] font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${batch.status === 'uploaded' ? 'bg-[#0054A6] text-white hover:bg-[#004385]' : 'border border-border-subtle bg-white text-text-main hover:bg-surface-bg'}`}
                              >
                                {isIngesting && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
                                {isIngesting ? 'Ingesting...' : batch.status === 'uploaded' ? 'Ingest' : 'Retry'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle overflow-hidden">
            <div className="px-6 py-5 border-b border-border-subtle">
              <h3 className="text-[16px] font-semibold text-text-main">Schema</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-bg">
                    <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Column</th>
                    <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {MMS_SCHEMA.map(schema => (
                    <tr key={schema.column} className="hover:bg-surface-bg transition-colors">
                      <td className="px-6 py-4 text-[13px] font-mono text-text-main whitespace-nowrap">{schema.column}</td>
                      <td className="px-6 py-4 text-[13px] text-text-muted">{schema.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
