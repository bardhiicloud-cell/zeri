import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, Users, Clock, Info } from 'lucide-react';
import { MunicipalityShield } from '../components/MunicipalityShield';
import { AuraPage, AuraHero, AuraStats, AuraSection, AuraOrbit } from '../components/aura/Aura';

import { dt } from '@/src/lib/dt';

/** About. Every claim describes what the product does today; none is a promise about timing or outcomes. */
export default function RrethProjektitPage() {
  const navigate = useNavigate();

  const steps = [
    { t: 'Raportimi', d: 'Qytetari përshkruan problemin, zgjedh kategorinë, shënon vendndodhjen në hartë dhe shton foto nëse ka.' },
    { t: 'Pranimi dhe shqyrtimi', d: 'Raporti ruhet dhe merr një Track-ID. Ekipi i platformës e shqyrton para se të bëhet publik.' },
    { t: 'Dërgimi te institucioni', d: 'Pasi aprovohet, raporti i caktohet institucionit përgjegjës sipas kategorisë.' },
    { t: 'Trajtimi', d: 'Institucioni e trajton problemin dhe statusi përditësohet te Track-ID.' },
    { t: 'Zgjidhja dhe mbyllja', d: 'Institucioni e shënon raportin si të zgjidhur dhe më vonë të mbyllur. Nëse jeni kyçur, merrni njoftim.' },
  ];
  const pillars = [
    { icon: Clock, t: 'Eliminimi i Burokracisë', d: 'Raportoni një problem të lagjes nga telefoni ose kompjuteri, me foto dhe vendndodhje, pa u paraqitur në sportel.' },
    { icon: Eye, t: 'Transparencë për raportet e aprovuara', d: 'Raportet e aprovuara shfaqen në regjistrin publik dhe në hartë, me status dhe historik veprimesh. Raportet në pritje, kontakti i qytetarit dhe shënimet e brendshme nuk publikohen.' },
    { icon: Users, t: 'Pjesëmarrje Qytetare', d: 'Sondazhet, komuniteti dhe laboratori i ideve i japin qytetarit hapësirë të shprehet. Platforma nuk garanton që një komunë ose institucion do t’i pranojë propozimet.' },
  ];

  return (
    <AuraPage>
      <AuraHero
        visual={<AuraOrbit core={Info} />}
        tone="violet"
        eyebrow={dt('Rreth Platformës Kombëtare')}
        icon={Info}
        title={<>{dt('Zëri i Qytetarëve')}</>}
        subtitle={dt('Platformë qytetare që bashkon qytetarët me 38 komunat e Kosovës për raportimin e problemeve, transparencën e raporteve të aprovuara dhe pjesëmarrjen në jetën publike lokale.')}
        actions={<>
          <button onClick={() => navigate('/raporto')} className="au-btn au-btn-light">{dt('Raporto një Problem')} <ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
          <button onClick={() => navigate('/komunat')} className="au-btn au-btn-glass">{dt('Eksploro 38 Komunat')}</button>
        </>}
        aside={<AuraStats items={[{ value: '38', label: dt('komuna në një platformë') }, { value: 'Track-ID', label: dt('kod unik për çdo raport të ruajtur') }]} />}
      />

      <AuraSection id="mission" kicker={dt('Misioni')} title={dt('Për Çka Është Ndërtuar Ky Projekt?')}>
        <div className="grid gap-2.5 md:grid-cols-3">
          {pillars.map(p => (
            <article key={p.t} className="au-tile p-4">
              <span className="au-ico"><p.icon className="h-[18px] w-[18px]" aria-hidden="true" /></span>
              <h3 className="mt-3 text-[15px] font-semibold">{dt(p.t)}</h3>
              <p className="au-sub mt-1 text-[13px] leading-relaxed">{dt(p.d)}</p>
            </article>
          ))}
        </div>
      </AuraSection>

      <AuraSection id="how" kicker={dt('Rrjedha')} title={dt('Si Funksionon Platforma (Qysh Tek)?')}>
        <p className="au-sub mb-3 text-[13px]">{dt('Nga momenti kur një qytetar vëren një problem deri te mbyllja e raportit:')}</p>
        <ol className="au-list">
          {steps.map((s, i) => (
            <li key={s.t} className="flex gap-3 px-4 py-3.5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--au-accent)] text-[12px] font-semibold text-white">{i + 1}</span>
              <div><h3 className="text-[15px] font-semibold">{dt(s.t)}</h3><p className="au-sub mt-0.5 text-[13px] leading-relaxed">{dt(s.d)}</p></div>
            </li>
          ))}
        </ol>
      </AuraSection>

      <AuraSection id="coverage" kicker={dt('Shtrirja Gjeografike')} title={dt('Raportimi është i hapur për të 38 komunat')}
        action={<Link to="/komunat" className="text-[13px] font-semibold text-[var(--au-accent)]">{dt('Shiko Listën e Komunave')} →</Link>}>
        <p className="au-sub mb-3 max-w-2xl text-[13px]">{dt('Mund të zgjidhni çdo komunë të Kosovës kur dërgoni një raport. Sa shpejt trajtohet varet nga institucioni përgjegjës.')}</p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {['Prishtinë', 'Prizren', 'Pejë', 'Gjilan', 'Ferizaj', 'Mitrovicë', 'Gjakovë', 'Podujevë'].map(muni => (
            <div key={muni} className="au-tile flex flex-col items-center p-2.5 text-center">
              <MunicipalityShield name={muni} size="sm" className="mb-1.5" />
              <span className="text-xs font-medium">{muni}</span>
            </div>
          ))}
        </div>
      </AuraSection>
    </AuraPage>
  );
}
