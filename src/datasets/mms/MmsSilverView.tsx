import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileSearch,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import {
  createMmsAnomalyRows,
  MMS_ANOMALY_RULES,
  MMS_AUTOMATICALLY_CLEAN,
  MMS_ROWS_CHECKED,
  MmsAnomalyId,
  MmsAnomalyRow,
  ResolutionChoice,
  ReviewStatus,
} from './mmsSilverMockData';

type StatusFilter = ReviewStatus | 'all';

interface ScorecardValues {
  rowsChecked: number;
  rowsForReview: number;
  resolved: number;
  clean: number;
}

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'for-review', label: 'For review' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'all', label: 'All' },
];

const CSV_COLUMNS: { label: string; value: (row: MmsAnomalyRow) => string }[] = [
  { label: 'Date', value: row => row.date },
  { label: 'Transaction number', value: row => row.transactionNumber },
  { label: 'Register number', value: row => row.registerNumber },
  { label: 'Store code', value: row => row.storeCode },
  { label: 'SKU code', value: row => row.skuCode },
  { label: 'Transaction type', value: row => row.transactionType },
  { label: 'MMS sales', value: row => row.mmsSales },
  { label: 'Quantity sold', value: row => row.quantitySold },
  { label: 'Margin', value: row => row.margin },
  { label: 'Store categorization', value: row => row.storeCategorization },
  { label: 'Issue', value: row => row.anomalyTypes.join(' | ') },
  { label: 'Status', value: row => row.status === 'reviewed' ? 'Reviewed' : 'For review' },
  { label: 'Resolved by', value: row => row.resolvedBy || '' },
  { label: 'Resolved at', value: row => row.resolvedAt || '' },
];

function calculateScorecards(rows: MmsAnomalyRow[]): ScorecardValues {
  const resolved = rows.filter(row => row.status === 'reviewed').length;
  return {
    rowsChecked: MMS_ROWS_CHECKED,
    rowsForReview: rows.length - resolved,
    resolved,
    clean: MMS_AUTOMATICALLY_CLEAN,
  };
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function formatSourceDate(value: string): string {
  if (!/^\d{6}$/.test(value)) return value || '—';
  const year = 2000 + Number(value.slice(0, 2));
  const month = Number(value.slice(2, 4));
  const day = Number(value.slice(4, 6));
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(year, month - 1, day));
}

function formatResolvedAt(value?: string): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

interface ReviewPanelProps {
  anomalyId: MmsAnomalyId;
  rows: MmsAnomalyRow[];
  onClose: () => void;
  onResolve: (rowIds: string[], resolution: ResolutionChoice, auditNote: string) => void;
}

