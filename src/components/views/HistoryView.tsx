import { useState } from 'react';
import { DATASETS } from '../../config/datasets';
import { ChevronDown } from 'lucide-react';

const MOCK_HISTORY = [
  { id: '1', timestamp: '2026-07-15T10:24:00Z', dataset: 'Customer database', action: 'Promote to Gold', detail: '211 records promoted', user: 'M. Reyes' },
  { id: '2', timestamp: '2026-07-15T09:15:00Z', dataset: 'Customer database', action: 'Upload', detail: 'batch #014, 1,204 rows', user: 'A. Santos' },
  { id: '3', timestamp: '2026-07-14T16:45:00Z', dataset: 'Loyalty sales', action: 'Promote to Gold', detail: '1,500 records promoted', user: 'M. Reyes' },
  { id: '4', timestamp: '2026-07-14T11:20:00Z', dataset: 'All transactions', action: 'Upload', detail: 'batch #089, 5,432 rows', user: 'J. Cruz' },
  { id: '5', timestamp: '2026-07-13T14:10:00Z', dataset: 'SKU hierarchy', action: 'Upload', detail: 'batch #005, 840 rows', user: 'C. Lim' },
  { id: '6', timestamp: '2026-07-13T10:05:00Z', dataset: 'Customer database', action: 'Promote to Gold', detail: '98 records promoted', user: 'M. Reyes' },
  { id: '7', timestamp: '2026-07-12T15:30:00Z', dataset: 'Loyalty sales', action: 'Upload', detail: 'batch #022, 2,100 rows', user: 'A. Santos' },
  { id: '8', timestamp: '2026-07-12T09:45:00Z', dataset: 'All transactions', action: 'Promote to Gold', detail: '4,100 records promoted', user: 'M. Reyes' },
  { id: '9', timestamp: '2026-07-11T13:20:00Z', dataset: 'SKU hierarchy', action: 'Promote to Gold', detail: '800 records promoted', user: 'J. Cruz' },
  { id: '10', timestamp: '2026-07-11T08:15:00Z', dataset: 'Customer database', action: 'Upload', detail: 'batch #013, 1,150 rows', user: 'C. Lim' },
];

export default function HistoryView() {
  const [filterDataset, setFilterDataset] = useState('All');
  const [filterAction, setFilterAction] = useState('All');

  const filteredHistory = MOCK_HISTORY.filter(row => {
    if (filterDataset !== 'All' && row.dataset !== filterDataset) return false;
    if (filterAction !== 'All' && row.action !== filterAction) return false;
    return true;
  });

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[20px] font-semibold text-text-main mb-1">Audit Log</h2>
          <p className="text-[14px] text-text-muted">Chronological history across all datasets and layers.</p>
        </div>

        <div className="flex items-center space-x-4">
          <div className="relative">
            <select
              value={filterDataset}
              onChange={(e) => setFilterDataset(e.target.value)}
              className="appearance-none flex items-center h-9 pl-4 pr-10 bg-white border border-border-subtle rounded-full text-[13px] font-medium text-text-main hover:border-brand-600 transition-colors shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-600/20"
            >
              <option value="All">All Datasets</option>
              {DATASETS.map(d => (
                <option key={d.id} value={d.label}>{d.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="appearance-none flex items-center h-9 pl-4 pr-10 bg-white border border-border-subtle rounded-full text-[13px] font-medium text-text-main hover:border-brand-600 transition-colors shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-600/20"
            >
              <option value="All">All Actions</option>
              <option value="Upload">Upload</option>
              <option value="Promote to Gold">Promote to Gold</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-bg">
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Timestamp</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Dataset</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Action</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Detail</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {filteredHistory.map(row => (
                <tr key={row.id} className="hover:bg-surface-bg transition-colors">
                  <td className="px-6 py-4 text-[13px] text-text-muted whitespace-nowrap">
                    {new Date(row.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </td>
                  <td className="px-6 py-4 text-[13px] font-medium text-text-main whitespace-nowrap">
                    {row.dataset}
                  </td>
                  <td className="px-6 py-4 text-[13px] text-text-main whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${row.action === 'Upload' ? 'bg-surface-bg text-text-muted border border-border-subtle' : 'bg-success/10 text-success border border-success/20'}`}>
                      {row.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[13px] text-text-muted">
                    {row.detail}
                  </td>
                  <td className="px-6 py-4 text-[13px] font-medium text-text-main whitespace-nowrap">
                    {row.user}
                  </td>
                </tr>
              ))}
              {filteredHistory.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[13px] text-text-muted">
                    No history records found for these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
