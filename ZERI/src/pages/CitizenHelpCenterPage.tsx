import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, Building2, ChevronDown, FileText, HeartPulse, LifeBuoy, MapPin,
  MessagesSquare, Phone, Search, ShieldCheck, Camera, UserRound, Wrench, HelpCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { REPORT_STATUS } from '../lib/reportStatus';
import { MAX_UPLOAD_BYTES, formatBytes } from '../lib/firebase';
import { cn } from '../lib/utils';
import { AuraPage, AuraHero, AuraSection, AuraNote, AuraEmpty, AuraOrbit } from '../components/aura/Aura';

import { dt } from '@/src/lib/dt';

/**
 * Help centre.
 *
 * Every statement here is grounded in something the product really does (the
 * report form's file limits, the status vocabulary in lib/reportStatus.ts, the
 * routes that exist). Where the platform has no confirmed answer, the article
 * says so instead of inventing a procedure; see `GAPS` at the bottom.
 */

interface Article {
  id: string;
  category: string;
  title: string;
  icon: LucideIcon;
  steps?: string[];
  body?: string;
  link?: { to: string; label: string };
}

const CATEGORIES = ['Fillimi', 'Ndjekja e raportit', 'Foto dhe skedarë', 'Llogaria dhe privatësia', 'Shërbime dhe komuniteti', 'Probleme teknike'] as const;

const reportLimit = formatBytes(MAX_UPLOAD_BYTES.reports);

