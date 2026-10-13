import { useState } from 'react';
import { Check, Copy, CreditCard, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { dt } from '@/src/lib/dt';
import { formatIban } from '../../lib/iban';
import { formatEur, startPaysera, type BankDetails, type PaymentOrder } from '../../lib/debateApi';

function CopyRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error(dt('Nuk u kopjua. Kopjojeni dorazi.'));
    }
  };
  return (
    <div className="flex items-center gap-3 border-b border-slate-100 py-2.5 last:border-0 dark:border-white/10">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
        <p className={`break-all text-sm font-bold text-slate-900 dark:text-white ${mono ? 'font-mono tracking-wide' : ''}`}>{value}</p>
      </div>
      <button type="button" onClick={copy} aria-label={`${dt('Kopjo')} ${label}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10">
        {copied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  );
}

/**
 * What a payer needs to complete a bank transfer: the code, the exact amount, the
 * account, and a three-step tutorial. If Paysera is on, a card button is offered too.
 */
export function PaymentInstructions({
  order, bank, payseraEnabled, onRefresh,
}: {
  order: PaymentOrder;
  bank: BankDetails | null;
  payseraEnabled: boolean;
  onRefresh?: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  const pay = async () => {
    setBusy(true);
    try {
      const { url } = await startPaysera(order.code);
      window.location.assign(url);
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  };

  if (order.status === 'paid') {
    return (
      <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
        <p className="flex items-center gap-2"><Check className="h-4 w-4" aria-hidden="true" />{dt('Pagesa u konfirmua. Faleminderit!')}</p>
        <p className="mt-1 font-mono text-xs">{order.code}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-slate-900 p-4 text-center text-white dark:bg-slate-800">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-300">{dt('Kodi juaj i pagesës')}</p>
        <p className="mt-1 font-mono text-3xl font-black tracking-[0.2em]">{order.code}</p>
        <p className="mt-2 text-lg font-black">{formatEur(order.amountEur)}</p>
      </div>

      {bank ? (
        <div className="rounded-2xl border border-slate-200 px-4 dark:border-white/10">
          <CopyRow label="IBAN" value={formatIban(bank.iban)} mono />
          {bank.beneficiary && <CopyRow label={dt('Përfituesi')} value={bank.beneficiary} />}
          {bank.bank && <CopyRow label={dt('Banka')} value={bank.bank} />}
          {bank.bic && <CopyRow label="BIC / SWIFT" value={bank.bic} mono />}
          <CopyRow label={dt('Përshkrimi / Referenca (shkruaj kodin)')} value={order.code} mono />
          <CopyRow label={dt('Shuma e saktë')} value={order.amountEur.toFixed(2)} />
        </div>
      ) : (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{dt('Pagesa me IBAN nuk është aktivizuar. Paguani me kartë.')}</p>
      )}

      <ol className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
        {[
          'Hapni aplikacionin e bankës suaj dhe bëni një transfer të ri në IBAN-in e mësipërm.',
          'Vendosni shumën e saktë dhe shkruani kodin në fushën “Përshkrimi” ose “Referenca”.',
          'Pas pagesës, ekipi e konfirmon duke e gjetur kodin në llogari. Shërbimi aktivizohet menjëherë pas konfirmimit.',
        ].map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">{i + 1}</span>
            <span>{dt(step)}</span>
          </li>
        ))}
      </ol>

      {payseraEnabled && (
        <button type="button" disabled={busy} onClick={pay} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CreditCard className="h-4 w-4" aria-hidden="true" />}
          {dt('Paguaj me kartë (Paysera)')}
        </button>
      )}

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{dt('Statusi')}: <strong className="text-amber-600">{order.expired ? dt('Skaduar (ende pranohet)') : dt('Në pritje të pagesës')}</strong></span>
        {onRefresh && <button type="button" onClick={() => void onRefresh()} className="font-bold text-blue-600 hover:underline dark:text-blue-300">{dt('Rifresko')}</button>}
      </div>
    </div>
  );
}
