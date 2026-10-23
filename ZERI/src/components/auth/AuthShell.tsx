import React from 'react';
import { ArrowLeft, Megaphone, MapPinned, ShieldCheck } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { BrandLockup, BrandMark } from '@/src/components/BrandLogo';
import { cn } from '@/src/lib/utils';

const POINTS = [
  { icon: Megaphone, title: 'Raporto', text: 'Dërgo çdo problem te institucioni përgjegjës.' },
  { icon: MapPinned, title: 'Ndiq', text: 'Shiko statusin e raportit deri në zgjidhje.' },
  { icon: ShieldCheck, title: 'Vendos', text: 'Voto në sondazhe dhe merr pjesë në debat.' },
];

interface AuthShellProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Shared split layout for login and register: brand panel on the left, form card on the right. */
export function AuthShell({ title, subtitle, onBack, backLabel, children, footer }: AuthShellProps) {
  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] bg-[#050b18] text-white font-sans">
      {/* Brand panel */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden p-14 xl:p-20 border-r border-white/5">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(34,211,238,0.14),transparent_55%),radial-gradient(ellipse_at_80%_90%,rgba(37,99,235,0.22),transparent_55%)]" />
        {/* Skyline only (the cover's own wordmark is cropped out so the logo never appears twice). */}
        <img src="/cover-city.jpg" alt="" aria-hidden="true" className="absolute inset-x-0 bottom-0 h-44 w-full object-cover opacity-80" style={{ objectPosition: '60% 30%', filter: 'brightness(1.25) saturate(1.2)', WebkitMaskImage: 'linear-gradient(to top, black 30%, transparent)', maskImage: 'linear-gradient(to top, black 30%, transparent)' }} />
        <div aria-hidden="true" className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.6)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="relative"><BrandLockup size="lg" /></div>
        <div className="relative max-w-md drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
          <div className="mb-6 h-px w-16 bg-gradient-to-r from-cyan-400 to-transparent" />
          <h2 className="text-3xl xl:text-4xl font-bold leading-tight tracking-tight">
            {dt('Së bashku për një Kosovë më të mirë')}<span className="text-cyan-400">.</span>
          </h2>
          <ul className="mt-10 space-y-5">
            {POINTS.map(({ icon: Icon, title: t, text }) => (
              <li key={t} className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-300">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-bold text-white">{dt(t)}</span>
                  <span className="block text-sm leading-relaxed text-slate-400">{dt(text)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-500">© {new Date().getFullYear()} {dt('Zëri Qytetarëve · Republika e Kosovës')}</p>
      </aside>

      {/* Form panel */}
      <main className="relative flex min-h-screen items-center justify-center px-4 py-20 sm:px-8 lg:min-h-0 lg:py-12">
        <div aria-hidden="true" className="absolute inset-0 lg:hidden bg-[radial-gradient(ellipse_at_50%_0%,rgba(34,211,238,0.14),transparent_60%)]" />
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="absolute left-4 top-4 z-20 inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-xs font-bold text-slate-200 transition-colors hover:bg-white/10 sm:left-8 sm:top-8"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {backLabel}
          </button>
        )}
        <div className="relative z-10 w-full max-w-[26rem]">
          <div className="mb-8 flex flex-col items-center lg:hidden">
            <BrandMark className="h-20 w-20 drop-shadow-[0_0_28px_rgba(34,211,238,0.45)]" />
            <div className="mt-3 text-3xl font-black leading-none tracking-[0.14em]">ZËRI</div>
            <div className="mt-1.5 text-xs font-semibold uppercase tracking-[0.45em] text-cyan-300">Qytetarëve</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.8)] backdrop-blur-xl sm:p-8">
            <h1 className="text-2xl font-black tracking-tight sm:text-[1.65rem]">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>
          {footer && <div className="mt-6 text-center text-sm text-slate-400">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

interface AuthFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  error?: string;
  hint?: React.ReactNode;
  action?: React.ReactNode;
}

/** Labelled input with leading icon and inline error; labels stay visible so the form reads at a glance. */
export function AuthField({ label, icon: Icon, error, hint, action, id, ...input }: AuthFieldProps) {
  const fieldId = id ?? `f-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={fieldId} className="text-xs font-bold text-slate-300">{label}</label>
        {action}
      </div>
      <div className="group relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-cyan-300" />
        <input
          id={fieldId}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${fieldId}-err` : undefined}
          {...input}
          className={cn(
            'h-12 w-full rounded-xl border bg-slate-950/60 pl-11 pr-4 text-sm font-medium text-white! outline-none transition-colors placeholder:text-slate-500 [color-scheme:dark]',
            'focus:border-cyan-400/70 focus:ring-4 focus:ring-cyan-400/10',
            error ? 'border-rose-400/60' : 'border-white/10 hover:border-white/20'
          )}
        />
      </div>
      {error && <p id={`${fieldId}-err`} role="alert" className="mt-1.5 text-xs font-semibold text-rose-300">{error}</p>}
      {!error && hint}
    </div>
  );
}

export function AuthError({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="mb-5 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-xs font-semibold leading-relaxed text-rose-200">
      {children}
    </div>
  );
}

export const authPrimaryBtn =
  'flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-sm font-bold text-white shadow-[0_8px_24px_-8px_rgba(14,165,233,0.6)] transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50';
export const authGoogleBtn =
  'flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-white text-sm font-bold text-slate-900 transition-colors hover:bg-slate-100 disabled:opacity-50';
export const authGhostBtn =
  'flex h-12 w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm font-bold text-slate-100 transition-colors hover:bg-white/10';

export function AuthDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-slate-400">
      <span className="h-px flex-1 bg-white/10" />{children}<span className="h-px flex-1 bg-white/10" />
    </div>
  );
}

export const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.56-5.17 3.56-8.82Z" />
    <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.08.72-2.46 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.1A12 12 0 0 0 12 24Z" />
    <path fill="#FBBC05" d="M5.28 14.29A7.2 7.2 0 0 1 4.9 12c0-.8.14-1.57.38-2.29v-3.1H1.27a12 12 0 0 0 0 10.78l4.01-3.1Z" />
    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.27 6.61l4.01 3.1C6.22 6.86 8.87 4.75 12 4.75Z" />
  </svg>
);
