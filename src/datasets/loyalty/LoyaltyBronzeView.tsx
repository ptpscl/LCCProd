import { useEffect, useState } from 'react';
import { LoyaltyBatch, listLoyaltyBatches, ingestBatch, getBatchStatus } from './loyaltyService';
import { Loader2 } from 'lucide-react';
import LoyaltyDataView from './LoyaltyDataView';

export default function LoyaltyBronzeView({ refreshTrigger }: { refreshTrigger: number }) {
  const [batches, setBatches] = useState<LoyaltyBatch[]>([]);
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
        const data = await listLoyaltyBatches();
        setBatches(data);
      } catch (error) {
        console.error("Error fetching loyalty batches:", error);
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
        showToast(`Ingested ${res.rows_ingested} rows for store ${res.store_code}, ${res.year_month}`, 'success');
      } else if (res.status === 'duplicate_suspected') {
        showToast(`Store ${res.store_code} / ${res.year_month} already ingested (batch ${res.existing_batch_id}). Skipped.`, 'warning');
      } else if (res.status === 'already_ingested') {
        showToast('Already ingested.', 'info');
      }

      // Refresh final status from DB via API to ensure sync
      const statusRes = await getBatchStatus(batchId);
      setBatches(prev => prev.map(b => b.id === batchId ? { 
        ...b, 
        status: statusRes.status, 
        row_count: statusRes.row_count, 
        store_code: statusRes.store_code, 
        year_month: statusRes.year_month 
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
        <LoyaltyDataView onBack={() => setViewMode('batches')} showToast={showToast} />
      ) : (
        <>
          <div className="flex justify-between items-center mb-[-8px]">
             <h2 className="text-[18px] font-semibold text-text-main">Bronze Loyalty Data</h2>
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
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[13px] text-text-muted">Loading batches...</td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[13px] text-text-muted">No batches uploaded yet.</td>
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
                        {b.status === 'invalid_multi_store' && <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium bg-red-100 text-red-800">Multi-Store Error</span>}
                        {b.status === 'invalid_multi_month' && <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium bg-red-100 text-red-800">Multi-Month Error</span>}
                        {b.status === 'duplicate_suspected' && <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium bg-yellow-100 text-yellow-800">Duplicate</span>}
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
              <tr className="hover:bg-surface-bg transition-colors">
                <td className="px-6 py-4 text-[13px] font-mono text-text-main whitespace-nowrap">DATE</td>
                <td className="px-6 py-4 text-[13px] text-text-muted">Transaction date</td>
              </tr>
              <tr className="hover:bg-surface-bg transition-colors">
                <td className="px-6 py-4 text-[13px] font-mono text-text-main whitespace-nowrap">TRANSACTION NUMBER</td>
                <td className="px-6 py-4 text-[13px] text-text-muted">Unique identifier for the transaction</td>
              </tr>
              <tr className="hover:bg-surface-bg transition-colors">
                <td className="px-6 py-4 text-[13px] font-mono text-text-main whitespace-nowrap">REGISTER NUMBER</td>
                <td className="px-6 py-4 text-[13px] text-text-muted">Register POS ID</td>
              </tr>
              <tr className="hover:bg-surface-bg transition-colors">
                <td className="px-6 py-4 text-[13px] font-mono text-text-main whitespace-nowrap">STORE CODE</td>
                <td className="px-6 py-4 text-[13px] text-text-muted">Store identifier code</td>
              </tr>
              <tr className="hover:bg-surface-bg transition-colors">
                <td className="px-6 py-4 text-[13px] font-mono text-text-main whitespace-nowrap">STORE CATEGORIZATION</td>
                <td className="px-6 py-4 text-[13px] text-text-muted">Category of the store</td>
              </tr>
              <tr className="hover:bg-surface-bg transition-colors">
                <td className="px-6 py-4 text-[13px] font-mono text-text-main whitespace-nowrap">CUSTOMER NUMBER</td>
                <td className="px-6 py-4 text-[13px] text-text-muted">Loyalty customer ID</td>
              </tr>
              <tr className="hover:bg-surface-bg transition-colors">
                <td className="px-6 py-4 text-[13px] font-mono text-text-main whitespace-nowrap">SKU CODE</td>
                <td className="px-6 py-4 text-[13px] text-text-muted">Product SKU identifier</td>
              </tr>
              <tr className="hover:bg-surface-bg transition-colors">
                <td className="px-6 py-4 text-[13px] font-mono text-text-main whitespace-nowrap">TRANSACTION TYPE</td>
                <td className="px-6 py-4 text-[13px] text-text-muted">Type of transaction</td>
              </tr>
              <tr className="hover:bg-surface-bg transition-colors">
                <td className="px-6 py-4 text-[13px] font-mono text-text-main whitespace-nowrap">LOYALTY SALES</td>
                <td className="px-6 py-4 text-[13px] text-text-muted">Amount of loyalty sales</td>
              </tr>
              <tr className="hover:bg-surface-bg transition-colors">
                <td className="px-6 py-4 text-[13px] font-mono text-text-main whitespace-nowrap">QTY SOLD</td>
                <td className="px-6 py-4 text-[13px] text-text-muted">Quantity of product sold</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}
    </div>
  );
}
