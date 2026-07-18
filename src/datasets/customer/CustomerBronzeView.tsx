import { useEffect, useState } from 'react';
import { Download, Loader2, Search, X } from 'lucide-react';

import { EXPECTED_CUSTOMER_COLUMNS } from './customerSchema';
import {
  CustomerBatch,
  exportCustomerRows,
  getCustomerBatchStatus,
  getCustomerRows,
  ingestCustomerBatch,
  listCustomerBatches,
} from './customerService';

type Toast = { message: string; type: 'success' | 'error' | 'info' };

const COLUMN_DESCRIPTIONS: Record<string, string> = {
  'CUSTOMER NUMBER': 'Unique loyalty customer identifier',
  GENDER: 'Recorded customer gender',
  BIRTHDAY: 'Birth date in YYYYMMDD format',
  AGE: 'Customer age in years',
  CITY: 'Registered city',
  PROVINCE: 'Registered province',
  'EXPIRY DATE': 'Membership expiration date',
  'MEMBER LOCATION': 'Membership registration branch',
  'APPLICATION DATE': 'Membership application date',
  'MEMBER SINCE': 'Membership activation date',
  'LAST VISIT': 'Most recent recorded visit',
  'FREQUENCY OF VISIT': 'Recorded visit frequency',
  'LAST VISITED STORE': 'Most recently visited store code',
};

