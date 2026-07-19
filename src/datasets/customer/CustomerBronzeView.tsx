import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import CustomerDataView from './CustomerDataView';
import {
  CustomerBatch,
  getCustomerBatchStatus,
  ingestCustomerBatch,
  listCustomerBatches,
} from './customerService';
import { EXPECTED_CUSTOMER_COLUMNS } from './customerSchema';

type ToastType = 'success' | 'error' | 'info' | 'warning';

const DESCRIPTIONS: Record<string, string> = {
  'CUSTOMER NUMBER': 'Unique loyalty customer identifier', GENDER: 'Recorded customer gender', BIRTHDAY: 'Birth date in YYYYMMDD format', AGE: 'Customer age in years', CITY: 'Registered city', PROVINCE: 'Registered province', 'EXPIRY DATE': 'Membership expiration date', 'MEMBER LOCATION': 'Membership registration branch', 'APPLICATION DATE': 'Membership application date', 'MEMBER SINCE': 'Membership activation date', 'LAST VISIT': 'Most recent recorded visit', 'FREQUENCY OF VISIT': 'Recorded visit frequency', 'LAST VISITED STORE': 'Most recently visited store code',
};

export default function CustomerBronzeView({ refreshTrigger }: { refreshTrigger: number }) {
  const [batches, setBatches] = useState<CustomerBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'batches' | 'data'>('batches');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = (message: string, type: ToastType) => setToast({ message, type });

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const loadBatches = async () => {
    setLoading(true);
    try {
      setBatches(await listCustomerBatches());
    } catch (error: any) {
      showToast(error.message || 'Failed to load Customer batches', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadBatches(); }, [refreshTrigger]);

  const handleIngest = async (batchId: string) => {
    setIngesting(previous => ({ ...previous, [batchId]: true }));
    try {
      const result = await ingestCustomerBatch(batchId);
      showToast(result.status === 'already_ingested' ? 'Batch was already ingested.' : `Ingested ${result.rows_ingested.toLocaleString()} Customer rows.`, result.status === 'already_ingested' ? 'info' : 'success');
      const status = await getCustomerBatchStatus(batchId);
      setBatches(previous => previous.map(batch => batch.id === batchId ? { ...batch, status: status.status, row_count: status.row_count } : batch));
    } catch (error: any) {
      showToast(error.message || 'Customer ingestion failed', 'error');
      await loadBatches();
    } finally {
      setIngesting(previous => ({ ...previous, [batchId]: false }));
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${parseFloat((bytes / Math.pow(1024, index)).toFixed(2))} ${units[index]}`;
  };

  const toastColors = toast?.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' : toast?.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' : toast?.type === 'warning' ? 'bg-yellow-50 text-yellow-800 border-yellow-200' : 'bg-blue-50 text-blue-800 border-blue-200';
  const totalRows = batches.reduce((sum, batch) => sum + (batch.row_count || 0), 0);
  const totalSize = batches.reduce((sum, batch) => sum + (batch.file_size_bytes || 0), 0);

  return <div className="space-y-6 relative">
    {toast && <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-[8px] border shadow-lg z-50 ${toastColors}`}><p className="text-[14px] font-medium">{toast.message}</p></div>}
    {viewMode === 'data' ? <CustomerDataView onBack={() => setViewMode('batches')} showToast={showToast} /> : <>
      <div className="flex justify-between items-center mb-[-8px]"><h2 className="text-[18px] font-semibold text-text-main">Bronze Customer Data</h2><button onClick={() => setViewMode('data')} className="h-9 px-4 rounded-[6px] text-[13px] font-medium bg-[#0054A6] text-white hover:bg-[#004385]">View Data</button></div>
      <div className="grid grid-cols-3 gap-6">{[['Total Batches', batches.length], ['Total Rows', totalRows.toLocaleString()], ['Storage Size', formatSize(totalSize)]].map(([label, value]) => <div key={label} className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-6"><h3 className="text-[13px] font-semibold text-text-muted uppercase tracking-wider mb-2">{label}</h3><p className="text-[28px] font-bold text-text-main">{loading ? '-' : value}</p></div>)}</div>
      <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle overflow-hidden">
        <div className="px-6 py-5 border-b border-border-subtle">
          <h3 className="text-[16px] font-semibold text-text-main">Recent batches</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-bg">
                {['File Name', 'Rows', 'Size', 'Status', 'Date', 'Action'].map(label => <th key={label} className={`px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider ${label === 'Action' ? 'text-right' : ''}`}>{label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {loading ? <tr><td colSpan={6} className="px-6 py-12 text-center text-[13px] text-text-muted">Loading batches...</td></tr> : !batches.length ? <tr><td colSpan={6} className="px-6 py-12 text-center text-[13px] text-text-muted">No batches uploaded yet.</td></tr> : batches.map(batch => <tr key={batch.id} className="hover:bg-surface-bg transition-colors"><td className="px-6 py-4 text-[13px] font-medium">{batch.file_name}</td><td className="px-6 py-4 text-[13px]">{batch.row_count?.toLocaleString() ?? '—'}</td><td className="px-6 py-4 text-[13px] text-text-muted">{formatSize(batch.file_size_bytes)}</td><td className="px-6 py-4"><StatusBadge status={batch.status} /></td><td className="px-6 py-4 text-[13px] text-text-muted whitespace-nowrap">{new Date(batch.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</td><td className="px-6 py-4 text-right">{['uploaded', 'validation_failed', 'ingestion_failed'].includes(batch.status) && <button onClick={() => void handleIngest(batch.id)} disabled={ingesting[batch.id]} className={`inline-flex items-center h-8 px-3 rounded-[6px] text-[13px] font-medium disabled:opacity-50 ${batch.status === 'uploaded' ? 'bg-[#0054A6] text-white' : 'border border-border-subtle bg-white'}`}>{ingesting[batch.id] && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}{ingesting[batch.id] ? 'Ingesting...' : batch.status === 'uploaded' ? 'Ingest' : 'Retry'}</button>}</td></tr>)}
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
              {EXPECTED_CUSTOMER_COLUMNS.map(column => <tr key={column} className="hover:bg-surface-bg transition-colors"><td className="px-6 py-4 text-[13px] font-mono text-text-main whitespace-nowrap">{column}</td><td className="px-6 py-4 text-[13px] text-text-muted">{DESCRIPTIONS[column]}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </>}
  </div>;
}

function StatusBadge({ status }: { status: string }) {
  const color = status === 'ingested' ? 'bg-green-100 text-green-800' : status === 'processing' ? 'bg-blue-100 text-blue-800' : status.includes('failed') ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800';
  return <span className={`inline-flex px-2 py-1 rounded-full text-[11px] font-medium ${color}`}>{status.replaceAll('_', ' ')}</span>;
}
