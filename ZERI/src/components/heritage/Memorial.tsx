import { useMemo, useState } from 'react';
import {
  Building2, Castle, Church, Columns3, Droplets, ExternalLink, Flag, Flame, Gem, House, Landmark, MapPin, Mountain,
  PawPrint, Sailboat, Scale, Search, HeartHandshake, Quote, Snowflake, Store, TreePine, Trees, Users, Waves, type LucideIcon,
} from 'lucide-react';
import {
  LEGENDARY_FAMILIES, LIBERATION_POINTS, MARTYRS, PLACES, PLACE_KINDS, ageAtDeath, formatMemorialDate,
  type Martyr, type PlaceKind,
} from '../../lib/heritage/memorial';
import type { HeritageLang } from '../../lib/heritage/types';
import { PlateArt } from './HeritageArt';
import { Photo } from './Photo';
import { CHARGES, SEXUAL_VIOLENCE_COUNTS, STRENGTH_LABEL } from '../../lib/heritage/accountability';
import { MARTYR_PROFILES } from '../../lib/heritage/martyrProfiles';
import { JASHARI_FACTS, JASHARI_SOURCE, PREKAZ_BEATS, PREKAZ_SOURCE } from '../../lib/heritage/jashari';
import { CITIES, WHY_VISIT } from '../../lib/heritage/welcome';

