import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, FileSearch, Pencil, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';

import {
  CustomerSilverRun,
  CustomerSilverStats,
  getCustomerSilverRows,
  getCustomerSilverRun,
  getCustomerSilverStats,
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

const CUSTOMER_ANOMALY_RULES = [
  { id: 'missing_customer_number', definition: 'Customer number is blank or contains a recognized missing-value marker.', anomalyClass: '1B' },
  { id: 'duplicate_customer_number', definition: 'Customer number appears more than once within the same source batch.', anomalyClass: '1B' },
  { id: 'without_province', definition: 'Province is blank or contains a recognized missing-value marker.', anomalyClass: '1A' },
  { id: 'birthday_invalid', definition: 'Birthday has a value but cannot be converted into a valid supported date.', anomalyClass: '1B' },
  { id: 'birthday_in_future', definition: 'Birthday occurs after the current date.', anomalyClass: '1B' },
  { id: 'birthday_age_over_120', definition: 'Birthday implies that the customer is more than 120 years old.', anomalyClass: '1B' },
  { id: 'age_invalid', definition: 'Age has a value but cannot be converted into an integer.', anomalyClass: '1B' },
  { id: 'birthday_age_mismatch', definition: 'Recorded age differs from the age implied by birthday by more than two years.', anomalyClass: '1B' },
] as const;

type CustomerAnomalyRule = typeof CUSTOMER_ANOMALY_RULES[number];
type CustomerReviewStatus = 'for-review' | 'reviewed' | 'all';
type CustomerResolutionChoice = 'accept' | 'corrected';

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
  const [activeRule, setActiveRule] = useState<CustomerAnomalyRule | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(() => new Date());
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
          if (qualityIssue && !(row.original_quality_issues || row.quality_issues).includes(qualityIssue)) return false;
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

  const refreshSummary = () => {
    setRefreshing(true);
    void load(1).finally(() => {
      setLastRefreshedAt(new Date());
      window.setTimeout(() => setRefreshing(false), 250);
    });
  };

  const downloadAnomalies = () => {
    const columns = ['CUSTOMER NUMBER', 'GENDER', 'BIRTHDAY', 'AGE', 'CITY', 'PROVINCE', 'LAST VISIT', 'anomaly_class', 'validation_status', 'quality_issues'];
    const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const anomalyRows = demoRows.filter(row => row.validation_status !== 'clean');
    const records = anomalyRows.map(row => columns.map(column =>
      csvCell(column === 'quality_issues'
        ? (row.original_quality_issues || row.quality_issues).join(' | ')
        : row[column])).join(','));
    const blob = new Blob([`\uFEFF${[columns.map(csvCell).join(','), ...records].join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'customer_silver_anomaly_samples.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
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
      resolved_by: 'Leonard Inciso',
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

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const ruleSummary = useMemo(() => CUSTOMER_ANOMALY_RULES.map(rule => {
    const affectedRows = demoRows.filter(row =>
      (row.original_quality_issues || row.quality_issues).includes(rule.id));
    return {
      ...rule,
      affectedRows: affectedRows.length,
      unresolvedRows: affectedRows.filter(row => row.validation_status !== 'resolved').length,
    };
  }), [demoRows]);

  const reviewRule = (rule: typeof CUSTOMER_ANOMALY_RULES[number]) => {
    setPage(1);
    setStatusFilter('');
    setAnomalyClass('');
    setCustomerNumber('');
    setCustomerNumberInput('');
    setQualityIssue(rule.id);
    setActiveRule(rule);
  };

  const resolveSelectedRows = (rowIds: string[], resolution: CustomerResolutionChoice, auditNote: string) => {
    const selectedIds = new Set(rowIds);
    const selectedRows = demoRows.filter(row => selectedIds.has(row.id) && row.validation_status !== 'resolved');
    const resolvedAt = new Date().toISOString();
    const resolvedRows = selectedRows.map(row => ({
      ...row,
      original_anomaly_class: row.original_anomaly_class || row.anomaly_class,
      original_quality_issues: row.original_quality_issues || [...row.quality_issues],
      anomaly_class: '0',
      validation_status: 'resolved',
      quality_issues: [],
      resolution_type: resolution,
      resolution_note: auditNote,
      resolved_by: 'Leonard Inciso',
      resolved_at: resolvedAt,
    }));
    const resolutionsById = new Map(resolvedRows.map(row => [row.id, row]));
    setDemoRows(previous => previous.map(row => resolutionsById.get(row.id) || row));
    resolvedRows.forEach(saveCustomerDemoResolution);
    const resolved1A = resolvedRows.filter(row => row.original_anomaly_class === '1A').length;
    const resolved1B = resolvedRows.filter(row => row.original_anomaly_class === '1B').length;
    setStats(previous => ({
      ...previous,
      flagged_rows: Math.max(0, previous.flagged_rows - resolvedRows.length),
      resolved_rows: previous.resolved_rows + resolvedRows.length,
      class_0_rows: previous.class_0_rows + resolvedRows.length,
      class_1a_rows: Math.max(0, previous.class_1a_rows - resolved1A),
      class_1b_rows: Math.max(0, previous.class_1b_rows - resolved1B),
    }));
    setNotice(`${resolvedRows.length} customer ${resolvedRows.length === 1 ? 'row' : 'rows'} resolved locally.`);
  };

  return <div className="space-y-6">
    {DEMO_MODE && <div className="px-4 py-3 rounded-[8px] border border-blue-200 bg-blue-50 text-blue-900 text-[13px] flex items-center justify-between"><span><strong>Prototype demo:</strong> summary counts come from the completed anomaly notebook; table rows are illustrative samples.</span><span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-[11px] font-semibold">No live processing</span></div>}
    {error && <div className="px-4 py-3 rounded-[8px] border border-red-200 bg-red-50 text-red-800 text-[13px]">{error}</div>}
    {notice && <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-[8px] border border-green-200 bg-green-50 text-green-800 text-[13px] shadow-lg">{notice}</div>}

    <section className="overflow-hidden rounded-[10px] border border-border-subtle border-t-[3px] border-t-silver-accent bg-white shadow-subtle">
      <div className="flex flex-wrap items-center justify-between gap-5 px-6 py-5">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-silver-bg text-silver-text"><ShieldCheck className="h-6 w-6" /></div>
          <div>
            <h3 className="text-[16px] font-semibold text-text-main">Customer validation summary</h3>
            <p className="mt-1 text-[13px] text-text-muted">Customer database · 0 / 1A / 1B anomaly classification</p>
            <p className="mt-1 text-[11px] text-text-muted">Refreshed {lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={refreshSummary} className="inline-flex h-9 items-center rounded-[8px] border border-border-subtle bg-white px-4 text-[12px] font-semibold text-text-main hover:bg-surface-bg"><RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Refresh</button>
          <button type="button" onClick={downloadAnomalies} className="inline-flex h-9 items-center rounded-[8px] bg-brand-600 px-4 text-[12px] font-semibold text-white hover:bg-brand-700"><Download className="mr-2 h-4 w-4" />Download anomalies CSV</button>
        </div>
      </div>
      <div className="grid border-t border-border-subtle sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Customer Rows Checked', stats.total_rows, 'All source rows classified'],
          ['Rows for Review', stats.flagged_rows, `Class 1A: ${stats.class_1a_rows.toLocaleString()} · Class 1B: ${stats.class_1b_rows.toLocaleString()}`],
          ['Resolved', stats.resolved_rows, 'Human-reviewed rows reclassified to 0'],
          ['Clean', stats.clean_rows, 'Automatically clean rows'],
        ].map(([label, value, note], index) => <div key={String(label)} className={`px-6 py-5 ${index > 0 ? 'border-l border-border-subtle' : ''}`}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">{label}</p>
          <p className="mt-2 text-[26px] font-semibold tabular-nums text-text-main">{loading ? '-' : Number(value).toLocaleString()}</p>
          <p className="mt-1 text-[11px] text-text-muted">{note}</p>
        </div>)}
      </div>
    </section>

    {run && <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle px-6 py-4 flex items-center justify-between gap-6">
      <div><p className="text-[13px] font-semibold">Latest processing run</p><p className="text-[12px] text-text-muted mt-1">Started {new Date(run.started_at || run.created_at).toLocaleString()}</p>{run.error_message && <p className="text-[12px] text-red-700 mt-2 break-all">{run.error_message}</p>}</div>
      <RunBadge status={run.status} />
    </div>}

    <section className="overflow-hidden rounded-[10px] border border-border-subtle bg-white shadow-subtle">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border-subtle px-6 py-5">
        <div>
          <h3 className="text-[16px] font-semibold text-text-main">Dataset rule summary</h3>
          <p className="mt-1 text-[12px] text-text-muted">
            Counts may overlap because one customer can trigger multiple rules. Prototype counts reflect the displayed sample rows.
          </p>
        </div>
        <span className="inline-flex items-center rounded-full bg-silver-bg px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-silver-text">
          Customer validation
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead><tr className="border-b border-border-subtle bg-surface-bg">
            <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-text-muted">Anomaly</th>
            <th className="w-28 px-6 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-text-muted">Class</th>
            <th className="w-36 px-6 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-text-muted">Affected rows</th>
            <th className="w-36 px-6 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-text-muted">For review</th>
            <th className="w-40 px-6 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-text-muted">Action</th>
          </tr></thead>
          <tbody className="divide-y divide-border-subtle">
            {ruleSummary.map(rule => <tr key={rule.id} className="transition-colors hover:bg-surface-bg/70">
              <td className="px-6 py-4">
                <p className="font-mono text-[12px] font-semibold text-text-main">{rule.id}</p>
                <p className="mt-1 text-[11px] leading-4 text-text-muted">{rule.definition}</p>
              </td>
              <td className="px-6 py-4 text-center"><ClassBadge value={rule.anomalyClass} /></td>
              <td className="px-6 py-4 text-right text-[13px] font-semibold tabular-nums text-text-main">{rule.affectedRows.toLocaleString()}</td>
              <td className="px-6 py-4 text-right text-[13px] font-semibold tabular-nums text-text-main">{rule.unresolvedRows.toLocaleString()}</td>
              <td className="px-6 py-4 text-right">
                {rule.affectedRows === 0 ? <span className="inline-flex rounded-full bg-surface-bg px-3 py-1.5 text-[11px] font-semibold text-text-muted">No samples</span>
                  : <button type="button" onClick={() => reviewRule(rule)} className="inline-flex items-center rounded-[7px] border border-brand-600 bg-white px-3 py-1.5 text-[12px] font-semibold text-brand-600 hover:bg-brand-50">
                    {rule.unresolvedRows === 0 ? <CheckCircle2 className="mr-1.5 h-4 w-4" /> : <FileSearch className="mr-1.5 h-4 w-4" />}
                    {rule.unresolvedRows === 0 ? 'Reviewed' : 'Review'}
                  </button>}
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>

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
    {activeRule && <CustomerReviewPanel rule={activeRule} rows={demoRows} onClose={() => setActiveRule(null)} onResolve={resolveSelectedRows} />}
  </div>;
}

function CustomerReviewPanel({ rule, rows, onClose, onResolve }: {
  rule: CustomerAnomalyRule;
  rows: any[];
  onClose: () => void;
  onResolve: (rowIds: string[], resolution: CustomerResolutionChoice, auditNote: string) => void;
}) {
  const [status, setStatus] = useState<CustomerReviewStatus>('for-review');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [resolution, setResolution] = useState<CustomerResolutionChoice | ''>('');
  const [auditNote, setAuditNote] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const affectedRows = rows.filter(row =>
    (row.original_quality_issues || row.quality_issues).includes(rule.id));
  const visibleRows = affectedRows.filter(row => status === 'all'
    || (status === 'reviewed' ? row.validation_status === 'resolved' : row.validation_status !== 'resolved'));
  const selectableRows = visibleRows.filter(row => row.validation_status !== 'resolved');
  const allVisibleSelected = selectableRows.length > 0
    && selectableRows.every(row => selectedIds.has(row.id));
  const canResolve = selectedIds.size > 0 && Boolean(resolution) && Boolean(auditNote.trim());

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  const toggleRow = (rowId: string) => {
    setConfirmation('');
    setSelectedIds(current => {
      const next = new Set(current);
      if (next.has(rowId)) next.delete(rowId); else next.add(rowId);
      return next;
    });
  };
  const toggleAll = () => setSelectedIds(current => {
    const next = new Set(current);
    selectableRows.forEach(row => allVisibleSelected ? next.delete(row.id) : next.add(row.id));
    return next;
  });
  const completeResolution = () => {
    if (!canResolve || !resolution) return;
    const ids = [...selectedIds];
    onResolve(ids, resolution, auditNote.trim());
    setSelectedIds(new Set());
    setResolution('');
    setAuditNote('');
    setConfirmation(`${ids.length} ${ids.length === 1 ? 'row' : 'rows'} marked as reviewed.`);
  };

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111827]/55 p-4">
    <section role="dialog" aria-modal="true" aria-labelledby="customer-review-title" className="flex h-[92vh] w-full max-w-[1480px] flex-col overflow-hidden rounded-[12px] border border-border-subtle bg-white shadow-2xl">
      <header className="flex shrink-0 items-start justify-between gap-5 border-b border-border-subtle px-6 py-5">
        <div><div className="mb-2 flex flex-wrap items-center gap-3"><span className="inline-flex rounded-full bg-silver-bg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-silver-text">Customer anomaly review</span><span className="text-[12px] font-medium text-text-muted">{affectedRows.length} affected rows</span></div><h2 id="customer-review-title" className="font-mono text-[18px] font-semibold text-text-main">{rule.id}</h2><p className="mt-1 max-w-[900px] text-[13px] leading-5 text-text-muted">{rule.definition}</p></div>
        <button type="button" onClick={onClose} aria-label="Close anomaly review" className="flex h-10 w-10 items-center justify-center rounded-full border border-border-subtle hover:bg-surface-bg"><X className="h-5 w-5 text-text-muted" /></button>
      </header>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-border-subtle bg-surface-bg px-6 py-3">
        <div className="flex items-center gap-2"><span className="mr-1 text-[12px] font-semibold text-text-main">Status</span>{([
          ['for-review', 'For review'], ['reviewed', 'Reviewed'], ['all', 'All'],
        ] as const).map(([value, label]) => <button key={value} type="button" onClick={() => { setStatus(value); setSelectedIds(new Set()); setConfirmation(''); }} className={`rounded-[7px] border px-4 py-2 text-[12px] font-semibold ${status === value ? 'border-brand-600 bg-brand-600 text-white' : 'border-border-subtle bg-white text-text-main hover:bg-brand-50'}`}>{label}</button>)}</div>
        <p className="text-[12px] text-text-muted">{visibleRows.length} shown · {selectedIds.size} selected</p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-[1450px] w-full border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-surface-bg shadow-[0_1px_0_#E4E9F0]"><tr>
            <th className="w-12 px-4 py-3"><input type="checkbox" checked={allVisibleSelected} disabled={!selectableRows.length} onChange={toggleAll} className="h-4 w-4 accent-[#0054A6]" /></th>
            {['Customer Number', 'Gender', 'Birthday', 'Age', 'City', 'Province', 'Last Visit', 'Class', 'Status', 'Quality Issues', 'Resolved By', 'Resolved At'].map(label => <th key={label} className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-text-muted">{label}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-border-subtle">{visibleRows.map(row => <tr key={row.id} className={selectedIds.has(row.id) ? 'bg-brand-50/70' : 'bg-white hover:bg-surface-bg'}>
            <td className="px-4 py-4"><input type="checkbox" checked={selectedIds.has(row.id)} disabled={row.validation_status === 'resolved'} onChange={() => toggleRow(row.id)} className="h-4 w-4 accent-[#0054A6] disabled:opacity-40" /></td>
            <td className="whitespace-nowrap px-4 py-4 font-mono text-[12px]">{row['CUSTOMER NUMBER'] || '—'}</td><td className="px-4 py-4 text-[12px]">{row.GENDER || '—'}</td><td className="whitespace-nowrap px-4 py-4 text-[12px]">{row.BIRTHDAY || '—'}</td><td className="px-4 py-4 text-[12px]">{row.AGE ?? '—'}</td><td className="whitespace-nowrap px-4 py-4 text-[12px]">{row.CITY || '—'}</td><td className="whitespace-nowrap px-4 py-4 text-[12px]">{row.PROVINCE || '—'}</td><td className="whitespace-nowrap px-4 py-4 text-[12px]">{row['LAST VISIT'] || '—'}</td><td className="px-4 py-4"><ClassBadge value={row.original_anomaly_class || row.anomaly_class} /></td><td className="px-4 py-4"><StatusBadge status={row.validation_status} /></td>
            <td className="max-w-[280px] px-4 py-4 text-[11px] text-amber-800">{(row.original_quality_issues || row.quality_issues).map((issue: string) => issue.replaceAll('_', ' ')).join(', ')}</td><td className="whitespace-nowrap px-4 py-4 text-[12px] text-text-muted">{row.resolved_by || '—'}</td><td className="whitespace-nowrap px-4 py-4 text-[12px] text-text-muted">{row.resolved_at ? new Date(row.resolved_at).toLocaleString() : '—'}</td>
          </tr>)}{!visibleRows.length && <tr><td colSpan={13} className="px-6 py-16 text-center text-[13px] text-text-muted">No customer rows match this status.</td></tr>}</tbody>
        </table>
      </div>
      <footer className="shrink-0 border-t border-border-subtle bg-white px-6 py-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(240px,0.7fr)_minmax(360px,1.3fr)_auto] lg:items-end">
          <label className="text-[12px] font-semibold text-text-main">Resolution<select value={resolution} onChange={event => setResolution(event.target.value as CustomerResolutionChoice | '')} disabled={!selectedIds.size} className="mt-1.5 h-10 w-full rounded-[7px] border border-border-subtle bg-white px-3 text-[13px] font-normal disabled:bg-surface-bg"><option value="">Choose a resolution</option><option value="accept">Accept as valid</option><option value="corrected">Data corrected</option></select></label>
          <label className="text-[12px] font-semibold text-text-main">Audit note <span className="text-error">*</span><input value={auditNote} onChange={event => setAuditNote(event.target.value)} disabled={!selectedIds.size} placeholder="Explain why this resolution is appropriate" className="mt-1.5 h-10 w-full rounded-[7px] border border-border-subtle px-3 text-[13px] font-normal disabled:bg-surface-bg" /></label>
          <button type="button" onClick={completeResolution} disabled={!canResolve} className="inline-flex h-10 items-center justify-center rounded-[7px] bg-brand-600 px-5 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"><CheckCircle2 className="mr-2 h-4 w-4" />Complete resolution</button>
        </div>
        <div className="mt-2 flex min-h-5 items-center justify-between text-[11px] text-text-muted"><p>Selections are limited to rows in this anomaly type. An audit note is required.</p>{confirmation && <p className="font-semibold text-success">{confirmation}</p>}</div>
      </footer>
    </section>
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
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111827]/55 p-4" onMouseDown={onClose}><div role="dialog" aria-modal="true" className="flex max-h-[92vh] w-full max-w-[1120px] flex-col overflow-hidden rounded-[12px] border border-border-subtle bg-white shadow-2xl" onMouseDown={event => event.stopPropagation()}>
    <div className="px-6 py-5 border-b border-border-subtle flex justify-between items-start"><div><h3 className="text-[18px] font-semibold">Review and resolve Customer row</h3><p className="text-[12px] text-text-muted mt-1">Prototype only — changes stay in this browser session.</p></div><button onClick={onClose}><X className="w-5 h-5 text-text-muted" /></button></div>
    <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-6"><div className="rounded-[8px] border border-amber-200 bg-amber-50 p-4"><p className="text-[12px] font-semibold text-amber-900">{row.validation_status === 'resolved' ? 'Original detected issues' : 'Detected issues'}</p><div className="flex flex-wrap gap-2 mt-2">{(row.original_quality_issues || row.quality_issues).map((issue: string) => <span key={issue} className="px-2 py-1 bg-white border border-amber-200 rounded-full text-[11px] text-amber-800">{issue.replaceAll('_', ' ')}</span>)}</div></div>
      <div className="grid grid-cols-2 gap-4">{field('customer_number', 'Customer number')}{field('gender', 'Gender')}{field('birthday', 'Birthday', 'date')}{field('age', 'Age', 'number')}{field('city', 'City')}{field('province', 'Province')}{field('last_visit', 'Last visit', 'date')}</div>
      <label className="text-[12px] font-semibold text-text-muted block">Audit note <span className="text-error">*</span><textarea value={form.resolution_note || ''} onChange={event => setForm({ ...form, resolution_note: event.target.value })} placeholder="Explain what was reviewed or corrected" className="mt-2 w-full min-h-[90px] p-3 rounded-[6px] border border-border-subtle text-[13px] font-normal" /></label>
    </div>
    <div className="shrink-0 px-6 py-4 border-t border-border-subtle flex items-center justify-between gap-3"><p className="text-[11px] text-text-muted">Resolution reclassifies the row to class 0 while retaining its original issues for audit.</p><div className="flex gap-3"><button onClick={onClose} className="h-10 px-4 rounded-[6px] border border-border-subtle text-[13px]">Cancel</button><button onClick={onSave} disabled={!form.resolution_note?.trim()} className="h-10 px-4 rounded-[6px] bg-[#0054A6] text-white text-[13px] font-semibold inline-flex items-center disabled:cursor-not-allowed disabled:opacity-45"><CheckCircle2 className="w-4 h-4 mr-2" />Complete resolution</button></div></div>
  </div></div>;
}
