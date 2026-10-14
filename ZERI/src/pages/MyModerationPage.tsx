import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gavel, Loader2, ShieldCheck, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { dt } from '@/src/lib/dt';
import { useStore } from '../lib/store';
import { EFFECT_LABELS, KIND_LABELS, moderationApi, type MyModerationCase } from '../lib/moderationApi';

/**
 * What the moderation of the public debate decided about me, and why.
 *
 * A person sees only decided cases about their own content or account (never who reported
 * them, never open reports), the reason the moderator gave, any active restriction and its
 * end, and can appeal a decision once within 30 days. The appeal goes to a different
 * moderator than the one who decided.
 */
type Data = Awaited<ReturnType<typeof moderationApi.myCases>>;

export default function MyModerationPage() {
  const user = useStore(state => state.currentUser);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try { setData(await moderationApi.myCases()); } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { if (user && user.role !== 'guest') void load(); }, [user, load]);

  if (!user || user.role === 'guest') {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">{dt('Moderimi i llogarisë sime')}</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">{dt('Kyçuni për të parë vendimet e moderimit për llogarinë tuaj.')}</p>
        <Link to="/login" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-5 text-sm font-bold text-white">{dt('Kyçu')}</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-10">
      <header>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">{dt('Moderimi i llogarisë sime')}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{dt('Vendimet e moderatorëve të debatit për përmbajtjen ose llogarinë tuaj, arsyeja e secilit dhe mundësia për apelim.')}</p>
      </header>

      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error} <button type="button" className="underline" onClick={() => void load()}>{dt('Provo përsëri')}</button></p>}
      {!data && !error && <div className="flex justify-center p-10 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" /></div>}

      {data && (
        <>
          <section className={data.restriction ? 'rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/30 dark:bg-rose-950/30' : 'rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-950/30'}>
            {data.restriction ? (
              <p className="flex items-start gap-2 text-sm font-semibold text-rose-900 dark:text-rose-100">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                {data.restriction.kind === 'suspension' && data.restriction.untilMs
                  ? `${dt('Llogaria juaj është e pezulluar deri më')} ${new Date(data.restriction.untilMs).toLocaleString('sq-AL', { dateStyle: 'long', timeStyle: 'short' })}. ${dt('Deri atëherë mund të lexoni, por jo të postoni, komentoni apo dërgoni mesazhe.')}`
                  : dt('Llogaria juaj është e kufizuar pa afat.')}
              </p>
            ) : (
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900 dark:text-emerald-100"><ShieldCheck className="h-5 w-5" aria-hidden="true" />{dt('Llogaria juaj nuk ka asnjë kufizim aktiv.')}</p>
            )}
            {data.warningCount > 0 && <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">{dt('Paralajmërime gjithsej')}: {data.warningCount}</p>}
          </section>

          {data.cases.length === 0
            ? <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-slate-900">{dt('Nuk ka asnjë vendim moderimi për ju.')}</p>
            : <ul className="space-y-3">{data.cases.map(item => <CaseCard key={item.id} item={item} onAppealed={() => void load()} />)}</ul>}
        </>
      )}
    </main>
  );
}

function CaseCard({ item, onAppealed }: { item: MyModerationCase; onAppealed: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      await moderationApi.appeal(item.id, text.trim());
      toast.success(dt('Apelimi u dërgua. Do ta shqyrtojë një moderator tjetër.'));
      onAppealed();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{dt(KIND_LABELS[item.kind])} · {item.decidedAtMs ? new Date(item.decidedAtMs).toLocaleDateString('sq-AL') : ''}</p>
      <p className="mt-1 font-black text-slate-900 dark:text-white">{dt(EFFECT_LABELS[item.effect ?? ''] ?? item.effect ?? '')}</p>
      {item.excerpt && <blockquote className="mt-2 rounded-lg bg-slate-50 p-2 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-300">{item.excerpt}</blockquote>}
      <p className="mt-2 text-sm text-slate-700 dark:text-slate-300"><span className="font-bold">{dt('Arsyeja')}:</span> {item.reason}</p>
      {item.appeal && (
        <p className="mt-2 flex items-center gap-1 text-sm font-semibold text-amber-800 dark:text-amber-300">
          <Gavel className="h-4 w-4" aria-hidden="true" />
          {item.appeal.outcome === 'upheld' ? dt('Apelimi u shqyrtua: vendimi mbetet.') : item.appeal.outcome === 'overturned' ? dt('Apelimi u pranua: vendimi u rrëzua.') : dt('Apelimi juaj po shqyrtohet.')}
        </p>
      )}
      {item.canAppeal && !open && <button type="button" onClick={() => setOpen(true)} className="mt-3 inline-flex min-h-10 items-center rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200">{dt('Apelo këtë vendim')}</button>}
      {open && (
        <form onSubmit={submit} className="mt-3 space-y-2">
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">{dt('Pse mendoni se vendimi është i gabuar? (10-1000 shenja)')}
            <textarea required minLength={10} maxLength={1000} rows={4} value={text} onChange={e => setText(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-base sm:text-sm dark:border-white/15 dark:bg-slate-950" />
          </label>
          {error && <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="inline-flex min-h-10 items-center rounded-xl bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-50">{busy ? dt('Duke dërguar…') : dt('Dërgo apelimin')}</button>
            <button type="button" onClick={() => setOpen(false)} className="min-h-10 rounded-xl px-4 text-sm font-bold text-slate-600">{dt('Anulo')}</button>
          </div>
        </form>
      )}
    </li>
  );
}
