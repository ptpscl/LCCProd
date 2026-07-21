import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  Download,
  Filter,
  Info,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import {
  createStageBRows,
  HUMAN_REVIEW_COLUMNS,
  MATCH_STATUS_SUMMARY,
  MMS_COLUMNS,
  MatchStatus,
  RECONCILIATION_CONTEXT,
  REVIEW_VIEW_DEFINITIONS,
  ResolutionChoice,
  STAGE_A_COLUMNS,
  STAGE_B_CLASSIFICATION_COLUMNS,
  STAGE_B_MMS_ROWS_CHECKED,
  StageBRow,
} from './stageBSilverMockData';

type StatusFilter = 'For review' | 'Reviewed' | 'All';
type SortDirection = 'asc' | 'desc';
type FilterType = 'text' | 'select' | 'date' | 'number';
type ColumnGroup = 'stageA' | 'mms' | 'classification' | 'audit';

interface ColumnFilterValue {
  query?: string;
  value?: string;
  min?: string;
  max?: string;
}

interface ReviewColumn {
  key: string;
  label: string;
  group: ColumnGroup;
  filterType: FilterType;
  value: (row: StageBRow) => string;
  numericSort?: boolean;
}

interface ReviewSort {
  key: string;
  direction: SortDirection;
}

type ColumnFilters = Record<string, ColumnFilterValue>;

const MISSING_FILTER_VALUE = '__MISSING__';
const NUMERIC_SOURCE_COLUMNS = new Set([
  'TRANSACTION_NUMBER', 'REGISTER_NUMBER', 'STORE_CODE', 'SKU_CODE', 'QTY_SOLD', 'LOYALTY_SALES',
  'CLD_AGE', 'CLD_MEMBER_LOCATION', 'CLD_FREQUENCY_OF_VISIT', 'CLD_LAST_VISITED_STORE',
  'TRANSACTION NUMBER', 'REGISTER NUMBER', 'STORE CODE', 'SKU CODE', 'MMS SALES', 'QTY SOLD', 'MARGIN',
]);
const DATE_SOURCE_COLUMNS = new Set([
  'DATE', 'CLD_BIRTHDAY', 'CLD_EXPIRY_DATE', 'CLD_APPLICATION_DATE', 'CLD_MEMBER_SINCE', 'CLD_LAST_VISIT',
]);
const SELECT_SOURCE_COLUMNS = new Set([
  'TRANSACTION_TYPE', 'CUSTOMER_MATCH_STATUS', 'CLD_SOURCE', 'CLD_GENDER', 'CLD_CITY', 'CLD_PROVINCE',
  'HAS_NEGATIVE_QTY_OR_LOYALTY_SALES', 'Has_Anomaly_Or_Not', 'Anomaly_Flags',
  'TRANSACTION TYPE', 'STORE CATEGORIZATION',
]);

function sourceFilterType(column: string): FilterType {
  if (NUMERIC_SOURCE_COLUMNS.has(column)) return 'number';
  if (DATE_SOURCE_COLUMNS.has(column)) return 'date';
  if (SELECT_SOURCE_COLUMNS.has(column)) return 'select';
  return 'text';
}

const classificationGetters: Record<string, (row: StageBRow) => string> = {
  DATASET_ONLY_ANOMALY: row => row.datasetOnlyAnomaly,
  MATCH_STATUS: row => row.matchStatus,
  MATCH_QUALITY: row => row.matchQuality,
  BASE_CASE_MATCHING: row => row.baseCaseMatching,
  FINAL_MATCHING: row => row.finalMatching,
  detail: row => row.detail,
  has_anomaly_or_not: row => row.hasAnomalyOrNot,
  loyalty_customer_info_source: row => row.loyaltyCustomerInfoSource,
  STAGE_C_READINESS: row => row.stageCReadiness,
};

const auditGetters: Record<string, (row: StageBRow) => string> = {
  'Issue Status': row => row.issueStatus,
  Resolution: row => row.resolution || '',
  'Audit Note': row => row.auditNote || '',
  'Resolved By': row => row.resolvedBy || '',
  'Resolved At': row => row.resolvedAt || '',
};

export const STAGE_B_REVIEW_COLUMNS: ReviewColumn[] = [
  ...STAGE_A_COLUMNS.map(label => ({
    key: `stageA:${label}`,
    label,
    group: 'stageA' as const,
    filterType: sourceFilterType(label),
    value: (row: StageBRow) => row.stageA[label] || '',
    numericSort: NUMERIC_SOURCE_COLUMNS.has(label),
  })),
  ...MMS_COLUMNS.map(label => ({
    key: `mms:${label}`,
    label,
    group: 'mms' as const,
    filterType: sourceFilterType(label),
    value: (row: StageBRow) => row.mms[label] || '',
    numericSort: NUMERIC_SOURCE_COLUMNS.has(label),
  })),
  ...STAGE_B_CLASSIFICATION_COLUMNS.map(label => ({
    key: `classification:${label}`,
    label,
    group: 'classification' as const,
    filterType: label === 'detail' ? 'text' as const : 'select' as const,
    value: classificationGetters[label],
  })),
  ...HUMAN_REVIEW_COLUMNS.map(label => ({
    key: `audit:${label}`,
    label,
    group: 'audit' as const,
    filterType: label === 'Audit Note' || label === 'Resolved By'
      ? 'text' as const
      : label === 'Resolved At' ? 'date' as const : 'select' as const,
    value: auditGetters[label],
  })),
];

