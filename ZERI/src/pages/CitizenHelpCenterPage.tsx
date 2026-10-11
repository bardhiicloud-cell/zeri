import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  FileText,
  HeartPulse,
  LifeBuoy,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { filterByScope, isSpecificScope, scopeKey } from '../lib/municipalityScope';
import { cn } from '../lib/utils';

const helpCards = [
  {
    title: 'Raporto një problem',
    description: 'Dërgo një çështje publike me vendndodhje, fotografi dhe përditësime.',
    detail: 'Raportim qytetar',
    href: '/raporto',
    icon: FileText,
    tone: 'blue',
  },
  {
    title: 'Shërbime publike',
    description: 'Gjej udhëzime dhe shërbime komunale në një katalog të vetëm.',
    detail: 'Katalog shërbimesh',
    href: '/sherbimet',
    icon: Building2,
    tone: 'emerald',
  },
  {
    title: 'Mbështetje shëndetësore',
    description: 'Regjistro dhe ndiq rastin tënd përmes një hapësire private.',
    detail: 'Qasje e mbrojtur',
    href: '/shendetesia',
    icon: HeartPulse,
    tone: 'rose',
  },
  {
    title: 'Ndihmo komunitetin',
    description: 'Shfleto kauzat dhe mënyrat e verifikuara për të kontribuar.',
    detail: 'Solidaritet qytetar',
    href: '/donacion',
    icon: Users,
    tone: 'amber',
  },
  {
    title: 'Ndiq raportimin',
    description: 'Kontrollo statusin dhe historikun e kërkesës me ID-në tënde.',
    detail: 'Gjurmim transparent',
    href: '/trackid',
    icon: ShieldCheck,
    tone: 'indigo',
  },
  {
    title: 'Shiko hartën',
    description: 'Eksploro çështjet qytetare sipas zonës dhe vendndodhjes.',
    detail: 'Pamje gjeografike',
    href: '/harta',
    icon: MapPin,
    tone: 'cyan',
  },
] as const;

const toneClasses = {
  blue: 'bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-400/10 dark:text-blue-200 dark:ring-blue-300/10',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-400/10 dark:text-emerald-200 dark:ring-emerald-300/10',
  rose: 'bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-400/10 dark:text-rose-200 dark:ring-rose-300/10',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-400/10 dark:text-amber-200 dark:ring-amber-300/10',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-100 dark:bg-indigo-400/10 dark:text-indigo-200 dark:ring-indigo-300/10',
  cyan: 'bg-cyan-50 text-cyan-700 ring-cyan-100 dark:bg-cyan-400/10 dark:text-cyan-200 dark:ring-cyan-300/10',
};

