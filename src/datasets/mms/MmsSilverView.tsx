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
  createMmsAnomalyRows,
  MMS_ANOMALY_RULES,
  MMS_AUTOMATICALLY_CLEAN,
  MMS_ROWS_CHECKED,
  MmsAnomalyId,
  MmsAnomalyRow,
  ResolutionChoice,
  ReviewStatus,
} from './mmsSilverMockData';

export type StatusFilter = ReviewStatus | 'all';
export type SortDirection = 'asc' | 'desc';
export type ReviewColumnKey =
  | 'date'
  | 'transactionNumber'
  | 'registerNumber'
  | 'storeCode'
  | 'skuCode'
  | 'transactionType'
  | 'mmsSales'
  | 'quantitySold'
  | 'margin'
  | 'storeCategorization'
  | 'issue'
  | 'status'
  | 'resolvedBy'
  | 'resolvedAt';

export interface ColumnFilterValue {
  query?: string;
  value?: string;
  min?: string;
  max?: string;
}

export type ColumnFilters = Partial<Record<ReviewColumnKey, ColumnFilterValue>>;

export interface ReviewSort {
  key: ReviewColumnKey;
  direction: SortDirection;
}

type FilterType = 'text' | 'select' | 'date' | 'number';

const MISSING_FILTER_VALUE = '__MISSING__';

interface ReviewColumn {
  key: ReviewColumnKey;
  label: string;
  filterType: FilterType;
  value: (row: MmsAnomalyRow) => string;
  numericSort?: boolean;
  align?: 'right';
}

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

export const REVIEW_COLUMNS: ReviewColumn[] = [
  { key: 'date', label: 'Date', filterType: 'date', value: row => row.date, numericSort: true },
  { key: 'transactionNumber', label: 'Transaction Number', filterType: 'text', value: row => row.transactionNumber },
  { key: 'registerNumber', label: 'Register Number', filterType: 'text', value: row => row.registerNumber },
  { key: 'storeCode', label: 'Store Code', filterType: 'text', value: row => row.storeCode },
  { key: 'skuCode', label: 'SKU Code', filterType: 'text', value: row => row.skuCode },
  { key: 'transactionType', label: 'Transaction Type', filterType: 'select', value: row => row.transactionType },
  { key: 'mmsSales', label: 'MMS Sales', filterType: 'number', value: row => row.mmsSales, numericSort: true, align: 'right' },
  { key: 'quantitySold', label: 'Quantity Sold', filterType: 'number', value: row => row.quantitySold, numericSort: true, align: 'right' },
  { key: 'margin', label: 'Margin', filterType: 'number', value: row => row.margin, numericSort: true, align: 'right' },
  { key: 'storeCategorization', label: 'Store Categorization', filterType: 'select', value: row => row.storeCategorization },
  { key: 'issue', label: 'Issue', filterType: 'select', value: row => row.anomalyTypes.join(' | ') },
  { key: 'status', label: 'Status', filterType: 'select', value: row => row.status === 'reviewed' ? 'Reviewed' : 'For review' },
  { key: 'resolvedBy', label: 'Resolved By', filterType: 'text', value: row => row.resolvedBy || '' },
  { key: 'resolvedAt', label: 'Resolved At', filterType: 'date', value: row => row.resolvedAt || '' },
];

const COLUMN_BY_KEY = Object.fromEntries(
  REVIEW_COLUMNS.map(column => [column.key, column]),
) as Record<ReviewColumnKey, ReviewColumn>;

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

function sourceDateAsInput(value: string): string {
  if (!/^\d{6}$/.test(value)) return '';
  return `20${value.slice(0, 2)}-${value.slice(2, 4)}-${value.slice(4, 6)}`;
}

function formatResolvedAt(value?: string): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function hasActiveColumnFilter(filter?: ColumnFilterValue): boolean {
  return Boolean(filter && [filter.query, filter.value, filter.min, filter.max].some(value => value?.trim()));
}

