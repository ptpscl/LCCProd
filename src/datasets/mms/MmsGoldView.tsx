import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Download,
  Info,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  MMS_DATA_RELIABILITY,
  MMS_GOLD_COUNTS,
  MMS_GOLD_DEMO_ROWS,
  MMS_GOLD_SCHEMA,
  MmsGoldRow,
} from './mmsGoldMockData';

export type MmsGoldColumnKey = keyof Omit<MmsGoldRow, 'id'>;
export type MmsGoldSortDirection = 'asc' | 'desc';

export interface MmsGoldFilters {
  origin: string;
  storeCode: string;
  transactionNumber: string;
  skuCode: string;
}

export interface MmsGoldSort {
  key: MmsGoldColumnKey;
  direction: MmsGoldSortDirection;
}

interface MmsGoldColumn {
  key: MmsGoldColumnKey;
  label: string;
  numeric?: boolean;
  align?: 'right';
}

export const MMS_GOLD_COLUMNS: MmsGoldColumn[] = [
  { key: 'date', label: 'Date' },
  { key: 'transactionNumber', label: 'Transaction Number', numeric: true },
  { key: 'registerNumber', label: 'Register Number', numeric: true },
  { key: 'storeCode', label: 'Store Code', numeric: true },
  { key: 'skuCode', label: 'SKU Code', numeric: true },
  { key: 'transactionType', label: 'Transaction Type' },
  { key: 'mmsSales', label: 'MMS Sales', numeric: true, align: 'right' },
  { key: 'quantitySold', label: 'Quantity Sold', numeric: true, align: 'right' },
  { key: 'margin', label: 'Margin', numeric: true, align: 'right' },
  { key: 'storeCategorization', label: 'Store Categorization' },
  { key: 'datasetOnlyAnomaly', label: 'Dataset-Only Anomaly' },
  { key: 'recordOrigin', label: 'Record Origin' },
  { key: 'silverResolution', label: 'Silver Resolution' },
  { key: 'resolvedBy', label: 'Resolved By' },
  { key: 'resolvedAt', label: 'Resolved At' },
  { key: 'goldRecordStatus', label: 'Gold Record Status' },
  { key: 'goldBatchId', label: 'Gold Batch ID' },
  { key: 'goldLoadedAt', label: 'Gold Loaded At' },
];

const COLUMN_BY_KEY = Object.fromEntries(MMS_GOLD_COLUMNS.map(column => [column.key, column])) as Record<MmsGoldColumnKey, MmsGoldColumn>;

export function filterAndSortMmsGoldRows(rows: MmsGoldRow[], filters: MmsGoldFilters, sort: MmsGoldSort | null): MmsGoldRow[] {
  const filtered = rows.filter(row => {
    if (filters.origin && row.recordOrigin !== filters.origin) return false;
    if (filters.storeCode && !row.storeCode.toLocaleLowerCase().includes(filters.storeCode.toLocaleLowerCase())) return false;
    if (filters.transactionNumber && !row.transactionNumber.toLocaleLowerCase().includes(filters.transactionNumber.toLocaleLowerCase())) return false;
    if (filters.skuCode && !row.skuCode.toLocaleLowerCase().includes(filters.skuCode.toLocaleLowerCase())) return false;
    return true;
  });

  if (!sort) return filtered;
  const column = COLUMN_BY_KEY[sort.key];
  const multiplier = sort.direction === 'asc' ? 1 : -1;
  return [...filtered].sort((left, right) => {
    const leftValue = left[sort.key];
    const rightValue = right[sort.key];
    if (column.numeric) return (Number(leftValue || 0) - Number(rightValue || 0)) * multiplier;
    return String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true, sensitivity: 'base' }) * multiplier;
  });
}

