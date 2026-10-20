import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BadgeCheck, Check, Loader2, ShieldCheck, TrendingUp, X, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { dt } from '@/src/lib/dt';
import { useStore } from '../../lib/store';
import {
  decideVerification,
  getMyVerification,
  listVerificationRequests,
  type VerificationRequestItem,
  type VerificationState,
} from '../../lib/forumApi';
import {
  createPaymentOrder,
  formatEur,
  getMyOrders,
  getPaymentConfig,
  type BankDetails,
  type PaymentConfig,
  type PaymentOrder,
} from '../../lib/debateApi';
import { PaymentInstructions } from './PaymentInstructions';

const BENEFITS = [
  { icon: BadgeCheck, text: 'Tick blu pranë emrit në çdo postim, koment dhe profil.' },
  { icon: TrendingUp, text: 'Postimet tuaja dalin pak më lart në rrjedhën "Për ty".' },
  { icon: BarChart3, text: 'Analitikë e plotë për çdo postim: shfaqje, angazhim dhe renditje.' },
  { icon: ShieldCheck, text: 'Besim më i lartë: lexuesit e dallojnë llogarinë tuaj të vërtetë.' },
] as const;

/**
 * The verification plan: what it is, what it costs, and how to pay.
 *
 * Paying works with a code: the account gets a unique code, sends the amount to the
 * platform IBAN with the code as reference (or pays by card through Paysera, when
 * enabled), and the Debate admin confirms it against the bank account. The tick
 * switches on by itself when the payment is confirmed.
 *
 * Staff with the users section also still see the older request queue here.
 */
