import { useEffect, useState } from 'react';
import { Loader2, Play, Search, X } from 'lucide-react';

import {
  CustomerSilverRun,
  CustomerSilverStats,
  getCustomerSilverRows,
  getCustomerSilverRun,
  getCustomerSilverStats,
  startCustomerSilverProcessing,
} from './customerService';

const QUALITY_ISSUES = [
  'duplicate_customer_number',
  'invalid_birthday',
  'invalid_age',
  'invalid_expiry_date',
  'invalid_application_date',
  'invalid_member_since',
  'invalid_last_visit',
  'invalid_frequency_of_visit',
];

const EMPTY_STATS: CustomerSilverStats = {
  total_rows: 0,
  clean_rows: 0,
  flagged_rows: 0,
  latest_run: null,
};

export default function CustomerSilverView() {
  const [stats, setStats] = useState<CustomerSilverStats>(EMPTY_STATS);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [customerNumber, setCustomerNumber] = useState('');
  const [customerNumberInput, setCustomerNumberInput] = useState('');
  const [qualityIssue, setQualityIssue] = useState('');
  const [loading, setLoading] = useState(true);
  const [run, setRun] = useState<CustomerSilverRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 20;

  const load = async (targetPage = page) => {
    setLoading(true);
    setError(null);
    try {
      const [nextStats, result] = await Promise.all([
        getCustomerSilverStats(),
        getCustomerSilverRows({
          validation_status: statusFilter as any,
          customer_number: customerNumber,
          quality_issue: qualityIssue,
          page: targetPage,
          page_size: pageSize,
        }),
      ]);
      setStats(nextStats);
      setRun(nextStats.latest_run);
      setRows(result.rows || []);
      setTotal(result.total_matching_rows || 0);
    } catch (caught: any) {
      setError(caught.message || 'Failed to load Customer Silver data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(1); }, [statusFilter, customerNumber, qualityIssue]);

  useEffect(() => {
    if (!run || !['queued', 'processing'].includes(run.status)) return;
    const timer = window.setInterval(async () => {
      try {
        const nextRun = await getCustomerSilverRun(run.id);
        setRun(nextRun);
        if (['completed', 'failed'].includes(nextRun.status)) await load(1);
      } catch (caught: any) {
        setError(caught.message || 'Failed to refresh processing status');
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [run?.id, run?.status]);

  const processSilver = async () => {
    setError(null);
    try {
      setRun(await startCustomerSilverProcessing());
    } catch (caught: any) {
      setError(caught.message || 'Failed to start Customer Silver processing');
    }
  };

  const applyCustomerNumber = () => {
    setPage(1);
    setCustomerNumber(customerNumberInput.trim());
  };

  const clearFilters = () => {
    setPage(1);
    setStatusFilter('');
    setQualityIssue('');
    setCustomerNumber('');
    setCustomerNumberInput('');
  };

  const changePage = (nextPage: number) => {
    setPage(nextPage);
    void load(nextPage);
  };

  const processing = !!run && ['queued', 'processing'].includes(run.status);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return <div className="space-y-6">
    {error && <div className="px-4 py-3 rounded-[8px] border border-red-200 bg-red-50 text-red-800 text-[13px]">{error}</div>}

    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-[18px] font-semibold text-text-main">Silver Customer Data</h2>
        <p className="text-[13px] text-text-muted mt-1">Typed customer records with traceable data-quality flags.</p>
      </div>
      <button onClick={() => void processSilver()} disabled={processing}
        className="inline-flex items-center h-10 px-4 rounded-[7px] bg-[#64748B] hover:bg-[#526173] text-white text-[13px] font-semibold disabled:opacity-60">
        {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
        {processing ? 'Processing Silver...' : stats.total_rows ? 'Refresh from Bronze' : 'Process Bronze to Silver'}
      </button>
    </div>

    <div className="grid grid-cols-3 gap-6">
      {[
        ['Total Silver Rows', stats.total_rows, 'text-text-main'],
        ['Clean Rows', stats.clean_rows, 'text-green-700'],
        ['Flagged Rows', stats.flagged_rows, 'text-amber-700'],
      ].map(([label, value, color]) => <div key={String(label)} className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-6">
        <h3 className="text-[13px] font-semibold text-text-muted uppercase tracking-wider mb-2">{label}</h3>
        <p className={`text-[28px] font-bold ${color}`}>{loading ? '-' : Number(value).toLocaleString()}</p>
      </div>)}
    </div>

    {run && <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle px-6 py-4 flex items-center justify-between">
      <div><p className="text-[13px] font-semibold">Latest processing run</p><p className="text-[12px] text-text-muted mt-1">Started {new Date(run.started_at || run.created_at).toLocaleString()}</p></div>
      <RunBadge status={run.status} />
    </div>}

    <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-5 grid grid-cols-[1fr_1fr_1.4fr_auto] gap-4 items-end">
      <label className="text-[12px] font-semibold text-text-muted">Status
        <select value={statusFilter} onChange={event => { setPage(1); setStatusFilter(event.target.value); }} className="mt-2 w-full h-10 border border-border-subtle rounded-[6px] px-3 bg-white text-[13px] font-normal text-text-main">
          <option value="">All statuses</option><option value="clean">Clean</option><option value="flagged">Flagged</option><option value="resolved">Resolved</option>
        </select>
      </label>
      <label className="text-[12px] font-semibold text-text-muted">Quality issue
        <select value={qualityIssue} onChange={event => { setPage(1); setQualityIssue(event.target.value); }} className="mt-2 w-full h-10 border border-border-subtle rounded-[6px] px-3 bg-white text-[13px] font-normal text-text-main">
          <option value="">All issues</option>{QUALITY_ISSUES.map(issue => <option key={issue} value={issue}>{issue.replaceAll('_', ' ')}</option>)}
        </select>
      </label>
      <label className="text-[12px] font-semibold text-text-muted">Customer number
        <div className="mt-2 flex"><input value={customerNumberInput} onChange={event => setCustomerNumberInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') applyCustomerNumber(); }} placeholder="e.g. 50981396-RPC" className="w-full h-10 border border-border-subtle rounded-l-[6px] px-3 text-[13px] font-normal text-text-main" /><button onClick={applyCustomerNumber} className="h-10 px-4 bg-[#0054A6] text-white rounded-r-[6px]"><Search className="w-4 h-4" /></button></div>
      </label>
      <button onClick={clearFilters} className="h-10 px-4 border border-border-subtle rounded-[6px] text-[13px] inline-flex items-center"><X className="w-4 h-4 mr-2" />Clear</button>
    </div>

    <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle overflow-hidden">
      <div className="overflow-x-auto"><table className="w-full text-left border-collapse min-w-[1050px]">
        <thead><tr className="border-b border-border-subtle bg-surface-bg">{['Customer Number', 'Gender', 'Birthday', 'Age', 'City', 'Province', 'Last Visit', 'Status', 'Quality Issues'].map(label => <th key={label} className="px-4 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-border-subtle">
          {loading ? <tr><td colSpan={9} className="py-12 text-center text-[13px] text-text-muted">Loading Silver rows...</td></tr> : !rows.length ? <tr><td colSpan={9} className="py-12 text-center text-[13px] text-text-muted">No Silver rows match these filters.</td></tr> : rows.map(row => <tr key={row.id} className="hover:bg-surface-bg">
            <td className="px-4 py-3 text-[12px] font-mono">{row['CUSTOMER NUMBER']}</td><td className="px-4 py-3 text-[12px]">{row.GENDER ?? '-'}</td><td className="px-4 py-3 text-[12px]">{row.BIRTHDAY ?? '-'}</td><td className="px-4 py-3 text-[12px]">{row.AGE ?? '-'}</td><td className="px-4 py-3 text-[12px]">{row.CITY ?? '-'}</td><td className="px-4 py-3 text-[12px]">{row.PROVINCE ?? '-'}</td><td className="px-4 py-3 text-[12px]">{row['LAST VISIT'] ?? '-'}</td><td className="px-4 py-3"><StatusBadge status={row.validation_status} /></td><td className="px-4 py-3 text-[11px] text-amber-800 max-w-[260px]">{(row.quality_issues || []).map((issue: string) => issue.replaceAll('_', ' ')).join(', ') || '-'}</td>
          </tr>)}
        </tbody>
      </table></div>
      <div className="px-5 py-4 border-t border-border-subtle flex justify-between items-center text-[12px] text-text-muted"><span>{total.toLocaleString()} matching rows</span><div className="flex items-center gap-3"><button disabled={page <= 1} onClick={() => changePage(page - 1)} className="h-8 px-3 border rounded-[5px] disabled:opacity-40">Previous</button><span>Page {page} of {pages}</span><button disabled={page >= pages} onClick={() => changePage(page + 1)} className="h-8 px-3 border rounded-[5px] disabled:opacity-40">Next</button></div></div>
    </div>
  </div>;
}

function StatusBadge({ status }: { status: string }) {
  const color = status === 'clean' ? 'bg-green-100 text-green-800' : status === 'resolved' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800';
  return <span className={`px-2 py-1 rounded-full text-[11px] font-medium ${color}`}>{status}</span>;
}

function RunBadge({ status }: { status: string }) {
  const color = status === 'completed' ? 'bg-green-100 text-green-800' : status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800';
  return <span className={`px-3 py-1 rounded-full text-[11px] font-medium ${color}`}>{status}</span>;
}
