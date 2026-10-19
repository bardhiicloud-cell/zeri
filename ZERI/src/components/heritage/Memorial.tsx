import { useMemo, useState } from 'react';
import {
  Building2, Castle, Church, Columns3, Droplets, ExternalLink, Flag, Flame, Gem, House, Landmark, MapPin, Mountain,
  PawPrint, Sailboat, Scale, Search, Snowflake, Store, TreePine, Trees, Users, Waves, type LucideIcon,
} from 'lucide-react';
import {
  LEGENDARY_FAMILIES, LIBERATION_POINTS, MARTYRS, PLACES, PLACE_KINDS, ageAtDeath, formatMemorialDate,
  type Martyr, type PlaceKind,
} from '../../lib/heritage/memorial';
import type { HeritageLang } from '../../lib/heritage/types';
import { PlateArt } from './HeritageArt';

const year = (v?: string) => (v ? v.slice(0, 4) : '—');
const initials = (name: string) => name.split(/[\s-]+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();

/* ── Luftë çlirimtare, jo terrorizëm ─────────────────────────────────────── */

export function LiberationSection({ lang }: { lang: HeritageLang }) {
  return (
    <section aria-labelledby="hx-lib" className="hx-hero hx-grain relative isolate overflow-hidden rounded-[28px]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(90%_70%_at_100%_0%,rgba(200,16,46,.35)_0%,transparent_60%),radial-gradient(70%_60%_at_0%_100%,rgba(232,195,110,.18)_0%,transparent_60%)]" aria-hidden="true" />
      <div className="space-y-6 p-6 sm:p-10">
        <header className="max-w-3xl space-y-3">
          <p className="hx-eyebrow" style={{ color: '#e8c36e' }}>{lang === 'sq' ? 'E vërteta e luftës' : 'The truth of the war'}</p>
          <h2 id="hx-lib" className="hx-serif text-3xl font-black leading-[1.02] text-white sm:text-5xl">
            {lang === 'sq' ? 'Luftë çlirimtare, jo terrorizëm' : 'A war of liberation, not terrorism'}
          </h2>
          <p className="text-[15px] leading-relaxed text-slate-200">
            {lang === 'sq'
              ? 'UÇK-ja nuk sulmoi askënd jashtë vendit të vet dhe nuk luftoi për pushtet mbi të tjerët. Luftëtarët e saj mbrojtën familjet, fshatrat dhe të drejtën e një populli për të jetuar i lirë në tokën e vet. Faktet më poshtë, secili me burim, tregojnë pse etiketa "terroriste" nuk qëndron.'
              : 'The KLA attacked no one beyond its own land and did not fight for power over others. Its fighters defended their families, their villages and a people’s right to live free on its own land. The facts below, each with a source, show why the "terrorist" label does not hold.'}
          </p>
        </header>
        <ol className="grid gap-3 md:grid-cols-2">
          {LIBERATION_POINTS.map((p, i) => (
            <li key={p.sourceLabel + i} className="rounded-2xl border border-white/12 bg-white/[0.06] p-5 backdrop-blur">
              <p className="flex items-start gap-3">
                <span className="hx-serif w-8 shrink-0 text-2xl font-black leading-none text-[#e8c36e]">{String(i + 1).padStart(2, '0')}</span>
                <span className="hx-serif text-lg font-black leading-snug text-white">{p.title[lang]}</span>
              </p>
              <p className="mt-2 pl-11 text-sm leading-relaxed text-slate-300">{p.body[lang]}</p>
              <a href={p.source} target="_blank" rel="noreferrer" className="mt-3 ml-11 inline-flex items-center gap-1 text-[11px] font-bold text-[#e8c36e] hover:underline">
                <Scale className="h-3.5 w-3.5" aria-hidden="true" />{p.sourceLabel}<ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ── Dëshmorët ───────────────────────────────────────────────────────────── */

function MartyrCard({ m, lang }: { m: Martyr; lang: HeritageLang }) {
  const age = ageAtDeath(m.born, m.died);
  return (
    <li className="hx-card relative flex gap-4 overflow-hidden p-4 sm:p-5">
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#c8102e] via-[#e8c36e] to-[#c8102e]" />
      <span aria-hidden="true" className="hx-serif flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-black text-[#e8c36e] ring-2 ring-[#e8c36e]/70" style={{ background: 'radial-gradient(circle at 30% 25%, #2a1416, #0b0b12)' }}>
        {initials(m.name)}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="hx-serif text-lg font-black leading-tight" style={{ color: 'var(--hx-ink)' }}>
          {m.name}{m.alias && <span className="hx-brass text-sm font-bold"> · “{m.alias}”</span>}
        </h3>
        <p className="hx-year mt-0.5 text-base">{year(m.born)} – {year(m.died)}{age !== null && <span className="hx-ink-3 ml-2 font-sans text-xs font-semibold">{lang === 'sq' ? `${age} vjeç` : `aged ${age}`}</span>}</p>
        <dl className="hx-ink-2 mt-2 space-y-0.5 text-xs">
          <div className="flex gap-1.5"><dt className="hx-ink-3 w-16 shrink-0">{lang === 'sq' ? 'Lindur' : 'Born'}</dt><dd>{formatMemorialDate(m.born)}{m.bornPlace ? `, ${m.bornPlace}` : ''}</dd></div>
          <div className="flex gap-1.5"><dt className="hx-ink-3 w-16 shrink-0">{lang === 'sq' ? 'Rënë' : 'Fell'}</dt><dd className="font-semibold" style={{ color: 'var(--hx-ink)' }}>{formatMemorialDate(m.died)}, {m.diedPlace}</dd></div>
        </dl>
        <p className="hx-ink-2 mt-2 text-sm leading-relaxed">{m.role[lang]}</p>
        <a href={m.source} target="_blank" rel="noreferrer" className="hx-ink-3 mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider hover:underline">
          {lang === 'sq' ? 'Burimi' : 'Source'}<ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      </div>
    </li>
  );
}

export function MartyrsSection({ lang }: { lang: HeritageLang }) {
  const [era, setEra] = useState<'uck' | 'pararendes'>('uck');
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return MARTYRS
      .filter(m => (needle ? true : m.era === era))
      .filter(m => !needle || `${m.name} ${m.alias ?? ''} ${m.diedPlace} ${m.bornPlace ?? ''}`.toLowerCase().includes(needle))
      .slice()
      .sort((a, b) => a.died.localeCompare(b.died));
  }, [era, q]);

  return (
    <section aria-labelledby="hx-martyrs" className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl space-y-2">
          <p className="hx-eyebrow">{lang === 'sq' ? 'Lavdi dëshmorëve' : 'Glory to the martyrs'}</p>
          <h2 id="hx-martyrs" className="hx-serif text-3xl font-black leading-tight sm:text-4xl" style={{ color: 'var(--hx-ink)' }}>
            {lang === 'sq' ? 'Dëshmorët e kombit' : 'The nation’s martyrs'}
          </h2>
          <p className="hx-ink-2 text-sm leading-relaxed">
            {lang === 'sq'
              ? 'Mijëra luftëtarë të UÇK-së dhanë jetën për lirinë e Kosovës. Këtu janë emrat me datat e verifikuara nga burimet; regjistri plotësohet vazhdimisht.'
              : 'Thousands of KLA fighters gave their lives for Kosovo’s freedom. Here are the names whose dates are verified from sources; the register keeps growing.'}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div role="tablist" aria-label={lang === 'sq' ? 'Periudha' : 'Period'} className="flex rounded-xl border hx-rule p-1" style={{ background: 'var(--hx-card)' }}>
            {(['uck', 'pararendes'] as const).map(id => (
              <button key={id} type="button" role="tab" aria-selected={era === id && !q} onClick={() => { setEra(id); setQ(''); }}
                className="min-h-10 rounded-lg px-3.5 text-sm font-black transition"
                style={era === id && !q ? { background: 'var(--hx-ink)', color: 'var(--hx-paper)' } : { color: 'var(--hx-ink-2)' }}>
                {id === 'uck' ? (lang === 'sq' ? 'UÇK 1997–1999' : 'KLA 1997–1999') : (lang === 'sq' ? 'Pararendësit' : 'Forerunners')}
              </button>
            ))}
          </div>
          <label className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
            <span className="sr-only">{lang === 'sq' ? 'Kërko emër' : 'Search a name'}</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" aria-hidden="true" />
            <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={lang === 'sq' ? 'Kërko emër ose vend…' : 'Search name or place…'}
              className="hx-card min-h-12 w-full pl-9 pr-3 text-sm" style={{ color: 'var(--hx-ink)' }} />
          </label>
        </div>
      </header>
      {list.length === 0
        ? <p className="hx-ink-3 text-sm">{lang === 'sq' ? 'Asnjë emër nuk përputhet.' : 'No name matches.'}</p>
        : <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{list.map(m => <MartyrCard key={m.id} m={m} lang={lang} />)}</ul>}
    </section>
  );
}

/* ── Familjet legjendare ─────────────────────────────────────────────────── */

export function FamiliesSection({ lang }: { lang: HeritageLang }) {
  const byId = useMemo(() => new Map(MARTYRS.map(m => [m.id, m])), []);
  return (
    <section aria-labelledby="hx-fam" className="space-y-5">
      <header className="max-w-2xl space-y-2">
        <p className="hx-eyebrow">{lang === 'sq' ? 'Familjet legjendare' : 'Legendary families'}</p>
        <h2 id="hx-fam" className="hx-serif text-3xl font-black leading-tight sm:text-4xl" style={{ color: 'var(--hx-ink)' }}>
          {lang === 'sq' ? 'Shtëpi që u bënë histori' : 'Homes that became history'}
        </h2>
      </header>
      <ul className="grid gap-4 md:grid-cols-2">
        {LEGENDARY_FAMILIES.map((f, i) => (
          <li key={f.id} className={i === 0 ? 'md:col-span-2' : ''}>
            <article className="hx-plate flex h-full flex-col sm:flex-row">
              <div className="relative h-28 shrink-0 sm:h-auto sm:w-40">
                <PlateArt hue={i === 0 ? 0 : 20 + i * 30} seed={200 + i} className="absolute inset-0 h-full w-full" />
                <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                  <Users className="h-10 w-10 text-white/80" />
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-5">
                <p className="hx-ink-3 flex items-center gap-1 text-xs font-bold"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{f.place}</p>
                <h3 className="hx-serif text-2xl font-black leading-tight" style={{ color: 'var(--hx-ink)' }}>{f.name}</h3>
                <p className="hx-ink-2 text-sm leading-relaxed">{f.body[lang]}</p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {f.members.map(id => byId.get(id)).filter((m): m is Martyr => Boolean(m)).map(m => (
                    <li key={m.id} className="rounded-full border hx-rule px-2.5 py-1 text-[11px] font-bold" style={{ color: 'var(--hx-ink)' }}>
                      {m.name} <span className="hx-brass">{year(m.born)}–{year(m.died)}</span>
                    </li>
                  ))}
                </ul>
                <a href={f.source} target="_blank" rel="noreferrer" className="hx-ink-3 mt-auto inline-flex items-center gap-1 pt-2 text-[10px] font-bold uppercase tracking-wider hover:underline">
                  {lang === 'sq' ? 'Burimi' : 'Source'}<ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── Turizmi ─────────────────────────────────────────────────────────────── */

const PLACE_ICON: Record<string, LucideIcon> = {
  Landmark, Mountain, TreePine, Waves, Droplets, Snowflake, Gem, Trees, Sailboat, Columns3, Castle, Store, House, Church, Building2, Flame, Flag, PawPrint,
};

export function TourismSection({ lang }: { lang: HeritageLang }) {
  const [kind, setKind] = useState<PlaceKind | 'all'>('all');
  const list = PLACES.filter(p => kind === 'all' || p.kind === kind);
  return (
    <section id="hx-turizem" aria-labelledby="hx-tour" className="scroll-mt-24 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl space-y-2">
          <p className="hx-eyebrow">{lang === 'sq' ? 'Turizmi' : 'Tourism'}</p>
          <h2 id="hx-tour" className="hx-serif text-4xl font-black leading-tight sm:text-5xl" style={{ color: 'var(--hx-ink)' }}>
            {lang === 'sq' ? 'Vende që duhen parë' : 'Places you must see'}
          </h2>
          <p className="hx-ink-2 text-base leading-relaxed">
            {lang === 'sq'
              ? 'Nga kanionet e Rugovës te rrugicat e Prizrenit, nga shpellat e mermerta te Prekazi: Kosova në një udhëtim.'
              : 'From the Rugova gorge to the lanes of Prizren, from marble caves to Prekaz: Kosovo in one journey.'}
          </p>
        </div>
        <div role="tablist" aria-label={lang === 'sq' ? 'Lloji' : 'Type'} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {(['all', 'natyre', 'histori', 'kujtese'] as const).map(id => (
            <button key={id} type="button" role="tab" aria-selected={kind === id} onClick={() => setKind(id)}
              className="min-h-10 shrink-0 rounded-full border px-4 text-sm font-black transition hx-rule"
              style={kind === id ? { background: 'var(--hx-ink)', color: 'var(--hx-paper)', borderColor: 'var(--hx-ink)' } : { color: 'var(--hx-ink-2)', background: 'var(--hx-card)' }}>
              {id === 'all' ? (lang === 'sq' ? 'Të gjitha' : 'All') : PLACE_KINDS[id][lang]}
            </button>
          ))}
        </div>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p, i) => {
          const Icon = PLACE_ICON[p.icon] ?? MapPin;
          return (
            <li key={p.id}>
              <article className="hx-plate group flex h-full flex-col">
                <div className="relative h-32 overflow-hidden">
                  <PlateArt hue={p.hue} seed={300 + i} className="absolute inset-0 h-full w-full transition duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" aria-hidden="true" />
                  <span className="absolute left-4 top-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/30 backdrop-blur" aria-hidden="true">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="absolute bottom-3 left-4 rounded-full bg-black/35 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur">{PLACE_KINDS[p.kind][lang]}</span>
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-5">
                  <p className="hx-ink-3 flex items-center gap-1 text-xs font-bold"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{p.municipality}</p>
                  <h3 className="hx-serif text-xl font-black leading-snug" style={{ color: 'var(--hx-ink)' }}>{p.name}</h3>
                  <p className="hx-ink-2 flex-1 text-sm leading-relaxed">{p.body[lang]}</p>
                  {p.tip && <p className="hx-brass pt-1 text-xs font-black">◆ {p.tip[lang]}</p>}
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
