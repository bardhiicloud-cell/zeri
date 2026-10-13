import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, ArrowUpRight, FileText, MapPin, BarChart3, ScrollText, Landmark,
  MessagesSquare, Vote, Lightbulb, Building, HeartPulse, HeartHandshake, Newspaper,
  Phone, LifeBuoy, ListChecks, Info, Layers,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AuraPage, AuraHero, AuraStats, AuraSection, AuraNote, AuraEmpty, AuraOrbit } from '../components/aura/Aura';

import { dt } from '@/src/lib/dt';

/**
 * No projects collection exists, so this page lists only what the product can prove:
 * its own public modules, each linking to a real route. Municipal projects get an
 * honest note until a verified data source exists.
 */
interface PlatformModule { to: string; title: string; field: string; description: string; icon: LucideIcon }

const MODULES: PlatformModule[] = [
  { to: '/raporto', title: 'Raporto problem', field: 'Raportime', description: 'Dërgoni një problem në qytetin tuaj me përshkrim, vendndodhje dhe foto. Merrni një Track-ID.', icon: FileText },
  { to: '/trackid', title: 'Gjurmo raportin', field: 'Raportime', description: 'Shkruani Track-ID për të parë statusin publik dhe historikun e një raporti.', icon: Search },
  { to: '/harta', title: 'Harta e raportimeve', field: 'Transparencë', description: 'Raportet e publikuara në hartë, sipas vendndodhjes dhe statusit.', icon: MapPin },
  { to: '/detailed-registry', title: 'Regjistri i raportimeve', field: 'Transparencë', description: 'Lista e raporteve publike me kërkim dhe filtra.', icon: ListChecks },
  { to: '/statistikat', title: 'Statistikat', field: 'Transparencë', description: 'Përmbledhje numerike e raportimeve në platformë.', icon: BarChart3 },
  { to: '/transparenca', title: 'Transparenca', field: 'Transparencë', description: 'Si funksionon platforma dhe si trajtohen raportimet.', icon: ScrollText },
  { to: '/komunat', title: 'Komunat', field: 'Institucione', description: 'Informacion sipas komunës.', icon: Landmark },
  { to: '/kontakt-numrat', title: 'Numrat e institucioneve', field: 'Institucione', description: 'Regjistri i numrave zyrtarë kombëtarë dhe komunalë.', icon: Phone },
  { to: '/sherbimet', title: 'Shërbimet publike', field: 'Shërbime', description: 'Udhëzues për shërbime publike dhe lidhje te portalet zyrtare.', icon: Building },
  { to: '/shendetesia', title: 'Regjistri shëndetësor', field: 'Shërbime', description: 'Rastet shëndetësore që kanë nevojë për mbështetje, me të dhëna të kufizuara.', icon: HeartPulse },
  { to: '/donacion', title: 'Fushata ndihme', field: 'Shërbime', description: 'Fushata të miratuara nga administratori; donacionet bëhen në faqe të jashtme.', icon: HeartHandshake },
  { to: '/forum', title: 'Komuniteti', field: 'Pjesëmarrje', description: 'Diskutime dhe postime të qytetarëve (kërkon hyrje).', icon: MessagesSquare },
  { to: '/sondazhet', title: 'Sondazhet', field: 'Pjesëmarrje', description: 'Votoni në sondazhe publike.', icon: Vote },
  { to: '/Idea', title: 'Laboratori i ideve', field: 'Pjesëmarrje', description: 'Dërgoni një ide për përmirësimin e platformës.', icon: Lightbulb },
  { to: '/lajme', title: 'Lajme', field: 'Informim', description: 'Lajme dhe njoftime të publikuara në platformë.', icon: Newspaper },
  { to: '/ndihma', title: 'Qendra e ndihmës', field: 'Informim', description: 'Udhëzime hap pas hapi për përdorimin e platformës.', icon: LifeBuoy },
];
const FIELDS = ['Raportime', 'Transparencë', 'Institucione', 'Shërbime', 'Pjesëmarrje', 'Informim'];

