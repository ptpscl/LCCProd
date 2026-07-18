import { useState, useEffect } from 'react';
import { Loader2, Download, Search, X } from 'lucide-react';
import { getBronzeStats, getBronzeRows, exportBronzeRows } from './loyaltyService';

function toYYMMDD(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

export default function LoyaltyDataView({ onBack, showToast }: { onBack: () => void, showToast: (msg: string, type: 'success'|'error'|'info'|'warning') => void }) {
  const [stats, setStats] = useState<{total_rows: number, last_updated: string | null} | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalMatching, setTotalMatching] = useState(0);
  
  const [storeCode, setStoreCode] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [skuCode, setSkuCode] = useState('');
  
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    getBronzeStats().then(setStats).catch(console.error);
  }, []);

  const fetchRows = async (currentPage: number, filters?: { storeCode: string, dateFrom: string, dateTo: string, skuCode: string }) => {
    setLoading(true);
    try {
      const activeFilters = filters || { storeCode, dateFrom, dateTo, skuCode };
      const data = await getBronzeRows({
        store_code: activeFilters.storeCode || undefined,
        date_from: toYYMMDD(activeFilters.dateFrom) || undefined,
        date_to: toYYMMDD(activeFilters.dateTo) || undefined,
        sku_code: activeFilters.skuCode || undefined,
        page: currentPage,
        page_size: pageSize
      });
      setRows(data.rows);
      setTotalMatching(data.total_matching_rows);
      setPage(data.page);
    } catch (e: any) {
      showToast(e.message || 'Failed to fetch rows', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows(1);
  }, []);

  const handleApplyFilters = () => {
    setPage(1);
    fetchRows(1);
  };

  const applyClear = () => {
    setStoreCode('');
    setDateFrom('');
    setDateTo('');
    setSkuCode('');
    setPage(1);
    fetchRows(1, { storeCode: '', dateFrom: '', dateTo: '', skuCode: '' });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportBronzeRows({
        store_code: storeCode || undefined,
        date_from: toYYMMDD(dateFrom) || undefined,
        date_to: toYYMMDD(dateTo) || undefined,
        sku_code: skuCode || undefined
      });
      showToast('Export initiated', 'success');
    } catch (e: any) {
      showToast(e.message || 'Export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.ceil(totalMatching / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
         <div>
            <button onClick={onBack} className="text-[13px] font-medium text-text-muted hover:text-[#0054A6] mb-2 flex items-center transition-colors">
              ← Back to Overview
            </button>
            <h2 className="text-[20px] font-semibold text-text-main">Bronze Data Explorer</h2>
            {stats && (
              <p className="text-[13px] text-text-muted mt-1">
                {stats.total_rows.toLocaleString()} total rows 
                {stats.last_updated && ` · last updated ${new Date(stats.last_updated).toLocaleString()}`}
              </p>
            )}
         </div>
         <button 
           onClick={handleExport}
           disabled={exporting || loading}
           className="inline-flex items-center justify-center h-9 px-4 rounded-[6px] text-[13px] font-medium border border-border-subtle bg-white text-text-main hover:bg-surface-bg disabled:opacity-50 transition-colors"
         >
           {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
           Download CSV
         </button>
      </div>

      <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-4">
         <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-[12px] font-medium text-text-muted mb-1">Store Code</label>
              <input 
                type="text" 
                value={storeCode} 
                onChange={e => setStoreCode(e.target.value)} 
                placeholder="e.g. 101"
                className="w-full h-9 px-3 rounded-[6px] border border-border-subtle text-[13px] focus:outline-none focus:border-[#0054A6]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-text-muted mb-1">Date From</label>
              <input 
                type="date" 
                value={dateFrom} 
                onChange={e => setDateFrom(e.target.value)} 
                className="w-full h-9 px-3 rounded-[6px] border border-border-subtle text-[13px] focus:outline-none focus:border-[#0054A6]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-text-muted mb-1">Date To</label>
              <input 
                type="date" 
                value={dateTo} 
                onChange={e => setDateTo(e.target.value)} 
                className="w-full h-9 px-3 rounded-[6px] border border-border-subtle text-[13px] focus:outline-none focus:border-[#0054A6]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-text-muted mb-1">SKU Code</label>
              <input 
                type="text" 
                value={skuCode} 
                onChange={e => setSkuCode(e.target.value)} 
                placeholder="e.g. 12345"
                className="w-full h-9 px-3 rounded-[6px] border border-border-subtle text-[13px] focus:outline-none focus:border-[#0054A6]"
              />
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleApplyFilters}
                className="flex-1 h-9 rounded-[6px] text-[13px] font-medium bg-[#0054A6] text-white hover:bg-[#004385] transition-colors flex items-center justify-center"
              >
                <Search className="w-4 h-4 mr-2" /> Apply
              </button>
              <button 
                onClick={applyClear}
                title="Clear Filters"
                className="w-9 h-9 flex-shrink-0 rounded-[6px] border border-border-subtle text-text-muted hover:text-text-main hover:bg-surface-bg flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
         </div>
      </div>

      <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle overflow-hidden flex flex-col">
         <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-bg">
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Transaction #</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Store Code</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">SKU Code</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Transaction Type</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Loyalty Sales</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Qty Sold</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-text-muted mx-auto" />
                    <p className="text-[13px] text-text-muted mt-2">Loading data...</p>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[13px] text-text-muted">
                    No rows match these filters.
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => (
                  <tr key={r.id || idx} className="hover:bg-surface-bg transition-colors">
                    <td className="px-6 py-3 text-[13px] text-text-main whitespace-nowrap">{r.DATE}</td>
                    <td className="px-6 py-3 text-[13px] text-text-main whitespace-nowrap">{r.TRANSACTION_NUMBER}</td>
                    <td className="px-6 py-3 text-[13px] text-text-main whitespace-nowrap">{r.STORE_CODE}</td>
                    <td className="px-6 py-3 text-[13px] text-text-main whitespace-nowrap">{r.SKU_CODE}</td>
                    <td className="px-6 py-3 text-[13px] text-text-main whitespace-nowrap">{r.TRANSACTION_TYPE}</td>
                    <td className="px-6 py-3 text-[13px] text-text-main whitespace-nowrap">{r.LOYALTY_SALES}</td>
                    <td className="px-6 py-3 text-[13px] text-text-main whitespace-nowrap">{r.QTY_SOLD}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
         </div>
         
         {/* Pagination */}
         <div className="px-6 py-4 border-t border-border-subtle flex items-center justify-between bg-surface-bg/50">
            <div className="text-[13px] text-text-muted">
              {totalMatching > 0 ? (
                <>Showing <span className="font-medium text-text-main">{(page - 1) * pageSize + 1}</span> to <span className="font-medium text-text-main">{Math.min(page * pageSize, totalMatching)}</span> of <span className="font-medium text-text-main">{totalMatching.toLocaleString()}</span> rows</>
              ) : (
                '0 rows'
              )}
            </div>
            <div className="flex items-center gap-2">
               <button 
                 disabled={page <= 1 || loading}
                 onClick={() => {
                   fetchRows(page - 1);
                 }}
                 className="h-8 px-3 rounded-[6px] text-[13px] font-medium border border-border-subtle bg-white text-text-main hover:bg-surface-bg disabled:opacity-50 transition-colors"
               >
                 Previous
               </button>
               <div className="text-[13px] text-text-muted px-2">
                 Page {page} of {Math.max(1, totalPages)}
               </div>
               <button 
                 disabled={page >= totalPages || loading}
                 onClick={() => {
                   fetchRows(page + 1);
                 }}
                 className="h-8 px-3 rounded-[6px] text-[13px] font-medium border border-border-subtle bg-white text-text-main hover:bg-surface-bg disabled:opacity-50 transition-colors"
               >
                 Next
               </button>
            </div>
         </div>
      </div>
    </div>
  );
}