export default function CustomerBronzeView({ refreshTrigger }: { refreshTrigger: number }) {
  const [batches, setBatches] = useState<CustomerBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'batches' | 'data'>('batches');
  const [toast, setToast] = useState<Toast | null>(null);

  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [customerNumber, setCustomerNumber] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const pageSize = 20;

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      setBatches(await listCustomerBatches());
    } catch (error: any) {
      setToast({ message: error.message || 'Failed to load batches', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchBatches(); }, [refreshTrigger]);

  const handleIngest = async (batchId: string) => {
    setIngesting(value => ({ ...value, [batchId]: true }));
    try {
      const result = await ingestCustomerBatch(batchId);
      setToast({
        message: result.status === 'already_ingested' ? 'Batch is already ingested.' : `Ingested ${result.rows_ingested.toLocaleString()} customer rows.`,
        type: result.status === 'already_ingested' ? 'info' : 'success',
      });
      const status = await getCustomerBatchStatus(batchId);
      setBatches(value => value.map(batch => batch.id === batchId
        ? { ...batch, status: status.status, row_count: status.row_count }
        : batch));
    } catch (error: any) {
      setToast({ message: error.message || 'Ingestion failed', type: 'error' });
      await fetchBatches();
    } finally {
      setIngesting(value => ({ ...value, [batchId]: false }));
    }
  };

  const loadRows = async (nextPage: number) => {
    setLoading(true);
    try {
      const result = await getCustomerRows({ customer_number: customerNumber, city, province, page: nextPage, page_size: pageSize });
      setRows(result.rows);
      setTotal(result.total_matching_rows);
      setPage(nextPage);
    } catch (error: any) {
      setToast({ message: error.message || 'Failed to load data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (viewMode === 'data') void loadRows(1); }, [viewMode]);

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${parseFloat((bytes / Math.pow(1024, index)).toFixed(2))} ${units[index]}`;
  };

  const toastColor = toast?.type === 'success'
    ? 'bg-green-50 text-green-800 border-green-200'
    : toast?.type === 'error'
      ? 'bg-red-50 text-red-800 border-red-200'
      : 'bg-blue-50 text-blue-800 border-blue-200';

  const dataView = () => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><button className="text-[13px] text-brand-600 mb-2" onClick={() => setViewMode('batches')}>← Back to batches</button><h2 className="text-[18px] font-semibold text-text-main">Bronze Customer Data</h2><p className="text-[13px] text-text-muted mt-1">{total.toLocaleString()} matching rows</p></div>
          <button onClick={() => exportCustomerRows({ customer_number: customerNumber, city, province })} className="inline-flex items-center justify-center h-9 px-4 rounded-[6px] text-[13px] font-medium border border-border-subtle bg-white hover:bg-surface-bg"><Download className="w-4 h-4 mr-2" />Download CSV</button>
        </div>
        <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            {[['Customer Number', customerNumber, setCustomerNumber], ['City', city, setCity], ['Province', province, setProvince]].map(([label, value, setter]) => <label key={label as string} className="text-[12px] font-medium text-text-muted">{label as string}<input value={value as string} onChange={event => (setter as (value: string) => void)(event.target.value)} className="mt-1 w-full h-9 px-3 rounded-[6px] border border-border-subtle text-[13px]" /></label>)}
            <div className="flex gap-2"><button onClick={() => loadRows(1)} className="flex-1 h-9 rounded-[6px] text-[13px] font-medium bg-[#0054A6] text-white flex items-center justify-center"><Search className="w-4 h-4 mr-2" />Apply</button><button onClick={() => { setCustomerNumber(''); setCity(''); setProvince(''); }} className="w-9 h-9 border border-border-subtle rounded-[6px] flex items-center justify-center"><X className="w-4 h-4" /></button></div>
          </div>
        </div>
        <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full text-left border-collapse"><thead><tr className="border-b border-border-subtle bg-surface-bg">{['Customer Number', 'Gender', 'Birthday', 'Age', 'City', 'Province', 'Member Location', 'Last Visit', 'Frequency', 'Last Store'].map(label => <th key={label} className="px-4 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">{label}</th>)}</tr></thead><tbody className="divide-y divide-border-subtle">{loading ? <tr><td colSpan={10} className="px-6 py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-text-muted mx-auto" /></td></tr> : rows.length === 0 ? <tr><td colSpan={10} className="px-6 py-12 text-center text-[13px] text-text-muted">No rows match these filters.</td></tr> : rows.map((row, index) => <tr key={row.id || index} className="hover:bg-surface-bg">{['CUSTOMER_NUMBER', 'GENDER', 'BIRTHDAY', 'AGE', 'CITY', 'PROVINCE', 'MEMBER_LOCATION', 'LAST_VISIT', 'FREQUENCY_OF_VISIT', 'LAST_VISITED_STORE'].map(column => <td key={column} className="px-4 py-3 text-[12px] whitespace-nowrap">{row[column] ?? '—'}</td>)}</tr>)}</tbody></table></div>
          <div className="px-6 py-4 border-t border-border-subtle flex justify-between text-[13px] text-text-muted"><span>{total ? `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total.toLocaleString()}` : '0 rows'}</span><div className="flex items-center gap-2"><button disabled={page <= 1 || loading} onClick={() => loadRows(page - 1)} className="h-8 px-3 border rounded-[6px] disabled:opacity-50">Previous</button><span>Page {page} of {totalPages}</span><button disabled={page >= totalPages || loading} onClick={() => loadRows(page + 1)} className="h-8 px-3 border rounded-[6px] disabled:opacity-50">Next</button></div></div>
        </div>
      </div>
    );
  };

  const totalRows = batches.reduce((sum, batch) => sum + (batch.row_count || 0), 0);
  const totalSize = batches.reduce((sum, batch) => sum + (batch.file_size_bytes || 0), 0);

  return (
    <div className="space-y-6 relative">
      {toast && <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-[8px] border shadow-lg z-50 ${toastColor}`}><p className="text-[14px] font-medium">{toast.message}</p></div>}
      {viewMode === 'data' ? dataView() : <>
        <div className="flex justify-between items-center mb-[-8px]"><h2 className="text-[18px] font-semibold text-text-main">Bronze Customer Data</h2><button onClick={() => setViewMode('data')} className="inline-flex items-center justify-center h-9 px-4 rounded-[6px] text-[13px] font-medium bg-[#0054A6] text-white hover:bg-[#004385]">View Data</button></div>
        <div className="grid grid-cols-3 gap-6">{[['Total Batches', batches.length], ['Total Rows', totalRows.toLocaleString()], ['Storage Size', formatSize(totalSize)]].map(([label, value]) => <div key={label} className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-6"><h3 className="text-[13px] font-semibold text-text-muted uppercase tracking-wider mb-2">{label}</h3><p className="text-[28px] font-bold text-text-main">{loading ? '-' : value}</p></div>)}</div>
        <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle overflow-hidden"><div className="px-6 py-5 border-b border-border-subtle"><h3 className="text-[16px] font-semibold text-text-main">Recent batches</h3></div><div className="overflow-x-auto"><table className="w-full text-left border-collapse"><thead><tr className="border-b border-border-subtle bg-surface-bg">{['File Name', 'Rows', 'Size', 'Status', 'Date', 'Action'].map(label => <th key={label} className={`px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider ${label === 'Action' ? 'text-right' : ''}`}>{label}</th>)}</tr></thead><tbody className="divide-y divide-border-subtle">{loading ? <tr><td colSpan={6} className="px-6 py-12 text-center text-[13px] text-text-muted">Loading batches...</td></tr> : !batches.length ? <tr><td colSpan={6} className="px-6 py-12 text-center text-[13px] text-text-muted">No batches uploaded yet.</td></tr> : batches.map(batch => <tr key={batch.id} className="hover:bg-surface-bg"><td className="px-6 py-4 text-[13px] font-medium">{batch.file_name}</td><td className="px-6 py-4 text-[13px]">{batch.row_count?.toLocaleString() ?? '—'}</td><td className="px-6 py-4 text-[13px] text-text-muted">{formatSize(batch.file_size_bytes)}</td><td className="px-6 py-4 text-[13px]"><span className={`inline-flex px-2 py-1 rounded-full text-[11px] font-medium ${batch.status === 'ingested' ? 'bg-green-100 text-green-800' : batch.status.includes('failed') ? 'bg-red-100 text-red-800' : batch.status === 'processing' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>{batch.status.replace('_', ' ')}</span></td><td className="px-6 py-4 text-[13px] text-text-muted whitespace-nowrap">{new Date(batch.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</td><td className="px-6 py-4 text-right">{['uploaded', 'ingestion_failed', 'validation_failed'].includes(batch.status) && <button onClick={() => handleIngest(batch.id)} disabled={ingesting[batch.id]} className={`inline-flex items-center justify-center h-8 px-3 rounded-[6px] text-[13px] font-medium disabled:opacity-50 ${batch.status === 'uploaded' ? 'bg-[#0054A6] text-white' : 'border border-border-subtle bg-white'}`}>{ingesting[batch.id] && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}{ingesting[batch.id] ? 'Ingesting...' : batch.status === 'uploaded' ? 'Ingest' : 'Retry'}</button>}</td></tr>)}</tbody></table></div></div>
        <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle overflow-hidden"><div className="px-6 py-5 border-b border-border-subtle"><h3 className="text-[16px] font-semibold text-text-main">Schema</h3></div><table className="w-full text-left"><thead><tr className="bg-surface-bg border-b border-border-subtle"><th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase">Column</th><th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase">Description</th></tr></thead><tbody className="divide-y divide-border-subtle">{EXPECTED_CUSTOMER_COLUMNS.map(column => <tr key={column} className="hover:bg-surface-bg"><td className="px-6 py-4 text-[13px] font-mono">{column}</td><td className="px-6 py-4 text-[13px] text-text-muted">{COLUMN_DESCRIPTIONS[column]}</td></tr>)}</tbody></table></div>
      </>}
    </div>
  );
}
