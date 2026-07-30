import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, Download, Info, RefreshCw, ShieldCheck, X } from 'lucide-react';
import {
  CUSTOMER_COLUMNS,
  createStageARows,
  getStageARelationalFlags,
  LOYALTY_COLUMNS,
  STAGE_A_ANOMALY_SUMMARY,
  STAGE_A_ROWS_CHECKED,
  STAGE_A_RULE_HITS,
  StageARow,
} from './stageASilverMockData';

type GoldStageAColumnKey =
  | 'date'
  | 'transactionNumber'
  | 'registerNumber'
  | 'storeCode'
  | 'customerNumber'
  | 'skuCode'
  | 'transactionType'
  | 'loyaltySales'
  | 'qtySold'
  | 'matchStatus'
  | 'datasetAnomaly'
  | 'resolution'
  | 'readyForStageB';

type GoldStageASortDirection = 'asc' | 'desc';

interface GoldStageASort {
  key: GoldStageAColumnKey;
  direction: GoldStageASortDirection;
}

interface GoldStageAColumn {
  key: GoldStageAColumnKey;
  label: string;
  numeric?: boolean;
  align?: 'right';
  value: (row: StageARow) => string;
}

const GOLD_STAGE_A_COLUMNS: GoldStageAColumn[] = [
  { key: 'date', label: 'Date', value: row => row.loyalty.DATE },
  { key: 'transactionNumber', label: 'Transaction Number', numeric: true, value: row => row.loyalty['TRANSACTION NUMBER'] },
  { key: 'registerNumber', label: 'Register Number', numeric: true, value: row => row.loyalty['REGISTER NUMBER'] },
  { key: 'storeCode', label: 'Store Code', numeric: true, value: row => row.loyalty['STORE CODE'] },
  { key: 'customerNumber', label: 'Customer Number', value: row => row.loyalty['CUSTOMER NUMBER'] || row.customer['CUSTOMER NUMBER'] || '' },
  { key: 'skuCode', label: 'SKU Code', numeric: true, value: row => row.loyalty['SKU CODE'] },
  { key: 'transactionType', label: 'Transaction Type', value: row => row.loyalty['TRANSACTION TYPE'] },
  { key: 'loyaltySales', label: 'Loyalty Sales', numeric: true, align: 'right', value: row => row.loyalty['LOYALTY SALES'] },
  { key: 'qtySold', label: 'Qty Sold', numeric: true, align: 'right', value: row => row.loyalty['QTY SOLD'] },
  { key: 'matchStatus', label: 'MATCH_STATUS', value: row => row.matchStatus },
  { key: 'datasetAnomaly', label: 'DATASET_ANOMALY', value: row => row.datasetAnomaly },
  { key: 'resolution', label: 'Resolution', value: row => row.resolution || '' },
  { key: 'readyForStageB', label: 'Ready', value: row => row.readyForStageB },
];

const COLUMN_BY_KEY = Object.fromEntries(GOLD_STAGE_A_COLUMNS.map(column => [column.key, column])) as Record<GoldStageAColumnKey, GoldStageAColumn>;

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function includes(value: string, query: string): boolean {
  return value.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}

