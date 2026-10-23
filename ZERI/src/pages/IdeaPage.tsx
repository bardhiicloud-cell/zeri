import { BackLink } from '../components/BackLink';
import React, { useState } from 'react';
import { ArrowDown, CheckCircle2, Lightbulb, Send, Loader2, Target, Users, MapPinned } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { postPublic } from '../lib/publicSubmit';
import AdBanner from '../components/AdBanner';
import { AuraPage, AuraHero, AuraNote, AuraOrbit } from '../components/aura/Aura';

import { dt } from '@/src/lib/dt';
import SubmissionOverlay from '../components/SubmissionOverlay';
const ideaCategories = [
  'Shërbime për qytetarë',
  'Raportime dhe Track-ID',
  'Harta dhe transparencë',
  'Komuna dhe institucione',
  'Pjesëmarrje qytetare',
  'Teknologji dhe inteligjencë artificiale',
  'Tjetër'
];

const field = 'w-full min-h-12 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-500/15 dark:border-white/10 dark:bg-white/5 dark:text-white';
const label = 'mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300';

export default function IdeaPage() {
  const navigate = useNavigate();
  const [sentReference, setSentReference] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(ideaCategories[0]);
  const [problem, setProblem] = useState('');
  const [solution, setSolution] = useState('');
  const [impact, setImpact] = useState('');
  const [audience, setAudience] = useState('Të gjithë qytetarët');
  const [scope, setScope] = useState('Të gjitha komunat');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const checks = [title.trim().length >= 5, problem.trim().length >= 20, solution.trim().length >= 20, impact.trim().length >= 10];
  const ideaMaturity = checks.filter(Boolean).length * 25;
  const R = 34;
  const C = 2 * Math.PI * R;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (!checks[0] || !checks[1] || !checks[2]) {
      toast.error('Plotësoni titullin dhe shpjegimet me më shumë detaje.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await postPublic('/api/v1/public/ideas', {
        title, category, problem, solution, impact, audience, scope,
      });
      if (!result.ok) {
        toast.error(result.error || 'Ideja nuk u dërgua. Ju lutemi provoni përsëri.');
        return;
      }
      setSentReference(result.reference);
      toast.success('Ideja juaj u ruajt. Faleminderit!');
      setTitle('');
      setProblem('');
      setSolution('');
      setImpact('');
      setAudience('Të gjithë qytetarët');
      setScope('Të gjitha komunat');
    } catch (error) {
      console.error('Gabim gjatë ruajtjes së idesë:', error);
      toast.error('Ideja nuk u dërgua. Teksti juaj është ruajtur në faqe; provoni përsëri.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { t: 'Vëzhgo', d: 'Nis nga një nevojë reale.', icon: Target },
    { t: 'Krijo', d: 'Propozo një zgjidhje të thjeshtë.', icon: Lightbulb },
    { t: 'Ndiko', d: 'Trego çfarë ndryshon.', icon: Users },
    { t: 'Dërgo', d: 'Ekipi i platformës e lexon.', icon: MapPinned },
  ];

  return (
    <>
      <SubmissionOverlay busy={isSubmitting} kind="idea" />
    <AuraPage>
      <BackLink to="/" label="Platforma" className="-mb-3 self-start" />

      <AuraHero
        visual={<AuraOrbit core={Lightbulb} />}
        tone="amber"
        eyebrow={dt('Laboratori qytetar')}
        icon={Lightbulb}
        title={dt('Idetë që e bëjnë Kosovën më të dëgjueshme.')}
        subtitle={dt('Laboratori i Ideve është hapësira ku qytetarët propozojnë funksione, shërbime dhe mënyra të reja për ta bërë Zërin Qytetarëve më të dobishëm për çdo komunë.')}
        actions={<a href="#idea-title" className="au-btn au-btn-light">{dt('Propozo një ide')} <ArrowDown className="h-4 w-4" aria-hidden="true" /></a>}
      />

      <ol className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" aria-label={dt('Si funksionon')}>
        {steps.map((s, i) => (
          <li key={s.t} className="au-tile flex items-center gap-3 p-3.5">
            <span className="au-ico"><s.icon className="h-[18px] w-[18px]" aria-hidden="true" /></span>
            <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide au-sub">0{i + 1}</p><p className="text-[14px] font-semibold leading-tight">{dt(s.t)}</p><p className="au-sub hidden text-[12px] leading-snug sm:block">{dt(s.d)}</p></div>
          </li>
        ))}
      </ol>

      <section className="grid gap-4 lg:grid-cols-[16rem_1fr] lg:gap-6">
        <aside className="space-y-3">
          <h2 className="text-[20px] font-semibold">{dt('Si ta shkruani')}</h2>
          <ol className="space-y-2.5 text-[13px]">
            <li><strong className="block text-[14px]">{dt('1. Problemi:')}</strong><span className="au-sub">{dt('Çfarë nuk funksionon sot dhe kë prek?')}</span></li>
            <li><strong className="block text-[14px]">{dt('2. Zgjidhja:')}</strong><span className="au-sub">{dt('Çfarë do të ndërtonit ose ndryshonit?')}</span></li>
            <li><strong className="block text-[14px]">3. Ndikimi:</strong><span className="au-sub">{dt('Si do ta përmirësonte jetën e qytetarëve?')}</span></li>
          </ol>
          <AuraNote>{dt('Idetë shqyrtohen nga ekipi i platformës dhe mund të përdoren për planifikimin e moduleve të reja të Zërit Qytetarëve.')}</AuraNote>
        </aside>

        <form onSubmit={handleSubmit} aria-busy={isSubmitting} className="au-tile space-y-4 p-4 sm:p-6">
          {sentReference && (
            <div role="status" className="flex items-start gap-3 rounded-xl bg-emerald-500/10 p-3.5 text-[13px] text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold">{dt('Ideja u ruajt. Referenca')}: <span className="font-mono">{sentReference}</span></p>
                <p className="mt-1 text-[12px] leading-relaxed opacity-90">{dt('Kjo nuk është raport zyrtar dhe nuk ka afat përgjigjeje. Ekipi i platformës i lexon idetë; nuk garantohet që ideja do të zbatohet. Për një problem në qytet përdorni “Raporto problem”.')}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-4">
            <svg viewBox="0 0 84 84" className="h-14 w-14 shrink-0 -rotate-90" role="img" aria-label={`${ideaMaturity}%`}>
              <circle cx="42" cy="42" r={R} fill="none" strokeWidth="9" className="stroke-black/10 dark:stroke-white/15" />
              <circle cx="42" cy="42" r={R} fill="none" strokeWidth="9" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C - (C * ideaMaturity) / 100} className="stroke-[var(--au-accent)] transition-[stroke-dashoffset] duration-500" />
            </svg>
            <div>
              <h2 className="text-[18px] font-semibold leading-tight">{dt('Ndërtoni idenë tuaj')}</h2>
              <p className="au-sub text-[13px]">{ideaMaturity}% · {dt('Sa më i qartë shpjegimi, aq më e lehtë është ta vlerësojmë.')}</p>
            </div>
          </div>

          <div><label htmlFor="idea-title" className="au-label">{dt('Titulli i idesë')}</label><input id="idea-title" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder={dt('P.sh. Njoftime automatike për ndryshimin e statusit')} className="au-input" /></div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><label htmlFor="idea-category" className="au-label">{dt('Fusha e idesë')}</label><select id="idea-category" value={category} onChange={e => setCategory(e.target.value)} className="au-input">{ideaCategories.map(item => <option key={item}>{item}</option>)}</select></div>
            <div><label htmlFor="idea-audience" className="au-label">{dt('Kush përfiton?')}</label><select id="idea-audience" value={audience} onChange={e => setAudience(e.target.value)} className="au-input"><option>{dt('Të gjithë qytetarët')}</option><option>{dt('Të rinjtë')}</option><option>Familjet</option><option>{dt('Bizneset lokale')}</option><option>{dt('Personat me aftësi të kufizuara')}</option></select></div>
            <div><label htmlFor="idea-scope" className="au-label">Ku zbatohet?</label><select id="idea-scope" value={scope} onChange={e => setScope(e.target.value)} className="au-input"><option>{dt('Të gjitha komunat')}</option><option>{dt('Komuna ime')}</option><option>{dt('Një lagje ose fshat')}</option><option>Nivel qendror</option></select></div>
          </div>
          <div><label htmlFor="idea-problem" className="au-label">{dt('Problemi që duhet zgjidhur')}</label><textarea id="idea-problem" value={problem} onChange={e => setProblem(e.target.value)} rows={3} maxLength={1200} placeholder={dt('Përshkruani situatën dhe qytetarët që preken...')} className="au-input" /></div>
          <div><label htmlFor="idea-solution" className="au-label">{dt('Zgjidhja që propozoni')}</label><textarea id="idea-solution" value={solution} onChange={e => setSolution(e.target.value)} rows={3} maxLength={1600} placeholder={dt('Shpjegoni si do të funksiononte ideja në praktikë...')} className="au-input" /></div>
          <div><label htmlFor="idea-impact" className="au-label">{dt('Ndikimi i pritshëm')} <span className="font-normal">(opsionale)</span></label><textarea id="idea-impact" value={impact} onChange={e => setImpact(e.target.value)} rows={2} maxLength={1000} placeholder={dt('Kë do të ndihmonte dhe si do ta matnim suksesin?')} className="au-input" /></div>
          <button type="submit" disabled={isSubmitting} className="au-btn au-btn-primary w-full !h-11">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
            {isSubmitting ? 'Duke dërguar...' : 'Dërgo idenë për shqyrtim'}
          </button>
          <p className="au-sub text-center text-[12px]">{dt('Idetë trajtohen me respekt dhe përdoren për përmirësimin e platformës.')}</p>
        </form>
      </section>

      <AdBanner position="banner" className="mx-auto" />
    </AuraPage>
    </>
  );
}
