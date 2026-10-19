import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, Building2, ChevronDown, FileText, HeartPulse, LifeBuoy,
  MessagesSquare, Phone, Search, ShieldCheck, Camera, UserRound, Wrench, HelpCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { MAX_UPLOAD_BYTES, formatBytes } from '../lib/firebase';
import { cn } from '../lib/utils';
import { AuraPage, AuraHero, AuraSection, AuraEmpty, AuraOrbit } from '../components/aura/Aura';

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
      `Te forma e raportit përdorni kutinë e ngarkimit. Mund të shtoni deri në 10 foto dhe 3 video (secila deri në 30 sekonda).`,
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
    id: 'forum', category: 'Shërbime dhe komuniteti', title: 'Si marr pjesë në sondazhe dhe ide?', icon: MessagesSquare,
    steps: [
      'Sondazhet publike hapen te “Sondazhet”.',
      'Ideja për përmirësimin e platformës dërgohet te “Laboratori i ideve” (nuk është raport zyrtar).',
    ],
    link: { to: '/sondazhet', label: 'Hap sondazhet' },
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

const norm = (s: string) => s.toLocaleLowerCase('sq-AL');

export default function CitizenHelpCenterPage() {
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>('submit');

  const results = useMemo(() => {
    const q = norm(query.trim());
    return ARTICLES.filter(a =>
      (!q || norm(`${a.title} ${a.body ?? ''} ${(a.steps ?? []).join(' ')}`).includes(q)));
  }, [query]);

  return (
    <AuraPage>
      {/* Hero with the search built in: the first thing a visitor can do is ask. */}
      <AuraHero
        visual={<AuraOrbit core={LifeBuoy} />}
        tone="violet"
        eyebrow={dt('Qendra e ndihmës')}
        icon={LifeBuoy}
        title={dt('Si mund t’ju ndihmojmë?')}
        subtitle={dt('Udhëzime të shkurtra për raportimin, gjurmimin dhe përdorimin e platformës. Kërkoni një temë.')}
        actions={
          <div className="w-full max-w-lg">
            <label htmlFor="help-search" className="sr-only">{dt('Kërko në ndihmë')}</label>
            <div className="flex items-center gap-2 rounded-full bg-white/95 pl-4 pr-1.5 text-slate-900 shadow-lg">
              <Search className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
              <input id="help-search" type="search" value={query} onChange={e => { setQuery(e.target.value); if (e.target.value) setOpenId(null); }}
                placeholder={dt('p.sh. Track-ID, foto, anonim')} className="h-11 w-full bg-transparent text-[15px] outline-none placeholder:text-slate-500" />
              {query && <button type="button" onClick={() => setQuery('')} className="au-btn au-btn-dark !h-8 shrink-0 !px-3 !text-[12px]">{dt('Pastro kërkimin')}</button>}
            </div>
            <button type="button" onClick={() => window.dispatchEvent(new Event('zeri:open-tour'))} className="mt-3 text-sm font-bold text-white underline underline-offset-4">
              {dt('Shfaq tutorialin hap pas hapi')}
            </button>
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
        {results.length === 0 ? (
          <AuraEmpty icon={Search} title={dt('Nuk u gjet asnjë artikull.')} text={dt('Provoni një fjalë tjetër ose na shkruani.')}
            action={<div className="flex gap-2"><button type="button" onClick={() => setQuery('')} className="au-btn au-btn-soft">{dt('Pastro kërkimin')}</button><Link to="/kontakt" className="au-btn au-btn-primary">{dt('Na shkruani')}</Link></div>} />
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
                      {a.link && <Link to={a.link.to} className="inline-flex min-h-10 items-center gap-1 text-[14px] font-semibold text-[var(--au-accent)]">{dt(a.link.label)} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </AuraSection>

      <p className="au-sub text-center text-[13px]">{dt('Nuk e gjetët përgjigjen?')} <Link to="/kontakt" className="font-semibold text-[var(--au-accent)]">{dt('Na shkruani')}</Link></p>
    </AuraPage>
  );
}
