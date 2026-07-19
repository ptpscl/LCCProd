import { useState, useEffect } from 'react';
import { Loader2, Download, Search, X } from 'lucide-react';
import { getBronzeStats, getBronzeRows, exportBronzeRows } from './skuService';

export default function SkuDataView({ onBack, showToast }: { onBack: () => void, showToast: (msg: string, type: 'success'|'error'|'info'|'warning') => void }) {
  const [stats, setStats] = useState<{total_rows: number, last_updated: string | null} | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalMatching, setTotalMatching] = useState(0);

  const [skuCode, setSkuCode] = useState('');
  const [division, setDivision] = useState('');
  const [department, setDepartment] = useState('');
  const [brand, setBrand] = useState('');

  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    getBronzeStats().then(setStats).catch(console.error);
  }, []);

  const fetchRows = async (currentPage: number, filters?: { skuCode: string, division: string, department: string, brand: string }) => {
    setLoading(true);
    try {
      const activeFilters = filters || { skuCode, division, department, brand };
      const data = await getBronzeRows({
        sku_code: activeFilters.skuCode || undefined,
        division: activeFilters.division || undefined,
        department: activeFilters.department || undefined,
        brand: activeFilters.brand || undefined,
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
    setSkuCode('');
    setDivision('');
    setDepartment('');
    setBrand('');
    setPage(1);
    fetchRows(1, { skuCode: '', division: '', department: '', brand: '' });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportBronzeRows({
        sku_code: skuCode || undefined,
        division: division || undefined,
        department: department || undefined,
        brand: brand || undefined
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
              <label className="block text-[12px] font-medium text-text-muted mb-1">SKU Code</label>
              <input
                type="text"
                value={skuCode}
                onChange={e => setSkuCode(e.target.value)}
                placeholder="e.g. 12345"
                className="w-full h-9 px-3 rounded-[6px] border border-border-subtle text-[13px] focus:outline-none focus:border-[#0054A6]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-text-muted mb-1">Division</label>
              <input
                type="text"
                value={division}
                onChange={e => setDivision(e.target.value)}
                placeholder="e.g. grocery food"
                className="w-full h-9 px-3 rounded-[6px] border border-border-subtle text-[13px] focus:outline-none focus:border-[#0054A6]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-text-muted mb-1">Department</label>
              <input
                type="text"
                value={department}
                onChange={e => setDepartment(e.target.value)}
                placeholder="e.g. beverages"
                className="w-full h-9 px-3 rounded-[6px] border border-border-subtle text-[13px] focus:outline-none focus:border-[#0054A6]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-text-muted mb-1">Brand</label>
              <input
                type="text"
                value={brand}
                onChange={e => setBrand(e.target.value)}
                placeholder="e.g. NESCAFE"
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
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">SKU Code</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Division</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Department</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Class</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Brand</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Unit Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-text-muted mx-auto" />
                    <p className="text-[13px] text-text-muted mt-2">Loading data...</p>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-[13px] text-text-muted">
                    No rows match these filters.
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => (
                  <tr key={r.id || idx} className="hover:bg-surface-bg transition-colors">
                    <td className="px-6 py-3 text-[13px] text-text-main whitespace-nowrap">{r.SKU_CODE}</td>
                    <td className="px-6 py-3 text-[13px] text-text-main max-w-[280px] truncate" title={r.SKU_DESCRIPTION}>{r.SKU_DESCRIPTION}</td>
                    <td className="px-6 py-3 text-[13px] text-text-main whitespace-nowrap">{r.DIVISION}</td>
                    <td className="px-6 py-3 text-[13px] text-text-main whitespace-nowrap">{r.DEPARTMENT}</td>
                    <td className="px-6 py-3 text-[13px] text-text-main whitespace-nowrap">{r.CATEGORY}</td>
                    <td className="px-6 py-3 text-[13px] text-text-main whitespace-nowrap">{r.CLASS}</td>
                    <td className="px-6 py-3 text-[13px] text-text-main whitespace-nowrap">{r.BRAND}</td>
                    <td className="px-6 py-3 text-[13px] text-text-main whitespace-nowrap">{r.UNIT_COST}</td>
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
