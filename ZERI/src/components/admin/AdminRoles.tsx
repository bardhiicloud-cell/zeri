/**
 * Katalogu i Roleve — the admin's reference for what every role can do.
 *
 * ─── What this screen is for ────────────────────────────────
 *
 * An administrator about to create a staff account has to choose between nine
 * roles, and the difference between `responder` and `dispatcher` is one
 * capability. A dropdown of role names cannot carry that; a person picks the
 * familiar-sounding one and either over-grants or under-grants.
 *
 * So this screen answers, for every role, in one place: what it is for, every
 * section it opens, what it is explicitly barred from, and what an administrator
 * should weigh before assigning it. The section lists are read from the same
 * table the access guard uses, so what is shown here is what is enforced.
 *
 * It is a *reference*, not a control surface: nothing here grants anything. The
 * actual assignment happens in `AdminAgents`, behind the server's role endpoint.
 */
import { useMemo, useState } from 'react';
import { dt } from '../../lib/dt';
import {
  ROLE_CATALOG,
  SECTION_LABELS,
  SECTION_ORDER,
  CLEARANCE_LABELS,
  type ClearanceLevel,
  type RoleProfile,
} from '../../lib/roleCatalog';
import type { AdminSection } from '../../lib/adminPermissions';
import { useStore } from '../../lib/store';
import { cn } from '../../lib/utils';
import {
  Shield, ShieldCheck, ShieldAlert, Users, Building2, Megaphone, Newspaper,
  Crown, Radio, Headphones, Lock, Check, X, Info, ChevronDown, ChevronRight,
  Ban, UserCog,
} from 'lucide-react';

/** Icon and tone per clearance band — the visual grammar of the whole screen. */
const CLEARANCE_STYLE: Record<ClearanceLevel, {
  icon: React.ComponentType<{ className?: string }>;
  ring: string;
  chip: string;
  accent: string;
}> = {
  owner: {
    icon: Crown,
    ring: 'border-amber-300/70 dark:border-amber-500/30',
    chip: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    accent: 'text-amber-600 dark:text-amber-400',
  },
  editorial: {
    icon: Newspaper,
    ring: 'border-indigo-300/70 dark:border-indigo-500/30',
    chip: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300',
    accent: 'text-indigo-600 dark:text-indigo-400',
  },
  field: {
    icon: Radio,
    ring: 'border-blue-300/70 dark:border-blue-500/30',
    chip: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
    accent: 'text-blue-600 dark:text-blue-400',
  },
  commercial: {
    icon: Megaphone,
    ring: 'border-rose-300/70 dark:border-rose-500/30',
    chip: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
    accent: 'text-rose-600 dark:text-rose-400',
  },
  customer: {
    icon: Building2,
    ring: 'border-emerald-300/70 dark:border-emerald-500/30',
    chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
    accent: 'text-emerald-600 dark:text-emerald-400',
  },
};

/** The role icon, chosen per role so a reader can tell them apart at a glance. */
const ROLE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  superadmin: Crown,
  admin: ShieldCheck,
  approver: ShieldAlert,
  newsadmin: Newspaper,
  agent: Radio,
  responder: Headphones,
  dispatcher: UserCog,
  adsadmin: Megaphone,
  debatwp: Megaphone,
  municipality: Building2,
};

function Stat({ label, value, tone = 'slate' }: { label: string; value: string | number; tone?: string }) {
  const tones: Record<string, string> = {
    slate: 'text-slate-900 dark:text-white',
    amber: 'text-amber-600',
    emerald: 'text-emerald-600',
    rose: 'text-rose-600',
    indigo: 'text-indigo-600',
    blue: 'text-blue-600',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
      <div className={`text-2xl font-black tabular-nums ${tones[tone] ?? tones.slate}`}>{value}</div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{dt(label)}</div>
    </div>
  );
}

