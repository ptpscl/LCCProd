import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, Download, Info, ShieldCheck, Sparkles } from 'lucide-react';
import {
  RELATIONAL_FLAG_SUMMARY,
  SKU_MATCH_COLUMNS,
  TRANSACTION_COLUMNS,
  createStageCRows,
  type RelationalFlag,
  type StageCRow,
} from './stageCSilverMockData';

type GoldStageCSortKey = 'date' | 'transactionNumber' | 'storeCode' | 'skuCode' | 'relationalFlag' | 'issueStatus';
type GoldStageCSortDirection = 'asc' | 'desc';

interface GoldStageCSort {
  key: GoldStageCSortKey;
  direction: GoldStageCSortDirection;
}

interface GoldStageCColumn {
  key: GoldStageCSortKey;
  label: string;
  numeric?: boolean;
  value: (row: StageCRow) => string;
}

const GOLD_STAGE_C_COLUMNS: GoldStageCColumn[] = [
  { key: 'date', label: 'Date', value: row => row.transaction.DATE },
  { key: 'transactionNumber', label: 'Transaction Number', numeric: true, value: row => row.transaction.TRANSACTION_NUMBER },
  { key: 'storeCode', label: 'Store Code', numeric: true, value: row => row.transaction.STORE_CODE },
  { key: 'skuCode', label: 'SKU Code', numeric: true, value: row => row.transaction.SKU_CODE },
  { key: 'relationalFlag', label: 'Relational Flag', value: row => row.relationalFlag },
  { key: 'issueStatus', label: 'Issue Status', value: row => row.issueStatus },
];

const COLUMN_BY_KEY = Object.fromEntries(GOLD_STAGE_C_COLUMNS.map(column => [column.key, column])) as Record<GoldStageCSortKey, GoldStageCColumn>;

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function formatFlag(flag: RelationalFlag): string {
  if (flag === 'SKU_SALES_MATCHED') return 'bg-green-100 text-green-800';
  if (flag === 'SKU_SALES_UNMATCHED') return 'bg-red-100 text-red-800';
  return 'bg-amber-100 text-amber-800';
}