function downloadCsv(rows: StageARow[], filename: string) {
  const headers = [...LOYALTY_COLUMNS, ...CUSTOMER_COLUMNS.map(value => `CLD_${value}`), 'MATCH_STATUS', 'DATASET_ANOMALY', 'DETAIL', 'ISSUE_STATUS', 'RESOLUTION', 'READY_FOR_STAGE_B', 'AUDIT_NOTE'];
  const records = rows.map(row => [
    ...LOYALTY_COLUMNS.map(key => row.loyalty[key] || ''),
    ...CUSTOMER_COLUMNS.map(key => row.customer[key] || ''),
    row.matchStatus,
    getStageARelationalFlags(row),
    row.detail,
    row.issueStatus,
    row.resolution || '',
    row.readyForStageB,
    row.auditNote || '',
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

function formatTimestamp(value?: string): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
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

function DetailGroup({ title, fields }: { title: string; fields: Array<[string, string]> }) {
  return (
    <section className="overflow-hidden rounded-[10px] border border-border-subtle bg-white">
      <h3 className="border-b border-border-subtle bg-surface-bg px-5 py-3 text-[12px] font-semibold uppercase tracking-wider text-text-muted">{title}</h3>
      <dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{label}</dt>
            <dd className="mt-1 break-words text-[13px] text-text-main">{value || '—'}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function GoldStageADetails({ row, onClose }: { row: StageARow; onClose: () => void }) {
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

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-3 sm:p-6" onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="gold-stage-a-details-title" className="flex max-h-[90vh] w-full max-w-[1480px] flex-col overflow-hidden rounded-[12px] bg-white shadow-xl" onMouseDown={event => event.stopPropagation()}>
        <header className="flex shrink-0 items-start justify-between gap-5 border-b border-border-subtle bg-white px-6 py-5">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-gold-bg px-2 py-1 text-[11px] font-medium text-gold-text">Read-only Gold record</span>
              <span className="text-[12px] text-text-muted">{row.id}</span>
            </div>
            <h2 id="gold-stage-a-details-title" className="text-[18px] font-semibold text-text-main">Gold Stage A record details</h2>
            <p className="mt-1 text-[12px] text-text-muted">Promoted customer + loyalty lineage for transaction {row.loyalty['TRANSACTION NUMBER']}.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close Gold Stage A record details" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] text-text-muted hover:bg-surface-bg hover:text-text-main focus:outline-none focus:ring-2 focus:ring-brand-600">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-surface-bg p-5 sm:p-6">
          <DetailGroup title="Stage A - Loyalty" fields={LOYALTY_COLUMNS.map(column => [column, row.loyalty[column] || ''])} />
          <DetailGroup title="Customer Database" fields={CUSTOMER_COLUMNS.map(column => [column, row.customer[column] || ''])} />
          <DetailGroup title="Gold lineage" fields={[
            ['MATCH_STATUS', row.matchStatus],
            ['DATASET_ANOMALY', getStageARelationalFlags(row)],
            ['detail', row.detail],
            ['READY_FOR_STAGE_B', row.readyForStageB],
          ]} />
          <DetailGroup title="Publication audit" fields={[
            ['Issue Status', row.issueStatus],
            ['Resolution', row.resolution || '—'],
            ['Audit Note', row.auditNote || '—'],
            ['Resolved By', row.resolvedBy || '—'],
            ['Resolved At', formatTimestamp(row.resolvedAt)],
          ]} />
        </div>
        <footer className="flex shrink-0 justify-end border-t border-border-subtle bg-white px-6 py-4">
          <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-[6px] border border-border-subtle bg-white px-4 text-[13px] font-medium text-text-main hover:bg-surface-bg focus:outline-none focus:ring-2 focus:ring-brand-600">
            Close
          </button>
        </footer>
      </section>
    </div>
  );
}

function renderCell(row: StageARow, column: GoldStageAColumn) {
  const value = column.value(row);
  if (column.key === 'loyaltySales' || column.key === 'qtySold') return value ? Number(value).toLocaleString(undefined, { maximumFractionDigits: 6 }) : '—';
  if (column.key === 'readyForStageB') return <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${value === 'READY' ? 'bg-green-100 text-green-800' : value === 'EXCLUDED' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{value}</span>;
  if (column.key === 'datasetAnomaly') return <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${value === 'NONE' ? 'bg-gray-100 text-gray-700' : 'bg-amber-100 text-amber-800'}`}>{value}</span>;
  if (column.key === 'resolution') return value || '—';
  return value || '—';
}

const EMPTY_FILTERS = {
  matchStatus: '',
  anomaly: '',
  storeCode: '',
  transactionNumber: '',
  customerNumber: '',
  skuCode: '',
  transactionType: '',
};

export default function StageAGoldView() {
  const [rows] = useState(createStageARows);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sort, setSort] = useState<GoldStageASort | null>(null);
  const [detailsRow, setDetailsRow] = useState<StageARow | null>(null);

  const filteredRows = useMemo(() => {
    const result = rows.filter(row => {
      if (filters.matchStatus && row.matchStatus !== filters.matchStatus) return false;
      if (filters.anomaly && row.datasetAnomaly !== filters.anomaly && !row.datasetAnomaly.split('|').includes(filters.anomaly)) return false;
      if (filters.storeCode && !includes(row.loyalty['STORE CODE'], filters.storeCode)) return false;
      if (filters.transactionNumber && !includes(row.loyalty['TRANSACTION NUMBER'], filters.transactionNumber)) return false;
      if (filters.customerNumber && !includes(row.loyalty['CUSTOMER NUMBER'], filters.customerNumber) && !includes(row.customer['CUSTOMER NUMBER'] || '', filters.customerNumber)) return false;
      if (filters.skuCode && !includes(row.loyalty['SKU CODE'], filters.skuCode)) return false;
      if (filters.transactionType && row.loyalty['TRANSACTION TYPE'] !== filters.transactionType) return false;
      return true;
    });

    if (!sort) return result;
    const column = COLUMN_BY_KEY[sort.key];
    const multiplier = sort.direction === 'asc' ? 1 : -1;
    return [...result].sort((left, right) => {
      const leftValue = column.value(left);
      const rightValue = column.value(right);
      if (column.numeric) return (Number(leftValue || 0) - Number(rightValue || 0)) * multiplier;
      return leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: 'base' }) * multiplier;
    });
  }, [filters, rows, sort]);

  const readyCount = rows.filter(row => row.readyForStageB === 'READY').length;
  const reviewedCount = rows.filter(row => row.issueStatus === 'Reviewed').length;
  const pendingCount = rows.filter(row => row.issueStatus === 'For review').length;
  const anomaliesCount = rows.filter(row => row.datasetAnomaly !== 'NONE').length;

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSort(null);
  };

  const refresh = () => {
    setRefreshing(true);
    setLastUpdatedAt(new Date());
    window.setTimeout(() => setRefreshing(false), 350);
  };

  const toggleSort = (key: GoldStageAColumnKey) => setSort(current => {
    if (!current || current.key !== key) return { key, direction: 'asc' };
    if (current.direction === 'asc') return { key, direction: 'desc' };
    return null;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[18px] font-semibold text-text-main">Gold Stage A Data</h2>
            <span className="rounded-full bg-gold-bg px-2 py-1 text-[11px] font-medium text-gold-text">Read-only demo</span>
          </div>
          <p className="mt-1 text-[13px] text-text-muted">Customer Database + Loyalty Sales promoted from Silver Stage A.</p>
          <p className="mt-1 text-[11px] text-text-muted">Updated as of {lastUpdatedAt.toLocaleString()}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={refresh} className="inline-flex h-9 items-center justify-center rounded-[6px] border border-border-subtle bg-white px-4 text-[13px] font-medium text-text-main hover:bg-surface-bg focus:outline-none focus:ring-2 focus:ring-brand-600">
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </button>
          <button type="button" onClick={() => downloadCsv(rows, 'stage_a_gold.csv')} className="inline-flex h-9 items-center justify-center rounded-[6px] bg-[#B58A00] px-4 text-[13px] font-medium text-white hover:bg-[#987400] focus:outline-none focus:ring-2 focus:ring-[#B58A00]">
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            Export Gold CSV
          </button>
        </div>
      </div>

      <section className="rounded-[10px] border border-border-subtle bg-white p-6 shadow-subtle">
        <div className="mb-3 flex items-center justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2">
              <h3 className="text-[13px] font-semibold uppercase tracking-wider text-text-muted">Stage A data reliability</h3>
              <MetricTooltip id="stage-a-gold-reliability" definition="Gold Stage A promoted rows are the Silver Stage A outputs accepted for downstream use. Review rows remain in the lineage audit but are not excluded from the read-only Gold view unless explicitly excluded." />
            </div>
            <p className="mt-0.5 text-[12px] text-text-muted">Customer Database + Loyalty Sales records ready for downstream extraction.</p>
          </div>
          <p className="text-[36px] font-bold text-[#8A7526]">{((readyCount / rows.length) * 100).toFixed(2)}%</p>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full border border-border-subtle bg-surface-bg">
          <div className="h-full bg-[#B58A00] transition-all duration-500" style={{ width: `${(readyCount / rows.length) * 100}%` }} />
        </div>
        <p className="mt-2 text-[12px] text-text-muted">{readyCount.toLocaleString()} of {rows.length.toLocaleString()} rows ready for Stage B · {pendingCount.toLocaleString()} still pending review in Silver</p>
        <p className="mt-1 text-[11px] text-text-muted">{readyCount} / {rows.length} = {((readyCount / rows.length) * 100).toFixed(2)}%</p>
      </section>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {[
          ['Trusted Stage A Records', readyCount, 'Published customer + loyalty rows', 'text-text-main'],
          ['Reviewed in Silver', reviewedCount, 'Accepted or excluded decisions', 'text-green-700'],
          ['Rows for Review', pendingCount, 'Still unresolved in Silver', 'text-amber-700'],
          ['Relational Flags', anomaliesCount, 'Rows with lineage issues', 'text-[#8A7526]'],
        ].map(([label, value, description, color]) => (
          <div key={String(label)} className="rounded-[10px] border border-border-subtle bg-white p-6 shadow-subtle">
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-text-muted">{label}</h3>
            <p className={`text-[28px] font-bold ${color}`}>{Number(value).toLocaleString()}</p>
            <p className="mt-1 text-[11px] text-text-muted">{description}</p>
          </div>
        ))}
      </div>

      <section className="rounded-[10px] border border-border-subtle bg-white p-5 shadow-subtle">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-[#B58A00]" aria-hidden="true" />
          <div>
            <h3 className="text-[14px] font-semibold text-text-main">Gold Stage A promotion rule</h3>
            <p className="mt-1 text-[12px] leading-5 text-text-muted">Accepted resolved record → clean Silver Stage A record → one trusted output per Customer Database + Loyalty Sales transaction line. Unresolved and excluded rows remain in the Silver audit trail and do not enter Gold as published data.</p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[10px] border border-border-subtle bg-white shadow-subtle">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border-subtle px-6 py-5">
          <div>
            <h3 className="text-[16px] font-semibold text-text-main">Gold promotion profile</h3>
            <p className="mt-1 text-[12px] text-text-muted">Read-only publication totals based on the Silver Stage A match outcomes.</p>
          </div>
          <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800">Provisional frontend data</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-bg">
                <th className="px-6 py-3 text-[12px] font-semibold uppercase tracking-wider text-text-muted">MATCH_STATUS</th>
                <th className="px-6 py-3 text-right text-[12px] font-semibold uppercase tracking-wider text-text-muted">Rows</th>
                <th className="px-6 py-3 text-right text-[12px] font-semibold uppercase tracking-wider text-text-muted">Ready for Gold</th>
                <th className="px-6 py-3 text-right text-[12px] font-semibold uppercase tracking-wider text-text-muted">For Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {STAGE_A_RELATIONAL_FLAG_SUMMARY.map(item => {
                const groupRows = rows.filter(row => row.datasetAnomaly.split('|').includes(item.anomaly));
                const ready = groupRows.filter(row => row.readyForStageB === 'READY').length;
                const pending = groupRows.filter(row => row.issueStatus === 'For review').length;
                const tooltipId = `stage-a-${item.anomaly.toLowerCase().replaceAll('_', '-')}`;
                return (
                  <tr key={item.anomaly} className="hover:bg-surface-bg">
                    <td className="px-6 py-4">
                      <div className="inline-flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-text-main">{item.anomaly}</span>
                        <MetricTooltip id={tooltipId} definition={item.definition} />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-[13px] font-medium text-text-main">{item.affected?.toLocaleString() ?? 'Pending baseline'}</td>
                    <td className="px-6 py-4 text-right text-[13px] font-medium text-green-700">{ready.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-[13px] font-medium text-amber-700">{pending.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border-subtle bg-surface-bg">
                <th className="px-6 py-4 text-[13px] font-semibold text-text-main">Stage A total</th>
                <td className="px-6 py-4 text-right text-[13px] font-bold text-text-main">{STAGE_A_ROWS_CHECKED.toLocaleString()}</td>
                <td className="px-6 py-4 text-right text-[13px] font-bold text-green-700">{readyCount.toLocaleString()}</td>
                <td className="px-6 py-4 text-right text-[13px] font-bold text-amber-700">{pendingCount.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="border-t border-border-subtle px-6 py-4 text-[12px] text-text-muted">{STAGE_A_RULE_HITS.toLocaleString()} Stage A rule hits remain tracked in Silver; Gold only carries the promoted customer + loyalty output.</p>
      </section>

      <section className="rounded-[10px] border border-border-subtle bg-white p-5 shadow-subtle">
        <div className="grid items-end gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="text-[12px] font-semibold text-text-muted">
            MATCH_STATUS
            <select value={filters.matchStatus} onChange={event => setFilters(current => ({ ...current, matchStatus: event.target.value }))} className="mt-2 h-10 w-full rounded-[6px] border border-border-subtle bg-white px-3 text-[13px] font-normal text-text-main outline-none focus:border-[#B58A00]">
              <option value="">All statuses</option>
              <option value="MATCHED">MATCHED</option>
              <option value="UNMATCHED_CUSTOMER">UNMATCHED_CUSTOMER</option>
              <option value="MISSING_CUSTOMER_NUMBER">MISSING_CUSTOMER_NUMBER</option>
              <option value="DUPLICATE_CUSTOMER_MATCH">DUPLICATE_CUSTOMER_MATCH</option>
            </select>
          </label>
          <label className="text-[12px] font-semibold text-text-muted">
            DATASET_ANOMALY
            <select value={filters.anomaly} onChange={event => setFilters(current => ({ ...current, anomaly: event.target.value }))} className="mt-2 h-10 w-full rounded-[6px] border border-border-subtle bg-white px-3 text-[13px] font-normal text-text-main outline-none focus:border-[#B58A00]">
              <option value="">All anomalies</option>
              {STAGE_A_ANOMALY_SUMMARY.map(item => <option key={item.anomaly} value={item.anomaly}>{item.anomaly}</option>)}
            </select>
          </label>
          <label className="text-[12px] font-semibold text-text-muted">
            Customer Number
            <input value={filters.customerNumber} onChange={event => setFilters(current => ({ ...current, customerNumber: event.target.value }))} placeholder="Search customer" className="mt-2 h-10 w-full rounded-[6px] border border-border-subtle px-3 text-[13px] font-normal text-text-main outline-none focus:border-[#B58A00]" />
          </label>
          <label className="text-[12px] font-semibold text-text-muted">
            Transaction Number
            <input value={filters.transactionNumber} onChange={event => setFilters(current => ({ ...current, transactionNumber: event.target.value }))} placeholder="Search transaction" className="mt-2 h-10 w-full rounded-[6px] border border-border-subtle px-3 text-[13px] font-normal text-text-main outline-none focus:border-[#B58A00]" />
          </label>
          <button type="button" onClick={clearFilters} className="inline-flex h-10 items-center justify-center rounded-[6px] border border-border-subtle px-4 text-[13px] text-text-main hover:bg-surface-bg focus:outline-none focus:ring-2 focus:ring-[#B58A00]">
            <X className="mr-2 h-4 w-4" aria-hidden="true" />
            Clear
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-[10px] border border-border-subtle bg-white shadow-subtle">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-6 py-4">
          <div>
            <h3 className="text-[15px] font-semibold text-text-main">Gold Stage A records</h3>
            <p className="mt-0.5 text-[12px] text-text-muted">Read-only customer + loyalty rows promoted from Silver Stage A.</p>
          </div>
          <button type="button" onClick={() => downloadCsv(filteredRows, 'stage_a_gold_filtered_rows.csv')} className="inline-flex h-9 items-center rounded-[6px] border border-[#B58A00] bg-white px-4 text-[12px] font-semibold text-[#8A7526] hover:bg-gold-bg focus:outline-none focus:ring-2 focus:ring-[#B58A00]">
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            Download filtered rows
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[2200px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-bg">
                {GOLD_STAGE_A_COLUMNS.map(column => {
                  const activeSort = sort?.key === column.key ? sort.direction : null;
                  return (
                    <th key={column.key} aria-sort={activeSort === 'asc' ? 'ascending' : activeSort === 'desc' ? 'descending' : 'none'} className={`whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted ${column.align === 'right' ? 'text-right' : ''}`}>
                      <button type="button" onClick={() => toggleSort(column.key)} aria-label={`Sort by ${column.label}`} className={`inline-flex items-center gap-1 rounded-[4px] hover:text-text-main focus:outline-none focus:ring-2 focus:ring-[#B58A00] ${column.align === 'right' ? 'ml-auto' : ''}`}>
                        {column.label}
                        {activeSort === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-[#B58A00]" aria-hidden="true" /> : activeSort === 'desc' ? <ArrowDown className="h-3.5 w-3.5 text-[#B58A00]" aria-hidden="true" /> : <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />}
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
                  {GOLD_STAGE_A_COLUMNS.map(column => (
                    <td key={column.key} className={`max-w-[320px] whitespace-nowrap px-4 py-3 text-[12px] text-text-main ${column.align === 'right' ? 'text-right font-mono' : ''}`}>
                      {renderCell(row, column)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => setDetailsRow(row)} className="inline-flex h-8 items-center rounded-[6px] border border-border-subtle bg-white px-3 text-[12px] font-medium text-text-main hover:bg-surface-bg focus:outline-none focus:ring-2 focus:ring-[#B58A00]">
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={GOLD_STAGE_A_COLUMNS.length + 1} className="px-6 py-12 text-center text-[13px] text-text-muted">
                    No Gold Stage A records match these filters.
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
            <h3 className="text-[16px] font-semibold text-text-main">Gold Stage A schema</h3>
            <p className="mt-1 text-[12px] text-text-muted">Promoted Customer Database and Loyalty Sales columns, plus Gold lineage and audit metadata.</p>
          </div>
          <ChevronDown className="h-5 w-5 text-text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-bg">
                <th className="px-6 py-3 text-[12px] font-semibold uppercase text-text-muted">Group</th>
                <th className="px-6 py-3 text-[12px] font-semibold uppercase text-text-muted">CSV Column</th>
                <th className="px-6 py-3 text-[12px] font-semibold uppercase text-text-muted">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {[...LOYALTY_COLUMNS, ...CUSTOMER_COLUMNS.map(value => `CLD_${value}`), 'MATCH_STATUS', 'DATASET_ANOMALY', 'DETAIL', 'ISSUE_STATUS', 'RESOLUTION', 'READY_FOR_STAGE_B', 'AUDIT_NOTE'].map(column => (
                <tr key={column}>
                  <td className="px-6 py-4 text-[12px] font-medium text-text-muted">{column.startsWith('CLD_') ? 'Customer' : LOYALTY_COLUMNS.includes(column as (typeof LOYALTY_COLUMNS)[number]) ? 'Loyalty' : 'Gold audit'}</td>
                  <td className="px-6 py-4 font-mono text-[13px] text-text-main">{column}</td>
                  <td className="px-6 py-4 text-[13px] text-text-muted">
                    {column === 'MATCH_STATUS' ? 'Stage A reconciliation status after Silver review.' :
                      column === 'DATASET_ANOMALY' ? 'Relational flag(s) inherited from Silver Stage A.' :
                      column === 'DETAIL' ? 'Short explanation of the match or issue state.' :
                      column === 'ISSUE_STATUS' ? 'Silver review state retained for auditability.' :
                      column === 'RESOLUTION' ? 'Silver resolution outcome if one was applied.' :
                      column === 'READY_FOR_STAGE_B' ? 'Whether the row is promoted to downstream Stage B.' :
                      column === 'AUDIT_NOTE' ? 'Human note attached during Stage A review.' :
                      'Promoted source column.'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {detailsRow && <GoldStageADetails row={detailsRow} onClose={() => setDetailsRow(null)} />}
    </div>
  );
}