const ARTICLES: Article[] = [
  {
    id: 'submit', category: 'Fillimi', title: 'Si e dërgoj një raport?', icon: FileText,
    steps: [
      'Hapni “Raporto problem”.',
      'Zgjidhni kategorinë dhe shkruani një titull dhe përshkrim të qartë: çfarë, ku dhe sa kohë.',
      'Shënoni vendndodhjen dhe komunën.',
      'Shtoni foto ose video nëse keni (shihni artikullin “Foto dhe skedarë”).',
      'Dërgoni raportin. Faqja shfaq Track-ID vetëm pasi raporti të jetë ruajtur me të vërtetë. Ruajeni.',
    ],
    link: { to: '/raporto', label: 'Hap “Raporto problem”' },
  },
  {
    id: 'emergency', category: 'Fillimi', title: 'Është emergjencë. Çfarë bëj?', icon: AlertTriangle,
    body: 'Për rrezik për jetën telefononi menjëherë 112 (emergjenca qendrore), 192 (Policia), 193 (zjarrfikësit) ose 194 (ndihma e shpejtë). Platforma nuk është shërbim emergjent dhe raportet nuk lexohen në çast.',
    link: { to: '/kontakt-numrat', label: 'Numrat e institucioneve' },
  },
  {
    id: 'trackid', category: 'Ndjekja e raportit', title: 'Ku e gjej Track-ID dhe si e përdor?', icon: Search,
    steps: [
      'Track-ID shfaqet në ekran pasi raporti të ruhet me sukses. Nëse jeni kyçur, njoftimet e statusit e përmbajnë gjithashtu.',
      'Hapni “Gjurmo raportin” dhe shkruani Track-ID saktësisht si e keni marrë.',
      'Do të shihni statusin aktual dhe historikun publik të veprimeve.',
    ],
    body: 'Nëse nuk e gjen asnjë rezultat, platforma përgjigjet njësoj për një ID të gabuar dhe për një ID që nuk është publike (për të mbrojtur raportet e tjera). Kontrolloni shkronjat dhe vizat.',
    link: { to: '/trackid', label: 'Hap “Gjurmo raportin”' },
  },
  {
    id: 'notpublic', category: 'Ndjekja e raportit', title: 'Pse raporti im nuk shfaqet publikisht?', icon: ShieldCheck,
    body: 'Një raport është publik vetëm pasi të jetë aprovuar. Derisa të jetë “Në pritje”, ai nuk shfaqet në hartë dhe regjistër, dhe fotot e tij nuk publikohen.',
  },
  {
    id: 'reopen', category: 'Ndjekja e raportit', title: 'Mund ta rihap një raport të mbyllur?', icon: HelpCircle,
    body: 'Aktualisht nuk ka një buton për rihapje nga qytetari. Nëse problemi vazhdon, mund të dërgoni një raport të ri; për ta lidhur me të vjetrin, shkruani Track-ID e vjetër në përshkrim. Ky është një sugjerim praktik, jo një procedurë zyrtare e konfirmuar.',
    link: { to: '/raporto', label: 'Dërgo raport të ri' },
  },
  {
    id: 'media', category: 'Foto dhe skedarë', title: 'Si i shtoj foto ose video?', icon: Camera,
    steps: [
      `Te forma e raportit përdorni kutinë e ngarkimit. Mund të shtoni deri në 12 skedarë.`,
      `Çdo foto ose video mund të jetë deri në ${reportLimit}.`,
      'Formate: foto, video, audio, PDF, DOC/DOCX dhe TXT.',
      'Një skedar shfaqet si i ngarkuar vetëm pasi ngarkimi të ketë përfunduar; nëse dështon, hiqeni dhe provoni përsëri.',
    ],
  },
  {
    id: 'privacy-report', category: 'Llogaria dhe privatësia', title: 'A mund ta dërgoj raportin në mënyrë anonime?', icon: UserRound,
    body: 'Forma e raportit ka opsionin “Kërkoj statusin anonim”. Kontakti dhe emri juaj nuk shfaqen në faqen publike të gjurmimit. Detajet e plota janë te politika e privatësisë.',
    link: { to: '/privatesia', label: 'Politika e privatësisë' },
  },
  {
    id: 'account', category: 'Llogaria dhe privatësia', title: 'Më duhet llogari?', icon: UserRound,
    body: 'Raportimi mund të vazhdojë edhe si mysafir kur faqja e ofron. Komuniteti (forumi) kërkon hyrje. Me llogari mund të merrni njoftime për ndryshimin e statusit.',
    link: { to: '/login', label: 'Hyr ose regjistrohu' },
  },
  {
    id: 'services', category: 'Shërbime dhe komuniteti', title: 'Si i gjej shërbimet publike?', icon: Building2,
    body: 'Katalogu i shërbimeve liston udhëzime dhe lidhje te portali zyrtar e-Kosova. Për kërkesa me tarifa, afate ose dokumente, ndiqni gjithmonë burimin zyrtar.',
    link: { to: '/sherbimet', label: 'Hap shërbimet' },
  },
  {
    id: 'forum', category: 'Shërbime dhe komuniteti', title: 'Si marr pjesë në komunitet dhe sondazhe?', icon: MessagesSquare,
    steps: [
      'Hyni në llogari, pastaj hapni “Komuniteti” për të parë dhe shkruar postime.',
      'Sondazhet publike hapen te “Sondazhet”.',
      'Ideja për përmirësimin e platformës dërgohet te “Laboratori i ideve” (nuk është raport zyrtar).',
    ],
    link: { to: '/forum', label: 'Hap komunitetin' },
  },
  {
    id: 'health', category: 'Shërbime dhe komuniteti', title: 'Regjistri shëndetësor: kush i shikon të dhënat?', icon: HeartPulse,
    body: 'Rastet shëndetësore nuk janë publike. I shihni vetëm ju (nëse jeni kyçur) dhe stafi i autorizuar i shëndetësisë; kontakti dhe dokumentet nuk shfaqen te qytetarët e tjerë. Mund ta dërgoni rastin edhe anonimisht, por pa llogari nuk do ta shihni më pas në faqe.',
    link: { to: '/shendetesia', label: 'Hap regjistrin' },
  },
  {
    id: 'upload-fail', category: 'Probleme teknike', title: 'Ngarkimi i skedarit dështon', icon: Wrench,
    steps: [
      `Kontrolloni që skedari të jetë deri në ${reportLimit}.`,
      'Kontrolloni lidhjen me internetin dhe provoni përsëri.',
      'Provoni një skedar tjetër ose një foto më të vogël.',
      'Nëse vazhdon, na shkruani me një përshkrim të gabimit.',
    ],
    link: { to: '/kontakt', label: 'Na shkruani' },
  },
  {
    id: 'lost-id', category: 'Probleme teknike', title: 'E humba Track-ID', icon: HelpCircle,
    body: 'Track-ID nuk mund të rikthehet me kërkim publik, sepse ai është çelësi i vetëm i gjurmimit. Nëse jeni kyçur, kontrolloni njoftimet e llogarisë. Përndryshe nuk ka mënyrë të konfirmuar për ta rikuperuar nga kjo faqe.',
  },
];

/** Questions the platform cannot answer yet. Shown to citizens so the gap is visible, not papered over. */
const GAPS = [
  'Sa kohë ka institucioni për t’iu përgjigjur një raporti.',
  'Procedura zyrtare për ankesë kundër vendimit të një institucioni.',
  'Afati i përgjigjes së ekipit të platformës për mesazhet e kontaktit.',
];

const STATUS_HELP: Record<string, string> = {
  'Pending Review': 'Raporti u pranua dhe pret shqyrtimin nga ekipi i platformës.',
  'Approved': 'U aprovua dhe u dërgua te institucioni përgjegjës. Tani është publik.',
  'Assigned': 'Institucioni ia ka caktuar raportin një inspektori.',
  'In Progress': 'Trajtimi ka filluar.',
  'Resolved': 'Institucioni e shënoi si të zgjidhur.',
  'Rejected': 'Raporti u refuzua. Arsyeja shënohet në detajet e gjurmimit.',
  'Overdue': 'Afati i përgjigjes së institucionit ka kaluar.',
  'Closed': 'Raporti është mbyllur.',
};

