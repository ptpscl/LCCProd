import { useEffect, useRef, useState } from 'react';
import { Download, Loader2, Search, X } from 'lucide-react';

import {
  exportMmsBronzeRows,
  getMmsBronzeRows,
  getMmsBronzeStats,
  MmsBronzeFilters,
  MmsBronzeRow,
  MmsBronzeStats,
} from './mmsService';

interface MmsDataViewProps {
  onBack: () => void;
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

type SourceColumn =
  | 'DATE'
  | 'TRANSACTION_NUMBER'
  | 'REGISTER_NUMBER'
  | 'STORE_CODE'
  | 'STORE_CATEGORIZATION'
  | 'SKU_CODE'
  | 'TRANSACTION_TYPE'
  | 'MMS_SALES'
  | 'QTY_SOLD'
  | 'MARGIN';

const SOURCE_COLUMNS: { key: SourceColumn; label: SourceColumn }[] = [
  { key: 'DATE', label: 'DATE' },
  { key: 'TRANSACTION_NUMBER', label: 'TRANSACTION_NUMBER' },
  { key: 'REGISTER_NUMBER', label: 'REGISTER_NUMBER' },
  { key: 'STORE_CODE', label: 'STORE_CODE' },
  { key: 'STORE_CATEGORIZATION', label: 'STORE_CATEGORIZATION' },
  { key: 'SKU_CODE', label: 'SKU_CODE' },
  { key: 'TRANSACTION_TYPE', label: 'TRANSACTION_TYPE' },
  { key: 'MMS_SALES', label: 'MMS_SALES' },
  { key: 'QTY_SOLD', label: 'QTY_SOLD' },
  { key: 'MARGIN', label: 'MARGIN' },
];

const PAGE_SIZE = 20;

function safeDataError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : '';
  if (
    message.includes('must be a valid YYMMDD calendar date')
    || message === 'date_from cannot be later than date_to'
    || message.startsWith('Too many rows to export')
  ) {
    return message;
  }
  return fallback;
}

function displayValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number' && value !== value) return '—';
  return value;
}