const COLUMN_BY_KEY = Object.fromEntries(STAGE_B_REVIEW_COLUMNS.map(column => [column.key, column]));

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function dateAsInput(value: string): string {
  const digits = value.replaceAll('-', '').slice(0, 8);
  if (/^\d{6}$/.test(digits)) return `20${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`;
  if (/^\d{8}$/.test(digits)) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  return value.slice(0, 10);
}

function formatResolvedAt(value?: string): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function hasActiveFilter(filter?: ColumnFilterValue): boolean {
  return Boolean(filter && [filter.query, filter.value, filter.min, filter.max].some(value => value?.trim()));
}

function rowMatchesFilter(row: StageBRow, column: ReviewColumn, filter: ColumnFilterValue): boolean {
  const rawValue = column.value(row);
  if (column.filterType === 'number') {
    const numericValue = Number(rawValue);
    if (!rawValue) return false;
    const min = filter.min?.trim() ? Number(filter.min) : null;
    const max = filter.max?.trim() ? Number(filter.max) : null;
    if (min !== null && !Number.isNaN(min) && numericValue < min) return false;
    if (max !== null && !Number.isNaN(max) && numericValue > max) return false;
    return true;
  }
  if (column.filterType === 'date') return !filter.query || dateAsInput(rawValue) === filter.query;
  if (column.filterType === 'select') {
    if (!filter.value) return true;
    if (filter.value === MISSING_FILTER_VALUE) return !rawValue;
    if (column.label === 'DATASET_ONLY_ANOMALY') return rawValue.split('|').includes(filter.value);
    return rawValue === filter.value;
  }
  return !filter.query || rawValue.toLocaleLowerCase().includes(filter.query.toLocaleLowerCase());
}

export function filterAndSortStageBRows(
  rows: StageBRow[],
  statusFilter: StatusFilter,
  filters: ColumnFilters,
  sort: ReviewSort | null,
): StageBRow[] {
  const filtered = rows.filter(row => {
    if (statusFilter !== 'All' && row.issueStatus !== statusFilter) return false;
    return Object.entries(filters).every(([key, filter]) => {
      const column = COLUMN_BY_KEY[key];
      return !column || !hasActiveFilter(filter) || rowMatchesFilter(row, column, filter);
    });
  });
  if (!sort) return filtered;
  const column = COLUMN_BY_KEY[sort.key];
  if (!column) return filtered;
  const multiplier = sort.direction === 'asc' ? 1 : -1;
  return [...filtered].sort((left, right) => {
    const leftValue = column.value(left);
    const rightValue = column.value(right);
    if (column.numericSort) return (Number(leftValue || 0) - Number(rightValue || 0)) * multiplier;
    return leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: 'base' }) * multiplier;
  });
}

function filterOptions(column: ReviewColumn, rows: StageBRow[]): string[] {
  const values = column.label === 'DATASET_ONLY_ANOMALY'
    ? rows.flatMap(row => column.value(row).split('|'))
    : rows.map(row => column.value(row));
  const options = [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  return rows.some(row => !column.value(row)) ? [MISSING_FILTER_VALUE, ...options] : options;
}

function ColumnFilterPopover({
  column,
  filter,
  rows,
  onChange,
  onClear,
}: {
  column: ReviewColumn;
  filter: ColumnFilterValue;
  rows: StageBRow[];
  onChange: (filter: ColumnFilterValue) => void;
  onClear: () => void;
}) {
  const options = filterOptions(column, rows);
  return (
    <div className="absolute left-0 top-full z-40 mt-1 w-[230px] rounded-[8px] border border-border-subtle bg-white p-3 text-left normal-case tracking-normal shadow-lg" onClick={event => event.stopPropagation()}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-[12px] font-semibold text-text-main">Filter {column.label}</span>
        <button type="button" onClick={onClear} className="text-[11px] font-medium text-brand-600 hover:text-brand-700 focus:outline-none focus:underline">Clear</button>
      </div>
      {column.filterType === 'select' && (
        <select autoFocus value={filter.value || ''} onChange={event => onChange({ value: event.target.value })} className="h-9 w-full rounded-[6px] border border-border-subtle bg-white px-2 text-[12px] font-normal text-text-main outline-none focus:border-brand-600">
          <option value="">All values</option>
          {options.map(option => <option key={option} value={option}>{option === MISSING_FILTER_VALUE ? 'Missing' : option}</option>)}
        </select>
      )}
      {column.filterType === 'date' && (
        <input autoFocus type="date" value={filter.query || ''} onChange={event => onChange({ query: event.target.value })} className="h-9 w-full rounded-[6px] border border-border-subtle px-2 text-[12px] font-normal text-text-main outline-none focus:border-brand-600" />
      )}
      {column.filterType === 'number' && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] font-medium text-text-muted">Minimum<input autoFocus type="number" step="any" value={filter.min || ''} onChange={event => onChange({ ...filter, min: event.target.value })} className="mt-1 h-9 w-full rounded-[6px] border border-border-subtle px-2 text-[12px] font-normal text-text-main outline-none focus:border-brand-600" /></label>
          <label className="text-[11px] font-medium text-text-muted">Maximum<input type="number" step="any" value={filter.max || ''} onChange={event => onChange({ ...filter, max: event.target.value })} className="mt-1 h-9 w-full rounded-[6px] border border-border-subtle px-2 text-[12px] font-normal text-text-main outline-none focus:border-brand-600" /></label>
        </div>
      )}
      {column.filterType === 'text' && (
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
          <input autoFocus type="search" value={filter.query || ''} onChange={event => onChange({ query: event.target.value })} placeholder="Contains..." className="h-9 w-full rounded-[6px] border border-border-subtle pl-8 pr-2 text-[12px] font-normal text-text-main outline-none focus:border-brand-600" />
        </label>
      )}
    </div>
  );
}