function rowMatchesFilter(row: MmsAnomalyRow, key: ReviewColumnKey, filter: ColumnFilterValue): boolean {
  const column = COLUMN_BY_KEY[key];
  const rawValue = column.value(row);

  if (column.filterType === 'number') {
    const numericValue = Number(rawValue);
    const min = filter.min?.trim() === '' || filter.min === undefined ? null : Number(filter.min);
    const max = filter.max?.trim() === '' || filter.max === undefined ? null : Number(filter.max);
    if (min !== null && !Number.isNaN(min) && numericValue < min) return false;
    if (max !== null && !Number.isNaN(max) && numericValue > max) return false;
    return true;
  }

  if (column.filterType === 'date') {
    if (!filter.query) return true;
    const comparableDate = key === 'resolvedAt'
      ? rawValue.slice(0, 10)
      : sourceDateAsInput(rawValue);
    return comparableDate === filter.query;
  }

  if (column.filterType === 'select') {
    if (!filter.value) return true;
    if (filter.value === MISSING_FILTER_VALUE) return !rawValue;
    if (key === 'issue') return row.anomalyTypes.includes(filter.value as MmsAnomalyId);
    return rawValue === filter.value;
  }

  return !filter.query || rawValue.toLocaleLowerCase().includes(filter.query.toLocaleLowerCase());
}

export function filterAndSortReviewRows(
  rows: MmsAnomalyRow[],
  statusFilter: StatusFilter,
  filters: ColumnFilters,
  sort: ReviewSort | null,
): MmsAnomalyRow[] {
  const filtered = rows.filter(row => {
    if (statusFilter !== 'all' && row.status !== statusFilter) return false;
    return (Object.entries(filters) as [ReviewColumnKey, ColumnFilterValue][])
      .every(([key, filter]) => !hasActiveColumnFilter(filter) || rowMatchesFilter(row, key, filter));
  });

  if (!sort) return filtered;
  const column = COLUMN_BY_KEY[sort.key];
  const multiplier = sort.direction === 'asc' ? 1 : -1;
  return [...filtered].sort((left, right) => {
    const leftValue = column.value(left);
    const rightValue = column.value(right);
    if (column.numericSort) {
      return (Number(leftValue || 0) - Number(rightValue || 0)) * multiplier;
    }
    return leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: 'base' }) * multiplier;
  });
}

function filterOptions(column: ReviewColumn, rows: MmsAnomalyRow[]): string[] {
  if (column.key === 'issue') {
    return [...new Set(rows.flatMap(row => row.anomalyTypes))].sort();
  }
  const values = rows.map(row => column.value(row));
  const options = [...new Set(values.filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  return values.some(value => !value) ? [MISSING_FILTER_VALUE, ...options] : options;
}

interface ColumnFilterPopoverProps {
  column: ReviewColumn;
  filter: ColumnFilterValue;
  options: string[];
  onChange: (next: ColumnFilterValue) => void;
  onClear: () => void;
}

function ColumnFilterPopover({ column, filter, options, onChange, onClear }: ColumnFilterPopoverProps) {
  return (
    <div
      className="absolute left-0 top-full z-40 mt-1 w-[230px] rounded-[8px] border border-border-subtle bg-white p-3 text-left normal-case tracking-normal shadow-lg"
      onClick={event => event.stopPropagation()}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-[12px] font-semibold text-text-main">Filter {column.label}</span>
        <button
          type="button"
          onClick={onClear}
          className="text-[11px] font-medium text-brand-600 hover:text-brand-700 focus:outline-none focus:underline"
        >
          Clear
        </button>
      </div>

      {column.filterType === 'select' && (
        <select
          autoFocus
          value={filter.value || ''}
          onChange={event => onChange({ value: event.target.value })}
          className="h-9 w-full rounded-[6px] border border-border-subtle bg-white px-2 text-[12px] font-normal text-text-main outline-none focus:border-brand-600"
        >
          <option value="">All values</option>
          {options.map(option => <option key={option} value={option}>{option === MISSING_FILTER_VALUE ? 'Missing' : option}</option>)}
        </select>
      )}

      {column.filterType === 'date' && (
        <input
          autoFocus
          type="date"
          value={filter.query || ''}
          onChange={event => onChange({ query: event.target.value })}
          className="h-9 w-full rounded-[6px] border border-border-subtle px-2 text-[12px] font-normal text-text-main outline-none focus:border-brand-600"
        />
      )}

      {column.filterType === 'number' && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] font-medium text-text-muted">
            Minimum
            <input
              autoFocus
              type="number"
              step="any"
              value={filter.min || ''}
              onChange={event => onChange({ ...filter, min: event.target.value })}
              className="mt-1 h-9 w-full rounded-[6px] border border-border-subtle px-2 text-[12px] font-normal text-text-main outline-none focus:border-brand-600"
            />
          </label>
          <label className="text-[11px] font-medium text-text-muted">
            Maximum
            <input
              type="number"
              step="any"
              value={filter.max || ''}
              onChange={event => onChange({ ...filter, max: event.target.value })}
              className="mt-1 h-9 w-full rounded-[6px] border border-border-subtle px-2 text-[12px] font-normal text-text-main outline-none focus:border-brand-600"
            />
          </label>
        </div>
      )}

      {column.filterType === 'text' && (
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
          <input
            autoFocus
            type="search"
            value={filter.query || ''}
            onChange={event => onChange({ query: event.target.value })}
            placeholder="Contains..."
            className="h-9 w-full rounded-[6px] border border-border-subtle pl-8 pr-2 text-[12px] font-normal text-text-main outline-none focus:border-brand-600"
          />
        </label>
      )}
    </div>
  );
}

