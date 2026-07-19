import { useEffect, useState } from 'react';
import { Download, Loader2, Search, X } from 'lucide-react';

import {
  CustomerFilters,
  exportCustomerRows,
  getCustomerRows,
  getCustomerStats,
} from './customerService';

interface Props {
  onBack: () => void;
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const DISPLAY_COLUMNS = [
  'CUSTOMER NUMBER',
  'GENDER',
  'BIRTHDAY',
  'AGE',
  'CITY',
  'PROVINCE',
  'MEMBER LOCATION',
  'MEMBER SINCE',
  'LAST VISIT',
  'FREQUENCY OF VISIT',
  'LAST VISITED STORE',
];

export default function CustomerDataView({ onBack, showToast }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<{ total_rows: number; last_updated: string | null } | null>(null);
  const [customerNumber, setCustomerNumber] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [memberLocation, setMemberLocation] = useState('');
  const [lastVisitedStore, setLastVisitedStore] = useState('');
  const [lastVisitFrom, setLastVisitFrom] = useState('');
  const [lastVisitTo, setLastVisitTo] = useState('');
  const pageSize = 20;

  const filters = (targetPage = page): CustomerFilters => ({
    customer_number: customerNumber,
    city,
    province,
    member_location: memberLocation,
    last_visited_store: lastVisitedStore,
    last_visit_from: lastVisitFrom,
    last_visit_to: lastVisitTo,
    page: targetPage,
    page_size: pageSize,
  });

  const loadRows = async (targetPage: number, override?: CustomerFilters) => {
    setLoading(true);
    try {
      const result = await getCustomerRows(override || filters(targetPage));
      setRows(result.rows);
      setTotal(result.total_matching_rows);
      setPage(targetPage);
    } catch (error: any) {
      showToast(error.message || 'Failed to fetch Customer rows', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows(1);
    getCustomerStats().then(setStats).catch(error => {
      showToast(error.message || 'Failed to fetch Customer statistics', 'error');
    });
  }, []);

  const clearFilters = () => {
    setCustomerNumber('');
    setCity('');
    setProvince('');
    setMemberLocation('');
    setLastVisitedStore('');
    setLastVisitFrom('');
    setLastVisitTo('');
    void loadRows(1, { page: 1, page_size: pageSize });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportCustomerRows(filters(1));
      showToast('Customer CSV export downloaded.', 'success');
    } catch (error: any) {
      showToast(error.message || 'Customer export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div><button onClick={onBack} className="text-[13px] text-text-muted hover:text-text-main mb-2">← Back to Overview</button><h2 className="text-[20px] font-semibold text-text-main">Customer Bronze Data Explorer</h2>{stats && <p className="text-[12px] text-text-muted mt-1">{stats.total_rows.toLocaleString()} total rows{stats.last_updated ? ` · last updated ${new Date(stats.last_updated).toLocaleString()}` : ''}</p>}</div>
      <button onClick={handleExport} disabled={exporting || loading} className="inline-flex items-center h-9 px-4 rounded-[6px] text-[13px] font-medium border border-border-subtle bg-white hover:bg-surface-bg disabled:opacity-50">{exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}Download CSV</button>
    </div>

    <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <FilterInput label="Customer Number" value={customerNumber} onChange={setCustomerNumber} />
        <FilterInput label="City" value={city} onChange={setCity} />
        <FilterInput label="Province" value={province} onChange={setProvince} />
        <FilterInput label="Member Location" value={memberLocation} onChange={setMemberLocation} />
        <FilterInput label="Last Visited Store" value={lastVisitedStore} onChange={setLastVisitedStore} />
        <FilterInput label="Last Visit From" value={lastVisitFrom} onChange={setLastVisitFrom} type="date" />
        <FilterInput label="Last Visit To" value={lastVisitTo} onChange={setLastVisitTo} type="date" />
        <div className="flex gap-2 items-end"><button onClick={() => void loadRows(1)} className="flex-1 h-9 rounded-[6px] text-[13px] font-medium bg-[#0054A6] text-white hover:bg-[#004385] flex items-center justify-center"><Search className="w-4 h-4 mr-2" />Apply</button><button onClick={clearFilters} title="Clear filters" className="w-9 h-9 border border-border-subtle rounded-[6px] flex items-center justify-center hover:bg-surface-bg"><X className="w-4 h-4" /></button></div>
      </div>
    </div>

    <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle overflow-hidden">
      <div className="overflow-x-auto"><table className="w-full text-left border-collapse"><thead><tr className="border-b border-border-subtle bg-surface-bg">{DISPLAY_COLUMNS.map(column => <th key={column} className="px-4 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">{column}</th>)}</tr></thead><tbody className="divide-y divide-border-subtle">{loading ? <tr><td colSpan={DISPLAY_COLUMNS.length} className="px-6 py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-text-muted mx-auto" /><p className="text-[13px] text-text-muted mt-2">Loading data...</p></td></tr> : rows.length === 0 ? <tr><td colSpan={DISPLAY_COLUMNS.length} className="px-6 py-12 text-center text-[13px] text-text-muted">No rows match these filters.</td></tr> : rows.map((row, index) => <tr key={row.id || index} className="hover:bg-surface-bg">{DISPLAY_COLUMNS.map(column => <td key={column} className="px-4 py-3 text-[12px] text-text-main whitespace-nowrap">{row[column] ?? '—'}</td>)}</tr>)}</tbody></table></div>
      <div className="px-6 py-4 border-t border-border-subtle flex items-center justify-between bg-surface-bg/50"><p className="text-[13px] text-text-muted">{total ? `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total.toLocaleString()} rows` : '0 rows'}</p><div className="flex items-center gap-2"><button disabled={page <= 1 || loading} onClick={() => void loadRows(page - 1)} className="h-8 px-3 rounded-[6px] text-[13px] border bg-white disabled:opacity-50">Previous</button><span className="text-[13px] text-text-muted">Page {page} of {totalPages}</span><button disabled={page >= totalPages || loading} onClick={() => void loadRows(page + 1)} className="h-8 px-3 rounded-[6px] text-[13px] border bg-white disabled:opacity-50">Next</button></div></div>
    </div>
  </div>;
}

function FilterInput({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="text-[12px] font-medium text-text-muted">{label}<input type={type} value={value} onChange={event => onChange(event.target.value)} className="mt-1 w-full h-9 px-3 rounded-[6px] border border-border-subtle text-[13px] focus:outline-none focus:border-[#0054A6]" /></label>;
}