function GroupHeaderRow({ includeSelection }: { includeSelection: boolean }) {
  return (
    <tr className="border-b border-border-subtle bg-surface-bg">
      {includeSelection && <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-text-muted">Selection</th>}
      <th colSpan={STAGE_A_COLUMNS.length} className="border-l border-border-subtle px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-silver-text">Stage A · Customer + Loyalty</th>
      <th colSpan={MMS_COLUMNS.length} className="border-l border-border-subtle px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-silver-text">MMS</th>
      <th colSpan={STAGE_B_CLASSIFICATION_COLUMNS.length} className="border-l border-border-subtle px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-silver-text">Stage B Classification</th>
      <th colSpan={HUMAN_REVIEW_COLUMNS.length} className="border-l border-border-subtle px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-silver-text">Human Review Audit</th>
    </tr>
  );
}

function ColumnHeaderRow({
  rows,
  filters,
  sort,
  openFilter,
  setOpenFilter,
  onFilter,
  onClearFilter,
  onSort,
  includeSelection,
  allVisibleSelected,
  selectableCount,
  onSelectAll,
  readOnly = false,
}: {
  rows: StageBRow[];
  filters: ColumnFilters;
  sort: ReviewSort | null;
  openFilter: string | null;
  setOpenFilter: (key: string | null) => void;
  onFilter: (key: string, filter: ColumnFilterValue) => void;
  onClearFilter: (key: string) => void;
  onSort: (key: string) => void;
  includeSelection: boolean;
  allVisibleSelected: boolean;
  selectableCount: number;
  onSelectAll: () => void;
  readOnly?: boolean;
}) {
  return (
    <tr className="border-b border-border-subtle bg-surface-bg">
      {includeSelection && (
        <th className="w-12 px-4 py-3">
          <input type="checkbox" aria-label="Select all visible rows for review" checked={allVisibleSelected} disabled={selectableCount === 0} onChange={onSelectAll} className="h-4 w-4 rounded border-gray-300 accent-[#0054A6] disabled:opacity-40" />
        </th>
      )}
      {STAGE_B_REVIEW_COLUMNS.map(column => {
        const activeFilter = hasActiveFilter(filters[column.key]);
        const activeSort = sort?.key === column.key ? sort.direction : null;
        return (
          <th key={column.key} aria-sort={activeSort === 'asc' ? 'ascending' : activeSort === 'desc' ? 'descending' : 'none'} className="relative whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            {readOnly ? column.label : (
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => onSort(column.key)} aria-label={`Sort by ${column.label}${activeSort ? `, currently ${activeSort === 'asc' ? 'ascending' : 'descending'}` : ''}`} className="inline-flex items-center gap-1 rounded-[4px] hover:text-text-main focus:outline-none focus:ring-2 focus:ring-brand-600">
                  {column.label}
                  {activeSort === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-brand-600" /> : activeSort === 'desc' ? <ArrowDown className="h-3.5 w-3.5 text-brand-600" /> : <ArrowUpDown className="h-3.5 w-3.5" />}
                </button>
                <button type="button" onClick={() => setOpenFilter(openFilter === column.key ? null : column.key)} aria-label={`Filter ${column.label}${activeFilter ? ', filter active' : ''}`} aria-expanded={openFilter === column.key} className={`flex h-6 w-6 items-center justify-center rounded-[4px] hover:bg-white hover:text-text-main focus:outline-none focus:ring-2 focus:ring-brand-600 ${activeFilter ? 'bg-brand-50 text-brand-600' : ''}`}>
                  <Filter className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            )}
            {!readOnly && openFilter === column.key && <ColumnFilterPopover column={column} filter={filters[column.key] || {}} rows={rows} onChange={next => onFilter(column.key, next)} onClear={() => onClearFilter(column.key)} />}
          </th>
        );
      })}
    </tr>
  );
}

