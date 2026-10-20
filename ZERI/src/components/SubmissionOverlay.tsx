import { useEffect, useState, type ComponentType } from 'react';
import { createPortal } from 'react-dom';
import { HeartPulse, KeyRound, Lightbulb, Mail, Newspaper, ShieldCheck, Wallet } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { BrandMark } from './BrandLogo';

/**
 * Full-screen wait for a form that does not have its own waiting page. Each kind of
 * submission has its own look so the visitor can tell what is happening:
 *   travel  the logo becomes a message and moves to the destination (news, contact, health)
 *   ring    a progress ring around the logo (login, register)
 *   glow    the logo glows and fills up (idea, donation, verification)
 * `busy` drives it: the bar eases toward 92% and completes when the request ends.
 */
export type OverlayKind = 'news' | 'contact' | 'health' | 'idea' | 'donation' | 'verify' | 'login' | 'register';

interface Spec {
  motion: 'travel' | 'ring' | 'glow';
  Icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  title: string;
  from: string;
  to: string;
  tone: string; // gradient classes
  stroke: string;
}

const SPECS: Record<OverlayKind, Spec> = {
  news: { motion: 'travel', Icon: Newspaper, title: 'Po dërgohet lajmi', from: 'Po përgatitet lajmi', to: 'Redaksia', tone: 'from-emerald-500 to-teal-600', stroke: '#10b981' },
  contact: { motion: 'travel', Icon: Mail, title: 'Po dërgohet mesazhi', from: 'Po përgatitet mesazhi', to: 'Ekipi i Zërit Qytetar', tone: 'from-sky-500 to-blue-600', stroke: '#0ea5e9' },
  health: { motion: 'travel', Icon: HeartPulse, title: 'Po regjistrohet rasti', from: 'Po përgatitet rasti', to: 'Regjistri shëndetësor', tone: 'from-rose-500 to-red-600', stroke: '#f43f5e' },
  idea: { motion: 'glow', Icon: Lightbulb, title: 'Po dërgohet ideja', from: 'Ideja po merr formë', to: 'Banka e ideve', tone: 'from-amber-400 to-orange-500', stroke: '#f59e0b' },
  donation: { motion: 'glow', Icon: Wallet, title: 'Po dërgohet aplikimi', from: 'Aplikimi po përgatitet', to: 'Qendra e ndihmës', tone: 'from-indigo-500 to-violet-600', stroke: '#6366f1' },
  verify: { motion: 'glow', Icon: ShieldCheck, title: 'Po dërgohet kërkesa', from: 'Kërkesa po përgatitet', to: 'Ekipi i verifikimit', tone: 'from-cyan-500 to-blue-600', stroke: '#06b6d4' },
  login: { motion: 'ring', Icon: KeyRound, title: 'Po hyni në llogari', from: 'Po verifikohet identiteti', to: 'Llogaria juaj', tone: 'from-blue-500 to-indigo-600', stroke: '#3b82f6' },
  register: { motion: 'ring', Icon: ShieldCheck, title: 'Po krijohet llogaria', from: 'Po ruhen të dhënat', to: 'Llogaria juaj', tone: 'from-violet-500 to-fuchsia-600', stroke: '#8b5cf6' },
};

function useProgress(busy: boolean) {
  const [shown, setShown] = useState(false);
  const [pct, setPct] = useState(4);
  useEffect(() => {
    if (busy) { setShown(true); setPct(4); return; }
    if (!shown) return;
    setPct(100);
    const hide = window.setTimeout(() => setShown(false), 500);
    return () => window.clearTimeout(hide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);
  useEffect(() => {
    if (!busy) return;
    const timer = window.setInterval(() => setPct(p => (p >= 92 ? p : p + Math.max(0.4, (92 - p) * 0.05))), 140);
    return () => window.clearInterval(timer);
  }, [busy]);
  return { shown, value: Math.round(pct) };
}

export default function SubmissionOverlay({ busy, kind }: { busy: boolean; kind: OverlayKind }) {
  const spec = SPECS[kind];
  const { shown, value } = useProgress(busy);
  if (!shown || typeof document === 'undefined') return null;
  const { Icon } = spec;
  const done = value >= 100;
  const label = done ? 'Përfundoi procesimi' : value < 40 ? spec.from : `Drejt: ${spec.to}`;

  const visual = spec.motion === 'travel' ? (
    <div className="relative h-24 w-full">
      <div className="absolute left-7 right-7 top-1/2 h-0.5 -translate-y-1/2 bg-white/20" />
      <div className="absolute left-0 top-1/2 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-2xl bg-white shadow-lg"><BrandMark className="h-9 w-9" /></div>
      <div className={`absolute right-0 top-1/2 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-2xl bg-gradient-to-br ${spec.tone} text-white shadow-lg`}><Icon className="h-7 w-7" aria-hidden /></div>
      <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-300" style={{ left: `calc(1.75rem + (100% - 3.5rem) * ${value / 100})` }}>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${spec.tone} text-white shadow-xl motion-safe:animate-bounce`}>
          {value < 25 ? <BrandMark className="h-8 w-8" /> : <Icon className="h-5 w-5" aria-hidden />}
        </div>
      </div>
    </div>
  ) : spec.motion === 'ring' ? (
    <div className="relative mx-auto h-36 w-36">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="6" />
        <circle cx="50" cy="50" r="44" fill="none" stroke={spec.stroke} strokeWidth="6" strokeLinecap="round" strokeDasharray={2 * Math.PI * 44} strokeDashoffset={2 * Math.PI * 44 * (1 - value / 100)} className="transition-[stroke-dashoffset] duration-300" />
      </svg>
      <div className="absolute inset-0 m-auto h-24 w-24 rounded-full motion-safe:animate-spin" style={{ animationDuration: '6s', border: `2px dashed ${spec.stroke}55` }} />
      <div className="absolute inset-0 flex items-center justify-center"><BrandMark className="h-16 w-16" /></div>
      <div className={`absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${spec.tone} text-white shadow-lg`}><Icon className="h-5 w-5" aria-hidden /></div>
    </div>
  ) : (
    <div className="relative mx-auto flex h-32 w-32 items-center justify-center">
      <span className={`absolute inset-0 rounded-full bg-gradient-to-br ${spec.tone} opacity-25 motion-safe:animate-ping`} />
      <span className={`absolute inset-3 rounded-full bg-gradient-to-br ${spec.tone} opacity-40 motion-safe:animate-pulse`} />
      <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-xl"><BrandMark className="h-12 w-12" /></div>
      <div className={`absolute -right-1 -top-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${spec.tone} text-white shadow-lg motion-safe:animate-bounce`}><Icon className="h-5 w-5" aria-hidden /></div>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[100001] flex items-center justify-center bg-slate-950/80 p-6 backdrop-blur-sm" role="status" aria-live="polite">
      <div className="w-full max-w-sm text-center text-white">
        <h2 className="mb-6 text-lg font-black tracking-tight">{dt(spec.title)}</h2>
        {visual}
        <div className="mt-6 h-2.5 w-full overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
          <div className={`h-full rounded-full bg-gradient-to-r ${spec.tone} transition-[width] duration-300`} style={{ width: `${value}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs font-bold text-white/80">
          <span>{dt(done ? label : value < 40 ? spec.from : spec.to)}</span>
          <span className="tabular-nums">{value}%</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