export function VerificationModal({ onClose }: { onClose: () => void }) {
  const currentUser = useStore((s) => s.currentUser);
  const signedIn = Boolean(currentUser && currentUser.role !== 'guest');
  const [state, setState] = useState<VerificationState | null>(null);
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [bank, setBank] = useState<BankDetails | null>(null);
  const [busy, setBusy] = useState(false);
  const [queue, setQueue] = useState<VerificationRequestItem[] | null>(null);

  const refresh = useCallback(async () => {
    if (!signedIn) return;
    const [verification, cfg, mine] = await Promise.allSettled([getMyVerification(), getPaymentConfig(), getMyOrders()]);
    if (verification.status === 'fulfilled') setState(verification.value);
    if (cfg.status === 'fulfilled') setConfig(cfg.value);
    if (mine.status === 'fulfilled') {
      setBank(mine.value.bank);
      setOrder(mine.value.orders.find((o) => o.kind === 'verification' && o.status === 'awaiting') ?? null);
    }
    try {
      setQueue((await listVerificationRequests()).items);
    } catch {
      setQueue(null); // Not staff with the users section: the legacy queue stays hidden.
    }
  }, [signedIn]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const price = config?.verificationPriceEur ?? null;
  const paymentsOn = Boolean(config && (config.methods.iban || config.methods.paysera));

  const getCode = async () => {
    setBusy(true);
    try {
      const result = await createPaymentOrder({ kind: 'verification' });
      setOrder(result.order);
      setBank(result.bank);
      setConfig((c) => (c ? { ...c, methods: { ...c.methods, paysera: result.payseraEnabled } } : c));
    } catch (error) {
      toast.error(error?.message || dt('Kodi nuk u krijua.'));
    } finally {
      setBusy(false);
    }
  };

  const decide = async (uid: string, decision: 'approve' | 'reject') => {
    setBusy(true);
    try {
      await decideVerification(uid, decision);
      toast.success(decision === 'approve' ? dt('Verifikimi u aktivizua për 30 ditë.') : dt('Kërkesa u refuzua.'));
      await refresh();
    } catch (error) {
      toast.error(error?.message || dt('Vendimi nuk u ruajt.'));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[12000] flex items-end justify-center bg-black/60 md:backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={dt('Verifikimi')} className="max-h-[94dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl dark:bg-zinc-900">
        <div className="relative bg-gradient-to-br from-blue-600 to-indigo-700 p-6 pt-8 text-white">
          <button type="button" onClick={onClose} aria-label={dt('Mbyll')} className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 hover:bg-white/25">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          <BadgeCheck className="h-10 w-10 fill-white text-blue-600" aria-hidden="true" />
          <h2 className="mt-3 text-2xl font-black">{dt('Verifikimi i llogarisë')}</h2>
          <p className="mt-1 text-sm text-blue-100">{dt('Tick blu dhe më shumë shikueshmëri në Debatin Publik.')}</p>
          <p className="mt-4 text-3xl font-black">
            {price !== null ? formatEur(price) : '—'}
            <span className="text-sm font-bold text-blue-100"> / {dt('muaj')}</span>
          </p>
        </div>

        <div className="space-y-5 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <ul className="space-y-3">
            {BENEFITS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-200">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
                {dt(text)}
              </li>
            ))}
          </ul>

          {!signedIn ? (
            <p className="rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              {dt('Hyni në llogari për të blerë verifikimin.')}
            </p>
          ) : state?.verified ? (
            <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
              <p className="flex items-center gap-2 font-black"><Check className="h-4 w-4" aria-hidden="true" />{dt('Llogaria juaj është e verifikuar.')}</p>
              {state.verifiedUntil && <p className="mt-1 text-xs">{dt('Aktive deri më')} {new Date(state.verifiedUntil).toLocaleDateString('sq-AL')}</p>}
            </div>
          ) : order ? (
            <PaymentInstructions order={order} bank={bank} payseraEnabled={Boolean(config?.methods.paysera)} onRefresh={refresh} />
          ) : !paymentsOn ? (
            <p className="rounded-2xl bg-slate-100 p-3 text-sm text-slate-700 dark:bg-zinc-800 dark:text-slate-200">{dt('Pagesat nuk janë aktivizuar ende. Provoni më vonë.')}</p>
          ) : price === null ? (
            <p className="rounded-2xl bg-slate-100 p-3 text-sm text-slate-700 dark:bg-zinc-800 dark:text-slate-200">{dt('Çmimi i verifikimit nuk është caktuar ende.')}</p>
          ) : (
            <div className="space-y-2">
              <button type="button" onClick={getCode} disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700 disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <BadgeCheck className="h-4 w-4" aria-hidden="true" />}
                {dt('Merr kodin e pagesës')} · {formatEur(price)}
              </button>
              <p className="text-center text-[11px] text-slate-500 dark:text-slate-400">{dt('Do të merrni një kod unik. Pagesa konfirmohet nga ekipi dhe verifikimi vlen 30 ditë.')}</p>
            </div>
          )}

          {queue && queue.length > 0 && (
            <section aria-label={dt('Kërkesat në pritje')} className="border-t border-slate-200 pt-4 dark:border-zinc-700">
              <h3 className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">{dt('Kërkesat e vjetra në pritje')} ({queue.length})</h3>
              <ul className="space-y-2">
                {queue.map((item) => (
                  <li key={item.uid} className="rounded-2xl border border-slate-200 p-3 dark:border-zinc-700">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{item.name || item.email}</p>
                    <p className="text-xs text-slate-500">{item.email}</p>
                    <div className="mt-2 flex gap-2">
                      <button type="button" disabled={busy} onClick={() => decide(item.uid, 'approve')} className="min-h-10 flex-1 rounded-full bg-emerald-600 px-3 text-xs font-black text-white disabled:opacity-60">{dt('Aprovo')}</button>
                      <button type="button" disabled={busy} onClick={() => decide(item.uid, 'reject')} className="min-h-10 rounded-full border border-slate-300 px-3 text-xs font-bold text-slate-700 disabled:opacity-60 dark:border-zinc-600 dark:text-slate-200">{dt('Refuzo')}</button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
