import React, { useState } from 'react';
import { ArrowLeft, Brain, CheckCircle2, Lightbulb, Send, Sparkles, Target, Users, MapPinned, ArrowUpRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useStore } from '../lib/store';
import AdBanner from '../components/AdBanner';
import { PageHero, heroPrimaryClass } from '../components/layout/PageHero';


import { dt } from '@/src/lib/dt';
const ideaCategories = [
  'Shërbime për qytetarë',
  'Raportime dhe Track-ID',
  'Harta dhe transparencë',
  'Komuna dhe institucione',
  'Pjesëmarrje qytetare',
  'Teknologji dhe inteligjencë artificiale',
  'Tjetër'
];

export default function IdeaPage() {
  const navigate = useNavigate();
  const currentUser = useStore(state => state.currentUser);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(ideaCategories[0]);
  const [problem, setProblem] = useState('');
  const [solution, setSolution] = useState('');
  const [impact, setImpact] = useState('');
  const [audience, setAudience] = useState('Të gjithë qytetarët');
  const [scope, setScope] = useState('Të gjitha komunat');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ideaMaturity = [title, problem, solution, impact].filter(value => value.trim().length >= 10).length * 25;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (title.trim().length < 5 || problem.trim().length < 20 || solution.trim().length < 20) {
      toast.error('Plotësoni titullin dhe shpjegimet me më shumë detaje.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'platformIdeas'), {
        title: title.trim(),
        category,
        problem: problem.trim(),
        solution: solution.trim(),
        impact: impact.trim(),
        audience,
        scope,
        authorId: currentUser?.id || 'guest',
        authorName: currentUser?.name || 'Qytetar anonim',
        status: 'submitted',
        createdAt: serverTimestamp()
      });
      toast.success('Ideja juaj u dërgua për shqyrtim. Faleminderit!');
      setTitle('');
      setProblem('');
      setSolution('');
      setImpact('');
      setAudience('Të gjithë qytetarët');
      setScope('Të gjitha komunat');
    } catch (error) {
      console.error('Gabim gjatë ruajtjes së idesë:', error);
      toast.error('Ideja nuk u dërgua. Ju lutemi provoni përsëri.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f8fafc] dark:bg-[#070e1c] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-xs font-black text-slate-500 hover:text-blue-600 dark:text-slate-400">
          <ArrowLeft className="w-4 h-4" /> {dt('Kthehu te Shërbimet')}
        </button>

        <PageHero
          eyebrow={dt('Laboratori qytetar')}
          icon={Sparkles}
          title={dt('Idetë që e bëjnë Kosovën më të dëgjueshme.')}
          subtitle={dt('Laboratori i Ideve është hapësira ku qytetarët propozojnë funksione, shërbime dhe mënyra të reja për ta bërë Zërin Qytetarëve më të dobishëm për çdo komunë.')}
          actions={
            <a href="#idea-title" className={heroPrimaryClass}>
              <Lightbulb className="h-4 w-4 text-amber-500" aria-hidden="true" /> {dt('Propozo një ide')}
            </a>
          }
          stats={[
            { value: '38', label: dt('komuna ku mund të zbatohet ideja') },
            { value: '4', label: dt('hapa nga mendimi te ndryshimi') },
          ]}
        />

        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 dark:border-blue-900/50 dark:bg-blue-950/30"><div className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-300">{dt('01 / Vëzhgo')}</div><p className="mt-2 text-sm font-bold text-slate-800 dark:text-white">{dt('Nis nga një nevojë reale.')}</p></div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 dark:border-amber-900/50 dark:bg-amber-950/30"><div className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-300">02 / Krijo</div><p className="mt-2 text-sm font-bold text-slate-800 dark:text-white">{dt('Propozo një zgjidhje të thjeshtë.')}</p></div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 dark:border-emerald-900/50 dark:bg-emerald-950/30"><div className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-300">03 / Ndiko</div><p className="mt-2 text-sm font-bold text-slate-800 dark:text-white">{dt('Trego çfarë ndryshon.')}</p></div>
          <div className="rounded-2xl border border-violet-100 bg-violet-50 p-5 dark:border-violet-900/50 dark:bg-violet-950/30"><div className="text-[10px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-300">{dt('04 / Bashkëpuno')}</div><p className="mt-2 text-sm font-bold text-slate-800 dark:text-white">{dt('Ndërtoje bashkë me komunitetin.')}</p></div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50"><Target className="h-5 w-5" /></div>
            <h2 className="font-black text-slate-900 dark:text-white">{dt('Gjej mundësinë')}</h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{dt('Përshkruaj qartë çfarë mungon ose çfarë mund të funksionojë më mirë.')}</p>
          </article>
          <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50"><Users className="h-5 w-5" /></div>
            <h2 className="font-black text-slate-900 dark:text-white">{dt('Mendo për qytetarin')}</h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{dt('Trego kë do të ndihmojë ideja dhe si do të përdorej në jetën e përditshme.')}</p>
          </article>
          <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50"><MapPinned className="h-5 w-5" /></div>
            <h2 className="font-black text-slate-900 dark:text-white">{dt('Lidhe me komunën')}</h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{dt('Një ide lokale mund të bëhet zgjidhje për të gjitha 38 komunat e Kosovës.')}</p>
          </article>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[0.75fr_1.25fr]">
          <aside className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-slate-900">
            <div className="mb-5 flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white"><Brain className="h-5 w-5 text-blue-600" /> {dt('Si ta shkruani')}</h2><span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Brief</span></div>
            <div className="mt-5 space-y-4 text-sm text-slate-600 dark:text-slate-300">
              <p><strong className="text-slate-900 dark:text-white">1. Problemi:</strong> {dt('Çfarë nuk funksionon sot dhe kë prek?')}</p>
              <p><strong className="text-slate-900 dark:text-white">{dt('2. Zgjidhja:')}</strong> {dt('Çfarë do të ndërtonit ose ndryshonit?')}</p>
              <p><strong className="text-slate-900 dark:text-white">3. Ndikimi:</strong> {dt('Si do ta përmirësonte jetën e qytetarëve?')}</p>
            </div>
            <div className="mt-6 rounded-xl bg-blue-50 p-4 text-xs leading-relaxed text-blue-900 dark:bg-blue-950/50 dark:text-blue-100">{dt('Idetë shqyrtohen nga ekipi i platformës dhe mund të përdoren për planifikimin e moduleve të reja të Zërit Qytetarëve.')}</div>
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 dark:border-white/10"><div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300"><ArrowUpRight className="h-3.5 w-3.5 text-blue-600" /> {dt('Ide e qartë')}</div><div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300"><ArrowUpRight className="h-3.5 w-3.5 text-blue-600" /> {dt('Ndikim i matshëm')}</div></div>
          </aside>

          <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-slate-900 sm:p-8">
            <div className="mb-6 flex items-start justify-between gap-4"><div><h2 className="text-2xl font-black text-slate-900 dark:text-white">{dt('Ndërtoni idenë tuaj')}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{dt('Sa më i qartë shpjegimi, aq më e lehtë është ta vlerësojmë.')}</p></div><div className="min-w-[92px] text-right"><div className="text-lg font-black text-blue-600">{ideaMaturity}%</div><div className="text-[9px] font-black uppercase tracking-wider text-slate-400">pjekuria</div></div></div>
            <div className="mb-5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-emerald-500 transition-all duration-300" style={{ width: `${ideaMaturity}%` }} /></div>
            <div className="space-y-5">
              <div><label htmlFor="idea-title" className="mb-2 block text-xs font-black text-slate-700 dark:text-slate-200">{dt('Titulli i idesë')}</label><input id="idea-title" value={title} onChange={event => setTitle(event.target.value)} maxLength={120} placeholder={dt('P.sh. Njoftime automatike për ndryshimin e statusit')} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></div>
              <div><label htmlFor="idea-category" className="mb-2 block text-xs font-black text-slate-700 dark:text-slate-200">{dt('Fusha e idesë')}</label><select id="idea-category" value={category} onChange={event => setCategory(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white">{ideaCategories.map(item => <option key={item}>{item}</option>)}</select></div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div><label htmlFor="idea-audience" className="mb-2 block text-xs font-black text-slate-700 dark:text-slate-200">{dt('Kush përfiton?')}</label><select id="idea-audience" value={audience} onChange={event => setAudience(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option>{dt('Të gjithë qytetarët')}</option><option>{dt('Të rinjtë')}</option><option>Familjet</option><option>{dt('Bizneset lokale')}</option><option>{dt('Personat me aftësi të kufizuara')}</option></select></div><div><label htmlFor="idea-scope" className="mb-2 block text-xs font-black text-slate-700 dark:text-slate-200">Ku zbatohet?</label><select id="idea-scope" value={scope} onChange={event => setScope(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option>{dt('Të gjitha komunat')}</option><option>{dt('Komuna ime')}</option><option>{dt('Një lagje ose fshat')}</option><option>Nivel qendror</option></select></div></div>
              <div><label htmlFor="idea-problem" className="mb-2 block text-xs font-black text-slate-700 dark:text-slate-200">{dt('Problemi që duhet zgjidhur')}</label><textarea id="idea-problem" value={problem} onChange={event => setProblem(event.target.value)} rows={4} maxLength={1200} placeholder={dt('Përshkruani situatën dhe qytetarët që preken...')} className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></div>
              <div><label htmlFor="idea-solution" className="mb-2 block text-xs font-black text-slate-700 dark:text-slate-200">{dt('Zgjidhja që propozoni')}</label><textarea id="idea-solution" value={solution} onChange={event => setSolution(event.target.value)} rows={4} maxLength={1600} placeholder={dt('Shpjegoni si do të funksiononte ideja në praktikë...')} className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></div>
              <div><label htmlFor="idea-impact" className="mb-2 block text-xs font-black text-slate-700 dark:text-slate-200">{dt('Ndikimi i pritshëm')} <span className="font-normal text-slate-400">(opsionale)</span></label><textarea id="idea-impact" value={impact} onChange={event => setImpact(event.target.value)} rows={3} maxLength={1000} placeholder={dt('Kë do të ndihmonte dhe si do ta matnim suksesin?')} className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></div>
              <button type="submit" disabled={isSubmitting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-black text-white transition-colors hover:bg-blue-700 disabled:opacity-60"><Send className="h-4 w-4" /> {isSubmitting ? 'Duke dërguar...' : 'Dërgo idenë për shqyrtim'}</button>
              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> {dt('Idetë trajtohen me respekt dhe përdoren për përmirësimin e platformës.')}</div>
            </div>
          </form>
        </section>

        <div className="text-center"><Link to="/sherbimet" className="text-xs font-black text-blue-600 hover:text-blue-700">{dt('Kthehu te shërbimet e Zërit Qytetarëve')}</Link></div>
        <AdBanner position="banner" className="mx-auto" />
      </div>
    </main>
  );
}
