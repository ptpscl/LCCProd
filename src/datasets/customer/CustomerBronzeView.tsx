import { useEffect, useState } from 'react';
import { Download, Loader2, Search, X } from 'lucide-react';

import {
  CustomerBatch,
  exportCustomerRows,
  getCustomerRows,
  listCustomerBatches,
} from './customerService';

export default function CustomerBronzeView({ refreshTrigger }: { refreshTrigger: number }) {
  const [batches, setBatches] = useState<CustomerBatch[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'batches' | 'data'>('batches');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [customerNumber, setCustomerNumber] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const pageSize = 20;

  useEffect(() => {
    setLoading(true);
    listCustomerBatches().then(setBatches).finally(() => setLoading(false));
  }, [refreshTrigger]);

  const loadRows = async (nextPage = page) => {
    setLoading(true);
    try {
      const result = await getCustomerRows({ customer_number: customerNumber, city, province, page: nextPage, page_size: pageSize });
      setRows(result.rows);
      setTotal(result.total_matching_rows);
      setPage(nextPage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (mode === 'data') void loadRows(1); }, [mode]);

  const formatSize = (bytes: number) => bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1024 / 1024).toFixed(2)} MB`;

  if (mode === 'data') {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div><button className="text-[13px] text-brand-600 mb-2" onClick={() => setMode('batches')}>← Back to batches</button><h2 className="text-[18px] font-semibold">Bronze Customer Data</h2></div>
          <button onClick={() => exportCustomerRows({ customer_number: customerNumber, city, province })} className="h-9 px-4 flex items-center border rounded-[6px] text-[13px]"><Download className="w-4 h-4 mr-2" />Download CSV</button>
        </div>
        <div className="bg-white border border-border-subtle rounded-[10px] p-4 grid grid-cols-4 gap-3 items-end">
          <label className="text-[12px] text-text-muted">Customer Number<input value={customerNumber} onChange={e => setCustomerNumber(e.target.value)} className="mt-1 w-full h-9 px-3 border rounded-[6px] text-[13px]" /></label>
          <label className="text-[12px] text-text-muted">City<input value={city} onChange={e => setCity(e.target.value)} className="mt-1 w-full h-9 px-3 border rounded-[6px] text-[13px]" /></label>
          <label className="text-[12px] text-text-muted">Province<input value={province} onChange={e => setProvince(e.target.value)} className="mt-1 w-full h-9 px-3 border rounded-[6px] text-[13px]" /></label>
          <div className="flex gap-2"><button onClick={() => loadRows(1)} className="h-9 flex-1 bg-brand-600 text-white rounded-[6px] text-[13px] flex items-center justify-center"><Search className="w-4 h-4 mr-2" />Apply</button><button onClick={() => { setCustomerNumber(''); setCity(''); setProvince(''); }} className="h-9 w-9 border rounded-[6px] flex items-center justify-center"><X className="w-4 h-4" /></button></div>
        </div>
        <div className="bg-white border border-border-subtle rounded-[10px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead><tr className="bg-surface-bg border-b border-border-subtle">{['Customer Number', 'Gender', 'Birthday', 'Age', 'City', 'Province', 'Member Location', 'Last Visit', 'Frequency', 'Last Store'].map(label => <th key={label} className="px-4 py-3 text-[11px] uppercase text-text-muted whitespace-nowrap">{label}</th>)}</tr></thead>
              <tbody className="divide-y divide-border-subtle">
                {loading ? <tr><td colSpan={10} className="p-10 text-center"><Loader2 className="w-5 h-5 mx-auto animate-spin" /></td></tr> : rows.length === 0 ? <tr><td colSpan={10} className="p-10 text-center text-[13px] text-text-muted">No customers found.</td></tr> : rows.map((row, index) => (
                  <tr key={row.id || index}>{['CUSTOMER_NUMBER', 'GENDER', 'BIRTHDAY', 'AGE', 'CITY', 'PROVINCE', 'MEMBER_LOCATION', 'LAST_VISIT', 'FREQUENCY_OF_VISIT', 'LAST_VISITED_STORE'].map(column => <td key={column} className="px-4 py-3 text-[12px] whitespace-nowrap">{row[column] ?? '—'}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t flex justify-between text-[13px] text-text-muted"><span>{total.toLocaleString()} customers</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => loadRows(page - 1)} className="px-3 h-8 border rounded disabled:opacity-50">Previous</button><span className="py-1.5">Page {page} of {totalPages}</span><button disabled={page >= totalPages} onClick={() => loadRows(page + 1)} className="px-3 h-8 border rounded disabled:opacity-50">Next</button></div></div>
        </div>
      </div>
    );
  }

  const totalRows = batches.reduce((sum, batch) => sum + (batch.row_count || 0), 0);
  const totalBytes = batches.reduce((sum, batch) => sum + (batch.file_size_bytes || 0), 0);
  return (
    <div className="space-y-6">
      <div className="flex justify-between"><h2 className="text-[18px] font-semibold">Bronze Customer Database</h2><button onClick={() => setMode('data')} className="h-9 px-4 bg-brand-600 text-white rounded-[6px] text-[13px]">View Data</button></div>
      <div className="grid grid-cols-3 gap-6">{[['Total Batches', batches.length], ['Total Rows', totalRows.toLocaleString()], ['Storage Size', formatSize(totalBytes)]].map(([label, value]) => <div key={label} className="bg-white border border-border-subtle rounded-[10px] p-6"><h3 className="text-[12px] uppercase text-text-muted font-semibold">{label}</h3><p className="text-[28px] font-bold mt-2">{loading ? '—' : value}</p></div>)}</div>
      <div className="bg-white border border-border-subtle rounded-[10px] overflow-hidden"><div className="p-5 border-b font-semibold">Recent batches</div><table className="w-full text-left"><thead><tr className="bg-surface-bg">{['File', 'Rows', 'Size', 'Status', 'Uploaded By', 'Date'].map(label => <th key={label} className="px-5 py-3 text-[11px] uppercase text-text-muted">{label}</th>)}</tr></thead><tbody className="divide-y">{batches.map(batch => <tr key={batch.id}><td className="px-5 py-4 text-[13px]">{batch.file_name}</td><td className="px-5 py-4 text-[13px]">{batch.row_count ?? '—'}</td><td className="px-5 py-4 text-[13px]">{formatSize(batch.file_size_bytes)}</td><td className="px-5 py-4 text-[12px]"><span className={`px-2 py-1 rounded-full ${batch.status === 'ingested' ? 'bg-green-100 text-green-800' : batch.status.includes('failed') ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>{batch.status}</span></td><td className="px-5 py-4 text-[13px]">{batch.uploaded_by}</td><td className="px-5 py-4 text-[13px]">{new Date(batch.created_at).toLocaleString()}</td></tr>)}</tbody></table>{!loading && !batches.length && <p className="p-10 text-center text-[13px] text-text-muted">No customer batches uploaded yet.</p>}</div>
    </div>
  );
}