function downloadCsv(rows: StageCRow[], filename: string) {
  const headers = [...TRANSACTION_COLUMNS, ...SKU_MATCH_COLUMNS, 'RELATIONAL_FLAG', 'ISSUE_STATUS', 'RESOLUTION', 'AUDIT_NOTE', 'RESOLVED_BY', 'RESOLVED_AT'];
  const records = rows.map(row => [
    ...TRANSACTION_COLUMNS.map(key => row.transaction[key] || ''),
    ...SKU_MATCH_COLUMNS.map(key => row.matchedSku?.[key] || ''),
    row.relationalFlag,
    row.issueStatus,
    row.resolution || '',
    row.auditNote || '',
    row.resolvedBy || '',
    row.resolvedAt || '',
  ].map(csvCell).join(','));
  const csv = [headers.map(csvCell).join(','), ...records].join('\n');
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function StageCGoldView() {
  const rows = useMemo(() => createStageCRows(), []);
  const [statusFilter, setStatusFilter] = useState<'All' | 'For review' | 'Reviewed'>('All');
  const [flagFilter, setFlagFilter] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<GoldStageCSort | null>(null);

  const filteredRows = useMemo(() => {
    const filtered = rows.filter(row => {
      if (statusFilter !== 'All' && row.issueStatus !== statusFilter) return false;
      if (flagFilter && row.relationalFlag !== flagFilter) return false;
      if (search) {
        const haystack = [
          row.transaction.DATE,
          row.transaction.TRANSACTION_NUMBER,
          row.transaction.STORE_CODE,
          row.transaction.SKU_CODE,
          row.relationalFlag,
          row.issueStatus,
          row.resolution || '',
          row.auditNote || '',
        ].join(' ').toLowerCase();
        if (!haystack.includes(search.toLowerCase())) return false;
      }
      return true;
    });

    if (!sort) return filtered;
    const column = COLUMN_BY_KEY[sort.key];
    const multiplier = sort.direction === 'asc' ? 1 : -1;
    return [...filtered].sort((left, right) => {
      const leftValue = column.value(left);
      const rightValue = column.value(right);
      if (column.numeric) return (Number(leftValue || 0) - Number(rightValue || 0)) * multiplier;
      return leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: 'base' }) * multiplier;
    });
  }, [flagFilter, rows, search, sort, statusFilter]);

  const matchedCount = rows.filter(row => row.relationalFlag === 'SKU_SALES_MATCHED').length;
  const unresolvedCount = rows.filter(row => row.issueStatus === 'For review').length;
  const reviewedCount = rows.filter(row => row.issueStatus === 'Reviewed').length;
  const readyCount = matchedCount + reviewedCount;
  const reliability = rows.length === 0 ? 0 : (readyCount / rows.length) * 100;
  const reliabilityColor = reliability >= 90 ? 'text-green-700' : reliability >= 70 ? 'text-amber-600' : 'text-red-600';
  const reliabilityBar = reliability >= 90 ? 'bg-green-600' : reliability >= 70 ? 'bg-amber-500' : 'bg-red-500';

  const toggleSort = (key: GoldStageCSortKey) => setSort(current => {
    if (!current || current.key !== key) return { key, direction: 'asc' };
    if (current.direction === 'asc') return { key, direction: 'desc' };
    return null;
  });

  const clearFilters = () => {
    setStatusFilter('All');
    setFlagFilter('');
    setSearch('');
    setSort(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[10px] border border-gold-accent/20 bg-gradient-to-r from-gold-bg to-white px-5 py-4 shadow-subtle">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-accent/10 text-gold-accent">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-[18px] font-semibold text-text-main">Gold Stage C Data</h2>
            <p className="mt-1 text-[13px] text-text-muted">SKU Hierarchy + Loyalty/MMS transaction output promoted from Silver Stage C.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => downloadCsv(rows, 'stage_c_gold.csv')}
          className="inline-flex h-10 items-center rounded-[7px] bg-[#B58A00] px-4 text-[13px] font-semibold text-white hover:bg-[#987400]"
        >
          <Download className="mr-2 h-4 w-4" />
          Export Gold CSV
        </button>
      </div>

      <section className="rounded-[10px] border border-border-subtle bg-white p-6 shadow-subtle">
        <div className="mb-3 flex items-center justify-between gap-5">
          <div>
            <div className="group relative inline-flex items-center gap-2">
              <h3 className="text-[13px] font-semibold uppercase tracking-wider text-text-muted">Stage C data reliability</h3>
              <button type="button" aria-describedby="stage-c-reliability-definition" className="rounded-full text-text-muted hover:text-text-main focus:outline-none focus:ring-2 focus:ring-brand-600">
                <Info className="h-4 w-4" aria-hidden="true" />
              </button>
              <span
                id="stage-c-reliability-definition"
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 w-[380px] max-w-[70vw] rounded-[6px] bg-gray-900 px-3 py-2 text-[11px] font-normal leading-4 text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
              >
                Transactions published to Gold are the matched records plus the rows reviewed and accepted in Silver. Unmatched and dropped rows stay outside Gold.
              </span>
            </div>
            <p className="mt-0.5 text-[12px] text-text-muted">Share of Stage C rows eligible for Gold after relational review.</p>
          </div>
          <p className={`text-[36px] font-bold ${reliabilityColor}`}>{reliability.toFixed(2)}%</p>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full border border-border-subtle bg-surface-bg">
          <div className={`h-full transition-all duration-500 ${reliabilityBar}`} style={{ width: `${reliability}%` }} />
        </div>
        <p className="mt-2 text-[12px] text-text-muted">
          {readyCount.toLocaleString()} of {rows.length.toLocaleString()} transaction rows published to Gold
          {' '}· {unresolvedCount.toLocaleString()} rows remain in Silver review
        </p>
      </section>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Trusted Records', readyCount, 'text-text-main'],
          ['Matched', matchedCount, 'text-green-700'],
          ['For Review', unresolvedCount, 'text-amber-700'],
          ['Reviewed', reviewedCount, 'text-blue-700'],
        ].map(([label, value, color]) => (
          <div key={String(label)} className="rounded-[10px] border border-border-subtle bg-white p-6 shadow-subtle">
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-text-muted">{label}</h3>
            <p className={`text-[28px] font-bold ${color}`}>{Number(value).toLocaleString()}</p>
          </div>
        ))}
      </div>

      <section className="rounded-[10px] border border-border-subtle bg-white p-5 shadow-subtle">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-[#B58A00]" />
          <div>
            <h3 className="text-[14px] font-semibold text-text-main">Gold publication rule</h3>
            <p className="mt-1 text-[12px] text-text-muted">
              Accepted resolved record - clean Silver Stage C record - one trusted output per transaction line.
              Unresolved and excluded rows remain in Silver audit and do not enter Gold as published data.
            </p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[10px] border border-border-subtle bg-white shadow-subtle">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border-subtle px-6 py-5">
          <div>
            <h3 className="text-[16px] font-semibold text-text-main">Gold promotion profile</h3>
            <p className="mt-1 text-[12px] text-text-muted">Read-only publication totals based on the Silver Stage C relational flags.</p>
          </div>
          <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800">Provisional frontend data</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-bg">
                <th className="px-6 py-3 text-[12px] font-semibold uppercase tracking-wider text-text-muted">RELATIONAL_FLAG</th>
                <th className="px-6 py-3 text-right text-[12px] font-semibold uppercase tracking-wider text-text-muted">Rows</th>
                <th className="px-6 py-3 text-right text-[12px] font-semibold uppercase tracking-wider text-text-muted">Published to Gold</th>
                <th className="px-6 py-3 text-right text-[12px] font-semibold uppercase tracking-wider text-text-muted">For Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {RELATIONAL_FLAG_SUMMARY.map(item => {
                const groupRows = rows.filter(row => row.relationalFlag === item.flag);
                const published = groupRows.filter(row => row.issueStatus === 'Reviewed' || row.relationalFlag === 'SKU_SALES_MATCHED').length;
                const pending = groupRows.filter(row => row.issueStatus === 'For review').length;
                return (
                  <tr key={item.flag} className="hover:bg-surface-bg">
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${formatFlag(item.flag)}`}>{item.flag}</span>
                    </td>
                    <td className="px-6 py-4 text-right text-[13px] font-medium text-text-main">{groupRows.length.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-[13px] font-medium text-green-700">{published.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-[13px] font-medium text-amber-700">{pending.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border-subtle bg-surface-bg">
                <th className="px-6 py-4 text-[13px] font-semibold text-text-main">Stage C total</th>
                <td className="px-6 py-4 text-right text-[13px] font-bold text-text-main">{rows.length.toLocaleString()}</td>
                <td className="px-6 py-4 text-right text-[13px] font-bold text-green-700">{readyCount.toLocaleString()}</td>
                <td className="px-6 py-4 text-right text-[13px] font-bold text-amber-700">{unresolvedCount.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="rounded-[10px] border border-border-subtle bg-white p-5 shadow-subtle">
        <div className="grid items-end gap-4 md:grid-cols-2 xl:grid-cols-[1.4fr_0.9fr_1fr_auto]">
          <label className="text-[12px] font-semibold text-text-muted">
            Search
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Transaction, SKU, flag, or status" className="mt-2 h-10 w-full rounded-[6px] border border-border-subtle px-3 text-[13px] font-normal text-text-main outline-none focus:border-[#B58A00]" />
          </label>
          <label className="text-[12px] font-semibold text-text-muted">
            Issue Status
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} className="mt-2 h-10 w-full rounded-[6px] border border-border-subtle bg-white px-3 text-[13px] font-normal text-text-main outline-none focus:border-[#B58A00]">
              <option value="All">All rows</option>
              <option value="For review">For review</option>
              <option value="Reviewed">Reviewed</option>
            </select>
          </label>
          <label className="text-[12px] font-semibold text-text-muted">
            Relational Flag
            <select value={flagFilter} onChange={event => setFlagFilter(event.target.value)} className="mt-2 h-10 w-full rounded-[6px] border border-border-subtle bg-white px-3 text-[13px] font-normal text-text-main outline-none focus:border-[#B58A00]">
              <option value="">All flags</option>
              {RELATIONAL_FLAG_SUMMARY.map(item => <option key={item.flag} value={item.flag}>{item.flag}</option>)}
            </select>
          </label>
          <button type="button" onClick={clearFilters} className="inline-flex h-10 items-center rounded-[6px] border border-border-subtle px-4 text-[13px] text-text-main hover:bg-surface-bg focus:outline-none focus:ring-2 focus:ring-[#B58A00]">
            Clear
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-[10px] border border-border-subtle bg-white shadow-subtle">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-6 py-4">
          <div>
            <h3 className="text-[15px] font-semibold text-text-main">Gold Stage C records</h3>
            <p className="mt-0.5 text-[12px] text-text-muted">Read-only transaction rows promoted from Silver Stage C.</p>
          </div>
          <button type="button" onClick={() => downloadCsv(filteredRows, 'stage_c_gold_filtered_rows.csv')} className="inline-flex h-9 items-center rounded-[6px] border border-[#B58A00] bg-white px-4 text-[12px] font-semibold text-[#8A7526] hover:bg-gold-bg focus:outline-none focus:ring-2 focus:ring-[#B58A00]">
            <Download className="mr-2 h-4 w-4" />
            Download filtered rows
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1800px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-bg">
                {GOLD_STAGE_C_COLUMNS.map(column => {
                  const activeSort = sort?.key === column.key ? sort.direction : null;
                  return (
                    <th key={column.key} aria-sort={activeSort === 'asc' ? 'ascending' : activeSort === 'desc' ? 'descending' : 'none'} className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      <button type="button" onClick={() => toggleSort(column.key)} className="inline-flex items-center gap-1 rounded-[4px] hover:text-text-main focus:outline-none focus:ring-2 focus:ring-[#B58A00]">
                        {column.label}
                        {activeSort === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-[#B58A00]" /> : activeSort === 'desc' ? <ArrowDown className="h-3.5 w-3.5 text-[#B58A00]" /> : <ArrowUpDown className="h-3.5 w-3.5" />}
                      </button>
                    </th>
                  );
                })}
                <th className="whitespace-nowrap px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {filteredRows.map(row => (
                <tr key={row.id} className="hover:bg-surface-bg">
                  {GOLD_STAGE_C_COLUMNS.map(column => (
                    <td key={column.key} className={`whitespace-nowrap px-4 py-3 text-[12px] text-text-main ${column.numeric ? 'text-right font-mono' : ''}`}>
                      {column.key === 'relationalFlag' ? (
                        <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${formatFlag(row.relationalFlag)}`}>{row.relationalFlag}</span>
                      ) : column.key === 'issueStatus' ? (
                        <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${row.issueStatus === 'Reviewed' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{row.issueStatus}</span>
                      ) : (
                        column.value(row)
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex h-8 items-center rounded-[6px] border border-border-subtle bg-white px-3 text-[12px] font-medium text-text-main">
                      {row.matchedSku ? 'Published' : 'Audit only'}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={GOLD_STAGE_C_COLUMNS.length + 1} className="px-6 py-12 text-center text-[13px] text-text-muted">
                    No Gold Stage C records match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border-subtle px-5 py-4 text-[12px] text-text-muted">
          {filteredRows.length} of {rows.length} trusted demo records shown
        </div>
      </section>

      <details className="group overflow-hidden rounded-[10px] border border-border-subtle bg-white shadow-subtle">
        <summary className="flex cursor-pointer list-none items-center justify-between border-b border-transparent px-6 py-5 marker:content-none group-open:border-border-subtle">
          <div>
            <h3 className="text-[16px] font-semibold text-text-main">Gold Stage C schema</h3>
            <p className="mt-1 text-[12px] text-text-muted">Promoted transaction rows, matched SKU lineage, and Gold audit metadata.</p>
          </div>
          <ChevronDown className="h-5 w-5 text-text-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-bg">
                <th className="px-6 py-3 text-[12px] font-semibold uppercase text-text-muted">Group</th>
                <th className="px-6 py-3 text-[12px] font-semibold uppercase text-text-muted">CSV Column</th>
                <th className="px-6 py-3 text-[12px] font-semibold uppercase text-text-muted">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {[...TRANSACTION_COLUMNS, ...SKU_MATCH_COLUMNS, 'RELATIONAL_FLAG', 'ISSUE_STATUS', 'RESOLUTION', 'AUDIT_NOTE', 'RESOLVED_BY', 'RESOLVED_AT'].map(column => (
                <tr key={column}>
                  <td className="px-6 py-4 text-[12px] font-medium text-text-muted">
                    {TRANSACTION_COLUMNS.includes(column as (typeof TRANSACTION_COLUMNS)[number])
                      ? 'Transaction'
                      : SKU_MATCH_COLUMNS.includes(column as (typeof SKU_MATCH_COLUMNS)[number])
                        ? 'Matched SKU'
                        : 'Gold audit'}
                  </td>
                  <td className="px-6 py-4 font-mono text-[13px] text-text-main">{column}</td>
                  <td className="px-6 py-4 text-[13px] text-text-muted">
                    {column === 'RELATIONAL_FLAG' ? 'Stage C relational classification inherited from Silver.' :
                      column === 'ISSUE_STATUS' ? 'Silver review state retained for auditability.' :
                      column === 'RESOLUTION' ? 'Silver resolution outcome if one was applied.' :
                      column === 'AUDIT_NOTE' ? 'Human note attached during Stage C review.' :
                      column === 'RESOLVED_BY' ? 'Reviewer or upstream actor recorded for the row.' :
                      column === 'RESOLVED_AT' ? 'Timestamp when the Silver resolution was recorded.' :
                      'Promoted source column.'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