const norm = (s: string) => s.toLocaleLowerCase('sq-AL');

export default function CitizenHelpCenterPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [openId, setOpenId] = useState<string | null>('submit');

  const results = useMemo(() => {
    const q = norm(query.trim());
    return ARTICLES.filter(a =>
      (category === 'all' || a.category === category) &&
      (!q || norm(`${a.title} ${a.body ?? ''} ${(a.steps ?? []).join(' ')}`).includes(q)));
  }, [query, category]);

  const PIPELINE: Array<keyof typeof STATUS_HELP> = ['Pending Review', 'Approved', 'Assigned', 'In Progress', 'Resolved', 'Closed'];
  const SIDE: Array<keyof typeof STATUS_HELP> = ['Rejected', 'Overdue'];
  const statusLabelOf = (code: string) => REPORT_STATUS[code as keyof typeof REPORT_STATUS]?.label ?? code;
  const [activeStatus, setActiveStatus] = useState<keyof typeof STATUS_HELP>('Pending Review');

  return (
    <AuraPage>
      {/* Hero with the search built in: the first thing a visitor can do is ask. */}
      <AuraHero
        visual={<AuraOrbit core={LifeBuoy} icons={[Search, FileText, MapPin, Phone, ShieldCheck, HelpCircle]} />}
        tone="violet"
        eyebrow={dt('Qendra e ndihmës')}
        icon={LifeBuoy}
        title={dt('Si mund t’ju ndihmojmë?')}
        subtitle={dt('Udhëzime të shkurtra për raportimin, gjurmimin dhe përdorimin e platformës. Kërkoni një temë ose zgjidhni një kategori.')}
        actions={
          <div className="w-full max-w-lg">
            <label htmlFor="help-search" className="sr-only">{dt('Kërko në ndihmë')}</label>
            <div className="flex items-center gap-2 rounded-full bg-white/95 pl-4 pr-1.5 text-slate-900 shadow-lg">
              <Search className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
              <input id="help-search" type="search" value={query} onChange={e => { setQuery(e.target.value); if (e.target.value) setOpenId(null); }}
                placeholder={dt('p.sh. Track-ID, foto, anonim')} className="h-11 w-full bg-transparent text-[15px] outline-none placeholder:text-slate-500" />
              {query && <button type="button" onClick={() => setQuery('')} className="au-btn au-btn-dark !h-8 shrink-0 !px-3 !text-[12px]">{dt('Pastro kërkimin')}</button>}
            </div>
          </div>
        }
      />

      {/* Emergency */}
      <section aria-labelledby="emergency-help" className="au-tile flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <span className="au-ico !bg-rose-500/12 !text-rose-600"><Phone className="h-[18px] w-[18px]" aria-hidden="true" /></span>
          <div>
            <h2 id="emergency-help" className="text-[15px] font-semibold">{dt('Rrezik i menjëhershëm?')}</h2>
            <p className="au-sub text-[13px]">{dt('Telefononi 112. Kjo qendër ndihme nuk zëvendëson shërbimet emergjente.')}</p>
          </div>
        </div>
        <a href="tel:112" className="au-btn !bg-rose-600 text-white">{dt('Telefono 112')}</a>
      </section>

      {/* Guides: one column list on the left, filters above. */}
      <AuraSection id="guides" title={dt('Artikujt')} action={<span className="au-sub text-[12px]" role="status">{results.length} {dt('artikuj')}</span>}>
        <div className="au-rail mb-3" role="group" aria-label={dt('Filtro sipas kategorisë')}>
          {['all', ...CATEGORIES].map(c => (
            <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)} className="au-chip">
              {c === 'all' ? dt('Të gjitha') : dt(c)}
            </button>
          ))}
        </div>

        {results.length === 0 ? (
          <AuraEmpty icon={Search} title={dt('Nuk u gjet asnjë artikull.')} text={dt('Provoni një fjalë tjetër ose na shkruani.')}
            action={<div className="flex gap-2"><button type="button" onClick={() => { setQuery(''); setCategory('all'); }} className="au-btn au-btn-soft">{dt('Pastro kërkimin')}</button><Link to="/kontakt" className="au-btn au-btn-primary">{dt('Na shkruani')}</Link></div>} />
        ) : (
          <div className="au-list">
            {results.map(a => {
              const open = openId === a.id || (!!query.trim() && results.length <= 3);
              return (
                <article key={a.id}>
                  <h3>
                    <button type="button" id={`help-btn-${a.id}`} aria-expanded={open} aria-controls={`help-panel-${a.id}`} onClick={() => setOpenId(openId === a.id ? null : a.id)}
                      className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left">
                      <span className="au-ico"><a.icon className="h-[18px] w-[18px]" aria-hidden="true" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="au-sub block text-[11px] font-semibold uppercase tracking-wide">{dt(a.category)}</span>
                        <span className="block text-[15px] font-medium">{dt(a.title)}</span>
                      </span>
                      <ChevronDown className={cn('h-4 w-4 shrink-0 opacity-50 transition-transform', open && 'rotate-180')} aria-hidden="true" />
                    </button>
                  </h3>
                  {open && (
                    <div id={`help-panel-${a.id}`} role="region" aria-labelledby={`help-btn-${a.id}`} className="space-y-3 px-4 pb-4 pl-[3.75rem] text-[14px] leading-relaxed">
                      {a.steps && (
                        <ol className="space-y-2">
                          {a.steps.map((st, n) => (
                            <li key={st} className="flex gap-2.5"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--au-accent-soft)] text-[11px] font-semibold text-[var(--au-accent)]">{n + 1}</span><span>{dt(st)}</span></li>
                          ))}
                        </ol>
                      )}
                      {a.body && <p className="au-sub">{dt(a.body)}</p>}
                      {a.link && <Link to={a.link.to} className="inline-flex items-center gap-1 text-[14px] font-semibold text-[var(--au-accent)]">{dt(a.link.label)} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </AuraSection>

      {/* Status: a six-step track and two exceptions */}
      <AuraSection id="status-help" kicker={dt('Track-ID')} title={dt('Çfarë do të thotë statusi i raportit?')}>
        <div className="au-tile p-4 sm:p-5">
          <p className="au-sub mb-4 text-[13px]">{dt('Këto janë statuset e vërteta që përdor platforma te Track-ID.')}</p>
          <div className="au-rail" role="tablist" aria-label={dt('Statuset')}>
            {PIPELINE.map((code, i) => (
              <button key={code} role="tab" type="button" aria-selected={activeStatus === code} onClick={() => setActiveStatus(code)} className="au-chip">
                <span className="au-count !opacity-70">{i + 1}</span>{statusLabelOf(code)}
              </button>
            ))}
          </div>
          <div className="mt-3 rounded-xl bg-[var(--au-card-2)] p-4" role="tabpanel" aria-live="polite">
            <p className="text-[15px] font-semibold">{statusLabelOf(activeStatus)}</p>
            <p className="au-sub mt-1 text-[14px] leading-relaxed">{dt(STATUS_HELP[activeStatus])}</p>
          </div>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            {SIDE.map(code => (
              <div key={code} className="rounded-xl bg-rose-500/10 px-4 py-3">
                <dt className="text-[13px] font-semibold text-rose-700 dark:text-rose-300">{statusLabelOf(code)}</dt>
                <dd className="mt-0.5 text-[13px] text-rose-700/80 dark:text-rose-200/80">{dt(STATUS_HELP[code])}</dd>
              </div>
            ))}
          </dl>
        </div>
      </AuraSection>

      <section aria-labelledby="gaps">
        <AuraNote tone="warn" icon={HelpCircle}>
          <p id="gaps" className="font-semibold">{dt('Çfarë nuk dimë ende të përgjigjemi')}</p>
          <p className="mt-0.5 opacity-90">{dt('Këto përgjigje nuk janë të konfirmuara dhe nuk do t’i shpiktim. Do të shtohen kur të kemi burim zyrtar:')}</p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4">{GAPS.map(g => <li key={g}>{dt(g)}</li>)}</ul>
        </AuraNote>
      </section>

      <nav aria-label={dt('Hyrje të shpejta')} className="grid gap-2.5 sm:grid-cols-3">
        {[
          { to: '/raporto', icon: FileText, label: 'Raporto problem' },
          { to: '/trackid', icon: Search, label: 'Gjurmo raportin' },
          { to: '/harta', icon: MapPin, label: 'Shiko hartën' },
        ].map(({ to, icon: Icon, label }) => (
          <Link key={to} to={to} className="au-tile au-tile-link flex items-center gap-3 p-3.5">
            <span className="au-ico"><Icon className="h-[18px] w-[18px]" aria-hidden="true" /></span>
            <span className="flex-1 text-[14px] font-medium">{dt(label)}</span>
            <ArrowRight className="h-4 w-4 opacity-40" aria-hidden="true" />
          </Link>
        ))}
      </nav>
      <p className="au-sub text-center text-[13px]">{dt('Nuk e gjetët përgjigjen?')} <Link to="/kontakt" className="font-semibold text-[var(--au-accent)]">{dt('Na shkruani')}</Link></p>
    </AuraPage>
  );
}
