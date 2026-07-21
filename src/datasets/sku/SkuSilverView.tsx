import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Play, AlertCircle, RotateCcw, X, Download, RefreshCw, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useAccess } from '../../../src/governance/useAccess';
import { SkuBatch, listSkuBatches } from './skuService';
import { SilverBatch, listSilverBatches, startSilverProcessing, getSilverStatus } from './skuSilverService';
import {
  DEMO_SILVER, DEMO_EXCLUDED, DemoSku, DemoResolution,
  getResolutions, addResolution, removeResolution, clearResolutions, anomaliesCsv,
} from './skuDemoData';

type FamilyType = 'DUP' | 'VARIANT' | 'PROMO' | 'PROMO_ORPHAN';

interface TagDef {
  key: string;
  type: FamilyType;
  definition: string;
  resolutions: { value: DemoResolution['action']; label: string; needsCanonical?: boolean }[];
}

const TAG_DEFS: TagDef[] = [
  {
    key: 'AUTO_DUPLICATE', type: 'DUP',
    definition: 'Exact match on normalized description, hierarchy, brand, sell UOM, extracted units, and pack size — the same product encoded multiple times, differing only in text formatting and SKU code.',
    resolutions: [
      { value: 'merge', label: 'Merge into selected SKU', needsCanonical: true },
      { value: 'keep', label: 'Keep all — not duplicates' },
    ],
  },
  {
    key: 'AUTO_VARIANT', type: 'VARIANT',
    definition: 'Same hierarchy, brand, and core description but differing on a variant axis (size, pack, flavor, color, scent, or form) — legitimate variants of one product line.',
    resolutions: [
      { value: 'confirm_variants', label: 'Confirm as legitimate variants' },
      { value: 'keep', label: 'Keep — needs manual split' },
    ],
  },
  {
    key: 'PROMO_FAMILY_MEMBER', type: 'PROMO',
    definition: 'Promo SKU stitched back to its regular counterpart via shared base description after promo-token stripping.',
    resolutions: [
      { value: 'link_promo', label: 'Link promo SKUs to regular SKU' },
      { value: 'keep', label: 'Keep separate' },
    ],
  },
  {
    key: 'PROMO_ORPHAN', type: 'PROMO_ORPHAN',
    definition: 'Promo SKU with no regular (non-promo) counterpart found in the clean file.',
    resolutions: [
      { value: 'keep', label: 'Keep — acknowledged, no counterpart' },
    ],
  },
];

