import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Download,
  Info,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { MMS_COLUMNS, STAGE_A_COLUMNS } from './stageBSilverMockData';
import {
  GOLD_MATCH_STATUS_PROFILE,
  GOLD_STAGE_B_COUNTS,
  GOLD_STAGE_B_DEMO_ROWS,
  GOLD_STAGE_B_EXPORT_COLUMNS,
  GOLD_STAGE_B_RELIABILITY,
  GoldStageBRow,
} from './stageBGoldMockData';

export type GoldStageBColumnKey =
  | 'date'
  | 'transactionNumber'
  | 'registerNumber'
  | 'storeCode'
  | 'customerNumber'
  | 'skuCode'
  | 'transactionType'
  | 'mmsSales'
  | 'loyaltySales'
  | 'matchStatus'
  | 'matchQuality'
  | 'recordOrigin'
  | 'goldRecordStatus';

export type GoldStageBSortDirection = 'asc' | 'desc';

export interface GoldStageBFilters {
  recordOrigin: string;
  matchStatus: string;
  matchQuality: string;
  storeCode: string;
  transactionNumber: string;
  registerNumber: string;
  customerNumber: string;
  skuCode: string;
  transactionType: string;
}

export interface GoldStageBSort {
  key: GoldStageBColumnKey;
  direction: GoldStageBSortDirection;
}

interface GoldStageBColumn {
  key: GoldStageBColumnKey;
  label: string;
  numeric?: boolean;
  align?: 'right';
  value: (row: GoldStageBRow) => string;
}

export const GOLD_STAGE_B_COLUMNS: GoldStageBColumn[] = [
  { key: 'date', label: 'Date', value: row => row.mms.DATE },
  { key: 'transactionNumber', label: 'Transaction Number', numeric: true, value: row => row.mms['TRANSACTION NUMBER'] },
  { key: 'registerNumber', label: 'Register Number', numeric: true, value: row => row.mms['REGISTER NUMBER'] },
  { key: 'storeCode', label: 'Store Code', numeric: true, value: row => row.mms['STORE CODE'] },
  { key: 'customerNumber', label: 'Customer Number', value: row => row.stageA.CUSTOMER_NUMBER },
  { key: 'skuCode', label: 'SKU Code', numeric: true, value: row => row.mms['SKU CODE'] },
  { key: 'transactionType', label: 'Transaction Type', value: row => row.mms['TRANSACTION TYPE'] },
  { key: 'mmsSales', label: 'MMS Sales', numeric: true, align: 'right', value: row => row.mms['MMS SALES'] },
  { key: 'loyaltySales', label: 'Loyalty Sales', numeric: true, align: 'right', value: row => row.stageA.LOYALTY_SALES },
  { key: 'matchStatus', label: 'MATCH_STATUS', value: row => row.matchStatus },
  { key: 'matchQuality', label: 'MATCH_QUALITY', value: row => row.matchQuality },
  { key: 'recordOrigin', label: 'Record Origin', value: row => row.recordOrigin },
  { key: 'goldRecordStatus', label: 'Gold Record Status', value: row => row.goldRecordStatus },
];

const COLUMN_BY_KEY = Object.fromEntries(
  GOLD_STAGE_B_COLUMNS.map(column => [column.key, column]),
) as Record<GoldStageBColumnKey, GoldStageBColumn>;

function includes(value: string, query: string): boolean {
  return value.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}

