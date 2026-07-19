import { useEffect, useState } from 'react';
import { SkuBatch, listSkuBatches, ingestBatch, getBatchStatus } from './skuService';
import { Loader2 } from 'lucide-react';
import SkuDataView from './SkuDataView';

const SKU_SCHEMA: { column: string; description: string }[] = [
  { column: 'SKU CODE', description: 'Unique code assigned to the product' },
  { column: 'SKU DESCRIPTION', description: 'Product name and description' },
  { column: 'DIVISION', description: 'Highest-level merchandise grouping' },
  { column: 'DEPARTMENT', description: 'Merchandise department within the division' },
  { column: 'CATEGORY', description: 'Product category within the department' },
  { column: 'CLASS', description: 'More detailed product group within the category' },
  { column: 'BRAND', description: 'Product brand' },
  { column: 'STANDARD PACK', description: 'Standard number of units in a supplier pack or case' },
  { column: 'PACK TYPE', description: 'Type of product packaging (can, bottle, box, sachet)' },
  { column: 'BUY UNIT OF MEASURE', description: 'Unit quantity used when purchasing from the supplier' },
  { column: 'SELL UNIT OF MEASURE', description: 'Unit quantity used when selling to customers' },
  { column: 'UNIT COST', description: 'Recorded cost per product unit' },
  { column: 'WEIGTH', description: 'Recorded product weight (column name misspelled in source)' },
  { column: 'HEIGHT', description: 'Recorded product or package height' },
  { column: 'LENGTH', description: 'Recorded product or package length' },
  { column: 'WIDTH', description: 'Recorded product or package width' },
  { column: 'CUBE', description: 'Recorded package volume or cubic-space measurement' },
  { column: 'VENDOR CODE', description: 'Unique code assigned to the product supplier' },
  { column: 'VENDOR DESCRIPTION', description: 'Name or description of the supplier' },
];

