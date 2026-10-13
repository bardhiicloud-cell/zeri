import { useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, CheckCircle2, ClipboardPaste, Landmark, Search, Settings2, Upload, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { dt } from '@/src/lib/dt';
import { cn } from '../../lib/utils';
import { formatIban, isValidIban } from '../../lib/iban';
import {
  KIND_LABELS,
  adminPayments,
  analyzeStatement,
  applyStatement,
  cancelPayment,
  confirmPayment,
  formatEur,
  formatWhen,
  getPaymentSettings,
  savePaymentSettings,
  type PaymentOrder,
  type PaymentSettings,
  type PaymentStatus,
  type StatementEntry,
  type StatementOutcome,
} from '../../lib/debateApi';
import { Badge, BulkBar, Empty, ErrorNote, Panel, Spinner, Stat, btn, inputClass, useLoad, useSelection } from './ui';

type Sub = 'awaiting' | 'paid' | 'cancelled' | 'statement' | 'settings' | 'guide';

const SUBS: ReadonlyArray<{ id: Sub; label: string; icon: typeof Landmark }> = [
  { id: 'awaiting', label: 'Në pritje të konfirmimit', icon: AlertTriangle },
  { id: 'paid', label: 'Të paguara', icon: CheckCircle2 },
  { id: 'cancelled', label: 'Të anuluara', icon: XCircle },
  { id: 'statement', label: 'Pasqyra bankare', icon: ClipboardPaste },
  { id: 'settings', label: 'IBAN & çmimet', icon: Settings2 },
  { id: 'guide', label: 'Udhëzuesi', icon: BookOpen },
];

const OUTCOME: Record<StatementOutcome, { label: string; tone: 'emerald' | 'amber' | 'rose' | 'slate' | 'blue'; help: string }> = {
  match: { label: 'Përputhet', tone: 'emerald', help: 'Kodi dhe shuma përputhen. Mund të konfirmohet.' },
  amount_mismatch: { label: 'Shumë tjetër', tone: 'amber', help: 'Kodi ekziston, por asnjë shumë në rresht nuk është çmimi. Kontrolloni dorazi.' },
  amount_unknown: { label: 'Pa shumë', tone: 'amber', help: 'Rreshti nuk ka shumë të lexueshme. Konfirmojeni nga lista në pritje.' },
  already_paid: { label: 'Tashmë e paguar', tone: 'slate', help: 'Ky kod është konfirmuar më parë.' },
  cancelled: { label: 'E anuluar', tone: 'rose', help: 'Porosia është anuluar.' },
  unknown_code: { label: 'Kod i panjohur', tone: 'rose', help: 'Nuk ka porosi me këtë kod. Mund të jetë nga një sistem tjetër.' },
};

export function DebatePayments({ onChanged }: { onChanged?: () => void }) {
  const [sub, setSub] = useState<Sub>('awaiting');

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label={dt('Pagesat')} className="flex gap-1.5 overflow-x-auto pb-1">
        {SUBS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={sub === id}
            onClick={() => setSub(id)}
            className={cn(
              'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-bold transition',
              sub === id ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5'
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {dt(label)}
          </button>
        ))}
      </div>

      {sub === 'awaiting' && <OrdersList status="awaiting" onChanged={onChanged} />}
      {sub === 'paid' && <OrdersList status="paid" onChanged={onChanged} />}
      {sub === 'cancelled' && <OrdersList status="cancelled" onChanged={onChanged} />}
      {sub === 'statement' && <StatementImport onChanged={onChanged} />}
      {sub === 'settings' && <PaymentSettingsForm />}
      {sub === 'guide' && <Guide />}
    </div>
  );
}

/* ----------------------------------------------------------------- orders */

