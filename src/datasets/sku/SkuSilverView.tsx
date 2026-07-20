import { useEffect, useRef, useState } from 'react';
import { Loader2, Play, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAccess } from '../../../src/governance/useAccess';
import { SkuBatch, listSkuBatches } from './skuService';
import { SilverBatch, listSilverBatches, startSilverProcessing, getSilverStatus } from './skuSilverService';

export default function SkuSilverView() {
  const { currentUser } = useAccess();

  const [bronzeBatches, setBronzeBatches] = useState<SkuBatch[]>([]);
  const [silverBatches, setSilverBatches] = useState<SilverBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef<number | null>(null);

  const activeRun = silverBatches.find(b => b.status === 'processing') || null;
  const ingestedBronze = bronzeBatches.filter(b => b.status === 'ingested' && (b.row_count || 0) > 0);
  const [selectedBronzeId, setSelectedBronzeId] = useState<string | null>(null);
  const defaultBronze = ingestedBronze.length > 0
    ? [...ingestedBronze].sort((a, b) => (b.row_count || 0) - (a.row_count || 0))[0]
    : null;
  const latestIngestedBronze = ingestedBronze.find(b => b.id === selectedBronzeId) || defaultBronze;

  const refresh = async () => {
    try {
      const [bronze, silver] = await Promise.all([listSkuBatches(), listSilverBatches()]);
      setBronzeBatches(bronze);
      setSilverBatches(silver);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  // Poll while a run is in progress
  useEffect(() => {
    if (activeRun && pollRef.current === null) {
      pollRef.current = window.setInterval(async () => {
        try {
          const status = await getSilverStatus(activeRun.id);
          setSilverBatches(prev => prev.map(b => b.id === status.id ? status : b));
          if (status.status !== 'processing' && pollRef.current !== null) {
            window.clearInterval(pollRef.current);
            pollRef.current = null;
          }
        } catch (e) { /* transient poll errors are fine */ }
      }, 3000);
    }
    return () => {
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [activeRun?.id]);

  const handleStart = async () => {
    if (!latestIngestedBronze || !currentUser) return;
    setStarting(true);
    setError('');
    try {
      await startSilverProcessing(latestIngestedBronze.id, currentUser.email);
      await refresh();
    } catch (e: any) {
      setError(e.message || 'Failed to start');
    } finally {
      setStarting(false);
    }
  };

  const statusBadge = (s: string) => {
    if (s === 'processing') return <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium bg-blue-100 text-blue-800">Processing</span>;
    if (s === 'completed') return <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium bg-green-100 text-green-800">Completed</span>;
    return <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium bg-red-100 text-red-800">Failed</span>;
  };

  return (
    <div className="space-y-6">
      {/* Run control */}
      <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[16px] font-semibold text-text-main mb-1">Silver Processing Pipeline</h3>
            <p className="text-[13px] text-text-muted">
              Runs the SKU cleaning (NB2) and anomaly tagging (NB3) pipeline on the ingested bronze data.
            </p>
            {ingestedBronze.length > 0 ? (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[12px] text-text-muted">Source:</span>
                <select
                  value={latestIngestedBronze?.id || ''}
                  onChange={e => setSelectedBronzeId(e.target.value)}
                  className="text-[12px] border border-border-subtle rounded-[6px] h-8 px-2 bg-white text-text-main"
                >
                  {ingestedBronze.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.file_name} · {(b.row_count || 0).toLocaleString()} rows · {new Date(b.created_at).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-[12px] text-error mt-2">No ingested bronze batch found — ingest one in the Bronze layer first.</p>
            )}
          </div>
          <button
            onClick={handleStart}
            disabled={starting || !!activeRun || !latestIngestedBronze}
            className="inline-flex items-center justify-center h-10 px-5 rounded-[8px] text-[13px] font-semibold bg-[#0054A6] text-white hover:bg-[#004385] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {starting || activeRun ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            {activeRun ? 'Processing…' : 'Process to Silver'}
          </button>
        </div>

        {activeRun && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-[8px] p-4 flex items-start">
            <Loader2 className="w-4 h-4 text-blue-600 mr-3 mt-0.5 animate-spin shrink-0" />
            <div>
              <p className="text-[13px] font-medium text-blue-800">{activeRun.step || 'Working…'}</p>
              <p className="text-[12px] text-blue-700 mt-0.5">Started {new Date(activeRun.created_at).toLocaleTimeString()} — this page updates automatically.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-error/10 border border-error/20 rounded-[8px] p-4 flex items-start">
            <AlertCircle className="w-4 h-4 text-error mr-3 mt-0.5 shrink-0" />
            <p className="text-[13px] font-medium text-error">{error}</p>
          </div>
        )}
      </div>

      {/* Run history */}
      <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle overflow-hidden">
        <div className="px-6 py-5 border-b border-border-subtle">
          <h3 className="text-[16px] font-semibold text-text-main">Pipeline runs</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-bg">
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Started</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Step</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Silver Rows</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">Excluded</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-wider">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-[13px] text-text-muted">Loading…</td></tr>
              ) : silverBatches.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-[13px] text-text-muted">No pipeline runs yet.</td></tr>
              ) : (
                silverBatches.map(b => (
                  <tr key={b.id} className="hover:bg-surface-bg transition-colors">
                    <td className="px-6 py-4 text-[13px] text-text-main whitespace-nowrap">
                      {new Date(b.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{statusBadge(b.status)}</td>
                    <td className="px-6 py-4 text-[13px] text-text-muted max-w-[320px] truncate" title={b.error_message || b.step || ''}>
                      {b.status === 'failed' ? (b.error_message || b.step) : b.step}
                    </td>
                    <td className="px-6 py-4 text-[13px] text-text-main whitespace-nowrap">
                      {b.silver_row_count != null ? b.silver_row_count.toLocaleString() : '—'}
                    </td>
                    <td className="px-6 py-4 text-[13px] text-text-main whitespace-nowrap">
                      {b.excluded_row_count != null ? b.excluded_row_count.toLocaleString() : '—'}
                    </td>
                    <td className="px-6 py-4 text-[13px] text-text-muted whitespace-nowrap">{b.started_by || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Placeholder for Phase 3 */}
      <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-6 text-center">
        <CheckCircle2 className="w-6 h-6 text-text-muted mx-auto mb-2" />
        <h3 className="text-[15px] font-semibold text-text-main mb-1">Anomaly Resolution Queue</h3>
        <p className="text-[13px] text-text-muted">
          After a pipeline run completes (Phase 2), tagged anomalies will appear here for family-by-family review and resolution.
        </p>
      </div>
    </div>
  );
}