function csvCell(value: string | number): string {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export function createMmsGoldCsv(rows: MmsGoldRow[]): string {
  const header = MMS_GOLD_COLUMNS.map(column => csvCell(column.label)).join(',');
  const records = rows.map(row => MMS_GOLD_COLUMNS.map(column => csvCell(row[column.key])).join(','));
  return [header, ...records].join('\n');
}

function downloadCsv(rows: MmsGoldRow[], filename: string) {
  const url = URL.createObjectURL(new Blob([`\uFEFF${createMmsGoldCsv(rows)}`], { type: 'text/csv;charset=utf-8' }));
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

function renderCell(row: MmsGoldRow, column: MmsGoldColumn) {
  const value = row[column.key];
  if (column.key === 'mmsSales' || column.key === 'quantitySold' || column.key === 'margin') {
    return Number(value).toLocaleString(undefined, { maximumFractionDigits: 9 });
  }
  if (column.key === 'datasetOnlyAnomaly') {
    return <div className="flex max-w-[360px] flex-wrap gap-1.5">{row.datasetOnlyAnomaly.split('|').map(code => (
      <span key={code} className={`rounded-full px-2 py-1 text-[11px] font-medium ${code === 'NONE' ? 'bg-gray-100 text-gray-700' : 'bg-amber-100 text-amber-800'}`}>{code}</span>
    ))}</div>;
  }
  if (column.key === 'recordOrigin') {
    return <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${row.recordOrigin === 'Accepted resolution' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>{row.recordOrigin}</span>;
  }
  if (column.key === 'goldRecordStatus') {
    return <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${row.goldRecordStatus === 'CLEAN' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{row.goldRecordStatus}</span>;
  }
  if (column.key === 'resolvedAt' || column.key === 'goldLoadedAt') return formatTimestamp(String(value));
  return String(value || '—');
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="text-[12px] font-semibold text-text-muted">{label}<input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="mt-2 h-10 w-full rounded-[6px] border border-border-subtle px-3 text-[13px] font-normal text-text-main outline-none focus:border-[#B58A00]" /></label>;
}

export default function MmsGoldView() {
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [origin, setOrigin] = useState('');
  const [storeCode, setStoreCode] = useState('');
  const [transactionInput, setTransactionInput] = useState('');
  const [transactionNumber, setTransactionNumber] = useState('');
  const [skuCode, setSkuCode] = useState('');
  const [sort, setSort] = useState<MmsGoldSort | null>(null);

  const filters = useMemo<MmsGoldFilters>(() => ({ origin, storeCode, transactionNumber, skuCode }), [origin, skuCode, storeCode, transactionNumber]);
  const filteredRows = useMemo(() => filterAndSortMmsGoldRows(MMS_GOLD_DEMO_ROWS, filters, sort), [filters, sort]);

  const refresh = () => {
    setRefreshing(true);
    setLastUpdatedAt(new Date());
    window.setTimeout(() => setRefreshing(false), 350);
  };
  const clear = () => {
    setOrigin('');
    setStoreCode('');
    setTransactionInput('');
    setTransactionNumber('');
    setSkuCode('');
    setSort(null);
  };
  const toggleSort = (key: MmsGoldColumnKey) => setSort(current => {
    if (!current || current.key !== key) return { key, direction: 'asc' };
    if (current.direction === 'asc') return { key, direction: 'desc' };
    return null;
  });

  return <div className="space-y-6">
    <div className="flex items-center justify-between rounded-[8px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900"><span><strong>Gold prototype:</strong> trusted MMS records demonstrate clean and accepted Silver outputs.</span><span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold">Read-only demo</span></div>

    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 className="text-[18px] font-semibold text-text-main">Gold MMS Sales</h2><p className="mt-1 text-[13px] text-text-muted">Curated MMS transactions ready for reporting and downstream processing.</p><p className="mt-1 text-[11px] text-text-muted">Updated as of {lastUpdatedAt.toLocaleString()}</p></div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={refresh} className="inline-flex h-10 items-center rounded-[7px] border border-border-subtle bg-white px-4 text-[13px] font-semibold text-text-main hover:bg-surface-bg focus:outline-none focus:ring-2 focus:ring-[#B58A00]"><RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />Refresh</button>
        <button type="button" onClick={() => downloadCsv(MMS_GOLD_DEMO_ROWS, 'gold_mms_sales.csv')} className="inline-flex h-10 items-center rounded-[7px] bg-[#B58A00] px-4 text-[13px] font-semibold text-white hover:bg-[#987400] focus:outline-none focus:ring-2 focus:ring-[#B58A00]"><Download className="mr-2 h-4 w-4" aria-hidden="true" />Export Gold MMS CSV</button>
      </div>
    </div>

    <section className="rounded-[10px] border border-border-subtle bg-white p-6 shadow-subtle">
      <div className="mb-3 flex items-center justify-between gap-5">
        <div><div className="group relative inline-flex items-center gap-2"><h3 className="text-[13px] font-semibold uppercase tracking-wider text-text-muted">MMS Data Reliability</h3><button type="button" aria-describedby="mms-reliability-definition" className="rounded-full text-text-muted hover:text-text-main focus:outline-none focus:ring-2 focus:ring-brand-600"><Info className="h-4 w-4" aria-hidden="true" /></button><span id="mms-reliability-definition" role="tooltip" className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 w-[360px] max-w-[70vw] rounded-[6px] bg-gray-900 px-3 py-2 text-[11px] font-normal leading-4 text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">Automatically clean Silver MMS rows plus rows resolved as Accept as Valid, divided by the original Bronze MMS row count.</span></div><p className="mt-0.5 text-[12px] text-text-muted">Share of Bronze MMS rows that are clean or have completed review and are eligible for Gold.</p></div>
        <p className="text-[36px] font-bold text-green-700">{MMS_DATA_RELIABILITY.toFixed(2)}%</p>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full border border-border-subtle bg-surface-bg"><div className="h-full bg-green-600 transition-all duration-500" style={{ width: `${MMS_DATA_RELIABILITY}%` }} /></div>
      <p className="mt-2 text-[12px] text-text-muted">133,130 of 133,166 Bronze MMS rows verified · 36 rows remain blocked in Silver</p>
      <p className="mt-1 text-[11px] text-text-muted">(Clean from Silver + Accepted as Valid) / Original Bronze MMS rows · (133,129 + 1) / 133,166 = 99.97%</p>
    </section>

    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">{[
      ['Trusted MMS Transactions', MMS_GOLD_COUNTS.trusted, 'Eligible Gold MMS rows', 'text-text-main'],
      ['Clean from Silver', MMS_GOLD_COUNTS.cleanFromSilver, 'No anomaly review required', 'text-green-700'],
      ['Accepted from Silver', MMS_GOLD_COUNTS.acceptedFromSilver, 'Resolved as Accept as Valid', 'text-blue-700'],
      ['Still Blocked', MMS_GOLD_COUNTS.stillBlocked, 'Unresolved or excluded in Silver', 'text-amber-700'],
    ].map(([label, value, description, color]) => <div key={String(label)} className="rounded-[10px] border border-border-subtle bg-white p-6 shadow-subtle"><h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-text-muted">{label}</h3><p className={`text-[28px] font-bold ${color}`}>{Number(value).toLocaleString()}</p><p className="mt-1 text-[11px] text-text-muted">{description}</p></div>)}</div>

    <section className="rounded-[10px] border border-border-subtle bg-white p-5 shadow-subtle"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-[#B58A00]" aria-hidden="true" /><div><h3 className="text-[14px] font-semibold">Gold transaction priority</h3><p className="mt-1 text-[12px] text-text-muted">Accepted resolved record → clean Silver record → one trusted output per six-key MMS transaction line. Unresolved and excluded Silver rows never enter Gold.</p></div></div></section>

    <section className="grid items-end gap-4 rounded-[10px] border border-border-subtle bg-white p-5 shadow-subtle md:grid-cols-[1.1fr_1fr_1.4fr_1fr_auto]">
      <label className="text-[12px] font-semibold text-text-muted">Record Origin<select value={origin} onChange={event => setOrigin(event.target.value)} className="mt-2 h-10 w-full rounded-[6px] border border-border-subtle bg-white px-3 text-[13px] font-normal text-text-main outline-none focus:border-[#B58A00]"><option value="">All origins</option><option value="Clean from Silver">Clean from Silver</option><option value="Accepted resolution">Accepted resolution</option></select></label>
      <Input label="Store Code" value={storeCode} onChange={setStoreCode} placeholder="e.g. 417" />
      <label className="text-[12px] font-semibold text-text-muted">Transaction Number<div className="mt-2 flex"><input value={transactionInput} onChange={event => setTransactionInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') setTransactionNumber(transactionInput.trim()); }} className="h-10 w-full rounded-l-[6px] border border-border-subtle px-3 text-[13px] font-normal text-text-main outline-none focus:border-[#B58A00]" placeholder="Search transaction" /><button type="button" onClick={() => setTransactionNumber(transactionInput.trim())} aria-label="Apply transaction number filter" className="h-10 rounded-r-[6px] bg-[#B58A00] px-4 text-white hover:bg-[#987400] focus:outline-none focus:ring-2 focus:ring-[#B58A00]"><Search className="h-4 w-4" aria-hidden="true" /></button></div></label>
      <Input label="SKU Code" value={skuCode} onChange={setSkuCode} placeholder="e.g. 4455845" />
      <button type="button" onClick={clear} className="inline-flex h-10 items-center rounded-[6px] border border-border-subtle px-4 text-[13px] text-text-main hover:bg-surface-bg focus:outline-none focus:ring-2 focus:ring-[#B58A00]"><X className="mr-2 h-4 w-4" aria-hidden="true" />Clear</button>
    </section>

    <section className="overflow-hidden rounded-[10px] border border-border-subtle bg-white shadow-subtle">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-6 py-4"><div><h3 className="text-[15px] font-semibold text-text-main">Gold MMS records</h3><p className="mt-0.5 text-[12px] text-text-muted">Read-only Gold-eligible MMS transaction lines.</p></div><button type="button" onClick={() => downloadCsv(filteredRows, 'gold_mms_filtered_rows.csv')} className="inline-flex h-9 items-center rounded-[6px] border border-[#B58A00] bg-white px-4 text-[12px] font-semibold text-[#8A7526] hover:bg-gold-bg focus:outline-none focus:ring-2 focus:ring-[#B58A00]"><Download className="mr-2 h-4 w-4" aria-hidden="true" />Download filtered rows</button></div>
      <div className="overflow-x-auto"><table className="min-w-[2850px] w-full border-collapse text-left"><thead><tr className="border-b border-border-subtle bg-surface-bg">{MMS_GOLD_COLUMNS.map(column => {
        const activeSort = sort?.key === column.key ? sort.direction : null;
        return <th key={column.key} aria-sort={activeSort === 'asc' ? 'ascending' : activeSort === 'desc' ? 'descending' : 'none'} className={`whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted ${column.align === 'right' ? 'text-right' : ''}`}><button type="button" onClick={() => toggleSort(column.key)} aria-label={`Sort by ${column.label}${activeSort ? `, currently ${activeSort === 'asc' ? 'ascending' : 'descending'}` : ''}`} className={`inline-flex items-center gap-1 rounded-[4px] hover:text-text-main focus:outline-none focus:ring-2 focus:ring-[#B58A00] ${column.align === 'right' ? 'ml-auto' : ''}`}>{column.label}{activeSort === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-[#B58A00]" /> : activeSort === 'desc' ? <ArrowDown className="h-3.5 w-3.5 text-[#B58A00]" /> : <ArrowUpDown className="h-3.5 w-3.5" />}</button></th>;
      })}</tr></thead><tbody className="divide-y divide-border-subtle">{filteredRows.map(row => <tr key={row.id} className="hover:bg-surface-bg">{MMS_GOLD_COLUMNS.map(column => <td key={column.key} className={`whitespace-nowrap px-4 py-3 text-[12px] text-text-main ${column.align === 'right' ? 'text-right font-mono' : ''}`}>{renderCell(row, column)}</td>)}</tr>)}{filteredRows.length === 0 && <tr><td colSpan={MMS_GOLD_COLUMNS.length} className="px-6 py-12 text-center text-[13px] text-text-muted">No Gold MMS records match these filters.</td></tr>}</tbody></table></div>
      <div className="border-t border-border-subtle px-5 py-4 text-[12px] text-text-muted">{filteredRows.length} of {MMS_GOLD_DEMO_ROWS.length} trusted demo records shown</div>
    </section>

    <details className="group overflow-hidden rounded-[10px] border border-border-subtle bg-white shadow-subtle">
      <summary className="flex cursor-pointer list-none items-center justify-between border-b border-transparent px-6 py-5 marker:content-none group-open:border-border-subtle"><div><h3 className="text-[16px] font-semibold text-text-main">Gold schema</h3><p className="mt-1 text-[12px] text-text-muted">Retained MMS lineage and generated Gold audit fields.</p></div><ChevronDown className="h-5 w-5 text-text-muted transition-transform group-open:rotate-180" aria-hidden="true" /></summary>
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead><tr className="border-b border-border-subtle bg-surface-bg"><th className="px-6 py-3 text-[12px] font-semibold uppercase text-text-muted">Column</th><th className="px-6 py-3 text-[12px] font-semibold uppercase text-text-muted">Description</th></tr></thead><tbody className="divide-y divide-border-subtle">{MMS_GOLD_SCHEMA.map(([column, description]) => <tr key={column}><td className="px-6 py-4 font-mono text-[13px] text-text-main">{column}</td><td className="px-6 py-4 text-[13px] text-text-muted">{description}</td></tr>)}</tbody></table></div>
    </details>
  </div>;
}