function renderCell(row: StageBRow, column: ReviewColumn) {
  const value = column.value(row);
  if (column.label === 'DATASET_ONLY_ANOMALY') {
    return <div className="flex max-w-[420px] flex-wrap gap-1.5">{value.split('|').map(code => <span key={code} className={`rounded-full px-2 py-1 text-[11px] font-medium ${code === 'NONE' ? 'bg-gray-100 text-gray-700' : 'bg-amber-100 text-amber-800'}`}>{code}</span>)}</div>;
  }
  if (column.label === 'Issue Status') return <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${row.issueStatus === 'Reviewed' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{row.issueStatus}</span>;
  if (column.label === 'STAGE_C_READINESS') return <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${value === 'READY' ? 'bg-green-100 text-green-800' : value === 'EXCLUDED' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{value}</span>;
  if (column.label === 'Resolved At') return formatResolvedAt(row.resolvedAt);
  return value || '—';
}

function LineageRows({ rows, includeSelection, selectedIds, onToggle }: { rows: StageBRow[]; includeSelection: boolean; selectedIds: Set<string>; onToggle: (id: string) => void }) {
  return (
    <tbody className="divide-y divide-border-subtle">
      {rows.map(row => (
        <tr key={row.id} className={`transition-colors hover:bg-surface-bg ${selectedIds.has(row.id) ? 'bg-brand-50' : 'bg-white'}`}>
          {includeSelection && <td className="px-4 py-3 align-top"><input type="checkbox" aria-label={`Select stitched row ${row.id}`} checked={selectedIds.has(row.id)} disabled={row.issueStatus === 'Reviewed' || !row.requiresStageBReview} onChange={() => onToggle(row.id)} className="h-4 w-4 rounded border-gray-300 accent-[#0054A6] disabled:opacity-40" /></td>}
          {STAGE_B_REVIEW_COLUMNS.map(column => <td key={column.key} className="max-w-[420px] whitespace-nowrap px-4 py-3 text-[12px] text-text-main">{renderCell(row, column)}</td>)}
        </tr>
      ))}
    </tbody>
  );
}

function useModalBehavior(onClose: () => void, openFilter?: string | null, closeFilter?: () => void) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (openFilter && closeFilter) closeFilter();
      else onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeFilter, onClose, openFilter]);
}