export function filterAndSortGoldStageBRows(
  rows: GoldStageBRow[],
  filters: GoldStageBFilters,
  sort: GoldStageBSort | null,
): GoldStageBRow[] {
  const filtered = rows.filter(row => {
    if (filters.recordOrigin && row.recordOrigin !== filters.recordOrigin) return false;
    if (filters.matchStatus && row.matchStatus !== filters.matchStatus) return false;
    if (filters.matchQuality && row.matchQuality !== filters.matchQuality) return false;
    if (filters.transactionType && row.mms['TRANSACTION TYPE'] !== filters.transactionType) return false;
    if (filters.storeCode && !includes(row.mms['STORE CODE'], filters.storeCode)) return false;
    if (filters.transactionNumber && !includes(row.mms['TRANSACTION NUMBER'], filters.transactionNumber)) return false;
    if (filters.registerNumber && !includes(row.mms['REGISTER NUMBER'], filters.registerNumber)) return false;
    if (filters.customerNumber && !includes(row.stageA.CUSTOMER_NUMBER, filters.customerNumber)) return false;
    if (filters.skuCode && !includes(row.mms['SKU CODE'], filters.skuCode)) return false;
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
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export function createGoldStageBCsv(rows: GoldStageBRow[]): string {
  const header = GOLD_STAGE_B_EXPORT_COLUMNS.map(column => csvCell(column.header)).join(',');
  const body = rows.map(row => GOLD_STAGE_B_EXPORT_COLUMNS.map(column => csvCell(column.value(row))).join(','));
  return [header, ...body].join('\n');
}

function downloadCsv(rows: GoldStageBRow[], filename: string) {
  const url = URL.createObjectURL(new Blob([`\uFEFF${createGoldStageBCsv(rows)}`], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function formatTimestamp(value: string): string {
  if (!value || value === '—') return '—';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function uniqueValues(value: (row: GoldStageBRow) => string): string[] {
  return [...new Set(GOLD_STAGE_B_DEMO_ROWS.map(value).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function MetricTooltip({ id, definition }: { id: string; definition: string }) {
  return (
    <span className="group relative inline-flex">
      <button type="button" aria-describedby={id} className="rounded-full text-text-muted hover:text-text-main focus:outline-none focus:ring-2 focus:ring-brand-600">
        <Info className="h-4 w-4" aria-hidden="true" />
      </button>
      <span id={id} role="tooltip" className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 w-[360px] max-w-[70vw] rounded-[6px] bg-gray-900 px-3 py-2 text-[11px] font-normal leading-4 text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {definition}
      </span>
    </span>
  );
}

function TextFilter({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="text-[12px] font-semibold text-text-muted">
      {label}
      <input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="mt-2 h-10 w-full rounded-[6px] border border-border-subtle px-3 text-[13px] font-normal text-text-main outline-none focus:border-[#B58A00]" />
    </label>
  );
}

function SelectFilter({ label, value, onChange, options, allLabel }: { label: string; value: string; onChange: (value: string) => void; options: string[]; allLabel: string }) {
  return (
    <label className="text-[12px] font-semibold text-text-muted">
      {label}
      <select value={value} onChange={event => onChange(event.target.value)} className="mt-2 h-10 w-full rounded-[6px] border border-border-subtle bg-white px-3 text-[13px] font-normal text-text-main outline-none focus:border-[#B58A00]">
        <option value="">{allLabel}</option>
        {options.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function DetailGroup({ title, fields }: { title: string; fields: Array<[string, string]> }) {
  return (
    <section className="overflow-hidden rounded-[10px] border border-border-subtle bg-white">
      <h3 className="border-b border-border-subtle bg-surface-bg px-5 py-3 text-[12px] font-semibold uppercase tracking-wider text-text-muted">{title}</h3>
      <dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
        {fields.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="break-words text-[11px] font-semibold uppercase tracking-wide text-text-muted">{label}</dt>
            <dd className="mt-1 break-words text-[13px] text-text-main">{value || '—'}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function GoldStageBDetails({ row, onClose }: { row: GoldStageBRow; onClose: () => void }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const reconciliationFields: Array<[string, string]> = [
    ['MATCH_STATUS', row.matchStatus],
    ['MATCH_QUALITY', row.matchQuality],
    ['BASE_CASE_MATCHING', row.baseCaseMatching],
    ['FINAL_MATCHING', row.finalMatching],
    ['detail', row.detail],
    ['has_anomaly_or_not', row.hasAnomalyOrNot],
    ['loyalty_customer_info_source', row.loyaltyCustomerInfoSource],
    ['STAGE_C_READINESS', row.stageCReadiness],
  ];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-3 sm:p-6" onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="gold-stage-b-details-title" className="flex max-h-[90vh] w-full max-w-[1480px] flex-col overflow-hidden rounded-[12px] bg-white shadow-xl" onMouseDown={event => event.stopPropagation()}>
        <header className="flex shrink-0 items-start justify-between gap-5 border-b border-border-subtle bg-white px-6 py-5">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2"><span className="rounded-full bg-gold-bg px-2 py-1 text-[11px] font-medium text-gold-text">Read-only Gold record</span><span className="text-[12px] text-text-muted">{row.goldBatchId}</span></div>
            <h2 id="gold-stage-b-details-title" className="text-[18px] font-semibold text-text-main">Gold Stage B record details</h2>
            <p className="mt-1 text-[12px] text-text-muted">Complete Stage B lineage and publication audit for transaction {row.mms['TRANSACTION NUMBER']}.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close Gold Stage B record details" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] text-text-muted hover:bg-surface-bg hover:text-text-main focus:outline-none focus:ring-2 focus:ring-brand-600"><X className="h-5 w-5" aria-hidden="true" /></button>
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-surface-bg p-5 sm:p-6">
          <DetailGroup title="Stage A — Customer and Loyalty" fields={STAGE_A_COLUMNS.map(column => [column, row.stageA[column] || ''])} />
          <DetailGroup title="MMS" fields={MMS_COLUMNS.map(column => [column, row.mms[column] || ''])} />
          <DetailGroup title="Reconciliation" fields={reconciliationFields} />
          <DetailGroup title="Dataset anomaly lineage" fields={[
            ['DATASET_ONLY_ANOMALY', row.datasetOnlyAnomaly],
          ]} />
          <DetailGroup title="Silver resolution audit" fields={[
            ['Issue Status', row.silverIssueStatus],
            ['Silver Resolution', row.silverResolution],
            ['Audit Note', row.silverAuditNote],
            ['Resolved By', row.resolvedBy],
            ['Resolved At', formatTimestamp(row.resolvedAt)],
          ]} />
          <DetailGroup title="Gold publication audit" fields={[
            ['Record Origin', row.recordOrigin],
            ['Gold Record Status', row.goldRecordStatus],
            ['Gold Batch ID', row.goldBatchId],
            ['Gold Loaded At', formatTimestamp(row.goldLoadedAt)],
          ]} />
        </div>
        <footer className="flex shrink-0 justify-end border-t border-border-subtle bg-white px-6 py-4">
          <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-[6px] border border-border-subtle bg-white px-4 text-[13px] font-medium text-text-main hover:bg-surface-bg focus:outline-none focus:ring-2 focus:ring-brand-600">Close</button>
        </footer>
      </section>
    </div>
  );
}

function renderMainCell(row: GoldStageBRow, column: GoldStageBColumn) {
  const value = column.value(row);
  if (column.key === 'mmsSales' || column.key === 'loyaltySales') {
    return value ? Number(value).toLocaleString(undefined, { maximumFractionDigits: 6 }) : '—';
  }
  if (column.key === 'recordOrigin') return <span className="rounded-full bg-green-100 px-2 py-1 text-[11px] font-medium text-green-800">{value}</span>;
  if (column.key === 'goldRecordStatus') return <span className="rounded-full bg-green-100 px-2 py-1 text-[11px] font-medium text-green-800">{value}</span>;
  return value || '—';
}

const EMPTY_FILTERS: GoldStageBFilters = {
  recordOrigin: '',
  matchStatus: '',
  matchQuality: '',
  storeCode: '',
  transactionNumber: '',
  registerNumber: '',
  customerNumber: '',
  skuCode: '',
  transactionType: '',
};

export default function StageBGoldView() {
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<GoldStageBFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<GoldStageBSort | null>(null);
  const [detailsRow, setDetailsRow] = useState<GoldStageBRow | null>(null);

  const filteredRows = useMemo(
    () => filterAndSortGoldStageBRows(GOLD_STAGE_B_DEMO_ROWS, filters, sort),
    [filters, sort],
  );
  const filterOptions = useMemo(() => ({
    recordOrigins: ['Clean from Silver', 'Accepted resolution'],
    matchStatuses: uniqueValues(row => row.matchStatus),
    matchQualities: uniqueValues(row => row.matchQuality),
    transactionTypes: uniqueValues(row => row.mms['TRANSACTION TYPE']),
  }), []);

  const setFilter = (key: keyof GoldStageBFilters, value: string) => setFilters(current => ({ ...current, [key]: value }));
  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSort(null);
  };
  const refresh = () => {
    setRefreshing(true);
    setLastUpdatedAt(new Date());
    window.setTimeout(() => setRefreshing(false), 350);
  };
  const toggleSort = (key: GoldStageBColumnKey) => setSort(current => {
    if (!current || current.key !== key) return { key, direction: 'asc' };
    if (current.direction === 'asc') return { key, direction: 'desc' };
    return null;
  });

  const profileTotals = GOLD_MATCH_STATUS_PROFILE.reduce((totals, item) => ({
    affected: totals.affected + item.affectedMmsRows,
    blocked: totals.blocked + (item.blockedInSilver || 0),
    published: totals.published + item.publishedToGold,
  }), { affected: 0, blocked: 0, published: 0 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-[8px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900"><span><strong>Gold prototype:</strong> trusted Stage B records demonstrate the read-only MMS-spine publication output.</span><span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold">Read-only demo</span></div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h2 className="text-[18px] font-semibold text-text-main">Gold Stage B Data</h2><p className="mt-1 text-[13px] text-text-muted">Trusted MMS-spine records enriched with Loyalty and Customer data.</p><p className="mt-1 text-[11px] text-text-muted">Updated as of {lastUpdatedAt.toLocaleString()}</p></div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={refresh} className="inline-flex h-10 items-center rounded-[7px] border border-border-subtle bg-white px-4 text-[13px] font-semibold text-text-main hover:bg-surface-bg focus:outline-none focus:ring-2 focus:ring-[#B58A00]"><RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />Refresh</button>
          <button type="button" onClick={() => downloadCsv(GOLD_STAGE_B_DEMO_ROWS, 'gold_stage_b.csv')} className="inline-flex h-10 items-center rounded-[7px] bg-[#B58A00] px-4 text-[13px] font-semibold text-white hover:bg-[#987400] focus:outline-none focus:ring-2 focus:ring-[#B58A00]"><Download className="mr-2 h-4 w-4" aria-hidden="true" />Export Gold Stage B CSV</button>
        </div>
      </div>

      <section className="rounded-[10px] border border-border-subtle bg-white p-6 shadow-subtle">
        <div className="mb-3 flex items-center justify-between gap-5">
          <div><div className="inline-flex items-center gap-2"><h3 className="text-[13px] font-semibold uppercase tracking-wider text-text-muted">STAGE B DATA RELIABILITY</h3><MetricTooltip id="gold-stage-b-reliability-definition" definition="Clean Silver Stage B MMS-spine rows plus rows resolved as Accept as Valid, divided by the total Stage B MMS rows checked. Full-audit and Loyalty-only records are not included in this denominator." /></div><p className="mt-0.5 text-[12px] text-text-muted">Share of Stage B MMS-spine rows that are clean or accepted and eligible for Gold.</p></div>
          <p className="text-[36px] font-bold text-green-700">{GOLD_STAGE_B_RELIABILITY.toFixed(2)}%</p>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full border border-border-subtle bg-surface-bg"><div className="h-full bg-green-600 transition-all duration-500" style={{ width: `${GOLD_STAGE_B_RELIABILITY}%` }} /></div>
        <p className="mt-2 text-[12px] text-text-muted">133,157 of 133,166 Stage B MMS rows verified · 9 rows remain blocked in Silver</p>
        <p className="mt-1 text-[11px] text-text-muted">133,157 / 133,166 = 99.99%</p>
      </section>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">{[
        ['TRUSTED STAGE B RECORDS', GOLD_STAGE_B_COUNTS.trusted, 'Published MMS-spine rows', 'text-text-main'],
        ['CLEAN FROM SILVER', GOLD_STAGE_B_COUNTS.cleanFromSilver, 'No review required', 'text-green-700'],
        ['ACCEPTED FROM SILVER', GOLD_STAGE_B_COUNTS.acceptedFromSilver, 'Resolved as Accept as Valid', 'text-blue-700'],
        ['STILL BLOCKED', GOLD_STAGE_B_COUNTS.stillBlocked, 'Unresolved or excluded', 'text-amber-700'],
      ].map(([label, value, description, color]) => <div key={String(label)} className="rounded-[10px] border border-border-subtle bg-white p-6 shadow-subtle"><h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-text-muted">{label}</h3><p className={`text-[28px] font-bold ${color}`}>{Number(value).toLocaleString()}</p><p className="mt-1 text-[11px] text-text-muted">{description}</p></div>)}</div>

      <section className="rounded-[10px] border border-border-subtle bg-white p-5 shadow-subtle"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-[#B58A00]" aria-hidden="true" /><div><h3 className="text-[14px] font-semibold">Gold Stage B publication rule</h3><p className="mt-1 text-[12px] leading-5 text-text-muted">Accepted resolved record → clean Silver Stage B record → one trusted output per MMS transaction line. Unresolved and excluded rows never enter Gold. Loyalty-only differences remain in the Silver audit and do not create Gold MMS-spine rows.</p></div></div></section>

      <section className="overflow-hidden rounded-[10px] border border-border-subtle bg-white shadow-subtle">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border-subtle px-6 py-5"><div><h3 className="text-[16px] font-semibold text-text-main">Gold Reconciliation Profile</h3><p className="mt-1 text-[12px] text-text-muted">Read-only publication totals based on the Silver Stage B MATCH_STATUS groups.</p></div><span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800">Provisional frontend data</span></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left"><thead><tr className="border-b border-border-subtle bg-surface-bg"><th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">MATCH_STATUS</th><th className="px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">Affected MMS Rows</th><th className="px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">Blocked in Silver</th><th className="px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">Published to Gold</th></tr></thead>
          <tbody className="divide-y divide-border-subtle">{GOLD_MATCH_STATUS_PROFILE.map(item => {
            const tooltipId = `gold-match-status-${item.status.toLocaleLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`;
            return <tr key={item.status} className="hover:bg-surface-bg"><td className="px-6 py-4"><div className="inline-flex items-center gap-2"><span className="text-[13px] font-semibold text-text-main">{item.status}</span><MetricTooltip id={tooltipId} definition={item.definition} /></div></td><td className="px-6 py-4 text-right text-[13px] font-medium text-text-main">{item.affectedMmsRows.toLocaleString()}</td><td className="px-6 py-4 text-right text-[13px] font-medium text-text-main">{item.blockedInSilver === null ? <span className="text-text-muted">Not included</span> : item.blockedInSilver.toLocaleString()}</td><td className="px-6 py-4 text-right text-[13px] font-medium text-text-main">{item.publishedToGold.toLocaleString()}</td></tr>;
          })}</tbody>
          <tfoot><tr className="border-t-2 border-border-subtle bg-surface-bg"><th className="px-6 py-4 text-[13px] font-semibold text-text-main">MMS total</th><td className="px-6 py-4 text-right text-[13px] font-bold text-text-main">{profileTotals.affected.toLocaleString()}</td><td className="px-6 py-4 text-right text-[13px] font-bold text-text-main">{profileTotals.blocked.toLocaleString()}</td><td className="px-6 py-4 text-right text-[13px] font-bold text-green-700">{profileTotals.published.toLocaleString()}</td></tr></tfoot>
        </table></div>
        <p className="border-t border-border-subtle px-6 py-4 text-[12px] text-text-muted">28 Loyalty-only differences remain in the Silver reconciliation audit and are not included in the MMS-spine Gold output.</p>
      </section>

      <section className="rounded-[10px] border border-border-subtle bg-white p-5 shadow-subtle">
        <div className="grid items-end gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SelectFilter label="Record Origin" value={filters.recordOrigin} onChange={value => setFilter('recordOrigin', value)} options={filterOptions.recordOrigins} allLabel="All origins" />
          <SelectFilter label="MATCH_STATUS" value={filters.matchStatus} onChange={value => setFilter('matchStatus', value)} options={filterOptions.matchStatuses} allLabel="All match statuses" />
          <SelectFilter label="MATCH_QUALITY" value={filters.matchQuality} onChange={value => setFilter('matchQuality', value)} options={filterOptions.matchQualities} allLabel="All match qualities" />
          <TextFilter label="Store Code" value={filters.storeCode} onChange={value => setFilter('storeCode', value)} placeholder="e.g. 417" />
          <TextFilter label="Transaction Number" value={filters.transactionNumber} onChange={value => setFilter('transactionNumber', value)} placeholder="Search transaction" />
          <TextFilter label="Register Number" value={filters.registerNumber} onChange={value => setFilter('registerNumber', value)} placeholder="e.g. 13" />
          <TextFilter label="Customer Number" value={filters.customerNumber} onChange={value => setFilter('customerNumber', value)} placeholder="Search customer" />
          <TextFilter label="SKU Code" value={filters.skuCode} onChange={value => setFilter('skuCode', value)} placeholder="Search SKU" />
          <SelectFilter label="Transaction Type" value={filters.transactionType} onChange={value => setFilter('transactionType', value)} options={filterOptions.transactionTypes} allLabel="All transaction types" />
          <button type="button" onClick={clearFilters} className="inline-flex h-10 items-center justify-center rounded-[6px] border border-border-subtle px-4 text-[13px] text-text-main hover:bg-surface-bg focus:outline-none focus:ring-2 focus:ring-[#B58A00]"><X className="mr-2 h-4 w-4" aria-hidden="true" />Clear</button>
        </div>
      </section>

      <section className="overflow-hidden rounded-[10px] border border-border-subtle bg-white shadow-subtle">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-6 py-4"><div><h3 className="text-[15px] font-semibold text-text-main">Gold Stage B records</h3><p className="mt-0.5 text-[12px] text-text-muted">Read-only Gold-eligible MMS-spine rows only.</p></div><button type="button" onClick={() => downloadCsv(filteredRows, 'gold_stage_b_filtered_rows.csv')} className="inline-flex h-9 items-center rounded-[6px] border border-[#B58A00] bg-white px-4 text-[12px] font-semibold text-[#8A7526] hover:bg-gold-bg focus:outline-none focus:ring-2 focus:ring-[#B58A00]"><Download className="mr-2 h-4 w-4" aria-hidden="true" />Download filtered rows</button></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[2350px] border-collapse text-left"><thead><tr className="border-b border-border-subtle bg-surface-bg">{GOLD_STAGE_B_COLUMNS.map(column => {
          const activeSort = sort?.key === column.key ? sort.direction : null;
          return <th key={column.key} aria-sort={activeSort === 'asc' ? 'ascending' : activeSort === 'desc' ? 'descending' : 'none'} className={`whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted ${column.align === 'right' ? 'text-right' : ''}`}><button type="button" onClick={() => toggleSort(column.key)} aria-label={`Sort by ${column.label}${activeSort ? `, currently ${activeSort === 'asc' ? 'ascending' : 'descending'}` : ''}`} className={`inline-flex items-center gap-1 rounded-[4px] hover:text-text-main focus:outline-none focus:ring-2 focus:ring-[#B58A00] ${column.align === 'right' ? 'ml-auto' : ''}`}>{column.label}{activeSort === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-[#B58A00]" aria-hidden="true" /> : activeSort === 'desc' ? <ArrowDown className="h-3.5 w-3.5 text-[#B58A00]" aria-hidden="true" /> : <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />}</button></th>;
        })}<th className="whitespace-nowrap px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">Action</th></tr></thead>
          <tbody className="divide-y divide-border-subtle">{filteredRows.map(row => <tr key={row.id} className="hover:bg-surface-bg">{GOLD_STAGE_B_COLUMNS.map(column => <td key={column.key} className={`max-w-[320px] whitespace-nowrap px-4 py-3 text-[12px] text-text-main ${column.align === 'right' ? 'text-right font-mono' : ''}`}>{renderMainCell(row, column)}</td>)}<td className="px-4 py-3 text-right"><button type="button" onClick={() => setDetailsRow(row)} className="inline-flex h-8 items-center rounded-[6px] border border-border-subtle bg-white px-3 text-[12px] font-medium text-text-main hover:bg-surface-bg focus:outline-none focus:ring-2 focus:ring-[#B58A00]">View Details</button></td></tr>)}{filteredRows.length === 0 && <tr><td colSpan={GOLD_STAGE_B_COLUMNS.length + 1} className="px-6 py-12 text-center text-[13px] text-text-muted">No Gold Stage B records match these filters.</td></tr>}</tbody>
        </table></div>
        <div className="border-t border-border-subtle px-5 py-4 text-[12px] text-text-muted">{filteredRows.length} of {GOLD_STAGE_B_DEMO_ROWS.length} trusted demo records shown</div>
      </section>

      <details className="group overflow-hidden rounded-[10px] border border-border-subtle bg-white shadow-subtle">
        <summary className="flex cursor-pointer list-none items-center justify-between border-b border-transparent px-6 py-5 marker:content-none group-open:border-border-subtle"><div><h3 className="text-[16px] font-semibold text-text-main">Gold Stage B schema</h3><p className="mt-1 text-[12px] text-text-muted">Complete retained Stage A, MMS, reconciliation, Silver audit, and Gold publication schema.</p></div><ChevronDown className="h-5 w-5 text-text-muted transition-transform group-open:rotate-180" aria-hidden="true" /></summary>
        <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left"><thead><tr className="border-b border-border-subtle bg-surface-bg"><th className="px-6 py-3 text-[12px] font-semibold uppercase text-text-muted">Group</th><th className="px-6 py-3 text-[12px] font-semibold uppercase text-text-muted">CSV Column</th><th className="px-6 py-3 text-[12px] font-semibold uppercase text-text-muted">Description</th></tr></thead><tbody className="divide-y divide-border-subtle">{GOLD_STAGE_B_EXPORT_COLUMNS.map(column => <tr key={column.header}><td className="px-6 py-4 text-[12px] font-medium text-text-muted">{column.group}</td><td className="px-6 py-4 font-mono text-[13px] text-text-main">{column.header}</td><td className="px-6 py-4 text-[13px] text-text-muted">{column.description}</td></tr>)}</tbody></table></div>
      </details>

      {detailsRow && <GoldStageBDetails row={detailsRow} onClose={() => setDetailsRow(null)} />}
    </div>
  );
}
