/**
 * Newsroom review queue for municipality work facts.
 *
 * A municipality can describe what it fixed, but it cannot declare it fact. Each
 * entry arrives as `review: 'pending'` and only appears next to a report as
 * verified once an editor has confirmed the evidence. That delay is the whole
 * mechanism: without it a municipality could write its own version of events,
 * which is the same power as editing the citizen's report, just slower.
 *
 * Only the review flag is editable here. The description, author and timestamp
 * are read-only, so the record of who claimed what and when survives even when a
 * claim is rejected.
 */
import { useEffect, useState, useCallback } from 'react';
import { dt } from '../../lib/dt';
import { auth } from '../../lib/firebase';
import {
  Check, X, Building2, Calendar, Euro, User, ExternalLink, RefreshCw, Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import DecisionBar from './DecisionBar';

interface WorkFact {
  id: string;
  reportId: string;
  description: string;
  completedAt?: string;
  performedBy?: string;
  cost?: string;
  attachments?: string[];
  municipality: string;
  authorEmail: string;
  review: 'pending' | 'confirmed' | 'rejected';
  createdAt?: { seconds?: number } | string;
}

/** Read the token so the server can verify the caller, not the client. */
async function authHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatWhen(value: WorkFact['createdAt']): string {
  if (!value) return '—';
  if (typeof value === 'string') return new Date(value).toLocaleString('sq-AL');
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000).toLocaleString('sq-AL');
  return '—';
}