export default function ProjektetPage() {
  const [query, setQuery] = useState('');
  const [field, setField] = useState('all');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MODULES.filter(m => (field === 'all' || m.field === field) && (!q || `${m.title} ${m.description}`.toLowerCase().includes(q)));
  }, [query, field]);
  const countOf = (f: string) => MODULES.filter(m => m.field === f).length;

  return (
    <AuraPage>
      <AuraHero
        visual={<AuraOrbit core={Layers} icons={MODULES.slice(0, 8).map(m => m.icon)} links={MODULES.slice(0, 8).map(m => ({ to: m.to, label: dt(m.title) }))} />}
        tone="blue"
        eyebrow={dt('Projektet')}
        icon={Layers}
        title={dt('Modulet e platformës')}
        subtitle={dt('Çfarë mund të bëni në Zëri i Qytetarëve: çdo modul më poshtë hapet te faqja e tij reale.')}
        aside={<AuraStats items={[{ value: MODULES.length, label: dt('module') }, { value: FIELDS.length, label: dt('Fusha') }]} />}
      />

      <AuraNote tone="warn" icon={Info}>
        <p className="font-semibold">{dt('Projektet komunale')}</p>
        <p className="mt-0.5 opacity-90">
          {dt('Platforma ende nuk ka një burim të verifikuar të dhënash për projektet kapitale komunale (buxhet, kontraktor, progres). Prandaj nuk shfaqim asnjë të tillë. Për projekte të një komune shihni faqen zyrtare të saj ose')}{' '}
          <Link to="/kontakt-numrat" className="font-semibold underline">{dt('numrat e institucioneve')}</Link>.
        </p>
      </AuraNote>

      <AuraSection id="modules" title={dt('Hap një modul')} action={<span className="au-sub text-[12px]" role="status">{results.length} {dt('nga')} {MODULES.length} {dt('module')}</span>}>
        <div className="mb-3 flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative sm:w-72">
            <label htmlFor="mod-search" className="sr-only">{dt('Kërko modul')}</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" aria-hidden="true" />
            <input id="mod-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={dt('Kërkoni sipas emrit ose përshkrimit')} className="au-input !pl-9" />
          </div>
          <div className="au-rail min-w-0 flex-1" role="group" aria-label={dt('Fusha')}>
            <button type="button" aria-pressed={field === 'all'} onClick={() => setField('all')} className="au-chip">{dt('Të gjitha fushat')} <span className="au-count">{MODULES.length}</span></button>
            {FIELDS.map(f => (
              <button key={f} type="button" aria-pressed={field === f} onClick={() => setField(f)} className="au-chip">{dt(f)} <span className="au-count">{countOf(f)}</span></button>
            ))}
          </div>
        </div>

        {results.length === 0 ? (
          <AuraEmpty icon={Search} title={dt('Nuk u gjet asnjë modul')} text={dt('Provoni një kërkim tjetër ose zgjidhni “Të gjitha fushat”.')}
            action={<button type="button" onClick={() => { setQuery(''); setField('all'); }} className="au-btn au-btn-primary">{dt('Pastro filtrat')}</button>} />
        ) : (
          <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {results.map(({ to, title, field: f, description, icon: Icon }) => (
              <li key={to}>
                <Link to={to} className="au-tile au-tile-link flex h-full items-start gap-3 p-4">
                  <span className="au-ico"><Icon className="h-[18px] w-[18px]" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[15px] font-semibold">{dt(title)}</span>
                      <ArrowUpRight className="h-4 w-4 shrink-0 opacity-40" aria-hidden="true" />
                    </span>
                    <span className="au-sub mt-0.5 block text-[13px] leading-snug">{dt(description)}</span>
                    <span className="au-sub mt-2 block text-[11px] font-semibold uppercase tracking-wide">{dt(f)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </AuraSection>
    </AuraPage>
  );
}