export default function SkuSilverView() {
  const { currentUser } = useAccess();

  const [bronzeBatches, setBronzeBatches] = useState<SkuBatch[]>([]);
  const [silverBatches, setSilverBatches] = useState<SilverBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef<number | null>(null);

  const [resolutions, setResolutions] = useState<DemoResolution[]>(getResolutions());
  const [openTag, setOpenTag] = useState<TagDef | null>(null);
  const [famIdx, setFamIdx] = useState(0);
  const [statusFilter, setStatusFilter] = useState<'for_review' | 'reviewed' | 'all'>('for_review');
  const [canonicalPick, setCanonicalPick] = useState<Record<string, string>>({});
  const [chosenAction, setChosenAction] = useState<string>('');
  const [auditNote, setAuditNote] = useState('');
  const [showExcluded, setShowExcluded] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'info' } | null>(null);
  const [refreshedAt, setRefreshedAt] = useState(new Date());

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }
  }, [toast]);

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
        } catch (e) { /* transient */ }
      }, 3000);
    }
    return () => {
      if (pollRef.current !== null) { window.clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [activeRun?.id]);

  const handleStart = async () => {
    if (!latestIngestedBronze || !currentUser) return;
    setStarting(true); setError('');
    try {
      await startSilverProcessing(latestIngestedBronze.id, currentUser.email);
      await refresh();
    } catch (e: any) { setError(e.message || 'Failed to start'); }
    finally { setStarting(false); }
  };

  const resolvedIds = new Set(resolutions.map(r => r.family_id));

  const familiesOf = (def: TagDef): Array<{ fid: string; members: DemoSku[] }> => {
    const fams: Record<string, DemoSku[]> = {};
    for (const s of DEMO_SILVER) {
      let fid = '';
      if (def.type === 'DUP') fid = s.dup_family_id;
      else if (def.type === 'VARIANT') fid = s.variant_family_id;
      else if (def.type === 'PROMO') fid = (s.promo_family_id && s.has_regular_anchor === 'Y') ? s.promo_family_id : '';
      else if (def.type === 'PROMO_ORPHAN') fid = (s.promo_family_id && s.has_regular_anchor === 'N') ? s.promo_family_id : '';
      if (fid) (fams[fid] = fams[fid] || []).push(s);
    }
    return Object.entries(fams).sort(([a], [b]) => a.localeCompare(b)).map(([fid, members]) => ({ fid, members }));
  };

  const allFamilyIds = TAG_DEFS.flatMap(d => familiesOf(d).map(f => f.fid));
  const totalFamilies = allFamilyIds.length;
  const resolvedCount = allFamilyIds.filter(f => resolvedIds.has(f)).length;
  const cleanCount = DEMO_SILVER.filter(s => s.anomaly_tags === 'CLEAN_UNIQUE').length;
  const anomalySkuCount = DEMO_SILVER.length - cleanCount;

  const modalFamilies = openTag
    ? familiesOf(openTag).filter(f =>
        statusFilter === 'all' ? true :
        statusFilter === 'reviewed' ? resolvedIds.has(f.fid) : !resolvedIds.has(f.fid))
    : [];
  const currentFam = modalFamilies[Math.min(famIdx, Math.max(0, modalFamilies.length - 1))] || null;
  const currentResolution = currentFam ? resolutions.find(r => r.family_id === currentFam.fid) : undefined;

  const openReview = (def: TagDef) => {
    setOpenTag(def); setFamIdx(0); setStatusFilter('for_review');
    setChosenAction(def.resolutions[0].value); setAuditNote('');
  };

  const completeResolution = () => {
    if (!openTag || !currentFam || !auditNote.trim()) return;
    const opt = openTag.resolutions.find(r => r.value === chosenAction);
    if (!opt) return;
    if (opt.needsCanonical && !canonicalPick[currentFam.fid]) return;
    const remainingBefore = modalFamilies.length;
    addResolution({
      family_id: currentFam.fid,
      family_type: openTag.type === 'DUP' ? 'DUP' : openTag.type === 'VARIANT' ? 'VARIANT' : 'PROMO',
      action: opt.value,
      canonical_sku_code: opt.needsCanonical ? canonicalPick[currentFam.fid] : undefined,
      audit_note: auditNote.trim(),
      resolved_by: currentUser?.email || 'demo user',
      resolved_at: new Date().toISOString(),
    });
    setResolutions(getResolutions());
    setAuditNote('');
    setToast({ message: `${currentFam.fid} resolved: ${opt.label}`, type: 'success' });
    if (statusFilter === 'for_review') {
      if (remainingBefore <= 1) {
        setOpenTag(null);
        setToast({ message: `All ${openTag.key} families resolved`, type: 'success' });
      } else if (famIdx >= remainingBefore - 1) {
        setFamIdx(0);
      }
    }
  };

  const undoFamily = (fid: string) => {
    removeResolution(fid);
    setResolutions(getResolutions());
    setToast({ message: `${fid} resolution undone`, type: 'info' });
  };

  const resetDemo = () => {
    clearResolutions(); setResolutions([]); setCanonicalPick({});
    setToast({ message: 'Demo reset — all resolutions cleared', type: 'info' });
  };

  const downloadCsv = () => {
    const blob = new Blob([anomaliesCsv()], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'sku_anomalies.csv';
    document.body.appendChild(a); a.click();
    window.URL.revokeObjectURL(url); document.body.removeChild(a);
  };

  const statusBadge = (s: string) => {
    if (s === 'processing') return <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium bg-blue-100 text-blue-800">Processing</span>;
    if (s === 'completed') return <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium bg-green-100 text-green-800">Completed</span>;
    return <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium bg-red-100 text-red-800">Failed</span>;
  };

  const reviewModal = () => {
    if (!openTag) return null;
    const affected = familiesOf(openTag).reduce((n, f) => n + f.members.length, 0);
    const chip = (key: typeof statusFilter, label: string) => (
      <button onClick={() => { setStatusFilter(key); setFamIdx(0); }}
        className={`h-7 px-3 rounded-full text-[12px] font-medium transition-colors ${
          statusFilter === key ? 'bg-[#0054A6] text-white' : 'bg-white border border-border-subtle text-text-main hover:bg-surface-bg'}`}>
        {label}
      </button>
    );
    const opt = openTag.resolutions.find(r => r.value === chosenAction);
    const canComplete = !!currentFam && !currentResolution && !!auditNote.trim()
      && !!opt && (!opt.needsCanonical || !!canonicalPick[currentFam.fid]);

    return (
      <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-[12px] shadow-lg w-full max-w-[980px] overflow-hidden flex flex-col max-h-[92vh]">
          <div className="px-6 pt-5 pb-4 border-b border-border-subtle shrink-0">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-full bg-surface-bg border border-border-subtle text-[11px] font-semibold text-text-muted uppercase tracking-wider">SKU anomaly review</span>
                  <span className="text-[12px] text-text-muted">{affected} affected SKUs · {familiesOf(openTag).length} families</span>
                </div>
                <h3 className="text-[18px] font-semibold text-text-main">{openTag.key}</h3>
                <p className="text-[13px] text-text-muted mt-1 max-w-[720px]">{openTag.definition}</p>
              </div>
              <button onClick={() => setOpenTag(null)} className="w-8 h-8 rounded-full border border-border-subtle flex items-center justify-center text-text-muted hover:text-text-main transition-colors shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-text-muted mr-1">Status</span>
                {chip('for_review', 'For review')}
                {chip('reviewed', 'Reviewed')}
                {chip('all', 'All')}
              </div>
              {modalFamilies.length > 0 && (
                <div className="flex items-center gap-2">
                  <button onClick={() => setFamIdx(i => (i - 1 + modalFamilies.length) % modalFamilies.length)}
                    className="h-7 px-3 rounded-[6px] text-[12px] font-medium border border-border-subtle bg-white text-text-main hover:bg-surface-bg transition-colors">← Prev</button>
                  <span className="text-[12px] text-text-muted">Family {Math.min(famIdx + 1, modalFamilies.length)} of {modalFamilies.length}</span>
                  <button onClick={() => setFamIdx(i => (i + 1) % modalFamilies.length)}
                    className="h-7 px-3 rounded-[6px] text-[12px] font-medium border border-border-subtle bg-white text-text-main hover:bg-surface-bg transition-colors">Next →</button>
                </div>
              )}
            </div>
          </div>

          <div className="p-6 overflow-y-auto">
            {!currentFam ? (
              <div className="py-12 text-center">
                <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-[14px] text-text-main font-medium">Nothing {statusFilter === 'for_review' ? 'left to review' : 'here'} for this anomaly type.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[13px] text-text-main">
                    <span className="font-mono font-semibold">{currentFam.fid}</span>
                    <span className="text-text-muted"> · {currentFam.members.length} SKUs · {currentFam.members[0].brand}</span>
                  </p>
                  {currentResolution && (
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 text-[11px] font-medium">
                        ✓ {currentResolution.action === 'merge' ? `Merged → ${currentResolution.canonical_sku_code}` :
                           currentResolution.action === 'confirm_variants' ? 'Confirmed variants' :
                           currentResolution.action === 'link_promo' ? 'Promos linked' : 'Kept'}
                      </span>
                      <button onClick={() => undoFamily(currentFam.fid)} title="Undo"
                        className="text-text-muted hover:text-text-main"><RotateCcw className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
                {currentResolution?.audit_note && (
                  <p className="text-[12px] text-text-muted mb-3 italic">Audit note: "{currentResolution.audit_note}" — {currentResolution.resolved_by}</p>
                )}
                <div className="border border-border-subtle rounded-[8px] overflow-hidden overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border-subtle bg-surface-bg">
                        {openTag.type === 'DUP' && !currentResolution && <th className="px-4 py-2 text-[11px] font-semibold text-text-muted uppercase">Keep</th>}
                        <th className="px-4 py-2 text-[11px] font-semibold text-text-muted uppercase">SKU Code</th>
                        <th className="px-4 py-2 text-[11px] font-semibold text-text-muted uppercase">Description</th>
                        <th className="px-4 py-2 text-[11px] font-semibold text-text-muted uppercase">Division</th>
                        <th className="px-4 py-2 text-[11px] font-semibold text-text-muted uppercase">Class</th>
                        <th className="px-4 py-2 text-[11px] font-semibold text-text-muted uppercase">Units</th>
                        <th className="px-4 py-2 text-[11px] font-semibold text-text-muted uppercase">Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {currentFam.members.map(m => (
                        <tr key={m.sku_code} className="hover:bg-surface-bg">
                          {openTag.type === 'DUP' && !currentResolution && (
                            <td className="px-4 py-2">
                              <input type="radio" name={`canon-${currentFam.fid}`}
                                checked={canonicalPick[currentFam.fid] === m.sku_code}
                                onChange={() => setCanonicalPick(prev => ({ ...prev, [currentFam.fid]: m.sku_code }))} />
                            </td>
                          )}
                          <td className="px-4 py-2 text-[13px] font-mono text-text-main whitespace-nowrap">{m.sku_code}</td>
                          <td className="px-4 py-2 text-[13px] text-text-main">{m.description}</td>
                          <td className="px-4 py-2 text-[13px] text-text-muted whitespace-nowrap">{m.division}</td>
                          <td className="px-4 py-2 text-[13px] text-text-muted whitespace-nowrap">{m.cls}</td>
                          <td className="px-4 py-2 text-[13px] text-text-muted whitespace-nowrap">{m.units}</td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            {m.promo_role === 'REGULAR_ANCHOR' && <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-medium">Regular anchor</span>}
                            {m.promo_role === 'PROMO_SKU' && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-medium">Promo SKU</span>}
                            {m.variant_type && !m.promo_role && <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[11px] font-medium">{m.variant_type}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <div className="px-6 py-4 border-t border-border-subtle shrink-0 bg-surface-bg/50">
            <div className="grid grid-cols-[240px_1fr_auto] gap-3 items-end">
              <div>
                <label className="block text-[12px] font-medium text-text-main mb-1">Resolution</label>
                <select value={chosenAction} onChange={e => setChosenAction(e.target.value)}
                  disabled={!currentFam || !!currentResolution}
                  className="w-full h-9 px-2 rounded-[6px] border border-border-subtle text-[13px] bg-white disabled:opacity-50">
                  {openTag.resolutions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-text-main mb-1">Audit note <span className="text-error">*</span></label>
                <input value={auditNote} onChange={e => setAuditNote(e.target.value)}
                  disabled={!currentFam || !!currentResolution}
                  placeholder="Explain why this resolution is appropriate"
                  className="w-full h-9 px-3 rounded-[6px] border border-border-subtle text-[13px] disabled:opacity-50 focus:outline-none focus:border-[#0054A6]" />
              </div>
              <button onClick={completeResolution} disabled={!canComplete}
                className="h-9 px-4 rounded-[6px] text-[13px] font-semibold bg-[#0054A6] text-white hover:bg-[#004385] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                Complete resolution
              </button>
            </div>
            <p className="text-[11px] text-text-muted mt-2">
              {opt?.needsCanonical ? 'Select the SKU to keep in the table above. ' : ''}An audit note is required — it is stored with the resolution for traceability.
            </p>
          </div>
        </div>
      </div>
    );
  };

  const tagRows = TAG_DEFS.map(def => {
    const fams = familiesOf(def);
    const affected = fams.reduce((n, f) => n + f.members.length, 0);
    const resolved = fams.filter(f => resolvedIds.has(f.fid)).length;
    return { def, fams: fams.length, affected, resolved };
  });

  return (
    <div className="space-y-6 relative">
      {reviewModal()}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-[8px] border shadow-lg z-50 ${
          toast.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-blue-50 text-blue-800 border-blue-200'}`}>
          <p className="text-[14px] font-medium">{toast.message}</p>
        </div>
      )}

      {/* Validation summary */}
      <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle overflow-hidden border-t-4 border-t-gray-700">
        <div className="px-6 py-4 flex items-center justify-between border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[8px] bg-surface-bg border border-border-subtle flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-text-muted" />
            </div>
            <div>
              <h3 className="text-[16px] font-semibold text-text-main">SKU hierarchy validation summary</h3>
              <p className="text-[12px] text-text-muted">
                SKU_Hierarchy_bronze.csv · anomaly tagging (NB2 + NB3) · {totalFamilies} anomaly families
                <span className="ml-2 text-text-muted/70">Refreshed {refreshedAt.toLocaleTimeString()}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setResolutions(getResolutions()); setRefreshedAt(new Date()); }}
              className="inline-flex items-center h-9 px-4 rounded-[6px] text-[13px] font-medium border border-border-subtle bg-white text-text-main hover:bg-surface-bg transition-colors">
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </button>
            <button onClick={downloadCsv}
              className="inline-flex items-center h-9 px-4 rounded-[6px] text-[13px] font-semibold bg-[#0054A6] text-white hover:bg-[#004385] transition-colors">
              <Download className="w-4 h-4 mr-2" /> Download anomalies CSV
            </button>
          </div>
        </div>
        <div className="grid grid-cols-4 divide-x divide-border-subtle">
          <div className="px-6 py-5">
            <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">SKUs Tagged</h4>
            <p className="text-[26px] font-bold text-text-main">{DEMO_SILVER.length}</p>
            <p className="text-[12px] text-text-muted">All silver rows classified</p>
          </div>
          <div className="px-6 py-5">
            <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">Families for Review</h4>
            <p className="text-[26px] font-bold text-amber-600">{totalFamilies - resolvedCount}</p>
            <p className="text-[12px] text-text-muted">{anomalySkuCount} SKUs in anomaly families</p>
          </div>
          <div className="px-6 py-5">
            <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">Resolved</h4>
            <p className="text-[26px] font-bold text-text-main">{resolvedCount}</p>
            <p className="text-[12px] text-text-muted">Human-reviewed families</p>
          </div>
          <div className="px-6 py-5">
            <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">Clean</h4>
            <p className="text-[26px] font-bold text-green-700">{cleanCount}</p>
            <p className="text-[12px] text-text-muted">Automatically clean SKUs</p>
          </div>
        </div>
      </div>

      {/* Anomaly tag summary */}
      <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle overflow-hidden">
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-text-main">Anomaly tag summary</h3>
            <p className="text-[12px] text-text-muted mt-0.5">Families group SKUs sharing an anomaly; resolutions are made per family with a mandatory audit note.</p>
          </div>
          <div className="flex items-center gap-2">
            {resolvedCount === totalFamilies
              ? <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-green-100 text-green-800 text-[11px] font-semibold">✓ ALL RESOLVED</span>
              : <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-semibold">{resolvedCount}/{totalFamilies} RESOLVED</span>}
            <button onClick={resetDemo} className="inline-flex items-center h-8 px-3 rounded-[6px] text-[12px] font-medium border border-border-subtle bg-white text-text-muted hover:text-text-main hover:bg-surface-bg transition-colors">
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset demo
            </button>
          </div>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border-subtle bg-surface-bg">
              <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase">Anomaly</th>
              <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase text-right">Families</th>
              <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase text-right">Affected SKUs</th>
              <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase text-right">Resolved</th>
              <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {tagRows.map(({ def, fams, affected, resolved }) => (
              <tr key={def.key} className="hover:bg-surface-bg transition-colors">
                <td className="px-6 py-4">
                  <p className="text-[13px] font-semibold text-text-main">{def.key}</p>
                </td>
                <td className="px-6 py-4 text-[13px] text-text-main text-right">{fams}</td>
                <td className="px-6 py-4 text-[13px] font-semibold text-text-main text-right">{affected}</td>
                <td className="px-6 py-4 text-[13px] text-right">
                  {resolved === fams && fams > 0
                    ? <span className="text-green-700 font-medium">{resolved}/{fams} ✓</span>
                    : <span className="text-text-muted">{resolved}/{fams}</span>}
                </td>
                <td className="px-6 py-4 text-right">
                  {fams === 0
                    ? <span className="inline-flex items-center h-8 px-3 rounded-[6px] text-[12px] font-medium bg-surface-bg text-text-muted">No anomalies</span>
                    : <button onClick={() => openReview(def)}
                        className="inline-flex items-center h-8 px-3 rounded-[6px] text-[12px] font-medium border border-[#0054A6]/30 bg-white text-[#0054A6] hover:bg-blue-50 transition-colors">
                        Review
                      </button>}
                </td>
              </tr>
            ))}
            <tr className="hover:bg-surface-bg transition-colors bg-surface-bg/40">
              <td className="px-6 py-4">
                <p className="text-[13px] font-semibold text-text-muted">EXCLUDED_BY_CLEANING</p>
                <p className="text-[12px] text-text-muted mt-0.5">P SKU / bucket / null description / duplicate codes — removed by NB2 before tagging</p>
              </td>
              <td className="px-6 py-4 text-[13px] text-text-muted text-right">—</td>
              <td className="px-6 py-4 text-[13px] font-semibold text-text-main text-right">{DEMO_EXCLUDED.length}</td>
              <td className="px-6 py-4 text-[13px] text-text-muted text-right">read-only</td>
              <td className="px-6 py-4 text-right">
                <button onClick={() => setShowExcluded(v => !v)}
                  className="inline-flex items-center h-8 px-3 rounded-[6px] text-[12px] font-medium border border-border-subtle bg-white text-text-main hover:bg-surface-bg transition-colors">
                  {showExcluded ? 'Hide' : 'View'}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {showExcluded && (
        <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle overflow-hidden">
          <div className="px-6 py-4 border-b border-border-subtle">
            <p className="text-[13px] text-text-muted">Removed by the cleaning layer (NB2) — no usable hierarchy. Transactions against these will be flagged DROPPED_SKU_TRANSACTION at matching time.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-bg">
                  <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase">SKU Code</th>
                  <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase">Description</th>
                  <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase">Division</th>
                  <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase">Tag</th>
                  <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {DEMO_EXCLUDED.map(e => (
                  <tr key={e.sku_code} className="hover:bg-surface-bg">
                    <td className="px-6 py-3 text-[13px] font-mono text-text-main">{e.sku_code}</td>
                    <td className="px-6 py-3 text-[13px] text-text-main">{e.description}</td>
                    <td className="px-6 py-3 text-[13px] text-text-muted">{e.division}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-1 rounded-full text-[11px] font-medium ${e.anomaly_tag === 'FOR_REMOVAL' ? 'bg-red-100 text-red-800' : e.anomaly_tag === 'NULL_SKU_DESCRIPTION' ? 'bg-gray-100 text-gray-800' : 'bg-amber-100 text-amber-800'}`}>{e.anomaly_tag}</span>
                    </td>
                    <td className="px-6 py-3 text-[13px] text-text-muted">{e.anomaly_remarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Live pipeline */}
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

        <div className="mt-5 border border-border-subtle rounded-[8px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-bg">
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Started</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Step</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Silver Rows</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Excluded</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-text-muted uppercase tracking-wider">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-[13px] text-text-muted">Loading…</td></tr>
                ) : silverBatches.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-[13px] text-text-muted">No pipeline runs yet.</td></tr>
                ) : (
                  silverBatches.map(b => (
                    <tr key={b.id} className="hover:bg-surface-bg transition-colors">
                      <td className="px-4 py-3 text-[13px] text-text-main whitespace-nowrap">
                        {new Date(b.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{statusBadge(b.status)}</td>
                      <td className="px-4 py-3 text-[13px] text-text-muted max-w-[300px] truncate" title={b.error_message || b.step || ''}>
                        {b.status === 'failed' ? (b.error_message || b.step) : b.step}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-text-main whitespace-nowrap">
                        {b.silver_row_count != null ? b.silver_row_count.toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-text-main whitespace-nowrap">
                        {b.excluded_row_count != null ? b.excluded_row_count.toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-text-muted whitespace-nowrap">{b.started_by || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