export default function MmsDataView({ onBack, showToast }: MmsDataViewProps) {
  const [stats, setStats] = useState<MmsBronzeStats | null>(null);
  const [rows, setRows] = useState<MmsBronzeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalMatching, setTotalMatching] = useState(0);
  const [appliedFilters, setAppliedFilters] = useState<MmsBronzeFilters>({});

  const [storeCode, setStoreCode] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [skuCode, setSkuCode] = useState('');
  const rowRequestSequence = useRef(0);

  const loadRows = async (targetPage: number, filters: MmsBronzeFilters) => {
    const requestSequence = rowRequestSequence.current + 1;
    rowRequestSequence.current = requestSequence;
    setLoading(true);
    setError('');

    try {
      const result = await getMmsBronzeRows({
        ...filters,
        page: targetPage,
        page_size: PAGE_SIZE,
      });
      if (requestSequence !== rowRequestSequence.current) return;

      setRows(result.rows);
      setPage(result.page);
      setTotalMatching(result.total_matching_rows);
    } catch (requestError) {
      if (requestSequence !== rowRequestSequence.current) return;
      const message = safeDataError(requestError, 'MMS rows could not be loaded. Please try again.');
      setRows([]);
      setTotalMatching(0);
      setPage(targetPage);
      setError(message);
      showToast(message, 'error');
    } finally {
      if (requestSequence === rowRequestSequence.current) setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    getMmsBronzeStats()
      .then(result => {
        if (active) setStats(result);
      })
      .catch(() => {
        if (active) setStats(null);
      });
    void loadRows(1, {});

    return () => {
      active = false;
      rowRequestSequence.current += 1;
    };
  }, []);

  const selectedFilters = (): MmsBronzeFilters => ({
    store_code: storeCode.trim() || undefined,
    date_from: dateFrom.trim() || undefined,
    date_to: dateTo.trim() || undefined,
    sku_code: skuCode.trim() || undefined,
  });

  const applyFilters = () => {
    const filters = selectedFilters();
    setAppliedFilters(filters);
    setPage(1);
    void loadRows(1, filters);
  };

  const clearFilters = () => {
    setStoreCode('');
    setDateFrom('');
    setDateTo('');
    setSkuCode('');
    setAppliedFilters({});
    setPage(1);
    void loadRows(1, {});
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await exportMmsBronzeRows(appliedFilters);
      showToast('MMS CSV export started.', 'success');
    } catch (exportError) {
      const message = safeDataError(exportError, 'The MMS CSV could not be exported. Please try again.');
      setError(message);
      showToast(message, 'error');
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.ceil(totalMatching / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="text-[13px] font-medium text-text-muted hover:text-[#0054A6] mb-2 flex items-center transition-colors"
          >
            ← Back to Overview
          </button>
          <h2 className="text-[20px] font-semibold text-text-main">Bronze MMS Data Explorer</h2>
          {stats && (
            <p className="text-[13px] text-text-muted mt-1">
              {stats.total_rows} total rows
              {stats.last_updated && ` · last updated ${stats.last_updated}`}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || loading}
          className="inline-flex items-center justify-center h-9 px-4 rounded-[6px] text-[13px] font-medium border border-border-subtle bg-white text-text-main hover:bg-surface-bg disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          {exporting ? 'Preparing CSV...' : 'Download CSV'}
        </button>
      </div>

      <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-[12px] font-medium text-text-muted mb-1">Store Code</label>
            <input
              type="text"
              value={storeCode}
              onChange={event => setStoreCode(event.target.value)}
              placeholder="e.g. 101"
              className="w-full h-9 px-3 rounded-[6px] border border-border-subtle text-[13px] focus:outline-none focus:border-[#0054A6]"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-text-muted mb-1">Date From (YYMMDD)</label>
            <input
              type="text"
              value={dateFrom}
              onChange={event => setDateFrom(event.target.value)}
              placeholder="e.g. 240101"
              className="w-full h-9 px-3 rounded-[6px] border border-border-subtle text-[13px] focus:outline-none focus:border-[#0054A6]"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-text-muted mb-1">Date To (YYMMDD)</label>
            <input
              type="text"
              value={dateTo}
              onChange={event => setDateTo(event.target.value)}
              placeholder="e.g. 240131"
              className="w-full h-9 px-3 rounded-[6px] border border-border-subtle text-[13px] focus:outline-none focus:border-[#0054A6]"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-text-muted mb-1">SKU Code</label>
            <input
              type="text"
              value={skuCode}
              onChange={event => setSkuCode(event.target.value)}
              placeholder="e.g. 12345"
              className="w-full h-9 px-3 rounded-[6px] border border-border-subtle text-[13px] focus:outline-none focus:border-[#0054A6]"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={applyFilters}
              disabled={loading}
              className="flex-1 h-9 rounded-[6px] text-[13px] font-medium bg-[#0054A6] text-white hover:bg-[#004385] disabled:opacity-50 transition-colors flex items-center justify-center"
            >
              <Search className="w-4 h-4 mr-2" /> Apply
            </button>
            <button
              type="button"
              onClick={clearFilters}
              disabled={loading}
              title="Clear filters"
              aria-label="Clear MMS filters"
              className="w-9 h-9 shrink-0 rounded-[6px] border border-border-subtle text-text-muted hover:text-text-main hover:bg-surface-bg disabled:opacity-50 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-error/10 border border-error/20 rounded-[8px] p-4 text-[13px] font-medium text-error">
          {error}
        </div>
      )}

      <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-left border-collapse">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-bg">
                {SOURCE_COLUMNS.map(column => (
                  <th
                    key={column.key}
                    className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {loading ? (
                <tr>
                  <td colSpan={SOURCE_COLUMNS.length} className="px-6 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-text-muted mx-auto" />
                    <p className="text-[13px] text-text-muted mt-2">Loading MMS rows...</p>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={SOURCE_COLUMNS.length} className="px-6 py-12 text-center text-[13px] text-text-muted">
                    No MMS rows match these filters.
                  </td>
                </tr>
              ) : (
                rows.map(row => (
                  <tr key={row.id} className="hover:bg-surface-bg transition-colors">
                    {SOURCE_COLUMNS.map(column => (
                      <td key={column.key} className="px-6 py-3 text-[13px] text-text-main whitespace-nowrap">
                        {displayValue(row[column.key])}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-border-subtle flex items-center justify-between gap-4 bg-surface-bg/50">
          <div className="text-[13px] text-text-muted">
            {totalMatching > 0 ? (
              <>
                Showing <span className="font-medium text-text-main">{(page - 1) * PAGE_SIZE + 1}</span>
                {' '}to <span className="font-medium text-text-main">{Math.min(page * PAGE_SIZE, totalMatching)}</span>
                {' '}of <span className="font-medium text-text-main">{totalMatching}</span> rows
              </>
            ) : '0 rows'}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => void loadRows(page - 1, appliedFilters)}
              className="h-8 px-3 rounded-[6px] text-[13px] font-medium border border-border-subtle bg-white text-text-main hover:bg-surface-bg disabled:opacity-50 transition-colors"
            >
              Previous
            </button>
            <span className="text-[13px] text-text-muted px-2">
              Page {page} of {Math.max(1, totalPages)}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => void loadRows(page + 1, appliedFilters)}
              className="h-8 px-3 rounded-[6px] text-[13px] font-medium border border-border-subtle bg-white text-text-main hover:bg-surface-bg disabled:opacity-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