function ReviewPanel({ anomalyId, rows, onClose, onResolve }: ReviewPanelProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('for-review');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [resolution, setResolution] = useState<ResolutionChoice | ''>('');
  const [auditNote, setAuditNote] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const rule = MMS_ANOMALY_RULES.find(item => item.id === anomalyId)!;
  const groupRows = useMemo(
    () => rows.filter(row => row.anomalyTypes.includes(anomalyId)),
    [anomalyId, rows],
  );
  const visibleRows = groupRows.filter(row => statusFilter === 'all' || row.status === statusFilter);
  const selectableRows = visibleRows.filter(row => row.status === 'for-review');
  const selectedRows = groupRows.filter(row => selectedIds.has(row.id));
  const allVisibleSelected = selectableRows.length > 0
    && selectableRows.every(row => selectedIds.has(row.id));
  const sameAnomalyType = selectedRows.length > 0
    && selectedRows.every(row => row.anomalyTypes.includes(anomalyId));
  const canResolve = sameAnomalyType && Boolean(resolution) && Boolean(auditNote.trim());

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const toggleRow = (rowId: string) => {
    setConfirmation('');
    setSelectedIds(current => {
      const next = new Set(current);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setConfirmation('');
    setSelectedIds(current => {
      const next = new Set(current);
      if (allVisibleSelected) {
        selectableRows.forEach(row => next.delete(row.id));
      } else {
        selectableRows.forEach(row => next.add(row.id));
      }
      return next;
    });
  };

  const completeResolution = () => {
    if (!canResolve || !resolution) return;
    const count = selectedIds.size;
    onResolve([...selectedIds], resolution, auditNote.trim());
    setSelectedIds(new Set());
    setResolution('');
    setAuditNote('');
    setConfirmation(`${count} ${count === 1 ? 'row' : 'rows'} marked as reviewed.`);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111827]/55 p-4" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="mms-review-title"
        className="flex h-[92vh] w-full max-w-[1480px] flex-col overflow-hidden rounded-[12px] border border-border-subtle bg-white shadow-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-5 border-b border-border-subtle px-6 py-5">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center rounded-full bg-silver-bg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-silver-text">
                MMS anomaly review
              </span>
              <span className="text-[12px] font-medium text-text-muted">
                {groupRows.length.toLocaleString()} affected rows
              </span>
            </div>
            <h2 id="mms-review-title" className="break-all text-[18px] font-semibold text-text-main">
              {anomalyId}
            </h2>
            <p className="mt-1 max-w-[900px] text-[13px] leading-5 text-text-muted">{rule.definition}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close anomaly review"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border-subtle text-[24px] text-text-muted transition-colors hover:border-slate-300 hover:bg-surface-bg hover:text-text-main focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2"
          >
            <span aria-hidden="true" className="-mt-0.5 leading-none">×</span>
          </button>
        </header>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-border-subtle bg-surface-bg px-6 py-3">
          <div className="flex items-center gap-2" role="group" aria-label="Status filter">
            <span className="mr-1 text-[12px] font-semibold text-text-main">Status</span>
            {STATUS_FILTERS.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setStatusFilter(option.value);
                  setSelectedIds(new Set());
                  setConfirmation('');
                }}
                className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-1 ${
                  statusFilter === option.value
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-border-subtle bg-white text-text-muted hover:border-slate-300 hover:text-text-main'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="text-[12px] text-text-muted">
            {visibleRows.length} shown · {selectedIds.size} selected
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="min-w-[2050px] border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_#E4E9F0]">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all rows for review on this page"
                    checked={allVisibleSelected}
                    disabled={selectableRows.length === 0}
                    onChange={toggleAllVisible}
                    className="h-4 w-4 rounded border-slate-300 accent-[#0054A6] focus:ring-brand-600 disabled:opacity-40"
                  />
                </th>
                {CSV_COLUMNS.map(column => (
                  <th key={column.label} className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-text-muted">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {visibleRows.map(row => (
                <tr key={row.id} className={`transition-colors hover:bg-brand-50/40 ${selectedIds.has(row.id) ? 'bg-brand-50/60' : 'bg-white'}`}>
                  <td className="px-4 py-4 align-top">
                    <input
                      type="checkbox"
                      aria-label={`Select source row ${row.sourceRow}`}
                      checked={selectedIds.has(row.id)}
                      disabled={row.status === 'reviewed'}
                      onChange={() => toggleRow(row.id)}
                      className="h-4 w-4 rounded border-slate-300 accent-[#0054A6] focus:ring-brand-600 disabled:opacity-40"
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-[12px] text-text-main" title={`Source value: ${row.date}`}>{formatSourceDate(row.date)}</td>
                  <td className="whitespace-nowrap px-4 py-4 font-mono text-[12px] text-text-main">{row.transactionNumber || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-4 font-mono text-[12px] text-text-main">{row.registerNumber || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-4 font-mono text-[12px] text-text-main">{row.storeCode || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-4 font-mono text-[12px] text-text-main">{row.skuCode || '—'}</td>
                  <td className={`whitespace-nowrap px-4 py-4 text-[12px] font-medium ${row.transactionType ? 'text-text-main' : 'text-error'}`}>
                    {row.transactionType || 'Missing'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-right font-mono text-[12px] text-text-main">{row.mmsSales}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-right font-mono text-[12px] text-text-main">{row.quantitySold}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-right font-mono text-[12px] text-text-main">{row.margin}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-[12px] text-text-main">{row.storeCategorization}</td>
                  <td className="max-w-[360px] px-4 py-4 text-[11px] leading-5 text-text-muted">
                    {row.anomalyTypes.map(issue => (
                      <span key={issue} className="mr-1.5 inline-block rounded bg-amber-50 px-2 py-0.5 font-medium text-amber-800">
                        {issue}
                      </span>
                    ))}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      row.status === 'reviewed' ? 'bg-emerald-50 text-success' : 'bg-amber-50 text-warning'
                    }`}>
                      {row.status === 'reviewed' ? 'Reviewed' : 'For review'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-[12px] text-text-muted">{row.resolvedBy || '—'}</td>
                  <td className="max-w-[280px] px-4 py-4 text-[12px] text-text-muted">
                    <span className="whitespace-nowrap">{formatResolvedAt(row.resolvedAt)}</span>
                    {row.auditNote && <span className="mt-1 block text-[11px] leading-4 text-text-main">Note: {row.auditNote}</span>}
                  </td>
                </tr>
              ))}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={15} className="px-6 py-16 text-center">
                    <CheckCircle2 className="mx-auto mb-3 h-7 w-7 text-success" aria-hidden="true" />
                    <p className="text-[14px] font-semibold text-text-main">No rows match this status.</p>
                    <p className="mt-1 text-[12px] text-text-muted">Choose Reviewed or All to inspect resolution history.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="shrink-0 border-t border-border-subtle bg-white px-6 py-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(220px,0.7fr)_minmax(320px,1.3fr)_auto] lg:items-end">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-text-main">Resolution</span>
              <select
                value={resolution}
                onChange={event => setResolution(event.target.value as ResolutionChoice | '')}
                disabled={selectedIds.size === 0}
                className="h-10 w-full rounded-[8px] border border-border-subtle bg-white px-3 text-[13px] text-text-main outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-50 disabled:bg-surface-bg disabled:text-text-muted"
              >
                <option value="">Choose a resolution</option>
                <option value="accept">Accept as valid</option>
                <option value="exclude">Exclude from clean output</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-text-main">
                Audit note <span className="text-error">*</span>
              </span>
              <input
                type="text"
                value={auditNote}
                onChange={event => setAuditNote(event.target.value)}
                disabled={selectedIds.size === 0}
                placeholder="Explain why this resolution is appropriate"
                className="h-10 w-full rounded-[8px] border border-border-subtle px-3 text-[13px] text-text-main outline-none placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-50 disabled:bg-surface-bg"
              />
            </label>
            <button
              type="button"
              onClick={completeResolution}
              disabled={!canResolve}
              className="inline-flex h-10 items-center justify-center rounded-[8px] bg-brand-600 px-5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Complete resolution
            </button>
          </div>
          <div className="mt-2 flex min-h-5 items-center justify-between gap-4 text-[11px]">
            <p className={sameAnomalyType || selectedRows.length === 0 ? 'text-text-muted' : 'font-medium text-error'}>
              Selections are limited to rows in this anomaly type. An audit note is required.
            </p>
            {confirmation && <p role="status" className="font-semibold text-success">{confirmation}</p>}
          </div>
        </footer>
      </section>
    </div>
  );
}

export default function MmsSilverView() {
  const [rows, setRows] = useState<MmsAnomalyRow[]>(createMmsAnomalyRows);
  const [scorecards, setScorecards] = useState<ScorecardValues>(() => calculateScorecards(createMmsAnomalyRows()));
  const [activeAnomaly, setActiveAnomaly] = useState<MmsAnomalyId | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);

  const updateRowsAndScorecards = (nextRows: MmsAnomalyRow[]) => {
    setRows(nextRows);
    setScorecards(calculateScorecards(nextRows));
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setScorecards(calculateScorecards(rows));
    setLastRefreshedAt(new Date());
    window.setTimeout(() => setRefreshing(false), 350);
  };

  const handleDownload = () => {
    const header = CSV_COLUMNS.map(column => csvCell(column.label)).join(',');
    const records = rows.map(row => CSV_COLUMNS.map(column => csvCell(column.value(row))).join(','));
    const blob = new Blob([`\uFEFF${[header, ...records].join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'mms_silver_anomalies_37_rows.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleResolve = (rowIds: string[], resolution: ResolutionChoice, auditNote: string) => {
    const resolvedIds = new Set(rowIds);
    const resolvedAt = new Date().toISOString();
    const nextRows = rows.map(row => resolvedIds.has(row.id)
      ? {
          ...row,
          status: 'reviewed' as const,
          resolution,
          auditNote,
          resolvedBy: 'Michelle',
          resolvedAt,
        }
      : row);
    updateRowsAndScorecards(nextRows);
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[10px] border border-border-subtle border-t-[3px] border-t-silver-accent bg-white shadow-subtle">
        <div className="flex flex-wrap items-center justify-between gap-5 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-silver-bg text-silver-text">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-[16px] font-semibold text-text-main">MMS validation summary</h3>
              <p className="mt-1 text-[13px] text-text-muted">
                417.csv · MMS-only validation · 37 unique anomaly rows
              </p>
              <p className="mt-1 text-[11px] text-text-muted">
                Refreshed {lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex h-9 items-center justify-center rounded-[8px] border border-border-subtle bg-white px-4 text-[12px] font-semibold text-text-main transition-colors hover:border-slate-300 hover:bg-surface-bg focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex h-9 items-center justify-center rounded-[8px] bg-brand-600 px-4 text-[12px] font-semibold text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2"
            >
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              Download anomalies CSV
            </button>
          </div>
        </div>
        <div className="grid border-t border-border-subtle sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'MMS Rows Checked', value: scorecards.rowsChecked, note: 'All source rows validated' },
            { label: 'Rows for Review', value: scorecards.rowsForReview, note: 'Unique unresolved anomalies' },
            { label: 'Resolved', value: scorecards.resolved, note: 'Human-reviewed rows' },
            { label: 'Clean', value: scorecards.clean, note: 'Automatically clean rows' },
          ].map((card, index) => (
            <div key={card.label} className={`px-6 py-5 ${index > 0 ? 'border-l border-border-subtle' : ''}`}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">{card.label}</p>
              <p className="mt-2 text-[26px] font-semibold tabular-nums text-text-main">{card.value.toLocaleString()}</p>
              <p className="mt-1 text-[11px] text-text-muted">{card.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-[10px] border border-border-subtle bg-white shadow-subtle">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border-subtle px-6 py-5">
          <div>
            <h3 className="text-[16px] font-semibold text-text-main">Dataset rule summary</h3>
            <p className="mt-1 text-[12px] text-text-muted">
              Rule counts can overlap. Scorecards use 37 unique rows and do not add the affected-row counts below.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-success">
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Validated
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-bg">
                <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-text-muted">Anomaly</th>
                <th className="w-36 px-6 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-text-muted">Affected rows</th>
                <th className="w-40 px-6 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-text-muted">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {MMS_ANOMALY_RULES.map(rule => {
                const groupRows = rows.filter(row => row.anomalyTypes.includes(rule.id));
                const groupReviewed = groupRows.length > 0 && groupRows.every(row => row.status === 'reviewed');
                const tooltipId = `${rule.id.toLowerCase()}-definition`;
                return (
                  <tr key={rule.id} className="transition-colors hover:bg-surface-bg/70">
                    <td className="px-6 py-4">
                      <div className="group relative inline-block max-w-full">
                        <button
                          type="button"
                          aria-describedby={tooltipId}
                          onClick={() => rule.affectedRows > 0 && setActiveAnomaly(rule.id)}
                          className={`break-all text-left font-mono text-[12px] font-semibold text-text-main underline decoration-dotted underline-offset-4 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2 ${rule.affectedRows > 0 ? 'cursor-pointer hover:text-brand-600' : 'cursor-help'}`}
                        >
                          {rule.id}
                        </button>
                        <span
                          id={tooltipId}
                          role="tooltip"
                          className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 w-[340px] max-w-[70vw] rounded-[7px] bg-slate-900 px-3 py-2 text-[11px] font-normal leading-4 text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                        >
                          {rule.definition}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-[13px] font-semibold tabular-nums text-text-main">
                      {rule.affectedRows.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {rule.affectedRows === 0 ? (
                        <span className="inline-flex rounded-full bg-surface-bg px-3 py-1.5 text-[11px] font-semibold text-text-muted">
                          No anomalies
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveAnomaly(rule.id)}
                          className={`inline-flex items-center rounded-[7px] border px-3 py-1.5 text-[12px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2 ${
                            groupReviewed
                              ? 'border-emerald-200 bg-emerald-50 text-success hover:border-emerald-300 hover:bg-emerald-100'
                              : 'border-brand-600 bg-white text-brand-600 hover:bg-brand-50'
                          }`}
                        >
                          {groupReviewed ? <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden="true" /> : <FileSearch className="mr-1.5 h-4 w-4" aria-hidden="true" />}
                          {groupReviewed ? 'Reviewed' : 'Review'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {activeAnomaly && (
        <ReviewPanel
          anomalyId={activeAnomaly}
          rows={rows}
          onClose={() => setActiveAnomaly(null)}
          onResolve={handleResolve}
        />
      )}
    </div>
  );
}