export default function CitizenHelpCenterPage() {
  const userMunicipality = useStore(state => state.userMunicipality);
  const reports = useStore(state => state.reports || []);
  const [search, setSearch] = useState('');
  const activeMunicipality = isSpecificScope(userMunicipality) ? scopeKey(userMunicipality) : null;
  const localReports = activeMunicipality ? filterByScope(reports, activeMunicipality) : reports;
  const resolvedReports = localReports.filter(report => report.status === 'Resolved').length;
  const openReports = localReports.length - resolvedReports;
  const registryLink = activeMunicipality
    ? `/detailed-registry?municipality=${encodeURIComponent(activeMunicipality)}`
    : '/detailed-registry';

  const filteredCards = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('sq-AL');
    return query
      ? helpCards.filter(card => `${card.title} ${card.description} ${card.detail}`.toLocaleLowerCase('sq-AL').includes(query))
      : helpCards;
  }, [search]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 pb-24 pt-6 text-slate-900 dark:bg-slate-950 dark:text-white sm:px-6 lg:px-8 lg:pt-10">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="relative isolate overflow-hidden rounded-[2rem] border border-white/10 bg-[#061326] p-6 text-white shadow-[0_30px_90px_-42px_rgba(2,6,23,0.9)] sm:p-10">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-36 left-1/3 h-72 w-72 rounded-full bg-blue-600/25 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-end">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.17em] text-cyan-200">
                <LifeBuoy className="h-4 w-4" aria-hidden="true" />
                Qendra e Ndihmës Qytetare
              </div>
              <h1 className="mt-5 max-w-2xl text-3xl font-black leading-tight tracking-tight sm:text-5xl">
                Hapi i duhur për çdo nevojë qytetare.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
                Gjej ndihmën sipas situatës dhe zonës tënde. Raporto, kërko shërbim ose ndiq një rast pa humbur kohë nëpër faqe.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/kontakt-numrat" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-rose-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-rose-950/30 transition hover:bg-rose-400">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  Numrat e emergjencës
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link to="/raporto" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  Nis raportim
                </Link>
              </div>
            </div>

            <aside className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-xl">
              <div className="flex items-center gap-2 text-cyan-200">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                <span className="text-[10px] font-black uppercase tracking-[0.16em]">Zona aktive</span>
              </div>
              <p className="mt-2 text-xl font-black">{activeMunicipality || 'Të gjitha komunat'}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">Informacioni dhe numërimet më poshtë përshtaten sipas zonës së zgjedhur.</p>
              <Link to="/komunat" className="mt-3 inline-flex min-h-10 items-center gap-1.5 text-xs font-black text-cyan-200 hover:text-white">
                Ndrysho zonën <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </aside>
          </div>
        </header>

        <section aria-label="Përmbledhje e zonës" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Raportime të ngarkuara', value: localReports.length, icon: Activity, color: 'text-cyan-600 dark:text-cyan-300' },
            { label: 'Të zgjidhura', value: resolvedReports, icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-300' },
            { label: 'Hapur / në proces', value: openReports, icon: Clock3, color: 'text-amber-600 dark:text-amber-300' },
            { label: 'Hyrje të shpejta', value: helpCards.length, icon: Sparkles, color: 'text-indigo-600 dark:text-indigo-300' },
          ].map(({ label, value, icon: Icon, color }) => (
            <article key={label} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
                <Icon className={cn('h-4 w-4 shrink-0', color)} aria-hidden="true" />
              </div>
              <p className={cn('mt-2 text-2xl font-black tracking-tight sm:text-3xl', color)}>{value.toLocaleString('sq-AL')}</p>
            </article>
          ))}
        </section>

        <section>
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-700 dark:text-cyan-300">Orientim i menjëhershëm</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight">Çfarë të duhet sot?</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Zgjidh një rrugë të qartë dhe vazhdo drejtpërdrejt.</p>
            </div>
            <label className="relative block w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Kërko ndihmë ose shërbim..."
                aria-label="Kërko ndihmë ose shërbim"
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-slate-900"
              />
            </label>
          </div>

          {filteredCards.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredCards.map(card => (
                <Link
                  key={card.href}
                  to={card.href}
                  className="group rounded-[1.5rem] border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-xl hover:shadow-blue-950/5 dark:border-white/10 dark:bg-slate-900 dark:hover:border-blue-400/40 sm:p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className={cn('inline-flex h-12 w-12 items-center justify-center rounded-2xl ring-1', toneClasses[card.tone])}>
                      <card.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <ArrowRight className="mt-1 h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-600 dark:text-slate-600" aria-hidden="true" />
                  </div>
                  <p className="mt-5 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{card.detail}</p>
                  <h3 className="mt-1 text-lg font-black tracking-tight">{card.title}</h3>
                  <p className="mt-2 min-h-10 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{card.description}</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-white/15 dark:bg-slate-900">
              <Search className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
              <p className="mt-2 font-bold">Nuk u gjet ndihmë për “{search}”.</p>
              <button type="button" onClick={() => setSearch('')} className="mt-2 min-h-10 text-sm font-black text-blue-700 hover:underline dark:text-cyan-300">Pastro kërkimin</button>
            </div>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[1.5rem] border border-slate-200/80 bg-white p-5 dark:border-white/10 dark:bg-slate-900 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-200"><MapPin className="h-5 w-5" aria-hidden="true" /></span>
              <div>
                <h2 className="font-black">Pasqyra e zonës</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Raportimet e dukshme për {activeMunicipality || 'të gjitha komunat'}.</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Të hapura / në proces</p>
                <p className="mt-1 text-2xl font-black text-amber-600 dark:text-amber-300">{openReports.toLocaleString('sq-AL')}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Të zgjidhura</p>
                <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-300">{resolvedReports.toLocaleString('sq-AL')}</p>
              </div>
            </div>
            <Link to={registryLink} className="mt-4 inline-flex min-h-10 items-center gap-1.5 text-xs font-black text-blue-700 hover:underline dark:text-cyan-300">
              Hap regjistrin publik <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          <aside className="rounded-[1.5rem] border border-rose-200/70 bg-gradient-to-br from-rose-50 via-white to-white p-5 dark:border-rose-300/10 dark:from-rose-950/30 dark:via-slate-900 dark:to-slate-900 sm:p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-400/10 dark:text-rose-200">
              <Phone className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-lg font-black">Rrezik i menjëhershëm?</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">Për situata urgjente, përdor numrat zyrtarë të emergjencës. Qendra e ndihmës nuk zëvendëson shërbimet emergjente.</p>
            <Link to="/kontakt-numrat" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-black text-white transition hover:bg-rose-700">
              Shiko numrat zyrtarë <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </aside>
        </section>

        <p className="text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Numërimet pasqyrojnë vetëm raportimet e ngarkuara në platformë; përditësimet varen nga informacioni i publikuar nga institucionet.
        </p>
      </div>
    </main>
  );
}