function WorkFactsQueue() {
  const [items, setItems] = useState<WorkFact[]>([]);
  const [status, setStatus] = useState<'pending' | 'confirmed' | 'rejected'>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async (which: typeof status) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/admin/work-facts?status=${which}`, {
        headers: await authHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setError(e.message || 'Ngarkimi dështoi.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(status); }, [status, load]);

  const decide = async (id: string, decision: 'confirmed' | 'rejected') => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/v1/admin/work-facts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ decision }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      // Remove from the current list: it no longer belongs to this tab.
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success(decision === 'confirmed' ? dt('Faktet u verifikuan.') : dt('Faktet u refuzuan.'));
    } catch (e) {
      toast.error(e.message || dt('Vendimi nuk u ruajt.'));
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-black text-slate-900 dark:text-white">
            {dt('Faktet e komunave — verifikim')}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {dt('Komuna përshkruan punimet; redaksia verifikon para publikimit.')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(status)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {dt('Rifresko')}
        </button>
      </header>

      {/* Status tabs */}
      <nav className="flex gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 dark:border-white/10 dark:bg-slate-900">
        {([
          { id: 'pending', label: 'Në verifikim', icon: Clock },
          { id: 'confirmed', label: 'Verifikuar', icon: Check },
          { id: 'rejected', label: 'Refuzuar', icon: X },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setStatus(id)}
            aria-pressed={status === id}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${status === id
                ? 'bg-blue-700 text-white'
                : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {dt(label)}
          </button>
        ))}
      </nav>

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </p>
      )}

      {loading && items.length === 0 && (
        <p className="rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500 dark:border-white/10">
          {dt('Duke ngarkuar...')}
        </p>
      )}

      {!loading && items.length === 0 && !error && (
        <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500 dark:border-white/10">
          {status === 'pending'
            ? dt('Nuk ka fakte në pritje të verifikimit.')
            : dt('Asnjë regjistrim në këtë kategori.')}
        </p>
      )}

      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900"
          >
            {/* Municipality + submission time */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-800 dark:bg-blue-500/10 dark:text-blue-300">
                <Building2 className="h-3 w-3" />
                {item.municipality}
              </span>
              <span className="text-[11px] text-slate-400">
                {dt('Raporti')}: {item.reportId}
              </span>
              <span className="ml-auto text-[11px] text-slate-400">
                {formatWhen(item.createdAt)}
              </span>
            </div>

            {/* The claim itself */}
            <p className="mt-3 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
              {item.description}
            </p>

            {/* Structured detail */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-500">
              {item.completedAt && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {item.completedAt}
                </span>
              )}
              {item.cost && (
                <span className="inline-flex items-center gap-1">
                  <Euro className="h-3 w-3" /> {item.cost}
                </span>
              )}
              {item.performedBy && (
                <span className="inline-flex items-center gap-1">
                  <User className="h-3 w-3" /> {item.performedBy}
                </span>
              )}
              {item.authorEmail && (
                <span className="inline-flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" /> {item.authorEmail}
                </span>
              )}
            </div>

            {(item.attachments?.length ?? 0) > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {item.attachments!.map((url, i) => (
                  <a
                    key={url + i}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold text-blue-700 hover:bg-slate-50 dark:border-white/10 dark:text-blue-300 dark:hover:bg-slate-800"
                  >
                    {dt('Bashkëngjitje')} {i + 1}
                  </a>
                ))}
              </div>
            )}

            {/* Decision — only offered while a decision is still needed. */}
            {status === 'pending' && (
              <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => decide(item.id, 'confirmed')}
                  disabled={busyId === item.id}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-black text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" /> {dt('Verifiko')}
                </button>
                <button
                  type="button"
                  onClick={() => decide(item.id, 'rejected')}
                  disabled={busyId === item.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3.5 py-2 text-xs font-black text-rose-700 transition-colors hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/20 dark:text-rose-300 dark:hover:bg-rose-500/10"
                >
                  <X className="h-3.5 w-3.5" /> {dt('Refuzo')}
                </button>
                <span className="ml-auto text-[10px] text-slate-400">
                  {dt('Vetëm teksti nuk ndryshon — regjistrohet kush e verifikoi.')}
                </span>
              </div>
            )}

            {status !== 'pending' && (
              <p className="mt-3 border-t border-slate-100 pt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:border-white/10">
                {status === 'confirmed' ? dt('Verifikuar') : dt('Refuzuar')}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

interface MunicipalRequest {
  id: string;
  reportId: string;
  trackingId?: string;
  reportTitle?: string;
  municipality: string;
  kind: 'respond' | 'correct_fact' | 'dispute' | 'request_removal';
  note: string;
  status: 'pending' | 'accepted' | 'declined' | 'published';
  byName?: string;
  at?: string | null;
  decisionReason?: string | null;
}

const KIND_LABELS: Record<MunicipalRequest['kind'], string> = {
  respond: 'Përgjigje zyrtare',
  correct_fact: 'Kërkesë për korrigjim fakti',
  dispute: 'Kundërshtim i raportit',
  request_removal: 'Kërkesë për heqje',
};

/** What municipalities asked staff to look at. Staff accept or decline, with a reason the municipality reads. */
function MunicipalRequestsQueue() {
  const [items, setItems] = useState<MunicipalRequest[]>([]);
  const [status, setStatus] = useState<'pending' | 'accepted' | 'declined' | 'published'>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (which: typeof status) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/admin/municipality-requests?status=${which}`, { headers: await authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setError(e.message || 'Ngarkimi dështoi.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(status); }, [status, load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {([['pending', 'Në pritje'], ['accepted', 'Të pranuara'], ['declined', 'Të refuzuara'], ['published', 'Përgjigje të publikuara']] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setStatus(id)}
            aria-pressed={status === id}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold ${status === id ? 'bg-slate-900 text-white dark:bg-emerald-600' : 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300'}`}
          >
            {dt(label)}
          </button>
        ))}
        <button type="button" onClick={() => void load(status)} className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 dark:border-white/10 dark:text-slate-300">
          <RefreshCw className="h-3.5 w-3.5" /> {dt('Rifresko')}
        </button>
      </div>

      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {loading ? (
        <p className="text-sm text-slate-500">{dt('Duke ngarkuar…')}</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500 dark:border-white/10">{dt('Asnjë kërkesë këtu.')}</p>
      ) : (
        <ul className="space-y-3">
          {items.map(item => (
            <li key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">{dt(KIND_LABELS[item.kind] ?? item.kind)}</span>
                <span className="inline-flex items-center gap-1 text-slate-500"><Building2 className="h-3 w-3" /> {item.municipality}</span>
                {item.trackingId && <span className="font-mono text-slate-400">#{item.trackingId}</span>}
                <span className="ml-auto text-slate-400">{formatWhen(item.at ?? undefined)}</span>
              </div>
              {item.reportTitle && <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{item.reportTitle}</p>}
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{item.note}</p>
              {item.decisionReason && <p className="mt-2 text-xs text-slate-500">{dt('Arsyeja e vendimit:')} {item.decisionReason}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {item.status !== 'published' && (
                  <DecisionBar kind="muniRequest" id={item.id} doc={item as any} onDecided={() => void load(status)} />
                )}
                <a href={`/admin#reports?open=${encodeURIComponent(item.reportId)}`} className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:underline">
                  <ExternalLink className="h-3 w-3" /> {dt('Hap raportin')}
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminWorkFacts() {
  const [tab, setTab] = useState<'facts' | 'requests'>('requests');
  return (
    <div className="space-y-5">
      <div className="flex gap-2" role="tablist">
        {([['requests', 'Kërkesat e komunave'], ['facts', 'Faktet e punimeve']] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === id ? 'bg-emerald-700 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300'}`}
          >
            {dt(label)}
          </button>
        ))}
      </div>
      {tab === 'requests' ? <MunicipalRequestsQueue /> : <WorkFactsQueue />}
    </div>
  );
}
