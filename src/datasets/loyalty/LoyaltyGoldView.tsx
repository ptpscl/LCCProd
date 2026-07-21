import { useMemo, useState } from 'react';
import { Download, Search, ShieldCheck, X } from 'lucide-react';
import { getLoyaltyGoldDemoRows, getLoyaltyGoldDemoStats, LOYALTY_GOLD_SCHEMA } from './loyaltyGoldDemo';

export default function LoyaltyGoldView() {
  const allRows = getLoyaltyGoldDemoRows();
  const stats = getLoyaltyGoldDemoStats();
  const [origin, setOrigin] = useState('');
  const [store, setStore] = useState('');
  const [transactionInput, setTransactionInput] = useState('');
  const [transaction, setTransaction] = useState('');
  const [customer, setCustomer] = useState('');

  const rows = useMemo(() => allRows.filter(row => {
    if (origin && row.record_origin !== origin) return false;
    if (store && !row.store_code.toLowerCase().includes(store.toLowerCase())) return false;
    if (transaction && !row.transaction_number.toLowerCase().includes(transaction.toLowerCase())) return false;
    if (customer && !row.customer_number.toLowerCase().includes(customer.toLowerCase())) return false;
    return true;
  }), [allRows, origin, store, transaction, customer]);

  const exportRows = () => {
    const headers = ['DATE', 'TRANSACTION NUMBER', 'REGISTER NUMBER', 'STORE CODE', 'STORE CATEGORIZATION', 'CUSTOMER NUMBER', 'SKU CODE', 'TRANSACTION TYPE', 'LOYALTY SALES', 'QTY SOLD', 'RECORD ORIGIN', 'RESOLUTION'];
    const values = rows.map(row => [row.date, row.transaction_number, row.register_number, row.store_code, row.store_categorization, row.customer_number, row.sku_code, row.transaction_type, row.loyalty_sales, row.qty_sold, row.record_origin, row.resolution]);
    const csv = [headers, ...values].map(record => record.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'loyalty_gold_prototype.csv'; anchor.click(); URL.revokeObjectURL(url);
  };
  const clear = () => { setOrigin(''); setStore(''); setTransactionInput(''); setTransaction(''); setCustomer(''); };

  return <div className="space-y-6">
    <div className="flex items-center justify-between rounded-[8px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900"><span><strong>Gold prototype:</strong> trusted Loyalty records demonstrate clean and accepted resolved Silver outputs.</span><span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold">Read-only demo</span></div>
    <div className="flex items-center justify-between"><div><h2 className="text-[18px] font-semibold">Gold Loyalty Sales</h2><p className="mt-1 text-[13px] text-text-muted">Curated Loyalty transactions ready for reporting and staged merging.</p></div><button onClick={exportRows} className="inline-flex h-10 items-center rounded-[7px] bg-[#B58A00] px-4 text-[13px] font-semibold text-white hover:bg-[#987400]"><Download className="mr-2 h-4 w-4" />Export sample</button></div>
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">{[
      ['Trusted Transactions', stats.trusted, 'text-text-main'],
      ['Clean from Silver', stats.clean, 'text-green-700'],
      ['Resolved from Silver', stats.resolved, 'text-blue-700'],
      ['Still Blocked', stats.blocked, 'text-amber-700'],
    ].map(([label, value, color]) => <div key={String(label)} className="rounded-[10px] border border-border-subtle bg-white p-6 shadow-subtle"><h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-text-muted">{label}</h3><p className={`text-[28px] font-bold ${color}`}>{Number(value).toLocaleString()}</p></div>)}</div>
    <div className="rounded-[10px] border border-border-subtle bg-white p-5 shadow-subtle"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-[#B58A00]" /><div><h3 className="text-[14px] font-semibold">Gold transaction priority</h3><p className="mt-1 text-[12px] text-text-muted">Accepted resolved record → clean Silver record → one winner per six-key transaction line. Flagged and excluded Silver rows never enter Gold.</p></div></div></div>
    <div className="grid items-end gap-4 rounded-[10px] border border-border-subtle bg-white p-5 shadow-subtle md:grid-cols-[1fr_1fr_1.4fr_1fr_auto]">
      <Select label="Origin" value={origin} onChange={setOrigin} options={[['', 'All origins'], ['clean', 'Clean'], ['resolved', 'Resolved']]} />
      <Input label="Store code" value={store} onChange={setStore} placeholder="e.g. 417" />
      <label className="text-[12px] font-semibold text-text-muted">Transaction number<div className="mt-2 flex"><input value={transactionInput} onChange={event => setTransactionInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') setTransaction(transactionInput.trim()); }} className="h-10 w-full rounded-l-[6px] border border-border-subtle px-3 text-[13px] font-normal" placeholder="Search transaction" /><button onClick={() => setTransaction(transactionInput.trim())} className="h-10 rounded-r-[6px] bg-[#B58A00] px-4 text-white"><Search className="h-4 w-4" /></button></div></label>
      <Input label="Customer number" value={customer} onChange={setCustomer} placeholder="Masked customer ID" />
      <button onClick={clear} className="inline-flex h-10 items-center rounded-[6px] border border-border-subtle px-4 text-[13px]"><X className="mr-2 h-4 w-4" />Clear</button>
    </div>
    <div className="overflow-hidden rounded-[10px] border border-border-subtle bg-white shadow-subtle"><div className="overflow-x-auto"><table className="w-full min-w-[1450px] text-left"><thead><tr className="border-b border-border-subtle bg-surface-bg">{['Date', 'Transaction', 'Register', 'Store', 'Store Category', 'Customer', 'SKU', 'Transaction Type', 'Loyalty Sales', 'Qty Sold', 'Origin', 'Resolution'].map(label => <th key={label} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">{label}</th>)}</tr></thead><tbody className="divide-y divide-border-subtle">{rows.map(row => <tr key={row.id} className="hover:bg-surface-bg"><td className="px-4 py-3 text-[12px]">{row.date}</td><td className="px-4 py-3 font-mono text-[12px]">{row.transaction_number}</td><td className="px-4 py-3 text-[12px]">{row.register_number}</td><td className="px-4 py-3 text-[12px]">{row.store_code}</td><td className="px-4 py-3 text-[12px]">{row.store_categorization}</td><td className="px-4 py-3 font-mono text-[12px]">{row.customer_number}</td><td className="px-4 py-3 font-mono text-[12px]">{row.sku_code}</td><td className="px-4 py-3 text-[12px]">{row.transaction_type}</td><td className="px-4 py-3 text-right font-mono text-[12px]">{row.loyalty_sales.toLocaleString()}</td><td className="px-4 py-3 text-right font-mono text-[12px]">{row.qty_sold}</td><td className="px-4 py-3"><OriginBadge value={row.record_origin} /></td><td className="max-w-[260px] px-4 py-3 text-[11px] text-text-muted">{row.resolution}</td></tr>)}</tbody></table></div><div className="border-t border-border-subtle px-5 py-4 text-[12px] text-text-muted">{rows.length} trusted prototype records</div></div>
    <div className="overflow-hidden rounded-[10px] border border-border-subtle bg-white shadow-subtle"><div className="border-b border-border-subtle px-6 py-5"><h3 className="text-[16px] font-semibold">Gold schema</h3></div><table className="w-full text-left"><thead><tr className="border-b border-border-subtle bg-surface-bg"><th className="px-6 py-3 text-[12px] uppercase text-text-muted">Column</th><th className="px-6 py-3 text-[12px] uppercase text-text-muted">Description</th></tr></thead><tbody className="divide-y divide-border-subtle">{LOYALTY_GOLD_SCHEMA.map(([column, description]) => <tr key={column}><td className="px-6 py-4 font-mono text-[13px]">{column}</td><td className="px-6 py-4 text-[13px] text-text-muted">{description}</td></tr>)}</tbody></table></div>
  </div>;
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="text-[12px] font-semibold text-text-muted">{label}<input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="mt-2 h-10 w-full rounded-[6px] border border-border-subtle px-3 text-[13px] font-normal" /></label>; }
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) { return <label className="text-[12px] font-semibold text-text-muted">{label}<select value={value} onChange={event => onChange(event.target.value)} className="mt-2 h-10 w-full rounded-[6px] border border-border-subtle bg-white px-3 text-[13px] font-normal">{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>; }
function OriginBadge({ value }: { value: string }) { return <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${value === 'resolved' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>{value}</span>; }