function OrdersList({ status, onChanged }: { status: PaymentStatus; onChanged?: () => void }) {
  const { data, error, loading, reload } = useLoad(() => adminPayments(status), [status]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const orders = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data?.orders ?? []).filter((o) => !needle || o.code.toLowerCase().includes(needle.replace(/[\s-]/g, '')) || (o.name ?? '').toLowerCase().includes(needle));
  }, [data, query]);
  const ids = useMemo(() => orders.map((o) => o.code), [orders]);
  const selection = useSelection(ids);
  const total = data?.totals[status];
  const selectedOrders = orders.filter((o) => selection.selected.has(o.code));
  const selectedSum = selectedOrders.reduce((sum, o) => sum + o.amountEur, 0);

  const confirmMany = async (list: PaymentOrder[]) => {
    if (list.length === 0) return;
    const sum = list.reduce((s, o) => s + o.amountEur, 0);
    if (!window.confirm(`${dt('Konfirmoni')} ${list.length} ${dt('pagesa me total')} ${formatEur(sum)}? ${dt('Bëjeni vetëm nëse paratë janë në llogari.')}`)) return;
    setBusy(true);
    let ok = 0;
    const failed: string[] = [];
    for (const order of list) {
      try {
        await confirmPayment(order.code, { bankReference: 'Konfirmim manual' });
        ok += 1;
      } catch (e) {
        failed.push(`${order.code}: ${(e as Error).message}`);
      }
    }
    setBusy(false);
    selection.clear();
    await reload();
    onChanged?.();
    if (failed.length) toast.error(`${ok} u konfirmuan, ${failed.length} jo. ${failed[0]}`, { duration: 8000 });
    else toast.success(`${ok} ${dt('pagesa u konfirmuan.')}`);
  };

  const cancelMany = async (list: PaymentOrder[]) => {
    if (list.length === 0 || !window.confirm(`${dt('Anuloni')} ${list.length} ${dt('porosi? Kodet nuk do të pranohen më.')}`)) return;
    setBusy(true);
    for (const order of list) {
      try {
        await cancelPayment(order.code, 'Anuluar nga admini');
      } catch {
        /* the list reload below shows what remains */
      }
    }
    setBusy(false);
    selection.clear();
    await reload();
    onChanged?.();
    toast.success(dt('Porositë u anuluan.'));
  };

  return (
    <Panel>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat label={status === 'awaiting' ? 'Në pritje' : status === 'paid' ? 'Të paguara' : 'Të anuluara'} value={total?.count ?? '—'} />
        <Stat label="Vlera totale" value={total ? formatEur(total.sumEur) : '—'} tone={status === 'paid' ? 'emerald' : 'amber'} />
        <Stat label="Të zgjedhura" value={selection.count ? `${selection.count} · ${formatEur(selectedSum)}` : '—'} tone="blue" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={dt('Kërko kod ose emër…')} aria-label={dt('Kërko pagesë')} className={cn(inputClass, 'pl-9')} />
        </label>
        <button type="button" onClick={() => void reload()} className={btn.ghost}>{loading ? <Spinner /> : dt('Rifresko')}</button>
      </div>

      <ErrorNote message={error} />

      {orders.length === 0 ? (
        <Empty>{loading ? dt('Po ngarkohet…') : status === 'awaiting' ? dt('Asnjë pagesë nuk pret konfirmim.') : dt('Asnjë pagesë këtu.')}</Empty>
      ) : (
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="w-10 px-3 py-2">
                  <input type="checkbox" checked={selection.allSelected} onChange={selection.toggleAll} aria-label={dt('Zgjidh të gjitha')} className="h-4 w-4" />
                </th>
                <th className="px-3 py-2">{dt('Kodi')}</th>
                <th className="px-3 py-2">{dt('Klienti')}</th>
                <th className="px-3 py-2">{dt('Për çfarë')}</th>
                <th className="px-3 py-2 text-right">{dt('Shuma')}</th>
                <th className="px-3 py-2">{dt('Krijuar')}</th>
                <th className="px-3 py-2 text-right">{dt('Veprime')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/10">
              {orders.map((order) => (
                <tr key={order.code} className={cn(selection.selected.has(order.code) && 'bg-blue-50/60 dark:bg-blue-950/20')}>
                  <td className="px-3 py-2.5">
                    <input type="checkbox" checked={selection.selected.has(order.code)} onChange={() => selection.toggle(order.code)} aria-label={`${dt('Zgjidh')} ${order.code}`} className="h-4 w-4" />
                  </td>
                  <td className="px-3 py-2.5 font-mono font-black tracking-wider text-slate-900 dark:text-white">{order.code}</td>
                  <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">{order.name || '—'}</td>
                  <td className="px-3 py-2.5">
                    <span className="text-slate-700 dark:text-slate-200">{dt(KIND_LABELS[order.kind])}</span>
                    {order.packageId && <span className="ml-1 text-xs text-slate-500">({order.packageId})</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right font-black text-slate-900 dark:text-white">{formatEur(order.amountEur)}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">
                    {formatWhen(status === 'paid' ? order.paidAtMs : order.createdAtMs)}
                    {order.expired && <Badge tone="amber">{dt('skaduar')}</Badge>}
                    {status === 'paid' && order.method && <Badge tone="blue">{order.method === 'paysera' ? 'Paysera' : 'IBAN'}</Badge>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {status === 'awaiting' && (
                      <div className="inline-flex gap-1.5">
                        <button type="button" disabled={busy} onClick={() => void confirmMany([order])} className={cn(btn.success, 'min-h-9 px-3 text-xs')}>{dt('Konfirmo')}</button>
                        <button type="button" disabled={busy} onClick={() => void cancelMany([order])} className={cn(btn.ghost, 'min-h-9 px-3 text-xs')}>{dt('Anulo')}</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {status === 'awaiting' && (
        <BulkBar count={selection.count} onClear={selection.clear}>
          <button type="button" disabled={busy} onClick={() => void confirmMany(selectedOrders)} className={cn(btn.success, 'min-h-9 px-3')}>{busy ? <Spinner /> : dt('Konfirmo pagesat')}</button>
          <button type="button" disabled={busy} onClick={() => void cancelMany(selectedOrders)} className={cn(btn.danger, 'min-h-9 px-3')}>{dt('Anulo')}</button>
        </BulkBar>
      )}
    </Panel>
  );
}

/* ---------------------------------------------------------- statement import */

function StatementImport({ onChanged }: { onChanged?: () => void }) {
  const [text, setText] = useState('');
  const [entries, setEntries] = useState<StatementEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const matched = useMemo(() => (entries ?? []).filter((e) => e.outcome === 'match').map((e) => e.code), [entries]);
  const selection = useSelection(matched);

  const analyze = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await analyzeStatement(text);
      setEntries(result.entries);
      if (result.entries.length === 0) setError(dt('Asnjë kod pagese nuk u gjet në këtë tekst.'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Matched lines start selected: the common case is "confirm everything that matches".
  const pickAll = () => selection.selectAll();

  const apply = async () => {
    const codes = [...selection.selected];
    if (codes.length === 0) return;
    const sum = (entries ?? []).filter((e) => selection.selected.has(e.code)).reduce((s, e) => s + (e.orderAmountEur ?? 0), 0);
    if (!window.confirm(`${dt('Konfirmoni')} ${codes.length} ${dt('pagesa me total')} ${formatEur(sum)}?`)) return;
    setBusy(true);
    try {
      const { results } = await applyStatement(text, codes);
      const done = results.filter((r) => r.result === 'confirmed').length;
      toast.success(`${done} ${dt('pagesa u konfirmuan.')}${done < results.length ? ` ${results.length - done} ${dt('u lanë pa ndryshuar.')}` : ''}`);
      setEntries(null);
      setText('');
      selection.clear();
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2_000_000) {
      setError(dt('Skedari është shumë i madh (maksimumi 2 MB).'));
      return;
    }
    setText(await file.text());
    setEntries(null);
  };

  return (
    <Panel>
      <h3 className="text-base font-black text-slate-900 dark:text-white">{dt('Krahaso pasqyrën bankare me kodet')}</h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        {dt('Kopjoni rreshtat nga e-banking ose ngarkoni CSV-në. Sistemi gjen kodet ZQ… në përshkrim dhe i krahason me porositë dhe shumat.')}
      </p>

      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setEntries(null); }}
        rows={8}
        placeholder={'12.10.2026;Pagese verifikim ZQK7M3P9X;15,99\n…'}
        aria-label={dt('Pasqyra bankare')}
        className={cn(inputClass, 'mt-3 min-h-40 py-2 font-mono')}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <label className={cn(btn.ghost, 'cursor-pointer')}>
          <Upload className="h-4 w-4" aria-hidden="true" />
          {dt('Ngarko CSV / TXT')}
          <input type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
        </label>
        <button type="button" disabled={busy || !text.trim()} onClick={() => void analyze()} className={btn.primary}>{busy ? <Spinner /> : dt('Analizo')}</button>
      </div>
      <div className="mt-3"><ErrorNote message={error} /></div>

      {entries && entries.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-bold text-slate-700 dark:text-slate-200">{entries.length} {dt('kode të gjetura')} · {matched.length} {dt('përputhen')}</span>
            {matched.length > 0 && <button type="button" onClick={pickAll} className="text-xs font-bold text-blue-600 hover:underline dark:text-blue-300">{dt('Zgjidh të gjitha që përputhen')}</button>}
          </div>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-white/10 dark:border-white/10">
            {entries.map((entry) => {
              const meta = OUTCOME[entry.outcome];
              const selectable = entry.outcome === 'match';
              return (
                <li key={entry.code} className="flex items-start gap-3 p-3">
                  <input
                    type="checkbox"
                    disabled={!selectable}
                    checked={selection.selected.has(entry.code)}
                    onChange={() => selection.toggle(entry.code)}
                    aria-label={`${dt('Zgjidh')} ${entry.code}`}
                    className="mt-1 h-4 w-4"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-black tracking-wider">{entry.code}</span>
                      <Badge tone={meta.tone}>{dt(meta.label)}</Badge>
                      {entry.name && <span className="text-sm text-slate-600 dark:text-slate-300">{entry.name}</span>}
                      {entry.orderAmountEur !== undefined && <span className="text-sm font-bold">{formatEur(entry.orderAmountEur)}</span>}
                    </div>
                    <p className="mt-0.5 break-words text-xs text-slate-500">{entry.line}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{dt(meta.help)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <BulkBar count={selection.count} onClear={selection.clear}>
        <button type="button" disabled={busy} onClick={() => void apply()} className={cn(btn.success, 'min-h-9 px-3')}>{busy ? <Spinner /> : dt('Konfirmo të zgjedhurat')}</button>
      </BulkBar>
    </Panel>
  );
}

/* ----------------------------------------------------------------- settings */

const AD_PACKAGES: ReadonlyArray<{ id: string; label: string }> = [
  { id: '1_week', label: '1 Javë' },
  { id: '2_weeks', label: '2 Javë' },
  { id: '1_month', label: '1 Muaj' },
];

function PaymentSettingsForm() {
  const { data, error, loading } = useLoad(getPaymentSettings, []);
  const [form, setForm] = useState<PaymentSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const current = form ?? data?.settings ?? null;

  if (loading && !current) return <Panel><Spinner /></Panel>;
  if (!current) return <Panel><ErrorNote message={error || dt('Cilësimet nuk u ngarkuan.')} /></Panel>;

  const set = (patch: Partial<PaymentSettings>) => setForm({ ...current, ...patch });
  const ibanState = !current.iban ? 'empty' : isValidIban(current.iban) ? 'ok' : 'bad';

  const save = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const { settings } = await savePaymentSettings(current);
      setForm(settings);
      toast.success(dt('Cilësimet u ruajtën.'));
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const num = (value: string): number | null => (value.trim() === '' ? null : Number(value.replace(',', '.')));

  return (
    <Panel className="space-y-5">
      <div>
        <h3 className="text-base font-black text-slate-900 dark:text-white">{dt('Llogaria bankare')}</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{dt('Këto të dhëna shihen nga klienti kur merr kodin e pagesës.')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 sm:col-span-2">
          IBAN
          <input value={current.iban} onChange={(e) => set({ iban: e.target.value })} placeholder="XK05 0000 0000 0000 0000" className={cn(inputClass, 'mt-1 font-mono')} />
          <span className={cn('mt-1 block text-xs', ibanState === 'ok' ? 'text-emerald-600' : ibanState === 'bad' ? 'text-rose-600' : 'text-slate-500')}>
            {ibanState === 'ok' ? `✓ ${formatIban(current.iban)}` : ibanState === 'bad' ? dt('IBAN-i nuk është i vlefshëm (kontrolli dështoi).') : dt('Pa IBAN, pagesa me kod është e çaktivizuar.')}
          </span>
        </label>
        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
          {dt('Përfituesi (emri në llogari)')}
          <input value={current.beneficiary} onChange={(e) => set({ beneficiary: e.target.value })} className={cn(inputClass, 'mt-1')} />
        </label>
        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
          {dt('Banka')}
          <input value={current.bank} onChange={(e) => set({ bank: e.target.value })} placeholder="Raiffeisen Bank Kosovo / NLB / TEB…" className={cn(inputClass, 'mt-1')} />
        </label>
        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
          BIC / SWIFT
          <input value={current.bic} onChange={(e) => set({ bic: e.target.value })} className={cn(inputClass, 'mt-1 font-mono')} />
        </label>
        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
          {dt('Shënim për klientin (opsional)')}
          <input value={current.note} onChange={(e) => set({ note: e.target.value })} className={cn(inputClass, 'mt-1')} />
        </label>
      </div>

      <div>
        <h3 className="text-base font-black text-slate-900 dark:text-white">{dt('Çmimet (€)')}</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{dt('Lëreni bosh për të çaktivizuar blerjen e një shërbimi.')}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
            {dt('Verifikimi / muaj')}
            <input inputMode="decimal" value={current.verificationPriceEur ?? ''} onChange={(e) => set({ verificationPriceEur: num(e.target.value) })} className={cn(inputClass, 'mt-1')} />
          </label>
          {AD_PACKAGES.map((pkg) => (
            <label key={pkg.id} className="block text-xs font-bold text-slate-600 dark:text-slate-300">
              {dt('Reklamë')} · {dt(pkg.label)}
              <input
                inputMode="decimal"
                value={current.adPackagePrices[pkg.id] ?? ''}
                onChange={(e) => {
                  const value = num(e.target.value);
                  const next = { ...current.adPackagePrices };
                  if (value === null) delete next[pkg.id];
                  else next[pkg.id] = value;
                  set({ adPackagePrices: next });
                }}
                className={cn(inputClass, 'mt-1')}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 p-3 text-sm dark:border-white/10">
        <p className="font-bold text-slate-900 dark:text-white">Paysera</p>
        <p className="mt-1 text-slate-600 dark:text-slate-300">
          {data?.paysera.enabled
            ? `${dt('Aktiv')}${data.paysera.test ? ` (${dt('modaliteti i testit')})` : ''}. ${dt('Klientët mund të paguajnë me kartë dhe konfirmimi bëhet automatikisht.')}`
            : dt('Jo aktiv. Për ta aktivizuar, vendosni PAYSERA_PROJECT_ID dhe PAYSERA_SIGN_PASSWORD në mjedisin e serverit (nga projekti juaj në Paysera) dhe rinisni serverin. Adresa e njoftimit (callback): /api/v1/payments/paysera/callback.')}
        </p>
      </div>

      <ErrorNote message={saveError} />
      <div className="flex justify-end">
        <button type="button" disabled={saving || ibanState === 'bad'} onClick={() => void save()} className={btn.primary}>{saving ? <Spinner /> : dt('Ruaj cilësimet')}</button>
      </div>
    </Panel>
  );
}

/* -------------------------------------------------------------------- guide */

function Guide() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel>
        <h3 className="text-base font-black text-slate-900 dark:text-white">{dt('Si paguan klientët (me kod)')}</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700 dark:text-slate-200">
          <li>{dt('Klienti zgjedh shërbimin (tick ose paketë reklame) dhe merr një kod unik, p.sh.')} <code className="rounded bg-slate-100 px-1.5 font-mono font-bold dark:bg-slate-800">ZQK7M3P9X</code>.</li>
          <li>{dt('Klienti dërgon shumën e saktë në IBAN-in tuaj dhe shkruan kodin në “Përshkrimi / Referenca” të pagesës.')}</li>
          <li>{dt('Ose paguan me kartë përmes Paysera, nëse është aktivizuar: konfirmimi bëhet vetë.')}</li>
          <li>{dt('Kodi ka karakter kontrolli: një shkronjë e gabuar nuk përputhet kurrë me porosinë e dikujt tjetër.')}</li>
          <li>{dt('Porosia skadon pas 14 ditësh, por një pagesë e vonuar prapë mund të konfirmohet.')}</li>
        </ol>
      </Panel>

      <Panel>
        <h3 className="text-base font-black text-slate-900 dark:text-white">{dt('Si i konfirmoni (admini)')}</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700 dark:text-slate-200">
          <li>{dt('Hapni e-banking dhe shikoni hyrjet e reja. Kodi ZQ… është në përshkrimin e pagesës.')}</li>
          <li><strong>{dt('Mënyra e shpejtë:')}</strong> {dt('te “Pasqyra bankare” ngjitni rreshtat ose CSV-në. Sistemi përputh kodin dhe shumën dhe ju konfirmoni të gjitha me një klikim.')}</li>
          <li><strong>{dt('Mënyra manuale:')}</strong> {dt('te “Në pritje” gjeni kodin, krahasoni shumën me llogarinë dhe shtypni “Konfirmo”. Mund të zgjidhni disa dhe t’i konfirmoni bashkë.')}</li>
          <li>{dt('Pas konfirmimit shërbimi aktivizohet menjëherë: ticku për 30 ditë, ose kërkesa e reklamës shënohet “e paguar”.')}</li>
          <li>{dt('Çdo konfirmim regjistrohet me emrin tuaj në auditim. Konfirmimi bëhet vetëm një herë për kod.')}</li>
          <li>{dt('Shumë e ndryshme? Sistemi e refuzon; konfirmojeni vetëm nëse e pranoni diferencën.')}</li>
        </ol>
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          {dt('Banka nuk lidhet automatikisht me këtë sistem: konfirmimi bëhet nga ju ose nga pasqyra që ngjitni. Lidhje direkte me një bankë kërkon API dhe kontratë me atë bankë; Paysera është e vetmja me kartë e gatshme këtu.')}
        </p>
      </Panel>
    </div>
  );
}