export default function SkuBronzeView({ refreshTrigger }: { refreshTrigger: number }) {
  const [batches, setBatches] = useState<SkuBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'batches' | 'data'>('batches');

  // Toast state
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    setToast({ message, type });
  };

  useEffect(() => {
    const fetchBatches = async () => {
      setLoading(true);
      try {
        const data = await listSkuBatches();
        setBatches(data);
      } catch (error) {
        console.error("Error fetching SKU batches:", error);
      }
      setLoading(false);
    };
    fetchBatches();
  }, [refreshTrigger]);

  const handleIngest = async (batchId: string) => {
    setIngesting(prev => ({ ...prev, [batchId]: true }));
    try {
      const res = await ingestBatch(batchId);
      if (res.status === 'ingested') {
        const skipped = res.duplicates_skipped || 0;
        if (res.rows_ingested === 0 && skipped > 0) {
          showToast(`No new rows: all ${skipped.toLocaleString()} rows are exact duplicates of existing data`, 'warning');
        } else if (skipped > 0) {
          showToast(`Ingested ${res.rows_ingested.toLocaleString()} new rows — ${skipped.toLocaleString()} duplicate rows detected and skipped`, 'warning');
        } else {
          showToast(`Ingested ${res.rows_ingested.toLocaleString()} SKU rows`, 'success');
        }
      } else if (res.status === 'already_ingested') {
        showToast('Already ingested.', 'info');
      }

      // Refresh final status from DB via API to ensure sync
      const statusRes = await getBatchStatus(batchId);
      setBatches(prev => prev.map(b => b.id === batchId ? {
        ...b,
        status: statusRes.status,
        row_count: statusRes.row_count
      } : b));

    } catch (e: any) {
      showToast(e.message || 'Ingestion failed', 'error');
    } finally {
      setIngesting(prev => ({ ...prev, [batchId]: false }));
    }
  };

  const totalBatches = batches.length;
  const totalRows = batches.reduce((sum, b) => sum + (b.row_count || 0), 0);
  const totalSizeBytes = batches.reduce((sum, b) => sum + (b.file_size_bytes || 0), 0);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formattedTotalSize = formatSize(totalSizeBytes);

  const getToastColors = (type: string) => {
    switch (type) {
      case 'success': return 'bg-green-50 text-green-800 border-green-200';
      case 'error': return 'bg-red-50 text-red-800 border-red-200';
      case 'warning': return 'bg-yellow-50 text-yellow-800 border-yellow-200';
      case 'info': return 'bg-blue-50 text-blue-800 border-blue-200';
      default: return 'bg-white text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Toast Overlay */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-[8px] border shadow-lg z-50 flex items-center transition-all animate-in fade-in slide-in-from-bottom-4 ${getToastColors(toast.type)}`}>
          <p className="text-[14px] font-medium">{toast.message}</p>
        </div>
      )}

      {viewMode === 'data' ? (
        <SkuDataView onBack={() => setViewMode('batches')} showToast={showToast} />
      ) : (
        <>
          <div className="flex justify-between items-center mb-[-8px]">
             <h2 className="text-[18px] font-semibold text-text-main">Bronze SKU Hierarchy Data</h2>
             <button
               onClick={() => setViewMode('data')}
               className="inline-flex items-center justify-center h-9 px-4 rounded-[6px] text-[13px] font-medium bg-[#0054A6] text-white hover:bg-[#004385] transition-colors"
             >
               View Data
             </button>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-6">
              <h3 className="text-[13px] font-semibold text-text-muted uppercase tracking-wider mb-2">Total Batches</h3>
              <p className="text-[28px] font-bold text-text-main">{loading ? '-' : totalBatches}</p>
            </div>
        <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-6">
          <h3 className="text-[13px] font-semibold text-text-muted uppercase tracking-wider mb-2">Total Rows</h3>
          <p className="text-[28px] font-bold text-text-main">{loading ? '-' : totalRows.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-6">
          <h3 className="text-[13px] font-semibold text-text-muted uppercase tracking-wider mb-2">Storage Size</h3>
          <p className="text-[28px] font-bold text-text-main">{loading ? '-' : formattedTotalSize}</p>
        </div>
      </div>

      <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle overflow-hidden">
        <div className="px-6 py-5 border-b border-border-subtle flex items-center justify-between">
          <h3 className="text-[16px] font-semibold text-text-main">Recent batches</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-bg">
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">File Name</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Rows</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Size</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Uploaded By</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[13px] text-text-muted">Loading batches...</td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[13px] text-text-muted">No batches uploaded yet.</td>
                </tr>
              ) : (
                batches.map(b => {
                  const isIngesting = ingesting[b.id];

                  return (
                    <tr key={b.id} className="hover:bg-surface-bg transition-colors">
                      <td className="px-6 py-4 text-[13px] font-medium text-text-main whitespace-nowrap">
                        {b.file_name}
                      </td>
                      <td className="px-6 py-4 text-[13px] text-text-main whitespace-nowrap">
                        {b.row_count != null ? b.row_count.toLocaleString() : '—'}
                      </td>
                      <td className="px-6 py-4 text-[13px] text-text-muted whitespace-nowrap">
                        {formatSize(b.file_size_bytes || 0)}
                      </td>
                      <td className="px-6 py-4 text-[13px] whitespace-nowrap">
                        {b.status === 'uploaded' && <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium bg-gray-100 text-gray-800">Uploaded</span>}
                        {b.status === 'ingested' && <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium bg-green-100 text-green-800">Ingested</span>}
                        {b.status === 'ingestion_failed' && <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium bg-red-100 text-red-800">Failed</span>}
                      </td>
                      <td className="px-6 py-4 text-[13px] text-text-muted whitespace-nowrap">
                        {b.uploaded_by}
                      </td>
                      <td className="px-6 py-4 text-[13px] text-text-muted whitespace-nowrap">
                        {new Date(b.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </td>
                      <td className="px-6 py-4 text-[13px] text-right whitespace-nowrap">
                        {b.status === 'uploaded' && (
                          <button
                            onClick={() => handleIngest(b.id)}
                            disabled={isIngesting}
                            className="inline-flex items-center justify-center h-8 px-3 rounded-[6px] text-[13px] font-medium bg-[#0054A6] text-white hover:bg-[#004385] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {isIngesting ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                                Ingesting...
                              </>
                            ) : (
                              'Ingest'
                            )}
                          </button>
                        )}
                        {b.status === 'ingestion_failed' && (
                           <button
                             onClick={() => handleIngest(b.id)}
                             disabled={isIngesting}
                             className="inline-flex items-center justify-center h-8 px-3 rounded-[6px] text-[13px] font-medium border border-border-subtle bg-white text-text-main hover:bg-surface-bg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                           >
                             {isIngesting ? (
                               <>
                                 <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                                 Retrying...
                               </>
                             ) : (
                               'Retry'
                             )}
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
              {SKU_SCHEMA.map(s => (
                <tr key={s.column} className="hover:bg-surface-bg transition-colors">
                  <td className="px-6 py-4 text-[13px] font-mono text-text-main whitespace-nowrap">{s.column}</td>
                  <td className="px-6 py-4 text-[13px] text-text-muted">{s.description}</td>
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
