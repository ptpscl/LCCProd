import { useState, useEffect } from 'react';
import { DATASETS } from '../../config/datasets';
import { ChevronDown } from 'lucide-react';
import { eventsService, AppEvent } from '../../services/eventsService';

export default function HistoryView() {
  const [filterDataset, setFilterDataset] = useState('All');
  const [filterAction, setFilterAction] = useState('All');
  const [history, setHistory] = useState<AppEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await eventsService.listEvents();
        setHistory(data);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch history events.');
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const filteredHistory = history.filter(row => {
    if (filterDataset !== 'All' && row.dataset !== filterDataset) return false;
    if (filterAction !== 'All' && row.type !== filterAction) return false;
    return true;
  });

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[20px] font-semibold text-text-main mb-1">Audit Log</h2>
          <p className="text-[14px] text-text-muted">Chronological history across all datasets and layers.</p>
          {error && <p className="text-[13px] text-error mt-2 font-medium">Error: {error}</p>}
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
              <option value="Sign Up">Sign Up</option>
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
              {loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[13px] text-text-muted">
                    Loading history...
                  </td>
                </tr>
              )}
              {!loading && filteredHistory.map(row => (
                <tr key={row.id} className="hover:bg-surface-bg transition-colors">
                  <td className="px-6 py-4 text-[13px] text-text-muted whitespace-nowrap">
                    {new Date(row.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </td>
                  <td className="px-6 py-4 text-[13px] font-medium text-text-main whitespace-nowrap">
                    {row.dataset}
                  </td>
                  <td className="px-6 py-4 text-[13px] text-text-main whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${row.type === 'Upload' ? 'bg-surface-bg text-text-muted border border-border-subtle' : 'bg-success/10 text-success border border-success/20'}`}>
                      {row.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[13px] text-text-muted">
                    {row.detail}
                  </td>
                  <td className="px-6 py-4 text-[13px] font-medium text-text-main whitespace-nowrap">
                    {row.actor}
                  </td>
                </tr>
              ))}
              {!loading && filteredHistory.length === 0 && (
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
