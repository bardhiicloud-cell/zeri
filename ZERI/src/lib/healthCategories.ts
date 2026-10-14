import {
  Activity, ClipboardList, Droplets, Heart, HeartPulse, Pill, ShieldAlert, Sparkles, Stethoscope,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { HealthCase } from '../types';

/**
 * One source of truth for how a health case is classified and how it looks.
 *
 * The register page, the case form and the filters all read from here, so a
 * category added in one place cannot silently render as a grey "SHËN" box in
 * another (which is what happened before: only three categories had a colour).
 */

export type HealthCategory = HealthCase['category'];
export type HealthUrgency = HealthCase['urgency'];
export type HealthStatus = HealthCase['status'];

type Icon = ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;

export interface CategoryMeta {
  id: HealthCategory;
  /** Short label for chips and group headers. */
  name: string;
  abbr: string;
  icon: Icon;
  /** Tile (avatar) classes. Full literal strings so Tailwind can see them. */
  tile: string;
  /** Accent text/bar colours for group headers. */
  accent: string;
  bar: string;
  hint: string;
}

export const CATEGORY_META: CategoryMeta[] = [
  { id: 'Kancer / Onkologji', name: 'Kancer & Onkologji', abbr: 'ONK', icon: ShieldAlert,
    tile: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300', accent: 'text-purple-700 dark:text-purple-300', bar: 'bg-purple-500',
    hint: 'Kemoterapi, radioterapi, kontrolla onkologjike' },
  { id: 'Sëmundje të Zemrës', name: 'Zemër (Kardiake)', abbr: 'KRD', icon: Heart,
    tile: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300', accent: 'text-rose-700 dark:text-rose-300', bar: 'bg-rose-500',
    hint: 'Insuficiencë, aritmi, operacione kardiake' },
  { id: 'Sëmundje të Mushkërive', name: 'Mushkëri (Pulmonare)', abbr: 'PUL', icon: Activity,
    tile: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300', accent: 'text-sky-700 dark:text-sky-300', bar: 'bg-sky-500',
    hint: 'SPOK, astma e rëndë, oksigjen në shtëpi' },
  { id: 'Sëmundje të Veshkave & Dializë', name: 'Veshkë & Dializë', abbr: 'VSH', icon: Droplets,
    tile: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300', accent: 'text-cyan-700 dark:text-cyan-300', bar: 'bg-cyan-500',
    hint: 'Hemodializë, transplant, insuficiencë renale' },
  { id: 'Diabet me Komplikime', name: 'Diabet me Komplikime', abbr: 'DIA', icon: Pill,
    tile: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300', accent: 'text-amber-700 dark:text-amber-300', bar: 'bg-amber-500',
    hint: 'Insulinë, këmba diabetike, retinopati' },
  { id: 'Sëmundje Neurologjike', name: 'Neurologjike', abbr: 'NEU', icon: Stethoscope,
    tile: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300', accent: 'text-indigo-700 dark:text-indigo-300', bar: 'bg-indigo-500',
    hint: 'Epilepsi, Parkinson, SM, pasoja të goditjes' },
  { id: 'Sëmundje e Rrallë', name: 'Sëmundje të Rralla', abbr: 'RAR', icon: Sparkles,
    tile: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/60 dark:text-fuchsia-300', accent: 'text-fuchsia-700 dark:text-fuchsia-300', bar: 'bg-fuchsia-500',
    hint: 'Diagnoza të rralla që kërkojnë trajtim special' },
  { id: 'Tjetër', name: 'Kategori tjetër', abbr: 'TJR', icon: ClipboardList,
    tile: 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-300', accent: 'text-slate-700 dark:text-slate-300', bar: 'bg-slate-400',
    hint: 'Gjendje që nuk hyn në kategoritë e mësipërme' },
];

const FALLBACK_CATEGORY = CATEGORY_META[CATEGORY_META.length - 1];

export const categoryMeta = (id: string): CategoryMeta =>
  CATEGORY_META.find((item) => item.id === id) ?? FALLBACK_CATEGORY;

export interface UrgencyMeta {
  id: HealthUrgency;
  label: string;
  description: string;
  /** Lower rank = shown first. */
  rank: number;
  pill: string;
  card: string;
  dot: string;
}

export const URGENCY_META: UrgencyMeta[] = [
  { id: 'Urgjente', label: 'Urgjente', rank: 0,
    description: 'Ka nevojë për ndërhyrje ose barna menjëherë.',
    pill: 'border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-900 dark:bg-rose-950/80 dark:text-rose-300',
    card: 'border-rose-500 bg-rose-50 dark:bg-rose-950/30', dot: 'bg-rose-500' },
  { id: 'Mesatare', label: 'Mesatare', rank: 1,
    description: 'Terapi kronike e rregullt; mungesa mund të bëhet urgjente.',
    pill: 'border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-900 dark:bg-amber-950/80 dark:text-amber-300',
    card: 'border-amber-500 bg-amber-50 dark:bg-amber-950/30', dot: 'bg-amber-500' },
  { id: 'Kronike e Stabilizuar', label: 'Kronike e stabilizuar', rank: 2,
    description: 'Gjendja është e qëndrueshme; kërkohet përcjellje.',
    pill: 'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-300',
    card: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30', dot: 'bg-emerald-500' },
];

export const urgencyMeta = (id: string): UrgencyMeta =>
  URGENCY_META.find((item) => item.id === id) ?? URGENCY_META[1];

export interface StatusMeta { label: string; pill: string }

export const statusMeta = (status: HealthStatus, hospitalNotified?: boolean): StatusMeta => {
  if (status === 'rejected') return { label: 'Kërkon rishikim', pill: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300' };
  if (status === 'resolved') return { label: 'Përfunduar', pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' };
  if (hospitalNotified) return { label: 'Spitali i njoftuar', pill: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' };
  if (status === 'verified') return { label: 'Verifikuar', pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' };
  return { label: 'Në pritje të verifikimit', pill: 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-slate-300' };
};

/** Quick-pick needs per category, so a citizen taps instead of typing medical terms. */
export const NEED_SUGGESTIONS: Record<HealthCategory, string[]> = {
  'Kancer / Onkologji': ['Barna citostatike', 'Radioterapi', 'Ndihmë financiare', 'Transport për trajtim'],
  'Sëmundje të Zemrës': ['Barna kardiake', 'Operacion', 'Pacemaker / stent', 'Ndihmë financiare'],
  'Sëmundje të Mushkërive': ['Koncentrator oksigjeni', 'Inhalatorë', 'Barna', 'Rehabilitim'],
  'Sëmundje të Veshkave & Dializë': ['Dializë', 'Transport për dializë', 'Barna', 'Transplant'],
  'Diabet me Komplikime': ['Insulinë', 'Shirita testues', 'Kujdes për plagë', 'Ndihmë financiare'],
  'Sëmundje Neurologjike': ['Barna antiepileptike', 'Fizioterapi', 'Pajisje ndihmëse', 'Kujdestar'],
  'Sëmundje e Rrallë': ['Barna speciale', 'Trajtim jashtë vendit', 'Ndihmë financiare', 'Konsultë specialisti'],
  'Tjetër': ['Barna', 'Ndihmë financiare', 'Transport', 'Konsultë specialisti'],
};

export { HeartPulse as HEALTH_ALL_ICON };