/** One role, expanded or collapsed. Collapsed by default: nine expanded cards is a wall. */
function RoleCard({ profile, expanded, onToggle }: {
  profile: RoleProfile;
  expanded: boolean;
  onToggle: () => void;
}) {
  const style = CLEARANCE_STYLE[profile.clearance];
  const Icon = ROLE_ICON[profile.role] ?? Shield;
  const BandIcon = style.icon;

  return (
    <article
      className={cn(
        'overflow-hidden rounded-2xl border bg-white transition-colors dark:bg-slate-900',
        style.ring
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 dark:bg-slate-800', style.accent)}>
          <Icon className="h-5 w-5" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-black text-slate-900 dark:text-white">{dt(profile.label)}</span>
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black', style.chip)}>
              <BandIcon className="h-3 w-3" />
              {dt(CLEARANCE_LABELS[profile.clearance])}
            </span>
            {profile.fullAccess && (
              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-black text-white dark:bg-slate-700">
                {dt('Akses i plotë')}
              </span>
            )}
            {!profile.isStaff && (
              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-black text-white">
                {dt('Klient — jo staf')}
              </span>
            )}
          </span>
          <span className="mt-1 block font-mono text-[11px] text-slate-400">{profile.role}</span>
          <span className="mt-1.5 block text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {dt(profile.purpose)}
          </span>
        </span>

        <span className="shrink-0 text-slate-400">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-slate-100 p-4 dark:border-white/5">
          {/* The sections this role opens, in sidebar order. */}
          <section>
            <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500">
              <Check className="h-3.5 w-3.5 text-emerald-600" />
              {dt('Seksionet që hap')} ({profile.sections.length})
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {SECTION_ORDER.filter((s) => profile.sections.includes(s)).map((section) => (
                <span
                  key={section}
                  className="rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"
                >
                  {dt(SECTION_LABELS[section])}
                </span>
              ))}
            </div>
          </section>

          {/* What it is barred from. The more useful half of an access description. */}
          <section>
            <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500">
              <Ban className="h-3.5 w-3.5 text-rose-600" />
              {dt('Nuk mund të')}
            </h4>
            <ul className="space-y-1.5">
              {profile.cannot.map((item) => (
                <li key={item} className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                  <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
                  <span>{dt(item)}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* The judgement call an administrator makes when assigning it. */}
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-950">
            <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500">
              <Info className="h-3.5 w-3.5" />
              {dt('Kur ta caktoni këtë rol')}
            </h4>
            <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
              {dt(profile.notes)}
            </p>
          </section>
        </div>
      )}
    </article>
  );
}

export default function AdminRoles() {
  const currentUser = useStore((s) => s.currentUser);
  const [filter, setFilter] = useState<'all' | ClearanceLevel>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  /** Highlight one section across every role — "who can touch the health registry?". */
  const [sectionFocus, setSectionFocus] = useState<AdminSection | 'all'>('all');

  const visible = useMemo(() => {
    let list = ROLE_CATALOG;
    if (filter !== 'all') list = list.filter((r) => r.clearance === filter);
    if (sectionFocus !== 'all') list = list.filter((r) => r.sections.includes(sectionFocus));
    return list;
  }, [filter, sectionFocus]);

  const staffCount = ROLE_CATALOG.filter((r) => r.isStaff).length;
  const fullCount = ROLE_CATALOG.filter((r) => r.fullAccess).length;
  const totalSections = SECTION_ORDER.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-900 text-white dark:bg-slate-700">
            <Shield className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-serif text-2xl font-black text-slate-950 dark:text-white">
              {dt('Katalogu i Roleve & Lejeve')}
            </h1>
            <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-slate-500">
              {dt('Referencë e plotë e çdo roli: çka hap, çka nuk lejohet, dhe kur duhet caktuar. Kjo faqe nuk jep asnjë leje — vetëm përshkruan politikën që zbatohet nga serveri.')}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {dt('Roli juaj')}: {currentUser?.role ?? '—'}
        </span>
      </header>

      {/* Numbers */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Role gjithsej" value={ROLE_CATALOG.length} />
        <Stat label="Role stafi" value={staffCount} tone="blue" />
        <Stat label="Akses i plotë" value={fullCount} tone="amber" />
        <Stat label="Seksione" value={totalSections} tone="indigo" />
      </div>

      {/* Filters: by clearance band, and by section — the two questions asked. */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900">
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
          {dt('Niveli')}:
        </span>
        <button
          type="button"
          onClick={() => setFilter('all')}
          aria-pressed={filter === 'all'}
          className={cn(
            'rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors',
            filter === 'all'
              ? 'bg-slate-900 text-white dark:bg-slate-700'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
          )}
        >
          {dt('Të gjitha')}
        </button>
        {(Object.keys(CLEARANCE_LABELS) as ClearanceLevel[]).map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => setFilter(level)}
            aria-pressed={filter === level}
            className={cn(
              'rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors',
              filter === level
                ? CLEARANCE_STYLE[level].chip
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            )}
          >
            {dt(CLEARANCE_LABELS[level])}
          </button>
        ))}

        <span className="ml-auto flex items-center gap-2">
          <Lock className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={sectionFocus}
            onChange={(e) => setSectionFocus(e.target.value as AdminSection | 'all')}
            aria-label={dt('Filtro sipas seksionit')}
            className="rounded-lg border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-bold outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
          >
            <option value="all">{dt('Kush e hap çdo seksion?')}</option>
            {SECTION_ORDER.map((section) => (
              <option key={section} value={section}>{dt(SECTION_LABELS[section])}</option>
            ))}
          </select>
        </span>
      </div>

      {/* The roles */}
      {visible.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-white/10 dark:bg-slate-900">
          <Shield className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">
            {dt('Asnjë rol nuk përputhet me këtë filtër.')}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visible.map((profile) => (
            <RoleCard
              key={profile.role}
              profile={profile}
              expanded={expanded === profile.role}
              onToggle={() => setExpanded((current) => (current === profile.role ? null : profile.role))}
            />
          ))}
        </div>
      )}

      {/* The rule that outranks every role. */}
      <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500 dark:border-white/10 dark:bg-slate-950">
        <Users className="mt-0.5 h-4 w-4 shrink-0" />
        {dt('Pavarësisht rolit, çdo veprim privilegjues regjistrohet në regjistrin e pandryshueshëm me emrin, komunën dhe kohën. Regjistri nuk mund të ndryshohet ose fshihet nga askush — as nga Super Administratori.')}
      </p>
    </div>
  );
}
