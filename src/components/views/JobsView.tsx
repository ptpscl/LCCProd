import { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Database,
  GitMerge,
  MoreVertical,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react';

type JobStatus = 'ready' | 'running' | 'completed' | 'failed';
type Tab = 'jobs' | 'runs';

interface WorkflowJob {
  id: string;
  name: string;
  description: string;
  type: 'Job' | 'Pipeline';
  tags: string[];
  icon: typeof Workflow;
  status: JobStatus;
  recentRuns: JobStatus[];
}

interface JobRun {
  id: string;
  jobName: string;
  status: JobStatus;
  startedAt: string;
  duration: string;
  triggeredBy: string;
}

const INITIAL_JOBS: WorkflowJob[] = [
  {
    id: 'anomaly-tagging',
    name: 'Anomaly Tagging of Individual Datasets',
    description: 'Validate each Bronze dataset independently and assign its Silver anomaly tags.',
    type: 'Job',
    tags: ['Bronze → Silver', 'Validation'],
    icon: ShieldCheck,
    status: 'ready',
    recentRuns: ['completed', 'completed', 'completed'],
  },
  {
    id: 'staged-merging',
    name: 'Staged Dataset Merging (A → B → C)',
    description: 'Build the integrated dataset progressively so every join remains traceable.',
    type: 'Pipeline',
    tags: ['Integration', 'A → B → C'],
    icon: GitMerge,
    status: 'ready',
    recentRuns: ['completed', 'completed', 'failed'],
  },
  {
    id: 'relational-anomaly-tagging',
    name: 'Relational Anomaly Tagging',
    description: 'Detect inconsistencies that only appear after datasets are related and merged.',
    type: 'Job',
    tags: ['Cross-dataset', 'Validation'],
    icon: Sparkles,
    status: 'ready',
    recentRuns: ['completed', 'completed'],
  },
  {
    id: 'publish-gold',
    name: 'Publish Clean and Resolved Silver to Gold',
    description: 'Promote approved clean and resolved Silver records into curated Gold outputs.',
    type: 'Job',
    tags: ['Silver → Gold', 'Publish'],
    icon: Database,
    status: 'ready',
    recentRuns: ['completed'],
  },
];

const INITIAL_RUNS: JobRun[] = [
  { id: 'run-1042', jobName: 'Anomaly Tagging of Individual Datasets', status: 'completed', startedAt: 'Jul 21, 2026, 9:14 AM', duration: '2m 18s', triggeredBy: 'Leonard Inciso' },
  { id: 'run-1041', jobName: 'Staged Dataset Merging (A → B → C)', status: 'completed', startedAt: 'Jul 21, 2026, 8:52 AM', duration: '8m 41s', triggeredBy: 'Leonard Inciso' },
  { id: 'run-1040', jobName: 'Relational Anomaly Tagging', status: 'failed', startedAt: 'Jul 20, 2026, 5:36 PM', duration: '1m 04s', triggeredBy: 'System' },
  { id: 'run-1039', jobName: 'Publish Clean and Resolved Silver to Gold', status: 'completed', startedAt: 'Jul 20, 2026, 4:10 PM', duration: '3m 27s', triggeredBy: 'Leonard Inciso' },
];

const MERGE_STAGES = [
  { id: 'A', title: 'Stage A', datasets: 'Loyalty + Customer DB' },
  { id: 'B', title: 'Stage B', datasets: 'Loyalty + Customer DB + MMS' },
  { id: 'C', title: 'Stage C', datasets: 'Loyalty + Customer DB + MMS + SKU Hierarchy' },
];

function StatusBadge({ status }: { status: JobStatus }) {
  const styles = status === 'completed'
    ? 'bg-emerald-50 text-success'
    : status === 'failed'
      ? 'bg-red-50 text-error'
      : status === 'running'
        ? 'bg-blue-50 text-brand-600'
        : 'bg-surface-bg text-text-muted';
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${styles}`}>
    {status === 'running' && <span className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-brand-600" />}
    {status}
  </span>;
}

function RecentRunDot({ status }: { status: JobStatus }) {
  return status === 'completed'
    ? <CheckCircle2 className="h-4 w-4 text-success" />
    : status === 'failed'
      ? <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-100 text-[10px] font-bold text-error">×</span>
      : <Clock3 className="h-4 w-4 text-brand-600" />;
}

export default function JobsView() {
  const [activeTab, setActiveTab] = useState<Tab>('jobs');
  const [jobs, setJobs] = useState(INITIAL_JOBS);
  const [runs, setRuns] = useState(INITIAL_RUNS);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'Job' | 'Pipeline'>('all');

  const visibleJobs = useMemo(() => jobs.filter(job => {
    if (typeFilter !== 'all' && job.type !== typeFilter) return false;
    const searchText = `${job.name} ${job.description} ${job.tags.join(' ')}`.toLowerCase();
    return searchText.includes(query.trim().toLowerCase());
  }), [jobs, query, typeFilter]);

  const runJob = (jobId: string) => {
    const job = jobs.find(item => item.id === jobId);
    if (!job || job.status === 'running') return;
    setJobs(current => current.map(item => item.id === jobId ? { ...item, status: 'running' } : item));
    const runId = `run-${Date.now()}`;
    setRuns(current => [{ id: runId, jobName: job.name, status: 'running', startedAt: new Date().toLocaleString(), duration: '—', triggeredBy: 'Leonard Inciso' }, ...current]);
    window.setTimeout(() => {
      setJobs(current => current.map(item => item.id === jobId
        ? { ...item, status: 'completed', recentRuns: ['completed', ...item.recentRuns].slice(0, 4) }
        : item));
      setRuns(current => current.map(run => run.id === runId ? { ...run, status: 'completed', duration: 'Prototype run' } : run));
    }, 1200);
  };

  return <div className="space-y-6">
    <section className="rounded-[10px] border border-border-subtle bg-white px-6 pt-5 shadow-subtle">
      <div className="flex items-start justify-between gap-5">
        <div><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-brand-50 text-brand-600"><Workflow className="h-6 w-6" /></div><div><h2 className="text-[20px] font-semibold text-text-main">Workflows</h2><p className="mt-1 text-[13px] text-text-muted">Orchestrate validation, merging, relational checks, and Gold publication.</p></div></div></div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-600">Prototype orchestration</span>
      </div>
      <div className="mt-6 flex gap-6">
        <button onClick={() => setActiveTab('jobs')} className={`border-b-2 pb-3 text-[13px] font-semibold ${activeTab === 'jobs' ? 'border-brand-600 text-brand-600' : 'border-transparent text-text-muted'}`}>Jobs &amp; pipelines</button>
        <button onClick={() => setActiveTab('runs')} className={`border-b-2 pb-3 text-[13px] font-semibold ${activeTab === 'runs' ? 'border-brand-600 text-brand-600' : 'border-transparent text-text-muted'}`}>Job runs</button>
      </div>
    </section>

    {activeTab === 'jobs' ? <>
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-[10px] border border-border-subtle bg-white p-4 shadow-subtle">
        <div className="relative min-w-[280px] flex-1 max-w-[460px]"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Filter by job name, tag, or ID" className="h-10 w-full rounded-[7px] border border-border-subtle pl-10 pr-3 text-[13px] outline-none focus:border-brand-600" /></div>
        <div className="flex items-center rounded-[7px] border border-border-subtle p-1">{(['all', 'Job', 'Pipeline'] as const).map(value => <button key={value} onClick={() => setTypeFilter(value)} className={`rounded-[5px] px-4 py-2 text-[12px] font-semibold ${typeFilter === value ? 'bg-brand-50 text-brand-600' : 'text-text-muted hover:text-text-main'}`}>{value === 'all' ? 'All' : `${value}s`}</button>)}</div>
      </section>

      <section className="overflow-hidden rounded-[10px] border border-border-subtle bg-white shadow-subtle">
        <div className="overflow-x-auto"><table className="w-full min-w-[1000px] border-collapse text-left">
          <thead><tr className="border-b border-border-subtle bg-surface-bg">{['Name', 'Type', 'Tags', 'Run as', 'Trigger', 'Recent runs', 'Status', ''].map(label => <th key={label} className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-text-muted">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-border-subtle">{visibleJobs.map(job => { const Icon = job.icon; return <tr key={job.id} className="hover:bg-surface-bg/70">
            <td className="px-5 py-4"><div className="flex items-start gap-3"><div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-[7px] bg-brand-50 text-brand-600"><Icon className="h-4 w-4" /></div><div><p className="text-[13px] font-semibold text-brand-600">{job.name}</p><p className="mt-1 max-w-[420px] text-[11px] leading-4 text-text-muted">{job.description}</p></div></div></td>
            <td className="px-5 py-4 text-[12px] font-medium text-text-main">{job.type}</td><td className="px-5 py-4"><div className="flex flex-wrap gap-1.5">{job.tags.map(tag => <span key={tag} className="rounded bg-surface-bg px-2 py-1 text-[10px] font-semibold text-text-muted">{tag}</span>)}</div></td><td className="whitespace-nowrap px-5 py-4 text-[12px] text-text-muted">Data Admin</td><td className="px-5 py-4 text-[12px] text-text-muted">Manual</td><td className="px-5 py-4"><div className="flex gap-1.5">{job.recentRuns.map((status, index) => <RecentRunDot key={`${status}-${index}`} status={status} />)}</div></td><td className="px-5 py-4"><StatusBadge status={job.status} /></td><td className="px-5 py-4"><div className="flex items-center gap-1"><button onClick={() => runJob(job.id)} disabled={job.status === 'running'} aria-label={`Run ${job.name}`} className="flex h-8 w-8 items-center justify-center rounded-full text-brand-600 hover:bg-brand-50 disabled:opacity-40"><Play className="h-4 w-4 fill-current" /></button><button aria-label="More actions" className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-surface-bg"><MoreVertical className="h-4 w-4" /></button></div></td>
          </tr>; })}</tbody>
        </table></div>
      </section>

      <section className="rounded-[10px] border border-border-subtle bg-white p-6 shadow-subtle">
        <div className="mb-5"><h3 className="text-[16px] font-semibold text-text-main">Merging pipeline dependency</h3><p className="mt-1 text-[12px] text-text-muted">Each stage starts only after the previous merge completes successfully.</p></div>
        <div className="grid items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">{MERGE_STAGES.map((stage, index) => <div key={stage.id} className="contents"><div className="rounded-[9px] border border-border-subtle bg-surface-bg p-5"><div className="flex items-center justify-between"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-[12px] font-bold text-white">{stage.id}</span><span className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Sequential</span></div><h4 className="mt-4 text-[14px] font-semibold text-text-main">{stage.title}</h4><p className="mt-1 text-[12px] leading-5 text-text-muted">{stage.datasets}</p></div>{index < MERGE_STAGES.length - 1 && <div className="flex items-center justify-center text-brand-600"><ArrowRight className="h-5 w-5" /></div>}</div>)}</div>
      </section>
    </> : <section className="overflow-hidden rounded-[10px] border border-border-subtle bg-white shadow-subtle">
      <div className="border-b border-border-subtle px-6 py-5"><h3 className="text-[16px] font-semibold text-text-main">Recent job runs</h3><p className="mt-1 text-[12px] text-text-muted">Prototype execution history for workflow monitoring.</p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[850px] border-collapse text-left"><thead><tr className="border-b border-border-subtle bg-surface-bg">{['Run ID', 'Job', 'Status', 'Started', 'Duration', 'Triggered by'].map(label => <th key={label} className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-text-muted">{label}</th>)}</tr></thead><tbody className="divide-y divide-border-subtle">{runs.map(run => <tr key={run.id} className="hover:bg-surface-bg/70"><td className="px-6 py-4 font-mono text-[12px] text-brand-600">{run.id}</td><td className="px-6 py-4 text-[12px] font-medium text-text-main">{run.jobName}</td><td className="px-6 py-4"><StatusBadge status={run.status} /></td><td className="px-6 py-4 text-[12px] text-text-muted">{run.startedAt}</td><td className="px-6 py-4 text-[12px] text-text-muted">{run.duration}</td><td className="px-6 py-4 text-[12px] text-text-muted">{run.triggeredBy}</td></tr>)}</tbody></table></div>
    </section>}
  </div>;
}
