import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, FileSearch, Pencil, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';
import {
  LOYALTY_ANOMALY_RULES,
  LOYALTY_ESTIMATED_CLEAN,
  LOYALTY_ROW_RULE_HITS,
  LOYALTY_ROWS_CHECKED,
  LoyaltyIssue,
  LoyaltySilverRow,
  loadLoyaltyDemoRows,
  saveLoyaltyDemoRows,
} from './loyaltySilverDemo';

type Rule = typeof LOYALTY_ANOMALY_RULES[number];
type ReviewStatus = 'for-review' | 'reviewed' | 'all';
type Resolution = 'accept' | 'exclude';

export default function LoyaltySilverView() {
  const [rows, setRows] = useState<LoyaltySilverRow[]>(loadLoyaltyDemoRows);
  const [activeRule, setActiveRule] = useState<Rule | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [issueFilter, setIssueFilter] = useState<LoyaltyIssue | ''>('');
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState(() => new Date());
  const [notice, setNotice] = useState('');
  const [selectedRow, setSelectedRow] = useState<LoyaltySilverRow | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  const resolved = rows.filter(row => row.validation_status === 'resolved').length;
  const filteredRows = useMemo(() => rows.filter(row => {
    if (statusFilter && row.validation_status !== statusFilter) return false;
    if (issueFilter && !(row.original_quality_issues || row.quality_issues).includes(issueFilter)) return false;
    const haystack = `${row['TRANSACTION NUMBER']} ${row['CUSTOMER NUMBER']} ${row['STORE CODE']} ${row['SKU CODE']}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  }), [rows, statusFilter, issueFilter, query]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const refresh = () => {
    setRefreshing(true);
    setRows(loadLoyaltyDemoRows());
    setRefreshedAt(new Date());
    window.setTimeout(() => setRefreshing(false), 300);
  };
  const download = () => {
    const columns = ['DATE', 'TRANSACTION NUMBER', 'REGISTER NUMBER', 'STORE CODE', 'CUSTOMER NUMBER', 'SKU CODE', 'TRANSACTION TYPE', 'LOYALTY SALES', 'QTY SOLD', 'validation_status', 'quality_issues'];
    const cell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const records = rows.filter(row => row.validation_status !== 'clean').map(row => columns.map(column => cell(column === 'quality_issues' ? (row.original_quality_issues || row.quality_issues).join(' | ') : (row as any)[column])).join(','));
    const blob = new Blob([`\uFEFF${[columns.map(cell).join(','), ...records].join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'loyalty_silver_anomaly_samples.csv'; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  };
  const resolveRows = (ids: string[], resolution: Resolution, note: string) => {
    const selected = new Set(ids); const now = new Date().toISOString();
    const next = rows.map(row => selected.has(row.id) ? { ...row, validation_status: 'resolved' as const, original_quality_issues: row.original_quality_issues || [...row.quality_issues], quality_issues: [] as LoyaltyIssue[], resolution_type: resolution, resolution_note: note, resolved_by: 'Leonard Inciso', resolved_at: now } : row);
    setRows(next); saveLoyaltyDemoRows(next); setNotice(`${ids.length} Loyalty ${ids.length === 1 ? 'row' : 'rows'} resolved locally.`);
  };
  const openEdit = (row: LoyaltySilverRow) => {
    setSelectedRow(row);
    setEditForm({
      date: row.DATE,
      transaction_number: row['TRANSACTION NUMBER'],
      register_number: row['REGISTER NUMBER'],
      store_code: row['STORE CODE'],
      customer_number: row['CUSTOMER NUMBER'],
      sku_code: row['SKU CODE'],
      transaction_type: row['TRANSACTION TYPE'],
      loyalty_sales: String(row['LOYALTY SALES']),
      qty_sold: String(row['QTY SOLD']),
      resolution_note: row.resolution_note || '',
    });
  };
  const saveEdit = () => {
    if (!selectedRow || !editForm.resolution_note.trim()) return;
    const updated: LoyaltySilverRow = {
      ...selectedRow,
      DATE: editForm.date,
      'TRANSACTION NUMBER': editForm.transaction_number.trim(),
      'REGISTER NUMBER': editForm.register_number.trim(),
      'STORE CODE': editForm.store_code.trim(),
      'CUSTOMER NUMBER': editForm.customer_number.trim(),
      'SKU CODE': editForm.sku_code.trim(),
      'TRANSACTION TYPE': editForm.transaction_type.trim(),
      'LOYALTY SALES': Number(editForm.loyalty_sales),
      'QTY SOLD': Number(editForm.qty_sold),
      validation_status: 'resolved',
      original_quality_issues: selectedRow.original_quality_issues || [...selectedRow.quality_issues],
      quality_issues: [],
      resolution_type: 'accept',
      resolution_note: editForm.resolution_note.trim(),
      resolved_by: 'Leonard Inciso',
      resolved_at: new Date().toISOString(),
    };
    const next = rows.map(row => row.id === updated.id ? updated : row);
    setRows(next); saveLoyaltyDemoRows(next); setSelectedRow(null); setNotice('Loyalty row correction saved locally.');
  };

  const ruleSummary = LOYALTY_ANOMALY_RULES.map(rule => ({
    ...rule,
    forReview: Math.max(0, rule.affected - rows.filter(row =>
      row.validation_status === 'resolved'
      && (row.original_quality_issues || row.quality_issues).includes(rule.id)).length),
  }));

  return <div className="space-y-6">
    <div className="flex items-center justify-between rounded-[8px] border border-blue-200 bg-blue-50 px-4 py-3 text-[13px] text-blue-900"><span><strong>Prototype demo:</strong> summary counts come from the Loyalty anomaly analysis; rows below are illustrative samples.</span><span className="rounded-full bg-blue-100 px-2 py-1 text-[11px] font-semibold">No live processing</span></div>
    {notice && <div className="fixed bottom-6 right-6 z-[120] rounded-[8px] border border-green-200 bg-green-50 px-4 py-3 text-[13px] text-green-800 shadow-lg">{notice}</div>}
    <section className="overflow-hidden rounded-[10px] border border-border-subtle border-t-[3px] border-t-silver-accent bg-white shadow-subtle">
      <div className="flex flex-wrap items-center justify-between gap-5 px-6 py-5"><div className="flex items-start gap-4"><div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-silver-bg text-silver-text"><ShieldCheck className="h-6 w-6" /></div><div><h3 className="text-[16px] font-semibold">Loyalty validation summary</h3><p className="mt-1 text-[13px] text-text-muted">Dataset-only anomaly tagging · 28,181,998 source rows</p><p className="mt-1 text-[11px] text-text-muted">Refreshed {refreshedAt.toLocaleTimeString()}</p></div></div><div className="flex gap-3"><button onClick={refresh} className="inline-flex h-9 items-center rounded-[8px] border border-border-subtle px-4 text-[12px] font-semibold"><RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Refresh</button><button onClick={download} className="inline-flex h-9 items-center rounded-[8px] bg-brand-600 px-4 text-[12px] font-semibold text-white"><Download className="mr-2 h-4 w-4" />Download anomalies CSV</button></div></div>
      <div className="grid border-t border-border-subtle sm:grid-cols-2 xl:grid-cols-4">{[
        ['Loyalty Rows Checked', LOYALTY_ROWS_CHECKED, 'All source rows scanned'],
        ['Rule Hits', LOYALTY_ROW_RULE_HITS - resolved, 'Counts overlap across the three rules'],
        ['Resolved', resolved, 'Human-reviewed demo rows'],
        ['Estimated Clean', LOYALTY_ESTIMATED_CLEAN + resolved, 'Pending production processor confirmation'],
      ].map(([label, value, note], index) => <div key={String(label)} className={`px-6 py-5 ${index ? 'border-l border-border-subtle' : ''}`}><p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">{label}</p><p className="mt-2 text-[26px] font-semibold tabular-nums">{Number(value).toLocaleString()}</p><p className="mt-1 text-[11px] text-text-muted">{note}</p></div>)}</div>
    </section>
    <section className="overflow-hidden rounded-[10px] border border-border-subtle bg-white shadow-subtle"><div className="flex items-start justify-between border-b border-border-subtle px-6 py-5"><div><h3 className="text-[16px] font-semibold">Dataset rule summary</h3><p className="mt-1 text-[12px] text-text-muted">Only the three confirmed Loyalty-only anomalies are included. Counts can overlap.</p></div><span className="rounded-full bg-silver-bg px-3 py-1 text-[11px] font-bold uppercase text-silver-text">Loyalty validation</span></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead><tr className="border-b border-border-subtle bg-surface-bg">{['Anomaly', 'Definition', 'Affected Rows', 'For Review', 'Action'].map(label => <th key={label} className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-text-muted">{label}</th>)}</tr></thead><tbody className="divide-y divide-border-subtle">{ruleSummary.map(rule => <tr key={rule.id} className="hover:bg-surface-bg/70"><td className="px-6 py-4 font-mono text-[12px] font-semibold">{rule.id}</td><td className="max-w-[650px] px-6 py-4 text-[12px] text-text-muted">{rule.definition}</td><td className="px-6 py-4 text-[13px] font-semibold tabular-nums">{rule.affected.toLocaleString()}</td><td className="px-6 py-4 text-[13px] font-semibold tabular-nums">{rule.forReview.toLocaleString()}</td><td className="px-6 py-4"><button onClick={() => { setIssueFilter(rule.id); setActiveRule(rule); }} className="inline-flex items-center rounded-[7px] border border-brand-600 px-3 py-1.5 text-[12px] font-semibold text-brand-600"><FileSearch className="mr-1.5 h-4 w-4" />Review</button></td></tr>)}</tbody></table></div></section>
    <section className="rounded-[10px] border border-border-subtle bg-white p-5 shadow-subtle"><div className="grid gap-4 md:grid-cols-[1fr_1fr_1.5fr_auto]"><label className="text-[12px] font-semibold text-text-muted">Status<select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="mt-2 h-10 w-full rounded-[6px] border border-border-subtle px-3 font-normal"><option value="">All statuses</option><option value="clean">Clean</option><option value="flagged">Flagged</option><option value="resolved">Resolved</option></select></label><label className="text-[12px] font-semibold text-text-muted">Quality issue<select value={issueFilter} onChange={event => setIssueFilter(event.target.value as LoyaltyIssue | '')} className="mt-2 h-10 w-full rounded-[6px] border border-border-subtle px-3 font-normal"><option value="">All issues</option>{LOYALTY_ANOMALY_RULES.map(rule => <option key={rule.id}>{rule.id}</option>)}</select></label><label className="text-[12px] font-semibold text-text-muted">Transaction, customer, store, or SKU<div className="relative mt-2"><Search className="absolute left-3 top-3 h-4 w-4 text-text-muted" /><input value={query} onChange={event => setQuery(event.target.value)} className="h-10 w-full rounded-[6px] border border-border-subtle pl-10 pr-3 font-normal" /></div></label><button onClick={() => { setStatusFilter(''); setIssueFilter(''); setQuery(''); }} className="mt-6 inline-flex h-10 items-center rounded-[6px] border border-border-subtle px-4 text-[13px]"><X className="mr-2 h-4 w-4" />Clear</button></div></section>
    <section className="overflow-hidden rounded-[10px] border border-border-subtle bg-white shadow-subtle"><div className="overflow-x-auto"><table className="w-full min-w-[1400px] text-left"><thead><tr className="border-b border-border-subtle bg-surface-bg">{['Date', 'Transaction', 'Register', 'Store', 'Customer', 'SKU', 'Transaction Type', 'Loyalty Sales', 'Qty Sold', 'Status', 'Quality Issues', 'Action'].map(label => <th key={label} className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-text-muted">{label}</th>)}</tr></thead><tbody className="divide-y divide-border-subtle">{filteredRows.map(row => <tr key={row.id} className="hover:bg-surface-bg"><td className="px-4 py-3 text-[12px]">{row.DATE}</td><td className="px-4 py-3 font-mono text-[12px]">{row['TRANSACTION NUMBER']}</td><td className="px-4 py-3 text-[12px]">{row['REGISTER NUMBER']}</td><td className="px-4 py-3 text-[12px]">{row['STORE CODE']}</td><td className="px-4 py-3 font-mono text-[12px]">{row['CUSTOMER NUMBER']}</td><td className="px-4 py-3 font-mono text-[12px]">{row['SKU CODE']}</td><td className="px-4 py-3 text-[12px]">{row['TRANSACTION TYPE']}</td><td className="px-4 py-3 text-right font-mono text-[12px]">{row['LOYALTY SALES'].toLocaleString()}</td><td className="px-4 py-3 text-right font-mono text-[12px]">{row['QTY SOLD']}</td><td className="px-4 py-3"><StatusBadge status={row.validation_status} /></td><td className="max-w-[260px] px-4 py-3 text-[11px] text-amber-800">{(row.original_quality_issues || row.quality_issues).join(', ') || '—'}</td><td className="px-4 py-3"><button onClick={() => openEdit(row)} disabled={row.validation_status === 'clean'} className="inline-flex h-8 items-center rounded-[6px] border border-border-subtle px-3 text-[12px] font-medium disabled:opacity-40"><Pencil className="mr-1.5 h-3.5 w-3.5" />{row.validation_status === 'resolved' ? 'Edit' : 'Review'}</button></td></tr>)}</tbody></table></div><div className="border-t border-border-subtle px-5 py-4 text-[12px] text-text-muted">{filteredRows.length} prototype rows shown</div></section>
    {activeRule && <ReviewPanel rule={activeRule} rows={rows} onClose={() => setActiveRule(null)} onResolve={resolveRows} />}
    {selectedRow && <EditModal row={selectedRow} form={editForm} setForm={setEditForm} onClose={() => setSelectedRow(null)} onSave={saveEdit} />}
  </div>;
}

function EditModal({ row, form, setForm, onClose, onSave }: {
  row: LoyaltySilverRow;
  form: Record<string, string>;
  setForm: (form: Record<string, string>) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const field = (key: string, label: string, type = 'text') => <label className="text-[12px] font-semibold text-text-muted">{label}<input type={type} value={form[key] || ''} onChange={event => setForm({ ...form, [key]: event.target.value })} className="mt-2 h-10 w-full rounded-[6px] border border-border-subtle px-3 text-[13px] font-normal text-text-main" /></label>;
  return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#111827]/55 p-4" onMouseDown={onClose}><section role="dialog" aria-modal="true" className="flex max-h-[92vh] w-full max-w-[1120px] flex-col overflow-hidden rounded-[12px] bg-white shadow-2xl" onMouseDown={event => event.stopPropagation()}>
    <header className="flex items-start justify-between border-b border-border-subtle px-6 py-5"><div><div className="mb-2 flex items-center gap-3"><span className="rounded-full bg-silver-bg px-2.5 py-1 text-[11px] font-bold uppercase text-silver-text">Loyalty row review</span><StatusBadge status={row.validation_status} /></div><h3 className="text-[18px] font-semibold">Review and correct Loyalty transaction</h3><p className="mt-1 text-[12px] text-text-muted">Correct the typed values and provide a required audit note.</p></div><button onClick={onClose}><X className="h-5 w-5" /></button></header>
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6"><div className="rounded-[8px] border border-amber-200 bg-amber-50 p-4"><p className="text-[12px] font-semibold text-amber-900">Original detected issues</p><div className="mt-2 flex flex-wrap gap-2">{(row.original_quality_issues || row.quality_issues).map(issue => <span key={issue} className="rounded-full border border-amber-200 bg-white px-2 py-1 text-[11px] text-amber-800">{issue}</span>)}</div></div>
      <div className="grid gap-4 md:grid-cols-3">{field('date', 'Date', 'date')}{field('transaction_number', 'Transaction number')}{field('register_number', 'Register number')}{field('store_code', 'Store code')}{field('customer_number', 'Customer number')}{field('sku_code', 'SKU code')}{field('transaction_type', 'Transaction type')}{field('loyalty_sales', 'Loyalty sales', 'number')}{field('qty_sold', 'Quantity sold', 'number')}</div>
      <label className="block text-[12px] font-semibold text-text-muted">Audit note <span className="text-error">*</span><textarea value={form.resolution_note || ''} onChange={event => setForm({ ...form, resolution_note: event.target.value })} className="mt-2 min-h-[90px] w-full rounded-[6px] border border-border-subtle p-3 text-[13px] font-normal" placeholder="Describe what was reviewed or corrected" /></label>
    </div>
    <footer className="flex items-center justify-between gap-4 border-t border-border-subtle px-6 py-4"><p className="text-[11px] text-text-muted">The original anomaly tags remain available for audit history.</p><div className="flex gap-3"><button onClick={onClose} className="h-10 rounded-[6px] border border-border-subtle px-4 text-[13px]">Cancel</button><button onClick={onSave} disabled={!form.resolution_note?.trim()} className="inline-flex h-10 items-center rounded-[6px] bg-brand-600 px-4 text-[13px] font-semibold text-white disabled:opacity-40"><CheckCircle2 className="mr-2 h-4 w-4" />Save as resolved</button></div></footer>
  </section></div>;
}

function StatusBadge({ status }: { status: string }) { const color = status === 'clean' ? 'bg-green-100 text-green-800' : status === 'resolved' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'; return <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${color}`}>{status}</span>; }

function ReviewPanel({ rule, rows, onClose, onResolve }: { rule: Rule; rows: LoyaltySilverRow[]; onClose: () => void; onResolve: (ids: string[], resolution: Resolution, note: string) => void }) {
  const [status, setStatus] = useState<ReviewStatus>('for-review'); const [selected, setSelected] = useState<Set<string>>(new Set()); const [resolution, setResolution] = useState<Resolution | ''>(''); const [note, setNote] = useState('');
  const affected = rows.filter(row => (row.original_quality_issues || row.quality_issues).includes(rule.id)); const visible = affected.filter(row => status === 'all' || (status === 'reviewed' ? row.validation_status === 'resolved' : row.validation_status !== 'resolved')); const selectable = visible.filter(row => row.validation_status !== 'resolved'); const all = selectable.length > 0 && selectable.every(row => selected.has(row.id)); const canResolve = selected.size > 0 && resolution && note.trim();
  useEffect(() => { const old = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = old; }; }, []);
  const toggle = (id: string) => setSelected(current => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111827]/55 p-4"><section className="flex h-[92vh] w-full max-w-[1480px] flex-col overflow-hidden rounded-[12px] bg-white shadow-2xl"><header className="flex justify-between border-b border-border-subtle px-6 py-5"><div><div className="mb-2 flex gap-3"><span className="rounded-full bg-silver-bg px-2.5 py-1 text-[11px] font-bold uppercase text-silver-text">Loyalty anomaly review</span><span className="text-[12px] text-text-muted">{affected.length} sample rows</span></div><h2 className="font-mono text-[18px] font-semibold">{rule.id}</h2><p className="mt-1 text-[13px] text-text-muted">{rule.definition}</p></div><button onClick={onClose}><X className="h-5 w-5" /></button></header><div className="flex items-center justify-between border-b border-border-subtle bg-surface-bg px-6 py-3"><div className="flex gap-2"><span className="mr-1 py-2 text-[12px] font-semibold">Status</span>{([['for-review', 'For review'], ['reviewed', 'Reviewed'], ['all', 'All']] as const).map(([value, label]) => <button key={value} onClick={() => { setStatus(value); setSelected(new Set()); }} className={`rounded-[7px] border px-4 py-2 text-[12px] font-semibold ${status === value ? 'border-brand-600 bg-brand-600 text-white' : 'bg-white'}`}>{label}</button>)}</div><p className="text-[12px] text-text-muted">{visible.length} shown · {selected.size} selected</p></div><div className="min-h-0 flex-1 overflow-auto"><table className="w-full min-w-[1450px] text-left"><thead className="sticky top-0 bg-surface-bg"><tr><th className="px-4 py-3"><input type="checkbox" checked={all} onChange={() => setSelected(all ? new Set() : new Set(selectable.map(row => row.id)))} /></th>{['Date', 'Transaction', 'Register', 'Store', 'Customer', 'SKU', 'Type', 'Sales', 'Qty', 'Status', 'Issues', 'Resolved By'].map(label => <th key={label} className="px-4 py-3 text-[11px] font-bold uppercase text-text-muted">{label}</th>)}</tr></thead><tbody className="divide-y divide-border-subtle">{visible.map(row => <tr key={row.id} className={selected.has(row.id) ? 'bg-brand-50' : ''}><td className="px-4 py-4"><input type="checkbox" checked={selected.has(row.id)} disabled={row.validation_status === 'resolved'} onChange={() => toggle(row.id)} /></td><td className="px-4 py-4 text-[12px]">{row.DATE}</td><td className="px-4 py-4 font-mono text-[12px]">{row['TRANSACTION NUMBER']}</td><td className="px-4 py-4 text-[12px]">{row['REGISTER NUMBER']}</td><td className="px-4 py-4 text-[12px]">{row['STORE CODE']}</td><td className="px-4 py-4 font-mono text-[12px]">{row['CUSTOMER NUMBER']}</td><td className="px-4 py-4 font-mono text-[12px]">{row['SKU CODE']}</td><td className="px-4 py-4 text-[12px]">{row['TRANSACTION TYPE']}</td><td className="px-4 py-4 text-right text-[12px]">{row['LOYALTY SALES']}</td><td className="px-4 py-4 text-right text-[12px]">{row['QTY SOLD']}</td><td className="px-4 py-4"><StatusBadge status={row.validation_status} /></td><td className="px-4 py-4 text-[11px] text-amber-800">{(row.original_quality_issues || row.quality_issues).join(', ')}</td><td className="px-4 py-4 text-[12px] text-text-muted">{row.resolved_by || '—'}</td></tr>)}</tbody></table></div><footer className="border-t border-border-subtle px-6 py-4"><div className="grid gap-4 lg:grid-cols-[0.7fr_1.3fr_auto]"><label className="text-[12px] font-semibold">Resolution<select value={resolution} onChange={event => setResolution(event.target.value as Resolution | '')} disabled={!selected.size} className="mt-1.5 h-10 w-full rounded-[7px] border px-3 font-normal"><option value="">Choose a resolution</option><option value="accept">Accept as valid</option><option value="exclude">Exclude from clean output</option></select></label><label className="text-[12px] font-semibold">Audit note *<input value={note} onChange={event => setNote(event.target.value)} disabled={!selected.size} className="mt-1.5 h-10 w-full rounded-[7px] border px-3 font-normal" placeholder="Explain why this resolution is appropriate" /></label><button disabled={!canResolve} onClick={() => { onResolve([...selected], resolution as Resolution, note.trim()); setSelected(new Set()); setResolution(''); setNote(''); }} className="mt-5 inline-flex h-10 items-center rounded-[7px] bg-brand-600 px-5 text-[13px] font-semibold text-white disabled:opacity-40"><CheckCircle2 className="mr-2 h-4 w-4" />Complete resolution</button></div></footer></section></div>;
}
