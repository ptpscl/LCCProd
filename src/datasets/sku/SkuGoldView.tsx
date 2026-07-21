import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, AlertCircle, Download, Search, ShieldCheck, X } from 'lucide-react';
import { DEMO_SILVER, deriveGold, getResolutions } from './skuDemoData';

const GOLD_SKU_SCHEMA: [string, string][] = [
  ['sku_code', 'Canonical SKU identifier after duplicate merges are applied.'],
  ['description', 'Cleaned, resolved product description.'],
  ['division', 'Top-level merchandise division.'],
  ['cls', 'Product class within the division.'],
  ['brand', 'Brand associated with the SKU.'],
  ['status', 'Resolution role — canonical (absorbed duplicates), linked promo, confirmed variant, or none.'],
];

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
  // (excluded/isolated members of a resolved family don't count as verified)
  const isVerified = (s: typeof DEMO_SILVER[number]) => {
    if (s.anomaly_tags === 'CLEAN_UNIQUE') return true;
    const fams = [s.dup_family_id, s.variant_family_id, s.promo_family_id].filter(Boolean);
    if (fams.length === 0) return false;
    return fams.every(f => {
      const r = resolutions.find(x => x.family_id === f);
      if (!r) return false;
      if (r.excluded_members?.includes(s.sku_code)) return false;
      return true;
    });
  };
  const verifiedCount = DEMO_SILVER.filter(isVerified).length;
  const reliability = (verifiedCount / DEMO_SILVER.length) * 100;
  const reliabilityColor = reliability >= 90 ? 'text-green-700' : reliability >= 70 ? 'text-green-600' : 'text-green-500';
  const reliabilityBar = reliability >= 90 ? 'bg-green-600' : reliability >= 70 ? 'bg-green-500' : 'bg-green-400';

  const roleOf = (sku: typeof gold[number]) => {
    if (mergedInto && Object.values(mergedInto).includes(sku.sku_code)) return 'CANONICAL';
    if (sku.promo_role === 'PROMO_SKU') {
      const r = resolutions.find(x => x.family_id === sku.promo_family_id);
      if (r?.action === 'link_promo' && !r.excluded_members?.includes(sku.sku_code)) return 'LINKED_PROMO';
    }
    if (sku.variant_family_id) {
      const r = resolutions.find(x => x.family_id === sku.variant_family_id);
      if (r?.action === 'confirm_variants' && !r.excluded_members?.includes(sku.sku_code)) return 'CONFIRMED_VARIANT';
    }
    return '';
  };

  const roleLabel = (role: string) => role === 'CANONICAL' ? 'Canonical' : role === 'LINKED_PROMO' ? 'Linked promo' : role === 'CONFIRMED_VARIANT' ? 'Confirmed variant' : 'None';

  const [division, setDivision] = useState('');
  const [brand, setBrand] = useState('');
  const [role, setRole] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [skuCode, setSkuCode] = useState('');

  const divisions = useMemo(() => Array.from(new Set(gold.map(s => s.division))).filter(Boolean).sort(), [gold]);

  const rows = useMemo(() => gold.filter(s => {
    if (division && s.division !== division) return false;
    if (brand && !s.brand.toLowerCase().includes(brand.toLowerCase())) return false;
    if (skuCode && !s.sku_code.toLowerCase().includes(skuCode.toLowerCase())) return false;
    if (role && roleOf(s) !== role) return false;
    return true;
  }), [gold, division, brand, skuCode, role, resolutions, mergedInto]);

  const clear = () => { setDivision(''); setBrand(''); setRole(''); setSearchInput(''); setSkuCode(''); };

  const exportSample = () => {
    const headers = ['SKU CODE', 'DESCRIPTION', 'DIVISION', 'CLASS', 'BRAND', 'STATUS'];
    const csvRows = rows.map(s => [s.sku_code, s.description, s.division, s.cls, s.brand, roleLabel(roleOf(s))]);
    const csv = [headers, ...csvRows].map(values => values.map(v => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'sku_gold_prototype.csv'; anchor.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="px-4 py-3 rounded-[8px] border border-amber-200 bg-amber-50 text-amber-900 text-[13px] flex items-center justify-between">
        <span><strong>Gold prototype:</strong> resolved, analysis-ready SKU catalog with duplicate merges applied and promo/variant relationships confirmed.</span>
        <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-semibold">Read-only demo</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-semibold text-text-main">Gold SKU Catalog</h2>
          <p className="text-[13px] text-text-muted mt-1">
            The resolved, analysis-ready product master: silver data with duplicate merges applied and promo/variant relationships confirmed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportSample} className="h-10 px-4 rounded-[7px] bg-[#B58A00] hover:bg-[#987400] text-white text-[13px] font-semibold inline-flex items-center">
            <Download className="w-4 h-4 mr-2" />Export sample
          </button>
          <button onClick={refresh} className="inline-flex items-center h-10 px-4 rounded-[6px] text-[13px] font-medium border border-border-subtle bg-white text-text-main hover:bg-surface-bg transition-colors">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </button>
        </div>
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
      <div className="rounded-[10px] border border-border-subtle bg-white p-6 shadow-subtle">
        <div className="mb-3 flex items-center justify-between gap-5">
          <div>
            <h3 className="text-[13px] font-semibold uppercase tracking-wider text-text-muted">Catalog Reliability</h3>
            <p className="mt-0.5 text-[12px] text-text-muted">Share of the catalog that is clean or has completed anomaly review and is eligible for Gold</p>
          </div>
          <p className={`text-[36px] font-bold ${reliabilityColor}`}>{reliability.toFixed(2)}%</p>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full border border-border-subtle bg-surface-bg">
          <div className={`h-full transition-all duration-500 ${reliabilityBar}`} style={{ width: `${reliability}%` }} />
        </div>
        <p className="mt-2 text-[12px] text-text-muted">{verifiedCount.toLocaleString()} of {DEMO_SILVER.length.toLocaleString()} SKUs verified · {pending > 0 ? `${pending} famil${pending === 1 ? 'y' : 'ies'} pending review in Silver` : 'all anomaly families resolved'}</p>
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

      <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-[#B58A00] mt-0.5" />
          <div>
            <h3 className="text-[14px] font-semibold">Gold resolution priority</h3>
            <p className="text-[12px] text-text-muted mt-1">Duplicates merge into the reviewer-selected canonical SKU. Confirmed variants and linked promos keep their own codes but carry a resolved status. Unresolved Silver families still appear here, unflagged, until reviewed.</p>
          </div>
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

      <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-5 grid grid-cols-[1fr_1fr_1fr_1.4fr_auto] gap-4 items-end">
        <Select label="Division" value={division} onChange={setDivision} options={[['', 'All divisions'], ...divisions.map(d => [d, d])]} />
        <Input label="Brand" value={brand} onChange={setBrand} placeholder="e.g. Nestle" />
        <Select label="Status" value={role} onChange={setRole} options={[['', 'All statuses'], ['CANONICAL', 'Canonical'], ['LINKED_PROMO', 'Linked promo'], ['CONFIRMED_VARIANT', 'Confirmed variant']]} />
        <label className="text-[12px] font-semibold text-text-muted">SKU code
          <div className="mt-2 flex">
            <input value={searchInput} onChange={event => setSearchInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') setSkuCode(searchInput.trim()); }} placeholder="Search SKU code" className="w-full h-10 border border-border-subtle rounded-l-[6px] px-3 text-[13px] font-normal" />
            <button onClick={() => setSkuCode(searchInput.trim())} className="h-10 px-4 rounded-r-[6px] bg-[#B58A00] text-white"><Search className="w-4 h-4" /></button>
          </div>
        </label>
        <button onClick={clear} className="h-10 px-4 border border-border-subtle rounded-[6px] text-[13px] inline-flex items-center"><X className="w-4 h-4 mr-2" />Clear</button>
      </div>

      <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle overflow-hidden">
        <div className="px-6 py-4 border-b border-border-subtle">
          <h3 className="text-[15px] font-semibold text-text-main">Resolved catalog ({rows.length} of {gold.length} SKUs)</h3>
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
              {!rows.length ? (
                <tr><td colSpan={6} className="py-12 text-center text-[13px] text-text-muted">No SKUs match these filters.</td></tr>
              ) : rows.map(s => {
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

      <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle overflow-hidden">
        <div className="px-6 py-5 border-b border-border-subtle"><h3 className="text-[16px] font-semibold">Gold schema</h3></div>
        <table className="w-full text-left">
          <thead><tr className="bg-surface-bg border-b border-border-subtle"><th className="px-6 py-3 text-[12px] text-text-muted uppercase">Column</th><th className="px-6 py-3 text-[12px] text-text-muted uppercase">Description</th></tr></thead>
          <tbody className="divide-y divide-border-subtle">
            {GOLD_SKU_SCHEMA.map(([column, description]) => (
              <tr key={column}><td className="px-6 py-4 text-[13px] font-mono">{column}</td><td className="px-6 py-4 text-[13px] text-text-muted">{description}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="text-[12px] font-semibold text-text-muted">{label}<input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="mt-2 w-full h-10 px-3 rounded-[6px] border border-border-subtle text-[13px] font-normal" /></label>;
}
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return <label className="text-[12px] font-semibold text-text-muted">{label}<select value={value} onChange={event => onChange(event.target.value)} className="mt-2 w-full h-10 px-3 rounded-[6px] border border-border-subtle bg-white text-[13px] font-normal">{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>;
}