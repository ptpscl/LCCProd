import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Pencil, Play, Search, X } from 'lucide-react';

import {
  CustomerSilverRun,
  CustomerSilverStats,
  getCustomerSilverRows,
  getCustomerSilverRun,
  getCustomerSilverStats,
  startCustomerSilverProcessing,
} from './customerService';
import {
  CUSTOMER_SILVER_DEMO_ROWS,
  CUSTOMER_SILVER_DEMO_STATS,
  applyCustomerDemoResolutions,
  saveCustomerDemoResolution,
} from './customerSilverDemo';

const DEMO_MODE = true;

const QUALITY_ISSUES = [
  'missing_customer_number',
  'duplicate_customer_number',
  'without_province',
  'birthday_invalid',
  'birthday_in_future',
  'birthday_age_over_120',
  'age_invalid',
  'birthday_age_mismatch',
];

const EMPTY_STATS: CustomerSilverStats = {
  total_rows: 0,
  clean_rows: 0,
  flagged_rows: 0,
  resolved_rows: 0,
  class_0_rows: 0,
  class_1a_rows: 0,
  class_1b_rows: 0,
  latest_run: null,
};

export default function CustomerSilverView() {
  const initialDemoRows = applyCustomerDemoResolutions(CUSTOMER_SILVER_DEMO_ROWS);
  const initialResolvedCount = initialDemoRows.filter(row => row.validation_status === 'resolved').length;
  const [stats, setStats] = useState<CustomerSilverStats>(DEMO_MODE ? {
    ...CUSTOMER_SILVER_DEMO_STATS,
    flagged_rows: Math.max(0, CUSTOMER_SILVER_DEMO_STATS.flagged_rows - initialResolvedCount),
    resolved_rows: initialResolvedCount,
    class_0_rows: CUSTOMER_SILVER_DEMO_STATS.class_0_rows + initialResolvedCount,
    class_1a_rows: Math.max(0, CUSTOMER_SILVER_DEMO_STATS.class_1a_rows
      - initialDemoRows.filter(row => row.validation_status === 'resolved' && row.original_anomaly_class === '1A').length),
    class_1b_rows: Math.max(0, CUSTOMER_SILVER_DEMO_STATS.class_1b_rows
      - initialDemoRows.filter(row => row.validation_status === 'resolved' && row.original_anomaly_class === '1B').length),
  } : EMPTY_STATS);
  const [rows, setRows] = useState<any[]>([]);
  const [demoRows, setDemoRows] = useState<any[]>(initialDemoRows);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [customerNumber, setCustomerNumber] = useState('');
  const [customerNumberInput, setCustomerNumberInput] = useState('');
  const [qualityIssue, setQualityIssue] = useState('');
  const [anomalyClass, setAnomalyClass] = useState('');
  const [loading, setLoading] = useState(true);
  const [run, setRun] = useState<CustomerSilverRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const pageSize = 20;

  const load = async (targetPage = page) => {
    setLoading(true);
    setError(null);
    try {
      if (DEMO_MODE) {
        const filtered = demoRows.filter(row => {
          if (statusFilter && row.validation_status !== statusFilter) return false;
          if (anomalyClass && row.anomaly_class !== anomalyClass) return false;
          if (customerNumber && row['CUSTOMER NUMBER'] !== customerNumber.toUpperCase()) return false;
          if (qualityIssue && !row.quality_issues.includes(qualityIssue)) return false;
          return true;
        });
        const start = (targetPage - 1) * pageSize;
        setRun(null);
        setRows(filtered.slice(start, start + pageSize));
        setTotal(filtered.length);
        return;
      }
      const [nextStats, result] = await Promise.all([
        getCustomerSilverStats(),
        getCustomerSilverRows({
          validation_status: statusFilter as any,
          customer_number: customerNumber,
          quality_issue: qualityIssue,
          anomaly_class: anomalyClass as any,
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

  useEffect(() => { void load(1); }, [statusFilter, customerNumber, qualityIssue, anomalyClass, demoRows]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

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
    if (DEMO_MODE) return;
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
    setAnomalyClass('');
    setCustomerNumber('');
    setCustomerNumberInput('');
  };

  const changePage = (nextPage: number) => {
    setPage(nextPage);
    void load(nextPage);
  };

  const openReview = (row: any) => {
    setSelectedRow(row);
    setEditForm({
      customer_number: row['CUSTOMER NUMBER'] || '', gender: row.GENDER || '',
      birthday: row.BIRTHDAY || '', age: row.AGE?.toString() || '',
      city: row.CITY || '', province: row.PROVINCE || '',
      last_visit: row['LAST VISIT'] || '', resolution_note: row.resolution_note || '',
    });
  };

  const saveResolution = () => {
    if (!selectedRow) return;
    const previousClass = selectedRow.anomaly_class;
    const resolvedRow = {
      ...selectedRow,
      'CUSTOMER NUMBER': editForm.customer_number.trim(),
      GENDER: editForm.gender.trim() || null,
      BIRTHDAY: editForm.birthday || null,
      AGE: editForm.age === '' ? null : Number(editForm.age),
      CITY: editForm.city.trim() || null,
      PROVINCE: editForm.province.trim() || null,
      'LAST VISIT': editForm.last_visit || null,
      anomaly_class: '0',
      original_anomaly_class: selectedRow.original_anomaly_class || previousClass,
      validation_status: 'resolved',
      original_quality_issues: selectedRow.original_quality_issues || [...selectedRow.quality_issues],
      quality_issues: [],
      resolution_note: editForm.resolution_note.trim(),
      resolved_at: new Date().toISOString(),
    };
    setDemoRows(previous => previous.map(row => row.id === selectedRow.id ? resolvedRow : row));
    saveCustomerDemoResolution(resolvedRow);
    if (previousClass !== '0') {
      setStats(previous => ({
        ...previous,
        flagged_rows: Math.max(0, previous.flagged_rows - 1),
        resolved_rows: previous.resolved_rows + 1,
        class_0_rows: previous.class_0_rows + 1,
        class_1a_rows: previousClass === '1A' ? Math.max(0, previous.class_1a_rows - 1) : previous.class_1a_rows,
        class_1b_rows: previousClass === '1B' ? Math.max(0, previous.class_1b_rows - 1) : previous.class_1b_rows,
      }));
    }
    setSelectedRow(null);
    setNotice('Prototype resolution saved locally. No database record was changed.');
  };

  const processing = !!run && ['queued', 'processing'].includes(run.status);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return <div className="space-y-6">
    {DEMO_MODE && <div className="px-4 py-3 rounded-[8px] border border-blue-200 bg-blue-50 text-blue-900 text-[13px] flex items-center justify-between"><span><strong>Prototype demo:</strong> summary counts come from the completed anomaly notebook; table rows are illustrative samples.</span><span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-[11px] font-semibold">No live processing</span></div>}
    {error && <div className="px-4 py-3 rounded-[8px] border border-red-200 bg-red-50 text-red-800 text-[13px]">{error}</div>}
    {notice && <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-[8px] border border-green-200 bg-green-50 text-green-800 text-[13px] shadow-lg">{notice}</div>}

    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-[18px] font-semibold text-text-main">Silver Customer Data</h2>
        <p className="text-[13px] text-text-muted mt-1">Typed customer records with traceable data-quality flags.</p>
      </div>
      <button onClick={() => void processSilver()} disabled={processing || DEMO_MODE}
        className="inline-flex items-center h-10 px-4 rounded-[7px] bg-[#64748B] hover:bg-[#526173] text-white text-[13px] font-semibold disabled:opacity-60">
        {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
        {DEMO_MODE ? 'Backend connection pending' : processing ? 'Processing Silver...' : stats.total_rows ? 'Refresh from Bronze' : 'Process Bronze to Silver'}
      </button>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
      {[
        ['Total Silver Rows', stats.total_rows, 'text-text-main'],
        ['Clean', stats.clean_rows, 'text-green-700'],
        ['Resolved', stats.resolved_rows, 'text-blue-700'],
        ['Class 1A · Province', stats.class_1a_rows, 'text-amber-600'],
        ['Class 1B · Anomaly', stats.class_1b_rows, 'text-red-700'],
      ].map(([label, value, color]) => <div key={String(label)} className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-6">
        <h3 className="text-[13px] font-semibold text-text-muted uppercase tracking-wider mb-2">{label}</h3>
        <p className={`text-[28px] font-bold ${color}`}>{loading ? '-' : Number(value).toLocaleString()}</p>
      </div>)}
    </div>

    {run && <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle px-6 py-4 flex items-center justify-between gap-6">
      <div><p className="text-[13px] font-semibold">Latest processing run</p><p className="text-[12px] text-text-muted mt-1">Started {new Date(run.started_at || run.created_at).toLocaleString()}</p>{run.error_message && <p className="text-[12px] text-red-700 mt-2 break-all">{run.error_message}</p>}</div>
      <RunBadge status={run.status} />
    </div>}

    <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-5 grid grid-cols-[0.8fr_1fr_1fr_1.4fr_auto] gap-4 items-end">
      <label className="text-[12px] font-semibold text-text-muted">Anomaly class
        <select value={anomalyClass} onChange={event => { setPage(1); setAnomalyClass(event.target.value); }} className="mt-2 w-full h-10 border border-border-subtle rounded-[6px] px-3 bg-white text-[13px] font-normal text-text-main">
          <option value="">All classes</option><option value="0">0 · Clean</option><option value="1A">1A · Without province</option><option value="1B">1B · Serious anomaly</option>
        </select>
      </label>
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
        <thead><tr className="border-b border-border-subtle bg-surface-bg">{['Customer Number', 'Gender', 'Birthday', 'Age', 'City', 'Province', 'Last Visit', 'Class', 'Status', 'Quality Issues', 'Action'].map(label => <th key={label} className="px-4 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-border-subtle">
          {loading ? <tr><td colSpan={11} className="py-12 text-center text-[13px] text-text-muted">Loading Silver rows...</td></tr> : !rows.length ? <tr><td colSpan={11} className="py-12 text-center text-[13px] text-text-muted">No Silver rows match these filters.</td></tr> : rows.map(row => <tr key={row.id} className="hover:bg-surface-bg">
            <td className="px-4 py-3 text-[12px] font-mono">{row['CUSTOMER NUMBER']}</td><td className="px-4 py-3 text-[12px]">{row.GENDER ?? '-'}</td><td className="px-4 py-3 text-[12px]">{row.BIRTHDAY ?? '-'}</td><td className="px-4 py-3 text-[12px]">{row.AGE ?? '-'}</td><td className="px-4 py-3 text-[12px]">{row.CITY ?? '-'}</td><td className="px-4 py-3 text-[12px]">{row.PROVINCE ?? '-'}</td><td className="px-4 py-3 text-[12px]">{row['LAST VISIT'] ?? '-'}</td><td className="px-4 py-3"><ClassBadge value={row.anomaly_class} /></td><td className="px-4 py-3"><StatusBadge status={row.validation_status} /></td><td className="px-4 py-3 text-[11px] text-amber-800 max-w-[260px]">{(row.quality_issues || []).map((issue: string) => issue.replaceAll('_', ' ')).join(', ') || '-'}</td><td className="px-4 py-3"><button onClick={() => openReview(row)} disabled={row.validation_status === 'clean'} className="inline-flex items-center h-8 px-3 rounded-[6px] border border-border-subtle bg-white text-[12px] font-medium hover:bg-surface-bg disabled:opacity-40"><Pencil className="w-3.5 h-3.5 mr-1.5" />{row.validation_status === 'resolved' ? 'Edit' : 'Review'}</button></td>
          </tr>)}
        </tbody>
      </table></div>
      <div className="px-5 py-4 border-t border-border-subtle flex justify-between items-center text-[12px] text-text-muted"><span>{total.toLocaleString()} matching rows</span><div className="flex items-center gap-3"><button disabled={page <= 1} onClick={() => changePage(page - 1)} className="h-8 px-3 border rounded-[5px] disabled:opacity-40">Previous</button><span>Page {page} of {pages}</span><button disabled={page >= pages} onClick={() => changePage(page + 1)} className="h-8 px-3 border rounded-[5px] disabled:opacity-40">Next</button></div></div>
    </div>
    {selectedRow && <ResolutionModal row={selectedRow} form={editForm} setForm={setEditForm} onClose={() => setSelectedRow(null)} onSave={saveResolution} />}
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

function ClassBadge({ value }: { value: string }) {
  const color = value === '0' ? 'bg-green-100 text-green-800' : value === '1A' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800';
  return <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${color}`}>{value}</span>;
}

function ResolutionModal({ row, form, setForm, onClose, onSave }: { row: any; form: Record<string, string>; setForm: (value: Record<string, string>) => void; onClose: () => void; onSave: () => void }) {
  const field = (key: string, label: string, type = 'text') => <label className="text-[12px] font-semibold text-text-muted">{label}<input type={type} value={form[key] || ''} onChange={event => setForm({ ...form, [key]: event.target.value })} className="mt-2 w-full h-10 px-3 rounded-[6px] border border-border-subtle text-[13px] text-text-main font-normal" /></label>;
  return <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-6" onMouseDown={onClose}><div className="w-full max-w-[760px] max-h-[90vh] overflow-y-auto bg-white rounded-[12px] shadow-xl" onMouseDown={event => event.stopPropagation()}>
    <div className="px-6 py-5 border-b border-border-subtle flex justify-between items-start"><div><h3 className="text-[18px] font-semibold">Review and resolve Customer row</h3><p className="text-[12px] text-text-muted mt-1">Prototype only — changes stay in this browser session.</p></div><button onClick={onClose}><X className="w-5 h-5 text-text-muted" /></button></div>
    <div className="p-6 space-y-6"><div className="rounded-[8px] border border-amber-200 bg-amber-50 p-4"><p className="text-[12px] font-semibold text-amber-900">{row.validation_status === 'resolved' ? 'Original detected issues' : 'Detected issues'}</p><div className="flex flex-wrap gap-2 mt-2">{(row.original_quality_issues || row.quality_issues).map((issue: string) => <span key={issue} className="px-2 py-1 bg-white border border-amber-200 rounded-full text-[11px] text-amber-800">{issue.replaceAll('_', ' ')}</span>)}</div></div>
      <div className="grid grid-cols-2 gap-4">{field('customer_number', 'Customer number')}{field('gender', 'Gender')}{field('birthday', 'Birthday', 'date')}{field('age', 'Age', 'number')}{field('city', 'City')}{field('province', 'Province')}{field('last_visit', 'Last visit', 'date')}</div>
      <label className="text-[12px] font-semibold text-text-muted block">Resolution note<textarea value={form.resolution_note || ''} onChange={event => setForm({ ...form, resolution_note: event.target.value })} placeholder="Describe what was reviewed or corrected" className="mt-2 w-full min-h-[90px] p-3 rounded-[6px] border border-border-subtle text-[13px] font-normal" /></label>
    </div>
    <div className="px-6 py-4 border-t border-border-subtle flex justify-end gap-3"><button onClick={onClose} className="h-10 px-4 rounded-[6px] border border-border-subtle text-[13px]">Cancel</button><button onClick={onSave} className="h-10 px-4 rounded-[6px] bg-[#0054A6] text-white text-[13px] font-semibold inline-flex items-center"><CheckCircle2 className="w-4 h-4 mr-2" />Save as resolved</button></div>
  </div></div>;
}
