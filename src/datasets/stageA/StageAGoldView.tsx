import { useMemo, useState } from 'react';
import { Download, Filter, ShieldCheck, Sparkles } from 'lucide-react';
import {
  CUSTOMER_COLUMNS,
  createStageARows,
  getStageARelationalFlags,
  LOYALTY_COLUMNS,
  STAGE_A_ANOMALY_SUMMARY,
} from './stageASilverMockData';

type GoldFilter = 'All' | 'Ready' | 'Accepted' | 'Excluded';

export default function StageAGoldView() {
  const allRows = createStageARows();
  const [statusFilter, setStatusFilter] = useState<GoldFilter>('All');
  const [query, setQuery] = useState('');

  const goldRows = useMemo(() => allRows.filter(row => {
    if (statusFilter === 'Ready' && row.readyForStageB !== 'READY') return false;
    if (statusFilter === 'Accepted' && row.resolution !== 'Accept as Valid') return false;
    if (statusFilter === 'Excluded' && row.resolution !== 'Exclude from Output') return false;

    if (query) {
      const haystack = [
        row.id,
        row.loyalty.DATE,
        row.loyalty['TRANSACTION NUMBER'],
        row.loyalty['STORE CODE'],
        row.loyalty['CUSTOMER NUMBER'],
        row.loyalty['SKU CODE'],
        row.matchStatus,
        row.datasetAnomaly,
        row.resolution,
      ].join(' ').toLowerCase();
      if (!haystack.includes(query.toLowerCase())) return false;
    }

    return true;
  }), [allRows, query, statusFilter]);

  const readyCount = allRows.filter(row => row.readyForStageB === 'READY').length;
  const acceptedCount = allRows.filter(row => row.resolution === 'Accept as Valid').length;
  const excludedCount = allRows.filter(row => row.resolution === 'Exclude from Output').length;

  const exportCsv = () => {
    const headers = [...LOYALTY_COLUMNS, ...CUSTOMER_COLUMNS.map(value => `CLD_${value}`), 'MATCH_STATUS', 'RELATIONAL_FLAG', 'RESOLUTION', 'READY_FOR_STAGE_B'];
    const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = goldRows.map(row => [
      ...LOYALTY_COLUMNS.map(key => row.loyalty[key] || ''),
      ...CUSTOMER_COLUMNS.map(key => row.customer[key] || ''),
      row.matchStatus,
      getStageARelationalFlags(row),
      row.resolution || '',
      row.readyForStageB,
    ].map(quote).join(','));

    const csv = [headers.map(quote).join(','), ...rows].join('\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'stage_a_gold_rows.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[10px] border border-gold-accent/20 bg-gradient-to-r from-gold-bg to-white px-5 py-4 shadow-subtle">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-accent/10 text-gold-accent">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-[18px] font-semibold text-text-main">Gold Stage A Data</h2>
            <p className="mt-1 text-[13px] text-text-muted">
              Clean, accepted Stage A outputs that are ready for downstream use.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex h-10 items-center rounded-[7px] bg-[#B58A00] px-4 text-[13px] font-semibold text-white hover:bg-[#987400]"
        >
          <Download className="mr-2 h-4 w-4" />
          Export Gold CSV
        </button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Ready for Stage B', readyCount, 'text-[#8A7526]'],
          ['Accepted', acceptedCount, 'text-green-700'],
          ['Excluded', excludedCount, 'text-amber-700'],
          ['Rule Definitions', STAGE_A_ANOMALY_SUMMARY.length, 'text-text-main'],
        ].map(([label, value, color]) => (
          <div key={String(label)} className="rounded-[10px] border border-border-subtle bg-white p-6 shadow-subtle">
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-text-muted">{label}</h3>
            <p className={`text-[28px] font-bold ${color}`}>{Number(value).toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="rounded-[10px] border border-border-subtle bg-white p-5 shadow-subtle">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-[#B58A00]" />
          <div>
            <h3 className="text-[14px] font-semibold text-text-main">Gold promotion rules</h3>
            <p className="mt-1 text-[12px] text-text-muted">
              Gold keeps only accepted or explicitly excluded Stage A records. This view is read-only and represents the promoted output set.
            </p>
          </div>
        </div>
      </div>

      <div className="grid items-end gap-4 rounded-[10px] border border-border-subtle bg-white p-5 shadow-subtle md:grid-cols-[1.4fr_0.8fr_auto]">
        <label className="text-[12px] font-semibold text-text-muted">
          Search
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Transaction, customer, status, or anomaly"
            className="mt-2 h-10 w-full rounded-[6px] border border-border-subtle px-3 text-[13px] font-normal outline-none focus:border-[#B58A00]"
          />
        </label>
        <label className="text-[12px] font-semibold text-text-muted">
          Gold state
          <select
            value={statusFilter}
            onChange={event => setStatusFilter(event.target.value as GoldFilter)}
            className="mt-2 h-10 w-full rounded-[6px] border border-border-subtle bg-white px-3 text-[13px] font-normal outline-none focus:border-[#B58A00]"
          >
            <option value="All">All rows</option>
            <option value="Ready">Ready for Stage B</option>
            <option value="Accepted">Accepted</option>
            <option value="Excluded">Excluded</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => { setQuery(''); setStatusFilter('All'); }}
          className="inline-flex h-10 items-center rounded-[6px] border border-border-subtle px-4 text-[13px]"
        >
          <Filter className="mr-2 h-4 w-4" />
          Clear
        </button>
      </div>

      <div className="overflow-hidden rounded-[10px] border border-border-subtle bg-white shadow-subtle">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1700px] text-left">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-bg">
                {['Date', 'Transaction', 'Customer', 'SKU', 'Match Status', 'Relational Flag', 'Resolution', 'Ready', 'Audit Note'].map(label => (
                  <th key={label} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {!goldRows.length ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[13px] text-text-muted">
                    No Gold Stage A rows match these filters.
                  </td>
                </tr>
              ) : goldRows.map(row => (
                <tr key={row.id} className="hover:bg-surface-bg">
                  <td className="px-4 py-3 text-[12px]">{row.loyalty.DATE}</td>
                  <td className="px-4 py-3 font-mono text-[12px]">{row.loyalty['TRANSACTION NUMBER']}</td>
                  <td className="px-4 py-3 font-mono text-[12px]">{row.loyalty['CUSTOMER NUMBER'] || '—'}</td>
                  <td className="px-4 py-3 font-mono text-[12px]">{row.loyalty['SKU CODE']}</td>
                  <td className="px-4 py-3 text-[12px]">{row.matchStatus}</td>
                  <td className="px-4 py-3 text-[12px] text-amber-800">{getStageARelationalFlags(row)}</td>
                  <td className="px-4 py-3 text-[12px]">{row.resolution || '—'}</td>
                  <td className="px-4 py-3 text-[12px]">{row.readyForStageB}</td>
                  <td className="max-w-[320px] px-4 py-3 text-[11px] text-text-muted">{row.auditNote || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border-subtle px-5 py-4 text-[12px] text-text-muted">
          {goldRows.length} promoted Stage A records
        </div>
      </div>
    </div>
  );
}
