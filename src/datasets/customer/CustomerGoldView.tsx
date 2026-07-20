import { useMemo, useState } from 'react';
import { Download, Search, ShieldCheck, X } from 'lucide-react';

import { CUSTOMER_GOLD_DEMO_ROWS, CUSTOMER_GOLD_SCHEMA } from './customerGoldDemo';

export default function CustomerGoldView() {
  const [origin, setOrigin] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [customerNumber, setCustomerNumber] = useState('');

  const rows = useMemo(() => CUSTOMER_GOLD_DEMO_ROWS.filter(row => {
    if (origin && row.record_origin !== origin) return false;
    if (city && !row.city.toLowerCase().includes(city.toLowerCase())) return false;
    if (province && !row.province.toLowerCase().includes(province.toLowerCase())) return false;
    if (customerNumber && !row.customer_number.toLowerCase().includes(customerNumber.toLowerCase())) return false;
    return true;
  }), [origin, city, province, customerNumber]);

  const exportSample = () => {
    const headers = ['CUSTOMER NUMBER', 'GENDER', 'BIRTHDAY', 'AGE', 'CITY', 'PROVINCE', 'LAST VISIT', 'RECORD ORIGIN', 'RESOLUTION'];
    const csvRows = rows.map(row => [row.customer_number, row.gender, row.birthday, row.age, row.city, row.province, row.last_visit, row.record_origin, row.resolution]);
    const csv = [headers, ...csvRows].map(values => values.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'customer_gold_prototype.csv'; anchor.click(); URL.revokeObjectURL(url);
  };

  const clear = () => { setOrigin(''); setCity(''); setProvince(''); setSearchInput(''); setCustomerNumber(''); };
  const cleanCount = CUSTOMER_GOLD_DEMO_ROWS.filter(row => row.record_origin === 'clean').length;
  const resolvedCount = CUSTOMER_GOLD_DEMO_ROWS.filter(row => row.record_origin === 'resolved').length;

  return <div className="space-y-6">
    <div className="px-4 py-3 rounded-[8px] border border-amber-200 bg-amber-50 text-amber-900 text-[13px] flex items-center justify-between"><span><strong>Gold prototype:</strong> dummy trusted records demonstrate how previous Silver issues appear after resolution.</span><span className="px-2 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-semibold">Read-only demo</span></div>

    <div className="flex items-center justify-between"><div><h2 className="text-[18px] font-semibold text-text-main">Gold Customer Master</h2><p className="text-[13px] text-text-muted mt-1">Canonical, trusted customer records ready for downstream use.</p></div><button onClick={exportSample} className="h-10 px-4 rounded-[7px] bg-[#B58A00] hover:bg-[#987400] text-white text-[13px] font-semibold inline-flex items-center"><Download className="w-4 h-4 mr-2" />Export sample</button></div>

    <div className="grid grid-cols-4 gap-6">{[
      ['Trusted Customers', CUSTOMER_GOLD_DEMO_ROWS.length, 'text-text-main'],
      ['Clean from Silver', cleanCount, 'text-green-700'],
      ['Resolved from Silver', resolvedCount, 'text-blue-700'],
      ['Duplicates Consolidated', 1, 'text-amber-700'],
    ].map(([label, value, color]) => <div key={String(label)} className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-6"><h3 className="text-[12px] font-semibold text-text-muted uppercase tracking-wider mb-2">{label}</h3><p className={`text-[28px] font-bold ${color}`}>{Number(value).toLocaleString()}</p></div>)}</div>

    <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-5"><div className="flex items-start gap-3"><ShieldCheck className="w-5 h-5 text-[#B58A00] mt-0.5" /><div><h3 className="text-[14px] font-semibold">Gold winner priority</h3><p className="text-[12px] text-text-muted mt-1">Resolved record → record with province → latest visit → newest source batch. Unresolved Silver rows never enter Gold.</p></div></div></div>

    <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle p-5 grid grid-cols-[1fr_1fr_1fr_1.4fr_auto] gap-4 items-end">
      <Select label="Origin" value={origin} onChange={setOrigin} options={[['', 'All origins'], ['clean', 'Clean'], ['resolved', 'Resolved']]} />
      <Input label="City" value={city} onChange={setCity} placeholder="e.g. Cebu City" />
      <Input label="Province" value={province} onChange={setProvince} placeholder="e.g. Cebu" />
      <label className="text-[12px] font-semibold text-text-muted">Customer number<div className="mt-2 flex"><input value={searchInput} onChange={event => setSearchInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') setCustomerNumber(searchInput.trim()); }} placeholder="Search canonical ID" className="w-full h-10 border border-border-subtle rounded-l-[6px] px-3 text-[13px] font-normal" /><button onClick={() => setCustomerNumber(searchInput.trim())} className="h-10 px-4 rounded-r-[6px] bg-[#B58A00] text-white"><Search className="w-4 h-4" /></button></div></label>
      <button onClick={clear} className="h-10 px-4 border border-border-subtle rounded-[6px] text-[13px] inline-flex items-center"><X className="w-4 h-4 mr-2" />Clear</button>
    </div>

    <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left border-collapse min-w-[1050px]"><thead><tr className="border-b border-border-subtle bg-surface-bg">{['Customer Number', 'Gender', 'Birthday', 'Age', 'City', 'Province', 'Last Visit', 'Origin', 'Resolution'].map(label => <th key={label} className="px-4 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider">{label}</th>)}</tr></thead><tbody className="divide-y divide-border-subtle">{!rows.length ? <tr><td colSpan={9} className="py-12 text-center text-[13px] text-text-muted">No trusted customers match these filters.</td></tr> : rows.map(row => <tr key={row.id} className="hover:bg-surface-bg"><td className="px-4 py-3 text-[12px] font-mono">{row.customer_number}</td><td className="px-4 py-3 text-[12px]">{row.gender}</td><td className="px-4 py-3 text-[12px]">{row.birthday}</td><td className="px-4 py-3 text-[12px]">{row.age}</td><td className="px-4 py-3 text-[12px]">{row.city}</td><td className="px-4 py-3 text-[12px]">{row.province}</td><td className="px-4 py-3 text-[12px]">{row.last_visit}</td><td className="px-4 py-3"><OriginBadge value={row.record_origin} /></td><td className="px-4 py-3 text-[11px] text-text-muted max-w-[260px]">{row.resolution}</td></tr>)}</tbody></table></div><div className="px-5 py-4 border-t border-border-subtle text-[12px] text-text-muted">{rows.length} trusted prototype records</div></div>

    <div className="bg-white rounded-[10px] border border-border-subtle shadow-subtle overflow-hidden"><div className="px-6 py-5 border-b border-border-subtle"><h3 className="text-[16px] font-semibold">Gold schema</h3></div><table className="w-full text-left"><thead><tr className="bg-surface-bg border-b border-border-subtle"><th className="px-6 py-3 text-[12px] text-text-muted uppercase">Column</th><th className="px-6 py-3 text-[12px] text-text-muted uppercase">Description</th></tr></thead><tbody className="divide-y divide-border-subtle">{CUSTOMER_GOLD_SCHEMA.map(([column, description]) => <tr key={column}><td className="px-6 py-4 text-[13px] font-mono">{column}</td><td className="px-6 py-4 text-[13px] text-text-muted">{description}</td></tr>)}</tbody></table></div>
  </div>;
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="text-[12px] font-semibold text-text-muted">{label}<input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="mt-2 w-full h-10 px-3 rounded-[6px] border border-border-subtle text-[13px] font-normal" /></label>; }
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) { return <label className="text-[12px] font-semibold text-text-muted">{label}<select value={value} onChange={event => onChange(event.target.value)} className="mt-2 w-full h-10 px-3 rounded-[6px] border border-border-subtle bg-white text-[13px] font-normal">{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>; }
function OriginBadge({ value }: { value: string }) { return <span className={`px-2 py-1 rounded-full text-[11px] font-medium ${value === 'resolved' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>{value}</span>; }
