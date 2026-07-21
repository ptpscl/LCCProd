import { useEffect, useState } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { DEMO_SILVER, deriveGold, getResolutions } from './skuDemoData';

export default function SkuGoldView() {
  const [, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);

  // Re-derive whenever the tab regains focus (user may have resolved in Silver)
  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const { gold, mergedAway, mergedInto } = deriveGold();
  const resolutions = getResolutions();

  const dupFamilies = new Set(DEMO_SILVER.filter(s => s.dup_family_id).map(s => s.dup_family_id));
  const varFamilies = new Set(DEMO_SILVER.filter(s => s.variant_family_id).map(s => s.variant_family_id));
  const promoFamilies = new Set(DEMO_SILVER.filter(s => s.promo_family_id).map(s => s.promo_family_id));
  const totalFamilies = dupFamilies.size + varFamilies.size + promoFamilies.size;
  const pending = totalFamilies - resolutions.length;

  // Reliability: % of catalog verified = clean-unique SKUs + SKUs in resolved families
  const resolvedFids = new Set(resolutions.map(r => r.family_id));
  const isVerified = (s: typeof DEMO_SILVER[number]) => {
    if (s.anomaly_tags === 'CLEAN_UNIQUE') return true;
    const fams = [s.dup_family_id, s.variant_family_id, s.promo_family_id].filter(Boolean);
    return fams.length > 0 && fams.every(f => resolvedFids.has(f));
  };
  const verifiedCount = DEMO_SILVER.filter(isVerified).length;
  const reliability = Math.round((verifiedCount / DEMO_SILVER.length) * 100);
  const reliabilityColor = reliability >= 90 ? 'text-green-700' : reliability >= 70 ? 'text-amber-600' : 'text-red-600';
  const reliabilityBar = reliability >= 90 ? 'bg-green-600' : reliability >= 70 ? 'bg-amber-500' : 'bg-red-500';

  const roleOf = (sku: typeof gold[number]) => {
    if (mergedInto && Object.values(mergedInto).includes(sku.sku_code)) return 'CANONICAL';
    if (sku.promo_role === 'PROMO_SKU') {
      const r = resolutions.find(x => x.family_id === sku.promo_family_id);
      if (r?.action === 'link_promo') return 'LINKED_PROMO';
    }
    if (sku.variant_family_id) {
      const r = resolutions.find(x => x.family_id === sku.variant_family_id);
      if (r?.action === 'confirm_variants') return 'CONFIRMED_VARIANT';
    }
    return '';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-semibold text-text-main">Gold SKU Catalog</h2>
          <p className="text-[13px] text-text-muted mt-1">
            The resolved, analysis-ready product master: silver data with duplicate merges applied and promo/variant relationships confirmed.
          </p>
        </div>
        <button onClick={refresh} className="inline-flex items-center h-9 px-4 rounded-[6px] text-[13px] font-medium border border-border-subtle bg-white text-text-main hover:bg-surface-bg transition-colors">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </button>
      </div>

      {pending > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-[8px] p-4 flex items-start">
          <AlertCircle className="w-4 h-4 text-amber-600 mr-3 mt-0.5 shrink-0" />
          <p className="text-[13px] text-amber-800">
            <span className="font-semibold">{pending} anomaly famil{pending === 1 ? 'y' : 'ies'} still unresolved</span> in the Silver layer.
            Their SKUs are shown here as-is until resolved.
          </p>
        </div>
      )}

      {/* Reliability score */}
      <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-[13px] font-semibold text-text-muted uppercase tracking-wider">Catalog Reliability</h3>
            <p className="text-[12px] text-text-muted mt-0.5">Share of the catalog that is clean or has completed anomaly review</p>
          </div>
          <p className={`text-[36px] font-bold ${reliabilityColor}`}>{reliability}%</p>
        </div>
        <div className="w-full h-3 bg-surface-bg rounded-full overflow-hidden border border-border-subtle">
          <div className={`h-full ${reliabilityBar} transition-all duration-500`} style={{ width: `${reliability}%` }} />
        </div>
        <p className="text-[12px] text-text-muted mt-2">{verifiedCount} of {DEMO_SILVER.length} SKUs verified · {pending > 0 ? `${pending} famil${pending === 1 ? 'y' : 'ies'} pending review in Silver` : 'all anomaly families resolved'}</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-5">
          <h3 className="text-[12px] font-semibold text-text-muted uppercase tracking-wider mb-1">Silver SKUs In</h3>
          <p className="text-[24px] font-bold text-text-main">{DEMO_SILVER.length}</p>
        </div>
        <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-5">
          <h3 className="text-[12px] font-semibold text-text-muted uppercase tracking-wider mb-1">Duplicates Merged Away</h3>
          <p className="text-[24px] font-bold text-red-600">−{mergedAway.size}</p>
        </div>
        <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-5">
          <h3 className="text-[12px] font-semibold text-text-muted uppercase tracking-wider mb-1">Gold SKUs Out</h3>
          <p className="text-[24px] font-bold text-[#B8860B]">{gold.length}</p>
        </div>
        <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-5">
          <h3 className="text-[12px] font-semibold text-text-muted uppercase tracking-wider mb-1">Resolutions Applied</h3>
          <p className="text-[24px] font-bold text-text-main">{resolutions.length} / {totalFamilies}</p>
        </div>
      </div>

      {mergedAway.size > 0 && (
        <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle overflow-hidden">
          <div className="px-6 py-4 border-b border-border-subtle">
            <h3 className="text-[15px] font-semibold text-text-main">Merge map</h3>
            <p className="text-[12px] text-text-muted mt-0.5">Retired SKU codes and the canonical SKU their history now attributes to.</p>
          </div>
          <div className="px-6 py-4 flex flex-wrap gap-2">
            {Object.entries(mergedInto).map(([from, to]) => (
              <span key={from} className="inline-flex items-center px-3 py-1.5 rounded-full bg-surface-bg border border-border-subtle text-[12px] font-mono text-text-main">
                {from} → {to}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle overflow-hidden">
        <div className="px-6 py-4 border-b border-border-subtle">
          <h3 className="text-[15px] font-semibold text-text-main">Resolved catalog ({gold.length} SKUs)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-bg">
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase">SKU Code</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase">Description</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase">Division</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase">Class</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase">Brand</th>
                <th className="px-6 py-3 text-[12px] font-semibold text-text-muted uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {gold.map(s => {
                const role = roleOf(s);
                return (
                  <tr key={s.sku_code} className="hover:bg-surface-bg">
                    <td className="px-6 py-3 text-[13px] font-mono text-text-main whitespace-nowrap">{s.sku_code}</td>
                    <td className="px-6 py-3 text-[13px] text-text-main">{s.description}</td>
                    <td className="px-6 py-3 text-[13px] text-text-muted whitespace-nowrap">{s.division}</td>
                    <td className="px-6 py-3 text-[13px] text-text-muted whitespace-nowrap">{s.cls}</td>
                    <td className="px-6 py-3 text-[13px] text-text-muted whitespace-nowrap">{s.brand}</td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      {role === 'CANONICAL' && <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 text-[11px] font-medium">Canonical (absorbed duplicates)</span>}
                      {role === 'LINKED_PROMO' && <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-medium">Promo → linked to regular</span>}
                      {role === 'CONFIRMED_VARIANT' && <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-800 text-[11px] font-medium">Confirmed variant</span>}
                      {!role && <span className="text-[12px] text-text-muted">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
