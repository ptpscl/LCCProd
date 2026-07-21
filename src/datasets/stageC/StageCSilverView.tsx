import { useMemo, useState, useEffect } from 'react';
import { CheckCircle2, Download, RefreshCw, X, Info } from 'lucide-react';
import {
  createStageCRows,
  calculateStageCScorecards,
  applyStageCResolution,
  RELATIONAL_FLAG_SUMMARY,
  TRANSACTION_COLUMNS,
  SKU_MATCH_COLUMNS,
  RelationalFlag,
  ResolutionChoice,
  StageCRow,
} from './stageCSilverMockData';

type StatusFilter = 'For review' | 'Reviewed' | 'All';

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function useModalBehavior(onClose: () => void) {
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
}

function flagBadgeClasses(flag: RelationalFlag): string {
  if (flag === 'SKU_SALES_MATCHED') return 'bg-green-100 text-green-800';
  if (flag === 'SKU_SALES_UNMATCHED') return 'bg-red-100 text-red-800';
  return 'bg-amber-100 text-amber-800';
}

function ReviewModal({
  flag,
  rows,
  onClose,
  onResolve,
}: {
  flag: RelationalFlag;
  rows: StageCRow[];
  onClose: () => void;
  onResolve: (ids: string[], resolution: ResolutionChoice, note: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('For review');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [resolution, setResolution] = useState<ResolutionChoice | ''>('');
  const [auditNote, setAuditNote] = useState('');
  const [confirmation, setConfirmation] = useState('');

  useModalBehavior(onClose);

  const groupRows = useMemo(() => rows.filter(r => r.relationalFlag === flag), [rows, flag]);
  const visibleRows = useMemo(
    () => (statusFilter === 'All' ? groupRows : groupRows.filter(r => r.issueStatus === statusFilter)),
    [groupRows, statusFilter],
  );
  const selectableRows = visibleRows.filter(r => r.requiresStageCReview && r.issueStatus === 'For review');
  const allVisibleSelected = selectableRows.length > 0 && selectableRows.every(r => selectedIds.has(r.id));
  const canResolve = selectedIds.size > 0 && Boolean(resolution) && Boolean(auditNote.trim());

  // Which SKU codes are in the current selection — only meaningful for SKU_SALES_UNMATCHED,
  // since that's the only flag where there's no matchedSku record to fall back on.
  const selectedUnmatchedSkuCodes = useMemo(() => {
    if (flag !== 'SKU_SALES_UNMATCHED') return [];
    const codes = new Set<string>();
    groupRows.forEach(row => {
      if (selectedIds.has(row.id)) codes.add(row.transaction.SKU_CODE);
    });
    return [...codes];
  }, [flag, groupRows, selectedIds]);

  // SKU_SALES_UNMATCHED has exactly one valid resolution — there's no matched SKU to
  // accept or exclude, so selecting rows locks the resolution and pre-fills the audit
  // note with the missing SKU codes instead of asking the reviewer to pick from a menu.
  useEffect(() => {
    if (flag === 'SKU_SALES_UNMATCHED' && selectedIds.size > 0) {
      setResolution('Alert Data Manager');
      setAuditNote(prev => prev.trim()
        ? prev
        : `Unmatched SKU code(s) not found in hierarchy: ${selectedUnmatchedSkuCodes.join(', ')}. Requesting upload of SKU details.`);
    }
  }, [flag, selectedIds, selectedUnmatchedSkuCodes]);

  const toggleRow = (id: string) => setSelectedIds(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAllVisible = () => setSelectedIds(current => {
    const next = new Set(current);
    selectableRows.forEach(row => { if (allVisibleSelected) next.delete(row.id); else next.add(row.id); });
    return next;
  });
  const completeResolution = () => {
    if (!canResolve || !resolution) return;
    const ids = [...selectedIds];
    onResolve(ids, resolution, auditNote.trim());
    setSelectedIds(new Set());
    setResolution('');
    setAuditNote('');
    setConfirmation(flag === 'SKU_SALES_UNMATCHED'
      ? `Data manager alerted for ${ids.length} ${ids.length === 1 ? 'transaction' : 'transactions'}.`
      : `${ids.length} ${ids.length === 1 ? 'row' : 'rows'} marked as reviewed.`);
  };

  const summary = RELATIONAL_FLAG_SUMMARY.find(item => item.flag === flag)!;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-3 sm:p-6" onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="stage-c-review-title" className="flex max-h-[90vh] w-full max-w-[1400px] flex-col overflow-hidden rounded-[12px] bg-white shadow-xl" onMouseDown={e => e.stopPropagation()}>
        <header className="flex shrink-0 items-start justify-between gap-5 border-b border-border-subtle bg-white px-6 py-5">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-silver-bg px-2 py-1 text-[11px] font-medium text-silver-text">Stage C relational review</span>
              <span className="text-[12px] text-text-muted">{groupRows.length} transactions</span>
            </div>
            <h2 id="stage-c-review-title" className="text-[18px] font-semibold text-text-main">{flag}</h2>
            <p className="mt-1 max-w-[900px] text-[12px] leading-5 text-text-muted">{summary.definition}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close review" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] text-text-muted hover:bg-surface-bg hover:text-text-main focus:outline-none focus:ring-2 focus:ring-brand-600">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-white px-6 py-3">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Status filter">
            <span className="mr-1 text-[12px] font-semibold text-text-muted">Status</span>
            {(['For review', 'Reviewed', 'All'] as const).map(option => (
              <button key={option} type="button" onClick={() => { setStatusFilter(option); setSelectedIds(new Set()); setConfirmation(''); }}
                className={`h-8 rounded-[6px] border px-3 text-[12px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-600 ${statusFilter === option ? 'border-brand-600 bg-brand-600 text-white' : 'border-border-subtle bg-white text-text-main hover:bg-surface-bg'}`}>
                {option}
              </button>
            ))}
          </div>
          <p className="text-[12px] text-text-muted">{visibleRows.length} shown · {selectedIds.size} selected</p>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="min-w-[1600px] border-collapse text-left">
            <thead className="sticky top-0 z-20 bg-surface-bg">
              <tr className="border-b border-border-subtle bg-surface-bg">
                {flag !== 'SKU_SALES_MATCHED' && <th className="w-12 px-4 py-3"><input type="checkbox" aria-label="Select all visible rows" checked={allVisibleSelected} disabled={selectableRows.length === 0} onChange={toggleAllVisible} className="h-4 w-4 rounded border-gray-300 accent-[#0054A6] disabled:opacity-40" /></th>}
                <th colSpan={TRANSACTION_COLUMNS.length} className="border-l border-border-subtle px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-silver-text">Transaction</th>
                <th colSpan={SKU_MATCH_COLUMNS.length} className="border-l border-border-subtle px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-silver-text">Matched SKU</th>
                <th className="border-l border-border-subtle px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-silver-text">Status</th>
              </tr>
              <tr className="border-b border-border-subtle bg-surface-bg">
                {flag !== 'SKU_SALES_MATCHED' && <th className="px-4 py-3" />}
                {TRANSACTION_COLUMNS.map(col => <th key={col} className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">{col}</th>)}
                {SKU_MATCH_COLUMNS.map(col => <th key={col} className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">{col}</th>)}
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Issue Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {visibleRows.map(row => (
                <tr key={row.id} className={`transition-colors hover:bg-surface-bg ${selectedIds.has(row.id) ? 'bg-brand-50' : 'bg-white'}`}>
                  {flag !== 'SKU_SALES_MATCHED' && (
                    <td className="px-4 py-3 align-top">
                      <input type="checkbox" aria-label={`Select ${row.id}`} checked={selectedIds.has(row.id)} disabled={!row.requiresStageCReview || row.issueStatus === 'Reviewed'} onChange={() => toggleRow(row.id)} className="h-4 w-4 rounded border-gray-300 accent-[#0054A6] disabled:opacity-40" />
                    </td>
                  )}
                  {TRANSACTION_COLUMNS.map(col => <td key={col} className="whitespace-nowrap px-4 py-3 text-[12px] text-text-main">{row.transaction[col] || '—'}</td>)}
                  {SKU_MATCH_COLUMNS.map(col => <td key={col} className="whitespace-nowrap px-4 py-3 text-[12px] text-text-main">{row.matchedSku?.[col] || '—'}</td>)}
                  <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${row.issueStatus === 'Reviewed' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{row.issueStatus}</span></td>
                </tr>
              ))}
              {visibleRows.length === 0 && (
                <tr><td colSpan={TRANSACTION_COLUMNS.length + SKU_MATCH_COLUMNS.length + 2} className="px-6 py-12 text-center text-[13px] text-text-muted">No rows match the current status filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {flag !== 'SKU_SALES_MATCHED' && (
          <footer className="shrink-0 border-t border-border-subtle bg-white px-6 py-4">
            {flag === 'SKU_SALES_UNMATCHED' && selectedUnmatchedSkuCodes.length > 0 && (
              <div className="mb-3 rounded-[6px] border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-[11px] font-medium text-amber-800">
                  This will alert the data manager to upload SKU details for: {selectedUnmatchedSkuCodes.join(', ')}
                </p>
              </div>
            )}
            <div className="grid gap-4 lg:grid-cols-[minmax(220px,0.7fr)_minmax(320px,1.3fr)_auto] lg:items-end">
              {flag === 'SKU_SALES_UNMATCHED' ? (
                <div className="text-[12px] font-semibold text-text-muted">Resolution
                  <div className="mt-2 flex h-10 w-full items-center rounded-[6px] border border-amber-200 bg-amber-50 px-3 text-[13px] font-medium text-amber-800">
                    Alert Data Manager
                  </div>
                </div>
              ) : (
                <label className="text-[12px] font-semibold text-text-muted">Resolution
                  <select value={resolution} onChange={e => setResolution(e.target.value as ResolutionChoice | '')} disabled={selectedIds.size === 0} className="mt-2 h-10 w-full rounded-[6px] border border-border-subtle bg-white px-3 text-[13px] font-normal text-text-main outline-none focus:border-brand-600 disabled:bg-surface-bg disabled:opacity-60">
                    <option value="">Choose a resolution</option>
                    <option value="Accept as Valid">Accept as Valid</option>
                    <option value="Exclude from Output">Exclude from Output</option>
                  </select>
                </label>
              )}
              <label className="text-[12px] font-semibold text-text-muted">Audit note <span className="text-error">*</span>
                <input type="text" value={auditNote} onChange={e => setAuditNote(e.target.value)} disabled={selectedIds.size === 0} placeholder="Explain why this resolution is appropriate" className="mt-2 h-10 w-full rounded-[6px] border border-border-subtle px-3 text-[13px] font-normal text-text-main outline-none placeholder:text-gray-400 focus:border-brand-600 disabled:bg-surface-bg disabled:opacity-60" />
              </label>
              <button type="button" onClick={completeResolution} disabled={!canResolve} className="inline-flex h-10 items-center justify-center rounded-[6px] bg-[#0054A6] px-4 text-[13px] font-semibold text-white hover:bg-[#004385] focus:outline-none focus:ring-2 focus:ring-brand-600 disabled:cursor-not-allowed disabled:opacity-50">
                <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />{flag === 'SKU_SALES_UNMATCHED' ? 'Send alert' : 'Complete resolution'}
              </button>
            </div>
            {confirmation && <p role="status" className="mt-2 text-[11px] font-medium text-green-800">{confirmation}</p>}
          </footer>
        )}
      </section>
    </div>
  );
}

export default function StageCSilverView() {
  const [rows, setRows] = useState<StageCRow[]>(createStageCRows);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [activeFlag, setActiveFlag] = useState<RelationalFlag | null>(null);

  const scorecards = useMemo(() => calculateStageCScorecards(rows), [rows]);

  const refresh = () => {
    setRefreshing(true);
    setLastUpdatedAt(new Date());
    window.setTimeout(() => setRefreshing(false), 350);
  };
  const resolve = (ids: string[], resolution: ResolutionChoice, note: string) => {
    setRows(current => applyStageCResolution(current, ids, resolution, note));
  };
  const downloadCsv = () => {
    const columns = [...TRANSACTION_COLUMNS, ...SKU_MATCH_COLUMNS, 'RELATIONAL_FLAG', 'ISSUE_STATUS'];
    const header = columns.map(csvCell).join(',');
    const records = rows.map(row => [
      ...TRANSACTION_COLUMNS.map(c => row.transaction[c] || ''),
      ...SKU_MATCH_COLUMNS.map(c => row.matchedSku?.[c] || ''),
      row.relationalFlag,
      row.issueStatus,
    ].map(csvCell).join(','));
    const blob = new Blob([`\uFEFF${[header, ...records].join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'stage_c_silver_demo_relational_flags.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[18px] font-semibold text-text-main">Silver Stage C Data</h2>
            <span className="rounded-full bg-silver-bg px-2 py-1 text-[11px] font-medium text-silver-text">Provisional demo</span>
          </div>
          <p className="mt-1 text-[13px] text-text-muted">SKU Hierarchy × Loyalty/MMS Transaction matching</p>
          <p className="mt-1 text-[11px] text-text-muted">Updated as of {lastUpdatedAt.toLocaleString()}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={refresh} className="inline-flex h-9 items-center justify-center rounded-[6px] border border-border-subtle bg-white px-4 text-[13px] font-medium text-text-main hover:bg-surface-bg focus:outline-none focus:ring-2 focus:ring-brand-600">
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />Refresh
          </button>
          <button type="button" onClick={downloadCsv} className="inline-flex h-9 items-center justify-center rounded-[6px] bg-[#0054A6] px-4 text-[13px] font-medium text-white hover:bg-[#004385] focus:outline-none focus:ring-2 focus:ring-brand-600">
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />Download Relational Flags CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Transactions Checked', scorecards.totalChecked],
          ['Matched', scorecards.matched],
          ['For Review', scorecards.forReview],
          ['Resolved', scorecards.resolved],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-[10px] border border-border-subtle bg-white p-6 shadow-subtle">
            <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-text-muted">{label}</h3>
            <p className="text-[28px] font-bold text-text-main">{Number(value).toLocaleString()}</p>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-text-muted">Demo value</p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-[10px] border border-border-subtle bg-white shadow-subtle">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border-subtle px-6 py-5">
          <div>
            <h3 className="text-[16px] font-semibold text-text-main">Relational Flag Summary</h3>
            <p className="mt-1 text-[12px] text-text-muted">Each transaction is matched against the SKU hierarchy and classified with one relational flag.</p>
          </div>
          <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800">Provisional frontend data</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-bg">
                <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">RELATIONAL_FLAG</th>
                <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Definition</th>
                <th className="px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">Affected Rows</th>
                <th className="px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">Remaining for Review</th>
                <th className="px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {RELATIONAL_FLAG_SUMMARY.map(item => {
                const groupRows = rows.filter(r => r.relationalFlag === item.flag);
                const remaining = groupRows.filter(r => r.requiresStageCReview && r.issueStatus === 'For review').length;
                const reviewed = groupRows.length > 0 && remaining === 0;
                return (
                  <tr key={item.flag} className="hover:bg-surface-bg">
                    <td className="px-6 py-4"><span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${flagBadgeClasses(item.flag)}`}>{item.flag}</span></td>
                    <td className="max-w-[420px] px-6 py-4 text-[12px] leading-5 text-text-muted">{item.definition}</td>
                    <td className="px-6 py-4 text-right text-[13px] font-medium text-text-main">{groupRows.length.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-[13px] font-medium text-text-main">{remaining}</td>
                    <td className="px-6 py-4 text-right">
                      <button type="button" onClick={() => setActiveFlag(item.flag)} className={`inline-flex h-8 items-center rounded-[6px] border px-3 text-[12px] font-medium focus:outline-none focus:ring-2 focus:ring-brand-600 ${reviewed ? 'border-green-200 bg-green-100 text-green-800 hover:bg-green-50' : 'border-border-subtle bg-white text-text-main hover:bg-surface-bg'}`}>
                        {reviewed && <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />}
                        {item.flag === 'SKU_SALES_MATCHED' ? 'View' : reviewed ? 'Reviewed' : 'Review'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex items-start gap-3 rounded-[10px] border border-border-subtle bg-white px-6 py-4 shadow-subtle">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
        <p className="text-[12px] leading-5 text-text-muted">SKU_SALES_MATCHED transactions require no action — they already have full division/category/brand attribution. UNMATCHED rows automatically alert the data manager to upload the missing SKU details. DROPPED_SKU_TRANSACTION rows require a resolution and audit note before they're considered Stage-C-complete.</p>
      </section>

      {activeFlag && <ReviewModal flag={activeFlag} rows={rows} onClose={() => setActiveFlag(null)} onResolve={resolve} />}
    </div>
  );
}