interface ReviewPanelProps {
  anomalyId: MmsAnomalyId;
  rows: MmsAnomalyRow[];
  onClose: () => void;
  onResolve: (rowIds: string[], resolution: ResolutionChoice, auditNote: string) => void;
}

function ReviewPanel({ anomalyId, rows, onClose, onResolve }: ReviewPanelProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('for-review');
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [sort, setSort] = useState<ReviewSort | null>(null);
  const [openFilter, setOpenFilter] = useState<ReviewColumnKey | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [resolution, setResolution] = useState<ResolutionChoice | ''>('');
  const [auditNote, setAuditNote] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const rule = MMS_ANOMALY_RULES.find(item => item.id === anomalyId)!;
  const groupRows = useMemo(
    () => rows.filter(row => row.anomalyTypes.includes(anomalyId)),
    [anomalyId, rows],
  );
  const visibleRows = useMemo(
    () => filterAndSortReviewRows(groupRows, statusFilter, columnFilters, sort),
    [columnFilters, groupRows, sort, statusFilter],
  );
  const selectableRows = visibleRows.filter(row => row.status === 'for-review');
  const selectedRows = groupRows.filter(row => selectedIds.has(row.id));
  const allVisibleSelected = selectableRows.length > 0
    && selectableRows.every(row => selectedIds.has(row.id));
  const sameAnomalyType = selectedRows.length > 0
    && selectedRows.every(row => row.anomalyTypes.includes(anomalyId));
  const canResolve = sameAnomalyType && Boolean(resolution) && Boolean(auditNote.trim());
  const activeFilterCount = Object.values(columnFilters).filter(hasActiveColumnFilter).length;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (openFilter) setOpenFilter(null);
      else onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, openFilter]);

  const clearSelections = () => {
    setSelectedIds(new Set());
    setConfirmation('');
  };

  const changeStatusFilter = (next: StatusFilter) => {
    setStatusFilter(next);
    clearSelections();
  };

  const changeColumnFilter = (key: ReviewColumnKey, next: ColumnFilterValue) => {
    setColumnFilters(current => ({ ...current, [key]: next }));
    clearSelections();
  };

  const clearColumnFilter = (key: ReviewColumnKey) => {
    setColumnFilters(current => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    clearSelections();
  };

  const clearAllFilters = () => {
    setStatusFilter('for-review');
    setColumnFilters({});
    setOpenFilter(null);
    clearSelections();
  };

  const toggleSort = (key: ReviewColumnKey) => {
    setSort(current => {
      if (!current || current.key !== key) return { key, direction: 'asc' };
      if (current.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
  };

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
      if (allVisibleSelected) selectableRows.forEach(row => next.delete(row.id));
      else selectableRows.forEach(row => next.add(row.id));
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

  const renderCell = (row: MmsAnomalyRow, column: ReviewColumn) => {
    if (column.key === 'date') return formatSourceDate(row.date);
    if (column.key === 'transactionType') return <span className={row.transactionType ? '' : 'text-error'}>{row.transactionType || 'Missing'}</span>;
    if (column.key === 'issue') {
      return <div className="flex max-w-[360px] flex-wrap gap-1.5">{row.anomalyTypes.map(issue => (
        <span key={issue} className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800">{issue}</span>
      ))}</div>;
    }
    if (column.key === 'status') {
      return <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${row.status === 'reviewed' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
        {row.status === 'reviewed' ? 'Reviewed' : 'For review'}
      </span>;
    }
    if (column.key === 'resolvedAt') {
      return <div className="max-w-[280px]">
        <span className="whitespace-nowrap">{formatResolvedAt(row.resolvedAt)}</span>
        {row.auditNote && <span className="mt-1 block text-[11px] leading-4 text-text-main">Note: {row.auditNote}</span>}
      </div>;
    }
    return column.value(row) || '—';
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-3 sm:p-6" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="mms-review-title"
        className="flex max-h-[90vh] w-full max-w-[1480px] flex-col overflow-hidden rounded-[12px] bg-white shadow-xl"
        onMouseDown={event => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-5 border-b border-border-subtle bg-white px-6 py-5">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-silver-bg px-2 py-1 text-[11px] font-medium text-silver-text">MMS anomaly review</span>
              <span className="text-[12px] text-text-muted">{groupRows.length.toLocaleString()} affected rows</span>
            </div>
            <h2 id="mms-review-title" className="break-all text-[18px] font-semibold text-text-main">{anomalyId}</h2>
            <p className="mt-1 max-w-[900px] text-[12px] leading-5 text-text-muted">{rule.definition}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close anomaly review"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] text-text-muted hover:bg-surface-bg hover:text-text-main focus:outline-none focus:ring-2 focus:ring-brand-600"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-white px-6 py-3">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Status filter">
            <span className="mr-1 text-[12px] font-semibold text-text-muted">Status</span>
            {STATUS_FILTERS.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => changeStatusFilter(option.value)}
                className={`h-8 rounded-[6px] border px-3 text-[12px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-600 ${statusFilter === option.value ? 'border-brand-600 bg-brand-600 text-white' : 'border-border-subtle bg-white text-text-main hover:bg-surface-bg'}`}
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              onClick={clearAllFilters}
              disabled={activeFilterCount === 0 && statusFilter === 'for-review'}
              className="ml-1 inline-flex h-8 items-center rounded-[6px] border border-border-subtle bg-white px-3 text-[12px] font-medium text-text-main hover:bg-surface-bg disabled:cursor-not-allowed disabled:opacity-40"
            >
              <X className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Clear filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </button>
          </div>
          <p className="text-[12px] text-text-muted">{visibleRows.length} shown · {selectedIds.size} selected</p>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="min-w-[2200px] border-collapse text-left">
            <thead className="sticky top-0 z-20 bg-surface-bg">
              <tr className="border-b border-border-subtle">
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all visible rows for review"
                    checked={allVisibleSelected}
                    disabled={selectableRows.length === 0}
                    onChange={toggleAllVisible}
                    className="h-4 w-4 rounded border-gray-300 accent-[#0054A6] disabled:opacity-40"
                  />
                </th>
                {REVIEW_COLUMNS.map(column => {
                  const activeFilter = hasActiveColumnFilter(columnFilters[column.key]);
                  const activeSort = sort?.key === column.key ? sort.direction : null;
                  return (
                    <th
                      key={column.key}
                      aria-sort={activeSort === 'asc' ? 'ascending' : activeSort === 'desc' ? 'descending' : 'none'}
                      className={`relative whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted ${column.align === 'right' ? 'text-right' : ''}`}
                    >
                      <div className={`flex items-center gap-1 ${column.align === 'right' ? 'justify-end' : ''}`}>
                        <button
                          type="button"
                          onClick={() => toggleSort(column.key)}
                          className="inline-flex items-center gap-1 rounded-[4px] hover:text-text-main focus:outline-none focus:ring-2 focus:ring-brand-600"
                          aria-label={`Sort by ${column.label}${activeSort ? `, currently ${activeSort === 'asc' ? 'ascending' : 'descending'}` : ''}`}
                        >
                          {column.label}
                          {activeSort === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-brand-600" /> : activeSort === 'desc' ? <ArrowDown className="h-3.5 w-3.5 text-brand-600" /> : <ArrowUpDown className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setOpenFilter(current => current === column.key ? null : column.key)}
                          className={`flex h-6 w-6 items-center justify-center rounded-[4px] hover:bg-white hover:text-text-main focus:outline-none focus:ring-2 focus:ring-brand-600 ${activeFilter ? 'bg-brand-50 text-brand-600' : ''}`}
                          aria-label={`Filter ${column.label}${activeFilter ? ', filter active' : ''}`}
                          aria-expanded={openFilter === column.key}
                        >
                          <Filter className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                      {openFilter === column.key && (
                        <ColumnFilterPopover
                          column={column}
                          filter={columnFilters[column.key] || {}}
                          options={filterOptions(column, groupRows)}
                          onChange={next => changeColumnFilter(column.key, next)}
                          onClear={() => clearColumnFilter(column.key)}
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {visibleRows.map(row => (
                <tr key={row.id} className={`transition-colors hover:bg-surface-bg ${selectedIds.has(row.id) ? 'bg-brand-50' : 'bg-white'}`}>
                  <td className="px-4 py-3 align-top">
                    <input
                      type="checkbox"
                      aria-label={`Select source row ${row.sourceRow}`}
                      checked={selectedIds.has(row.id)}
                      disabled={row.status === 'reviewed'}
                      onChange={() => toggleRow(row.id)}
                      className="h-4 w-4 rounded border-gray-300 accent-[#0054A6] disabled:opacity-40"
                    />
                  </td>
                  {REVIEW_COLUMNS.map(column => (
                    <td key={column.key} className={`px-4 py-3 text-[12px] text-text-main ${column.align === 'right' ? 'text-right' : ''} ${['date', 'transactionNumber', 'registerNumber', 'storeCode', 'skuCode'].includes(column.key) ? 'whitespace-nowrap' : ''}`}>
                      {renderCell(row, column)}
                    </td>
                  ))}
                </tr>
              ))}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={15} className="px-6 py-12 text-center text-[13px] text-text-muted">
                    No MMS rows match the current status and column filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="shrink-0 border-t border-border-subtle bg-white px-6 py-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(220px,0.7fr)_minmax(320px,1.3fr)_auto] lg:items-end">
            <label className="text-[12px] font-semibold text-text-muted">
              Resolution
              <select
                value={resolution}
                onChange={event => setResolution(event.target.value as ResolutionChoice | '')}
                disabled={selectedIds.size === 0}
                className="mt-2 h-10 w-full rounded-[6px] border border-border-subtle bg-white px-3 text-[13px] font-normal text-text-main outline-none focus:border-brand-600 disabled:bg-surface-bg disabled:opacity-60"
              >
                <option value="">Choose a resolution</option>
                <option value="accept">Accept as valid</option>
                <option value="exclude">Exclude from clean output</option>
              </select>
            </label>
            <label className="text-[12px] font-semibold text-text-muted">
              Audit note <span className="text-error">*</span>
              <input
                type="text"
                value={auditNote}
                onChange={event => setAuditNote(event.target.value)}
                disabled={selectedIds.size === 0}
                placeholder="Explain why this resolution is appropriate"
                className="mt-2 h-10 w-full rounded-[6px] border border-border-subtle px-3 text-[13px] font-normal text-text-main outline-none placeholder:text-gray-400 focus:border-brand-600 disabled:bg-surface-bg disabled:opacity-60"
              />
            </label>
            <button
              type="button"
              onClick={completeResolution}
              disabled={!canResolve}
              className="inline-flex h-10 items-center justify-center rounded-[6px] bg-[#0054A6] px-4 text-[13px] font-semibold text-white hover:bg-[#004385] focus:outline-none focus:ring-2 focus:ring-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Complete resolution
            </button>
          </div>
          <div className="mt-2 flex min-h-5 items-center justify-between gap-4 text-[11px]">
            <p className={sameAnomalyType || selectedRows.length === 0 ? 'text-text-muted' : 'font-medium text-error'}>
              Selections are limited to rows in this anomaly type. An audit note is required.
            </p>
            {confirmation && <p role="status" className="font-medium text-green-800">{confirmation}</p>}
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
    const header = REVIEW_COLUMNS.map(column => csvCell(column.label)).join(',');
    const records = rows.map(row => REVIEW_COLUMNS.map(column => csvCell(column.value(row))).join(','));
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-semibold text-text-main">Silver MMS Data</h2>
          <p className="mt-1 text-[13px] text-text-muted">417.csv · MMS-only validation · 37 unique anomaly rows</p>
          <p className="mt-1 text-[11px] text-text-muted">Refreshed {lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex h-9 items-center justify-center rounded-[6px] border border-border-subtle bg-white px-4 text-[13px] font-medium text-text-main hover:bg-surface-bg focus:outline-none focus:ring-2 focus:ring-brand-600"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex h-9 items-center justify-center rounded-[6px] bg-[#0054A6] px-4 text-[13px] font-medium text-white hover:bg-[#004385] focus:outline-none focus:ring-2 focus:ring-brand-600"
          >
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            Download anomalies CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['MMS Rows Checked', scorecards.rowsChecked],
          ['Rows for Review', scorecards.rowsForReview],
          ['Resolved', scorecards.resolved],
          ['Clean', scorecards.clean],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-[10px] border border-border-subtle bg-white p-6 shadow-subtle">
            <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-text-muted">{label}</h3>
            <p className="text-[28px] font-bold text-text-main">{Number(value).toLocaleString()}</p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-[10px] border border-border-subtle bg-white shadow-subtle">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border-subtle px-6 py-5">
          <div>
            <h3 className="text-[16px] font-semibold text-text-main">Anomaly summary</h3>
            <p className="mt-1 text-[12px] text-text-muted">Rule counts can overlap. Rows for Review counts unique unresolved rows.</p>
          </div>
          <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-[11px] font-medium text-green-800">Validated</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-bg">
                <th className="px-6 py-3 text-[12px] font-semibold uppercase tracking-wider text-text-muted">Anomaly</th>
                <th className="w-40 px-6 py-3 text-right text-[12px] font-semibold uppercase tracking-wider text-text-muted">Affected Rows</th>
                <th className="w-56 px-6 py-3 text-right text-[12px] font-semibold uppercase tracking-wider text-text-muted">Remaining Rows for Review</th>
                <th className="w-36 px-6 py-3 text-right text-[12px] font-semibold uppercase tracking-wider text-text-muted">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {MMS_ANOMALY_RULES.map(rule => {
                const groupRows = rows.filter(row => row.anomalyTypes.includes(rule.id));
                const remainingRows = groupRows.filter(row => row.status === 'for-review').length;
                const groupReviewed = rule.affectedRows > 0 && remainingRows === 0;
                const tooltipId = `${rule.id.toLowerCase()}-definition`;
                return (
                  <tr key={rule.id} className="transition-colors hover:bg-surface-bg">
                    <td className="px-6 py-4">
                      <div className="group relative inline-flex max-w-full items-center gap-2">
                        <button
                          type="button"
                          aria-describedby={tooltipId}
                          onClick={() => rule.affectedRows > 0 && setActiveAnomaly(rule.id)}
                          className={`break-all text-left text-[13px] font-semibold text-text-main focus:outline-none focus:ring-2 focus:ring-brand-600 ${rule.affectedRows > 0 ? 'hover:text-brand-600' : 'cursor-help'}`}
                        >
                          {rule.id}
                        </button>
                        <Info className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
                        <span
                          id={tooltipId}
                          role="tooltip"
                          className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 w-[340px] max-w-[70vw] rounded-[6px] bg-gray-900 px-3 py-2 text-[11px] font-normal leading-4 text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                        >
                          {rule.definition}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-[13px] font-medium text-text-main">{rule.affectedRows.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-[13px] font-medium text-text-main">{remainingRows.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">
                      {rule.affectedRows === 0 ? (
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-800">No anomalies</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveAnomaly(rule.id)}
                          className={`inline-flex h-8 items-center rounded-[6px] border px-3 text-[12px] font-medium focus:outline-none focus:ring-2 focus:ring-brand-600 ${groupReviewed ? 'border-green-200 bg-green-100 text-green-800 hover:bg-green-50' : 'border-border-subtle bg-white text-text-main hover:bg-surface-bg'}`}
                        >
                          {groupReviewed && <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />}
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
        <ReviewPanel anomalyId={activeAnomaly} rows={rows} onClose={() => setActiveAnomaly(null)} onResolve={handleResolve} />
      )}
    </div>
  );
}