function ReviewPanel({ status, rows, onClose, onResolve }: { status: MatchStatus; rows: StageBRow[]; onClose: () => void; onResolve: (ids: string[], resolution: ResolutionChoice, note: string) => void }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('For review');
  const [filters, setFilters] = useState<ColumnFilters>({});
  const [sort, setSort] = useState<ReviewSort | null>(null);
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [resolution, setResolution] = useState<ResolutionChoice | ''>('');
  const [auditNote, setAuditNote] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const summary = MATCH_STATUS_SUMMARY.find(item => item.status === status)!;
  const groupRows = useMemo(() => rows.filter(row => row.matchStatus === status), [rows, status]);
  const visibleRows = useMemo(() => filterAndSortStageBRows(groupRows, statusFilter, filters, sort), [filters, groupRows, sort, statusFilter]);
  const selectableRows = visibleRows.filter(row => row.issueStatus === 'For review' && row.requiresStageBReview);
  const selectedRows = groupRows.filter(row => selectedIds.has(row.id));
  const allVisibleSelected = selectableRows.length > 0 && selectableRows.every(row => selectedIds.has(row.id));
  const canResolve = selectedRows.length > 0 && Boolean(resolution) && Boolean(auditNote.trim());
  const activeFilterCount = Object.values(filters).filter(hasActiveFilter).length;

  useModalBehavior(onClose, openFilter, () => setOpenFilter(null));

  useEffect(() => {
    const visibleSelectableIds = new Set(selectableRows.map(row => row.id));
    setSelectedIds(current => {
      const next = new Set([...current].filter(id => visibleSelectableIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [selectableRows]);

  const changeFilter = (key: string, next: ColumnFilterValue) => {
    setFilters(current => ({ ...current, [key]: next }));
    setConfirmation('');
  };
  const clearFilter = (key: string) => setFilters(current => {
    const next = { ...current };
    delete next[key];
    return next;
  });
  const toggleSort = (key: string) => setSort(current => {
    if (!current || current.key !== key) return { key, direction: 'asc' };
    if (current.direction === 'asc') return { key, direction: 'desc' };
    return null;
  });
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
  const clearAll = () => {
    setStatusFilter('For review');
    setFilters({});
    setOpenFilter(null);
    setSelectedIds(new Set());
    setConfirmation('');
  };
  const completeResolution = () => {
    if (!canResolve || !resolution) return;
    const ids = [...selectedIds];
    onResolve(ids, resolution, auditNote.trim());
    setSelectedIds(new Set());
    setResolution('');
    setAuditNote('');
    setConfirmation(`${ids.length} ${ids.length === 1 ? 'row' : 'rows'} marked as reviewed.`);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-3 sm:p-6" onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="stage-b-review-title" className="flex max-h-[90vh] w-full max-w-[1480px] flex-col overflow-hidden rounded-[12px] bg-white shadow-xl" onMouseDown={event => event.stopPropagation()}>
        <header className="flex shrink-0 items-start justify-between gap-5 border-b border-border-subtle bg-white px-6 py-5">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2"><span className="rounded-full bg-silver-bg px-2 py-1 text-[11px] font-medium text-silver-text">Stage B reconciliation review</span><span className="text-[12px] text-text-muted">{groupRows.length} representative rows</span></div>
            <h2 id="stage-b-review-title" className="break-all text-[18px] font-semibold text-text-main">{status}</h2>
            <p className="mt-1 max-w-[900px] text-[12px] leading-5 text-text-muted">{summary.definition} Complete stitched-row lineage is shown below.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close Stage B review" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] text-text-muted hover:bg-surface-bg hover:text-text-main focus:outline-none focus:ring-2 focus:ring-brand-600"><X className="h-5 w-5" aria-hidden="true" /></button>
        </header>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-white px-6 py-3">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Status filter">
            <span className="mr-1 text-[12px] font-semibold text-text-muted">Status</span>
            {(['For review', 'Reviewed', 'All'] as const).map(option => <button key={option} type="button" onClick={() => { setStatusFilter(option); setSelectedIds(new Set()); setConfirmation(''); }} className={`h-8 rounded-[6px] border px-3 text-[12px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-600 ${statusFilter === option ? 'border-brand-600 bg-brand-600 text-white' : 'border-border-subtle bg-white text-text-main hover:bg-surface-bg'}`}>{option}</button>)}
            <button type="button" onClick={clearAll} disabled={activeFilterCount === 0 && statusFilter === 'For review'} className="ml-1 inline-flex h-8 items-center rounded-[6px] border border-border-subtle bg-white px-3 text-[12px] font-medium text-text-main hover:bg-surface-bg disabled:cursor-not-allowed disabled:opacity-40"><X className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />Clear filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</button>
          </div>
          <p className="text-[12px] text-text-muted">{visibleRows.length} shown · {selectedIds.size} selected</p>
        </div>
        <div className="min-h-0 flex-1 overflow-auto" data-testid="stage-b-review-scroll">
          <table className="min-w-[7800px] border-collapse text-left">
            <thead className="sticky top-0 z-20 bg-surface-bg">
              <GroupHeaderRow includeSelection />
              <ColumnHeaderRow rows={groupRows} filters={filters} sort={sort} openFilter={openFilter} setOpenFilter={setOpenFilter} onFilter={changeFilter} onClearFilter={clearFilter} onSort={toggleSort} includeSelection allVisibleSelected={allVisibleSelected} selectableCount={selectableRows.length} onSelectAll={toggleAllVisible} />
            </thead>
            <LineageRows rows={visibleRows} includeSelection selectedIds={selectedIds} onToggle={toggleRow} />
            {visibleRows.length === 0 && <tbody><tr><td colSpan={STAGE_B_REVIEW_COLUMNS.length + 1} className="px-6 py-12 text-center text-[13px] text-text-muted">No Stage B rows match the current status and column filters.</td></tr></tbody>}
          </table>
        </div>
        <footer className="shrink-0 border-t border-border-subtle bg-white px-6 py-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(220px,0.7fr)_minmax(320px,1.3fr)_auto] lg:items-end">
            <label className="text-[12px] font-semibold text-text-muted">Resolution<select value={resolution} onChange={event => setResolution(event.target.value as ResolutionChoice | '')} disabled={selectedIds.size === 0} className="mt-2 h-10 w-full rounded-[6px] border border-border-subtle bg-white px-3 text-[13px] font-normal text-text-main outline-none focus:border-brand-600 disabled:bg-surface-bg disabled:opacity-60"><option value="">Choose a resolution</option><option value="Accept as Valid">Accept as Valid</option><option value="Exclude from Output">Exclude from Output</option></select></label>
            <label className="text-[12px] font-semibold text-text-muted">Audit note <span className="text-error">*</span><input type="text" value={auditNote} onChange={event => setAuditNote(event.target.value)} disabled={selectedIds.size === 0} placeholder="Explain why this resolution is appropriate" className="mt-2 h-10 w-full rounded-[6px] border border-border-subtle px-3 text-[13px] font-normal text-text-main outline-none placeholder:text-gray-400 focus:border-brand-600 disabled:bg-surface-bg disabled:opacity-60" /></label>
            <button type="button" onClick={completeResolution} disabled={!canResolve} className="inline-flex h-10 items-center justify-center rounded-[6px] bg-[#0054A6] px-4 text-[13px] font-semibold text-white hover:bg-[#004385] focus:outline-none focus:ring-2 focus:ring-brand-600 disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />Complete resolution</button>
          </div>
          <div className="mt-2 flex min-h-5 items-center justify-between gap-4 text-[11px]"><p className="text-text-muted">BASE_CASE_MATCHING and FINAL_MATCHING are pipeline classifications. An audit note is required for human resolution.</p>{confirmation && <p role="status" className="font-medium text-green-800">{confirmation}</p>}</div>
        </footer>
      </section>
    </div>
  );
}

function ReadySnapshotModal({ rows, total, onClose }: { rows: StageBRow[]; total: number; onClose: () => void }) {
  const [placeholderMessage, setPlaceholderMessage] = useState('');
  useModalBehavior(onClose);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-3 sm:p-6" onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="ready-stage-c-title" className="flex max-h-[90vh] w-full max-w-[1480px] flex-col overflow-hidden rounded-[12px] bg-white shadow-xl" onMouseDown={event => event.stopPropagation()}>
        <header className="flex shrink-0 items-start justify-between gap-5 border-b border-border-subtle bg-white px-6 py-5">
          <div><div className="mb-2 flex flex-wrap items-center gap-2"><span className="rounded-full bg-green-100 px-2 py-1 text-[11px] font-medium text-green-800">Read-only snapshot</span><span className="text-[12px] text-text-muted">MMS-spine output only</span></div><h2 id="ready-stage-c-title" className="text-[18px] font-semibold text-text-main">Ready for Stage C snapshot</h2><p className="mt-1 text-[12px] text-text-muted">Showing 10–20 of {total.toLocaleString()} rows</p></div>
          <button type="button" onClick={onClose} aria-label="Close Ready for Stage C snapshot" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] text-text-muted hover:bg-surface-bg hover:text-text-main focus:outline-none focus:ring-2 focus:ring-brand-600"><X className="h-5 w-5" aria-hidden="true" /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto" data-testid="ready-stage-c-horizontal-scroll">
          <table className="min-w-[7600px] border-collapse text-left">
            <thead className="sticky top-0 z-20 bg-surface-bg">
              <GroupHeaderRow includeSelection={false} />
              <ColumnHeaderRow rows={rows} filters={{}} sort={null} openFilter={null} setOpenFilter={() => undefined} onFilter={() => undefined} onClearFilter={() => undefined} onSort={() => undefined} includeSelection={false} allVisibleSelected={false} selectableCount={0} onSelectAll={() => undefined} readOnly />
            </thead>
            <LineageRows rows={rows.slice(0, 20)} includeSelection={false} selectedIds={new Set()} onToggle={() => undefined} />
          </table>
        </div>
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border-subtle bg-white px-6 py-4">
          <p role="status" className="text-[11px] text-text-muted">{placeholderMessage || 'Clean rows and Accept as Valid resolutions are included. Excluded rows are never shown.'}</p>
          <button type="button" onClick={() => setPlaceholderMessage('Download Ready Rows is a frontend-only placeholder.')} className="inline-flex h-9 items-center justify-center rounded-[6px] border border-border-subtle bg-white px-4 text-[13px] font-medium text-text-main hover:bg-surface-bg focus:outline-none focus:ring-2 focus:ring-brand-600"><Download className="mr-2 h-4 w-4" aria-hidden="true" />Download Ready Rows</button>
        </footer>
      </section>
    </div>
  );
}

function MetricTooltip({ id, definition }: { id: string; definition: string }) {
  return (
    <span className="group relative inline-flex">
      <button type="button" aria-describedby={id} className="rounded-full text-text-muted hover:text-text-main focus:outline-none focus:ring-2 focus:ring-brand-600"><Info className="h-4 w-4" aria-hidden="true" /></button>
      <span id={id} role="tooltip" className="pointer-events-none absolute bottom-full right-0 z-30 mb-2 w-[320px] max-w-[70vw] rounded-[6px] bg-gray-900 px-3 py-2 text-[11px] font-normal leading-4 text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">{definition}</span>
    </span>
  );
}

export function calculateStageBScorecards(rows: StageBRow[]) {
  const reviewRows = rows.filter(row => row.requiresStageBReview && row.isMmsSpine);
  const unresolved = reviewRows.filter(row => row.issueStatus === 'For review').length;
  const resolved = reviewRows.filter(row => row.issueStatus === 'Reviewed').length;
  const excluded = reviewRows.filter(row => row.resolution === 'Exclude from Output').length;
  return {
    checked: STAGE_B_MMS_ROWS_CHECKED,
    review: unresolved,
    resolved,
    ready: STAGE_B_MMS_ROWS_CHECKED - unresolved - excluded,
  };
}

export function applyStageBResolution(
  rows: StageBRow[],
  ids: string[],
  resolution: ResolutionChoice,
  note: string,
  resolvedAt = new Date().toISOString(),
  resolvedBy = 'Michelle',
): StageBRow[] {
  if (!note.trim()) return rows;
  const selected = new Set(ids);
  return rows.map(row => selected.has(row.id) && row.requiresStageBReview && row.issueStatus === 'For review' ? {
    ...row,
    issueStatus: 'Reviewed',
    resolution,
    auditNote: note.trim(),
    resolvedBy,
    resolvedAt,
    stageCReadiness: resolution === 'Exclude from Output' ? 'EXCLUDED' : row.isMmsSpine ? 'READY' : 'AUDIT_ONLY',
  } : row);
}

export default function StageBSilverView() {
  const [rows, setRows] = useState<StageBRow[]>(createStageBRows);
  const [scorecards, setScorecards] = useState(() => calculateStageBScorecards(createStageBRows()));
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [activeStatus, setActiveStatus] = useState<MatchStatus | null>(null);
  const [readyOpen, setReadyOpen] = useState(false);

  const readyRows = useMemo(() => rows.filter(row => row.isMmsSpine && row.stageCReadiness === 'READY' && row.resolution !== 'Exclude from Output'), [rows]);

  const updateRows = (nextRows: StageBRow[]) => {
    setRows(nextRows);
    setScorecards(calculateStageBScorecards(nextRows));
  };
  const refresh = () => {
    setRefreshing(true);
    setScorecards(calculateStageBScorecards(rows));
    setLastUpdatedAt(new Date());
    window.setTimeout(() => setRefreshing(false), 350);
  };
  const resolve = (ids: string[], resolution: ResolutionChoice, note: string) => {
    updateRows(applyStageBResolution(rows, ids, resolution, note));
  };
  const downloadAnomalies = () => {
    const columns = STAGE_B_REVIEW_COLUMNS;
    const header = columns.map(column => csvCell(column.label)).join(',');
    const records = rows.filter(row => row.requiresStageBReview).map(row => columns.map(column => csvCell(column.value(row))).join(','));
    const blob = new Blob([`\uFEFF${[header, ...records].join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'stage_b_silver_demo_anomalies.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2"><h2 className="text-[18px] font-semibold text-text-main">Silver Stage B Data</h2><span className="rounded-full bg-silver-bg px-2 py-1 text-[11px] font-medium text-silver-text">Provisional demo</span></div>
          <p className="mt-1 text-[13px] text-text-muted">Stage A + MMS reconciliation</p>
          <p className="mt-1 text-[11px] text-text-muted">Updated as of {lastUpdatedAt.toLocaleString()}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={refresh} className="inline-flex h-9 items-center justify-center rounded-[6px] border border-border-subtle bg-white px-4 text-[13px] font-medium text-text-main hover:bg-surface-bg focus:outline-none focus:ring-2 focus:ring-brand-600"><RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />Refresh</button>
          <button type="button" onClick={downloadAnomalies} className="inline-flex h-9 items-center justify-center rounded-[6px] bg-[#0054A6] px-4 text-[13px] font-medium text-white hover:bg-[#004385] focus:outline-none focus:ring-2 focus:ring-brand-600"><Download className="mr-2 h-4 w-4" aria-hidden="true" />Download Anomalies CSV</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Stage B MMS Rows Checked', scorecards.checked],
          ['Rows for Review', scorecards.review],
          ['Resolved', scorecards.resolved],
          ['Ready for Stage C', scorecards.ready],
        ].map(([label, value]) => <div key={String(label)} className="rounded-[10px] border border-border-subtle bg-white p-6 shadow-subtle"><h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-text-muted">{label}</h3><p className="text-[28px] font-bold text-text-main">{Number(value).toLocaleString()}</p><p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-text-muted">Demo value</p></div>)}
      </div>

      <section className="rounded-[10px] border border-border-subtle bg-white p-6 shadow-subtle">
        <div className="mb-5"><h3 className="text-[16px] font-semibold text-text-main">Reconciliation Context</h3><p className="mt-1 text-[12px] text-text-muted">Provisional full-audit comparison counts. The primary scorecards above remain MMS-spine based.</p></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {RECONCILIATION_CONTEXT.map(metric => <div key={metric.label} className="rounded-[8px] border border-border-subtle bg-surface-bg p-4"><div className="flex items-start justify-between gap-3"><h4 className="text-[12px] font-semibold uppercase tracking-wider text-text-muted">{metric.label}</h4><MetricTooltip id={`context-${metric.label.toLowerCase().replaceAll(' ', '-')}`} definition={metric.definition} /></div><p className="mt-2 text-[22px] font-bold text-text-main">{metric.value.toLocaleString()}</p></div>)}
        </div>
      </section>

      <section className="overflow-hidden rounded-[10px] border border-border-subtle bg-white shadow-subtle">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border-subtle px-6 py-5"><div><h3 className="text-[16px] font-semibold text-text-main">Reconciliation Status Summary</h3><p className="mt-1 text-[12px] text-text-muted">Primary groups use pipeline MATCH_STATUS only. Remaining counts reflect the representative frontend review rows.</p></div><span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800">Provisional frontend data</span></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1180px] border-collapse text-left"><thead><tr className="border-b border-border-subtle bg-surface-bg"><th className="px-6 py-3 text-[12px] font-semibold uppercase tracking-wider text-text-muted">MATCH_STATUS</th><th className="w-64 px-6 py-3 text-[12px] font-semibold uppercase tracking-wider text-text-muted">Review View</th><th className="w-44 px-6 py-3 text-right text-[12px] font-semibold uppercase tracking-wider text-text-muted">Affected MMS Rows</th><th className="w-56 px-6 py-3 text-right text-[12px] font-semibold uppercase tracking-wider text-text-muted">Remaining Rows for Review</th><th className="w-36 px-6 py-3 text-right text-[12px] font-semibold uppercase tracking-wider text-text-muted">Action</th></tr></thead>
          <tbody className="divide-y divide-border-subtle">{MATCH_STATUS_SUMMARY.map(item => {
            const groupRows = rows.filter(row => row.matchStatus === item.status);
            const remaining = groupRows.filter(row => row.requiresStageBReview && row.issueStatus === 'For review').length;
            const reviewed = remaining === 0;
            const matchStatusTooltipId = `match-status-${item.status.toLowerCase().replaceAll(' ', '-').replaceAll('/', '-')}`;
            const reviewViewTooltipId = `review-view-${item.status.toLowerCase().replaceAll(' ', '-').replaceAll('/', '-')}`;
            return <tr key={item.status} className="hover:bg-surface-bg"><td className="px-6 py-4"><div className="group relative inline-flex items-center gap-2"><span className="text-[13px] font-semibold text-text-main">{item.status}</span><button type="button" aria-describedby={matchStatusTooltipId} className="rounded-full text-text-muted hover:text-text-main focus:outline-none focus:ring-2 focus:ring-brand-600"><Info className="h-4 w-4" aria-hidden="true" /></button><span id={matchStatusTooltipId} role="tooltip" className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 w-[360px] max-w-[70vw] rounded-[6px] bg-gray-900 px-3 py-2 text-[11px] font-normal leading-4 text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">{item.definition}</span></div></td><td className="px-6 py-4"><div className="group relative inline-flex items-center gap-2"><span className="text-[12px] font-medium text-text-main">{item.reviewView}</span><button type="button" aria-describedby={reviewViewTooltipId} className="rounded-full text-text-muted hover:text-text-main focus:outline-none focus:ring-2 focus:ring-brand-600"><Info className="h-4 w-4" aria-hidden="true" /></button><span id={reviewViewTooltipId} role="tooltip" className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 w-[360px] max-w-[70vw] rounded-[6px] bg-gray-900 px-3 py-2 text-[11px] font-normal leading-4 text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">{REVIEW_VIEW_DEFINITIONS[item.reviewView]}</span></div></td><td className="px-6 py-4 text-right text-[13px] font-medium text-text-main">{item.affectedMmsRows.toLocaleString()}</td><td className="px-6 py-4 text-right text-[13px] font-medium text-text-main">{remaining}</td><td className="px-6 py-4 text-right"><button type="button" onClick={() => setActiveStatus(item.status)} className={`inline-flex h-8 items-center rounded-[6px] border px-3 text-[12px] font-medium focus:outline-none focus:ring-2 focus:ring-brand-600 ${reviewed ? 'border-green-200 bg-green-100 text-green-800 hover:bg-green-50' : 'border-border-subtle bg-white text-text-main hover:bg-surface-bg'}`}>{reviewed && <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />}{reviewed ? 'Reviewed' : 'Review'}</button></td></tr>;
          })}</tbody>
        </table></div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-[10px] border border-border-subtle bg-white px-6 py-5 shadow-subtle"><div><h3 className="text-[16px] font-semibold text-text-main">Ready for Stage C</h3><p className="mt-1 text-[12px] text-text-muted">Read-only MMS-spine snapshot. Clean and accepted rows are included; excluded and unresolved rows are not.</p></div><button type="button" onClick={() => setReadyOpen(true)} className="inline-flex h-9 items-center justify-center rounded-[6px] bg-[#0054A6] px-4 text-[13px] font-medium text-white hover:bg-[#004385] focus:outline-none focus:ring-2 focus:ring-brand-600">View Ready for Stage C</button></section>

      {activeStatus && <ReviewPanel status={activeStatus} rows={rows} onClose={() => setActiveStatus(null)} onResolve={resolve} />}
      {readyOpen && <ReadySnapshotModal rows={readyRows} total={scorecards.ready} onClose={() => setReadyOpen(false)} />}
    </div>
  );
}