const year = (v?: string) => (v ? v.slice(0, 4) : '—');
const initials = (name: string) => name.split(/[\s-]+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();

/* ── Luftë çlirimtare, jo terrorizëm ─────────────────────────────────────── */

export function LiberationSection({ lang }: { lang: HeritageLang }) {
  return (
    <section aria-labelledby="hx-lib" className="hx-uck-hero hx-grain relative isolate overflow-hidden rounded-[28px]">
      <div className="space-y-5 p-5 sm:space-y-6 sm:p-10">
        <header className="max-w-3xl space-y-3">
          <p className="hx-eyebrow" style={{ color: '#ff8a98' }}>{lang === 'sq' ? 'E vërteta e luftës' : 'The truth of the war'}</p>
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
            <li key={p.sourceLabel + i} className="rounded-2xl border border-white/12 bg-white/[0.06] p-4 backdrop-blur sm:p-5">
              <p className="flex items-start gap-3">
                <span className="hx-serif w-8 shrink-0 text-2xl font-black leading-none text-[#ff4d63]">{String(i + 1).padStart(2, '0')}</span>
                <span className="hx-serif text-lg font-black leading-snug text-white">{p.title[lang]}</span>
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-300 sm:pl-11">{p.body[lang]}</p>
              <a href={p.source} target="_blank" rel="noreferrer" className="mt-3 sm:ml-11 inline-flex items-center gap-1 text-xs font-bold text-[#ff8a98] hover:underline">
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
  const profile = MARTYR_PROFILES[m.id];
  return (
    <li className="hx-card relative flex gap-3 overflow-hidden p-4 pl-5 sm:gap-4 sm:p-5">
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#c8102e] via-[#111] to-[#c8102e]" />
      {profile?.photo ? (
        <figure className="w-24 shrink-0 sm:w-28">
          <span className="relative block aspect-[4/5] overflow-hidden rounded-xl ring-2 ring-[#c8102e]" style={{ background: 'radial-gradient(circle at 30% 25%, #3a0a12, #0b0b12)' }}>
            <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center hx-serif text-2xl font-black text-white/80">{initials(m.name)}</span>
            <Photo name={`dheshmor-${m.id}`} alt={`${profile.photo.caption[lang]}`} bare className="!absolute inset-0 !bg-transparent" position="top" />
          </span>
          <figcaption className="hx-ink-3 mt-1.5 text-[10px] font-semibold leading-snug">{profile.photo.caption[lang]}</figcaption>
        </figure>
      ) : (
        <span className="relative flex h-14 w-14 shrink-0 sm:h-16 sm:w-16 items-center justify-center overflow-hidden rounded-full ring-2 ring-[#c8102e]" style={{ background: 'radial-gradient(circle at 30% 25%, #3a0a12, #0b0b12)' }}>
          <span aria-hidden="true" className="hx-serif text-lg font-black text-white/90">{initials(m.name)}</span>
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h3 className="hx-serif text-lg font-black leading-tight" style={{ color: 'var(--hx-ink)' }}>
          {m.name}{m.alias && <span className="hx-brass text-sm font-bold"> · “{m.alias}”</span>}
        </h3>
        <p className="hx-year mt-0.5 text-base">{year(m.born)} – {year(m.died)}{age !== null && <span className="hx-ink-3 ml-2 font-sans text-xs font-semibold">{lang === 'sq' ? `${age} vjeç` : `aged ${age}`}</span>}</p>
        <dl className="hx-ink-2 mt-2 space-y-0.5 text-xs">
          <div className="flex gap-1.5"><dt className="hx-ink-3 w-16 shrink-0">{lang === 'sq' ? 'Lindur' : 'Born'}</dt><dd>{formatMemorialDate(m.born)}{m.bornPlace ? `, ${m.bornPlace}` : ''}</dd></div>
          <div className="flex gap-1.5"><dt className="hx-ink-3 w-16 shrink-0">{lang === 'sq' ? 'Rënë' : 'Fell'}</dt><dd className="font-semibold" style={{ color: 'var(--hx-ink)' }}>{formatMemorialDate(m.died)}, {m.diedPlace}</dd></div>
        </dl>
        <p className="hx-ink-2 mt-2 text-sm leading-relaxed">{profile ? profile.bio[lang] : m.role[lang]}</p>
        {m.lastWords && (
          <blockquote className="mt-2 border-l-2 border-[#c8102e] pl-3 text-sm italic" style={{ color: 'var(--hx-ink)' }}>
            <span className="hx-ink-3 block text-xs font-black uppercase not-italic tracking-wider">{lang === 'sq' ? 'Fjalët e fundit' : 'Last words'}</span>“{m.lastWords[lang]}”
          </blockquote>
        )}
        <a href={m.source} target="_blank" rel="noreferrer" className="hx-ink-3 mt-2 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider hover:underline">
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
          <h2 id="hx-martyrs" className="hx-serif text-[1.75rem] font-black leading-tight sm:text-4xl" style={{ color: 'var(--hx-ink)' }}>
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
        : <ul className="grid items-start gap-4 md:grid-cols-2">{list.map(m => <MartyrCard key={m.id} m={m} lang={lang} />)}</ul>}
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
              <div className="relative aspect-[16/10] shrink-0 sm:aspect-auto sm:h-auto sm:w-44">
                <PlateArt hue={i === 0 ? 0 : 20 + i * 30} seed={200 + i} className="absolute inset-0 h-full w-full" />
                <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                  <Users className="h-10 w-10 text-white/80" />
                </span>
                <Photo name={`familja-${f.id}`} alt={f.name} bare className="!absolute inset-0" position="top" />
              </div>
              <div className="flex flex-1 flex-col gap-2 p-5">
                <p className="hx-ink-3 flex items-center gap-1 text-xs font-bold"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{f.place}</p>
                <h3 className="hx-serif text-2xl font-black leading-tight" style={{ color: 'var(--hx-ink)' }}>{f.name}</h3>
                <p className="hx-ink-2 text-sm leading-relaxed">{f.body[lang]}</p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {f.members.map(id => byId.get(id)).filter((m): m is Martyr => Boolean(m)).map(m => (
                    <li key={m.id} className="rounded-full border hx-rule px-2.5 py-1 text-xs font-bold" style={{ color: 'var(--hx-ink)' }}>
                      {m.name} <span className="hx-brass">{year(m.born)}–{year(m.died)}</span>
                    </li>
                  ))}
                </ul>
                <a href={f.source} target="_blank" rel="noreferrer" className="hx-ink-3 mt-auto inline-flex items-center gap-1 pt-2 text-xs font-bold uppercase tracking-wider hover:underline">
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
                <div className="relative aspect-[16/10] overflow-hidden">
                  <PlateArt hue={p.hue} seed={300 + i} className="absolute inset-0 h-full w-full transition duration-700 group-hover:scale-105" />
                  <Photo name={p.id} alt={p.name} bare className="!absolute inset-0" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" aria-hidden="true" />
                  <span className="absolute left-4 top-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/30 backdrop-blur" aria-hidden="true">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="absolute bottom-3 left-4 rounded-full bg-black/35 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-white backdrop-blur">{PLACE_KINDS[p.kind][lang]}</span>
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


/* ── Jasharët: Adem Jashari dhe Epopeja e Prekazit ──────────────────────── */

export function JashariSection({ lang }: { lang: HeritageLang }) {
  const sq = lang === 'sq';
  return (
    <section id="hx-jashari" aria-labelledby="hx-jashari-h" className="hx-uck-hero hx-grain relative isolate scroll-mt-24 overflow-hidden rounded-[28px]">
      <div className="grid gap-6 p-5 sm:gap-8 sm:p-10 lg:grid-cols-[320px_minmax(0,1fr)] lg:p-12">
        <div className="space-y-4">
          <Photo name="adem-jashari" alt="Adem Jashari" position="top" className="mx-auto aspect-[4/5] w-full max-w-[280px] rounded-2xl ring-1 ring-white/20 lg:max-w-none" />
          <dl className="grid grid-cols-2 gap-2">
            {JASHARI_FACTS.map(f => (
              <div key={f.k} className="rounded-xl border border-white/12 bg-white/[0.06] p-3">
                <dt className="hx-serif text-lg font-black text-[#ff4d63]">{f.k}</dt>
                <dd className="text-xs leading-snug text-slate-300">{f.v[lang]}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="space-y-6">
          <header className="space-y-2">
            <p className="hx-eyebrow" style={{ color: '#ff8a98' }}>{sq ? 'Komandanti Legjendar' : 'The Legendary Commander'}</p>
            <h2 id="hx-jashari-h" className="hx-serif text-3xl font-black leading-[1.02] sm:text-5xl">Adem Jashari <span className="text-[#ff4d63]">·</span> {sq ? 'Epopeja e Prekazit' : 'The Prekaz Epic'}</h2>
            <p className="max-w-2xl text-[15px] leading-relaxed text-slate-300">
              {sq
                ? 'Ademi nuk iku. Mbrojti shtëpinë, familjen dhe tokën e tij kundër një ushtrie me tanke, deri në frymën e fundit. Ai dhe familja e tij u bënë themeli mbi të cilin u ngrit lufta çlirimtare e një populli.'
                : 'Adem did not run. He defended his home, his family and his land against an army with tanks, to his last breath. He and his family became the foundation on which a people’s war of liberation was built.'}
            </p>
          </header>
          <ol className="space-y-3">
            {PREKAZ_BEATS.map(b => (
              <li key={b.date + b.title.sq} className="grid gap-1 rounded-2xl border border-white/12 bg-white/[0.05] p-4 sm:grid-cols-[110px_1fr] sm:gap-4">
                <p className="hx-serif text-lg font-black text-[#ff4d63]">{b.date}</p>
                <div>
                  <p className="font-black">{b.title[lang]}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-slate-300">{b.body[lang]}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="flex flex-wrap gap-4 text-xs font-bold">
            {[[JASHARI_SOURCE, 'Adem Jashari'], [PREKAZ_SOURCE, 'Attack on Prekaz']].map(([href, label]) => (
              <a key={href} href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#ff8a98] hover:underline">{sq ? 'Burimi' : 'Source'}: {label}<ExternalLink className="h-3 w-3" aria-hidden="true" /></a>
            ))}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ── Përgjegjësia: Serbia, dhe shifrat e dhunës seksuale ────────────────── */

const TONE: Record<string, string> = { finding: 'var(--hx-ok)', estimate: 'var(--hx-warn)', record: 'var(--hx-blue)' };

export function AccountabilitySection({ lang }: { lang: HeritageLang }) {
  const sq = lang === 'sq';
  const cols = [
    { side: 'intl' as const, title: sq ? 'Ndërkombëtarisht' : 'Internationally', lead: sq ? 'Gjykata, organizata dhe parlamente' : 'Courts, organisations and parliaments' },
    { side: 'kosova' as const, title: sq ? 'Nga Kosova' : 'From Kosovo', lead: sq ? 'Gjykatat, prokuroria dhe ligjet e vendit' : 'The country’s courts, prosecutors and laws' },
  ];
  return (
    <section id="hx-serbia" aria-labelledby="hx-serbia-h" className="scroll-mt-24 space-y-6">
      <header className="max-w-3xl space-y-2">
        <p className="hx-eyebrow">{sq ? 'Drejtësi për viktimat' : 'Justice for the victims'}</p>
        <h2 id="hx-serbia-h" className="hx-serif text-3xl font-black leading-tight sm:text-5xl" style={{ color: 'var(--hx-ink)' }}>
          {sq ? 'Akuzat ndaj Serbisë së Millosheviqit' : 'The case against Milošević’s Serbia'}
        </h2>
        <p className="hx-ink-2 text-[15px] leading-relaxed">
          {sq
            ? 'Fushata e vitit 1998–1999 ishte e organizuar nga shteti: dëbime masive, vrasje civilësh, djegie shtëpish dhe dhunë seksuale si armë. Kjo nuk është mendim — janë konstatime gjyqësore, shifra të dokumentuara dhe akte zyrtare. Çdo rresht ka burim dhe tregon sa e fortë është prova.'
            : 'The 1998–1999 campaign was organised by the state: mass expulsions, killings of civilians, house burnings and sexual violence as a weapon. This is not opinion — these are court findings, documented figures and official acts. Every line has a source and shows how strong the proof is.'}
        </p>
      </header>

      <div className="hx-card overflow-hidden">
        <div className="flex items-center gap-2 border-b px-5 py-3 hx-rule" style={{ background: 'color-mix(in srgb, var(--hx-brass) 7%, var(--hx-card))' }}>
          <HeartHandshake className="h-4 w-4 hx-brass" aria-hidden="true" />
          <h3 className="hx-eyebrow !tracking-[0.16em]">{sq ? 'Sa gra e burra u dhunuan? Shifrat e dokumentuara' : 'How many were raped? The documented figures'}</h3>
        </div>
        <ul className="grid divide-y hx-rule md:grid-cols-3 md:divide-x md:divide-y-0">
          {SEXUAL_VIOLENCE_COUNTS.map(c => (
            <li key={c.value} className="space-y-2 p-5">
              <p className="hx-serif text-3xl font-black leading-none hx-brass sm:text-4xl">{c.value}</p>
              <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--hx-ink)' }}>{c.label[lang]}</p>
              <p className="text-xs font-black uppercase tracking-wider" style={{ color: TONE[c.strength] }}>{STRENGTH_LABEL[c.strength][lang]}</p>
              {c.caveat && <p className="hx-ink-3 text-xs leading-relaxed">{c.caveat[lang]}</p>}
              <a href={c.source} target="_blank" rel="noreferrer" className="hx-ink-3 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider hover:underline">{c.sourceLabel}<ExternalLink className="h-3 w-3" aria-hidden="true" /></a>
            </li>
          ))}
        </ul>
        <p className="hx-ink-3 border-t px-5 py-3 text-xs leading-relaxed hx-rule">
          {sq
            ? 'Shifra e saktë nuk ekziston: shumica e të mbijetuarave heshtën nga frika dhe stigma. Ky arkiv nuk publikon emra, foto apo detaje të akteve dhe nderon çdo të mbijetuar. Mbështetja është në fund të kapitullit përkatës.'
            : 'No exact figure exists: most survivors stayed silent out of fear and stigma. This archive publishes no names, photos or details of the acts and honours every survivor. Support information is at the end of the relevant chapter.'}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {cols.map(col => (
          <div key={col.side} className="space-y-3">
            <div>
              <h3 className="hx-serif text-2xl font-black" style={{ color: 'var(--hx-ink)' }}>{col.title}</h3>
              <p className="hx-ink-3 text-xs font-semibold">{col.lead}</p>
            </div>
            <ul className="space-y-3">
              {CHARGES.filter(c => c.side === col.side).map(c => (
                <li key={c.id} className="hx-card relative overflow-hidden p-5">
                  <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1" style={{ background: TONE[c.strength] }} />
                  <p className="text-xs font-black uppercase tracking-wider" style={{ color: TONE[c.strength] }}>{STRENGTH_LABEL[c.strength][lang]}</p>
                  <h4 className="hx-serif mt-1 text-lg font-black leading-snug" style={{ color: 'var(--hx-ink)' }}>{c.title[lang]}</h4>
                  <p className="hx-ink-2 mt-1.5 text-sm leading-relaxed">{c.body[lang]}</p>
                  <a href={c.source} target="_blank" rel="noreferrer" className="hx-ink-3 mt-2 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider hover:underline">{c.sourceLabel}<ExternalLink className="h-3 w-3" aria-hidden="true" /></a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="flex items-start gap-2 text-xs hx-ink-3"><Quote className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />{sq ? 'Konstatimet gjyqësore vlejnë për personat e dënuar; aktakuzat dhe vlerësimet janë shënuar si të tilla. Krimet dokumentohen kushdo qoftë autori.' : 'Court findings apply to the persons convicted; indictments and estimates are labelled as such. Crimes are documented whoever committed them.'}</p>
    </section>
  );
}

/* ── Pse ta vizitosh Kosovën ────────────────────────────────────────────── */

export function WhyVisitSection({ lang }: { lang: HeritageLang }) {
  const sq = lang === 'sq';
  return (
    <section aria-labelledby="hx-why" className="space-y-8">
      <header className="max-w-3xl space-y-2">
        <p className="hx-eyebrow">{sq ? 'Mikpritja, traditat, njerëzit' : 'Hospitality, traditions, people'}</p>
        <h2 id="hx-why" className="hx-serif text-3xl font-black leading-tight sm:text-5xl" style={{ color: 'var(--hx-ink)' }}>{sq ? 'Pse ta vizitosh Kosovën' : 'Why visit Kosovo'}</h2>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {WHY_VISIT.map((w, i) => (
          <li key={w.id} className="hx-card p-5">
            <p className="hx-year text-4xl leading-none">{String(i + 1).padStart(2, '0')}</p>
            <h3 className="hx-serif mt-3 text-lg font-black leading-snug" style={{ color: 'var(--hx-ink)' }}>{w.title[lang]}</h3>
            <p className="hx-ink-2 mt-1.5 text-sm leading-relaxed">{w.body[lang]}</p>
          </li>
        ))}
      </ul>
      <div>
        <h3 className="hx-eyebrow mb-3">{sq ? 'Shtatë qytete' : 'Seven cities'}</h3>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CITIES.map(c => (
            <li key={c.id} className="hx-plate group">
              <div className="relative aspect-[16/10]">
                <PlateArt hue={CITIES.indexOf(c) * 45 + 200} seed={500 + CITIES.indexOf(c)} className="absolute inset-0 h-full w-full" />
                <Photo name={`qyteti-${c.id}`} alt={c.name} bare className="!absolute inset-0 transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" aria-hidden="true" />
                <p className="hx-serif absolute bottom-3 left-4 text-2xl font-black text-white">{c.name}</p>
              </div>
              <div className="p-4">
                <p className="hx-brass text-xs font-black uppercase tracking-wider">{c.tag[lang]}</p>
                <p className="hx-ink-2 mt-1 text-sm leading-relaxed">{c.body[lang]}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
