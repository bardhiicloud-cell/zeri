import { Link } from 'react-router-dom';
import { ArrowRight, Landmark, Megaphone, ShieldCheck, Siren, type LucideIcon } from 'lucide-react';
import '../styles/heritage.css';
import { usePageMeta } from '../lib/usePageMeta';
import { useHeritageLang } from '../lib/heritage/useLang';
import { BrandMark } from '../components/BrandLogo';
import { Crumbs } from '../components/heritage/Atoms';

interface Pillar {
  id: string; icon: LucideIcon; tint: string; to: string;
  kicker: { sq: string; en: string }; title: { sq: string; en: string }; lead: { sq: string; en: string };
  points: { sq: string; en: string }[]; cta: { sq: string; en: string };
}

const PILLARS: Pillar[] = [
  {
    id: 'raporto', icon: Siren, tint: '#2f6bff', to: '/raporto',
    kicker: { sq: 'Raporto', en: 'Report' }, title: { sq: 'Raporto çdo problem', en: 'Report any problem' },
    lead: { sq: 'Rrugë e prishur, mbeturina, ndriçim, ujë, korrupsion, shërbim i dobët — çdo gjë që prek jetën e qytetarit dhe duhet zgjidhur.', en: 'A broken road, rubbish, lighting, water, corruption, poor service — anything that touches a citizen’s life and needs fixing.' },
    points: [
      { sq: 'Përshkruaj problemin, shto foto dhe vendin në hartë.', en: 'Describe the problem, add photos and the place on the map.' },
      { sq: 'Merr një Track ID dhe ndiq statusin hap pas hapi.', en: 'Get a Track ID and follow the status step by step.' },
      { sq: 'Raporti shkon te institucioni përgjegjës; përgjigjja dhe afati janë publike.', en: 'The report goes to the responsible institution; the reply and the deadline are public.' },
    ],
    cta: { sq: 'Raporto tani', en: 'Report now' },
  },
  {
    id: 'zeri', icon: Megaphone, tint: '#0ea5a4', to: '/sondazhet',
    kicker: { sq: 'Zëri', en: 'Voice' }, title: { sq: 'Platforma e zërit të qytetarëve', en: 'The platform for citizens’ voice' },
    lead: { sq: 'Vendi ku njerëzit flasin, votojnë dhe propozojnë — dhe ku institucionet e shohin çfarë mendon vërtet populli.', en: 'The place where people speak, vote and propose — and where institutions see what the public really thinks.' },
    points: [
      { sq: 'Sondazhe dhe debate mbi çështjet e vendit dhe të komunës.', en: 'Polls and debates on national and municipal issues.' },
      { sq: 'Ide dhe propozime nga qytetarët, të dukshme për të gjithë.', en: 'Ideas and proposals from citizens, visible to everyone.' },
      { sq: 'Transparencë: statistika dhe të dhëna publike për punën e komunave.', en: 'Transparency: statistics and public data on how municipalities perform.' },
    ],
    cta: { sq: 'Hap sondazhet', en: 'Open the polls' },
  },
  {
    id: 'lajme', icon: ShieldCheck, tint: '#e11d48', to: '/lajme',
    kicker: { sq: 'Lajme', en: 'News' }, title: { sq: 'Antikorrupsion & antipropagandë', en: 'Anti-corruption & anti-propaganda' },
    lead: { sq: 'Lajme të kontrolluara për korrupsionin dhe për gënjeshtrat që synojnë ta çojnë popullin në rrugë të gabuar. Fakte me burim, jo zhurmë.', en: 'Checked news on corruption and on the lies meant to mislead the public. Facts with sources, not noise.' },
    points: [
      { sq: 'Ndjekim paratë publike, tenderët dhe vendimet e institucioneve.', en: 'We follow public money, tenders and institutional decisions.' },
      { sq: 'Çdo lajm për propagandën trajtohet me prova dhe burime të hapura.', en: 'Every news item on propaganda is handled with evidence and open sources.' },
      { sq: 'Ke një informacion? Dërgoje te redaksia me “Lajmëro”.', en: 'Have a tip? Send it to the newsroom with “Report news”.' },
    ],
    cta: { sq: 'Lexo lajmet', en: 'Read the news' },
  },
];

/** /zeri-qytetar — what Zëri i Qytetarëve does, in three cards. */
export default function ZeriQytetarPage() {
  const { lang } = useHeritageLang();
  const sq = lang === 'sq';
  usePageMeta(sq ? 'Zëri i Qytetarëve — çka bëjmë ne' : 'Citizens’ Voice — what we do', sq ? 'Raporto problemet, ngri zërin dhe lexo lajme kundër korrupsionit dhe propagandës.' : 'Report problems, raise your voice and read news against corruption and propaganda.');

  return (
    <div data-no-translate className="hx hx-page hx-state -mx-3 -my-3 sm:-mx-5 sm:-my-4 lg:-mx-8">
      <div className="mx-auto max-w-[1180px] space-y-12 px-4 pb-20 pt-4 sm:px-6 lg:px-8 lg:pt-6">
        <Crumbs items={[{ to: '/', label: sq ? 'Ballina' : 'Home' }, { label: sq ? 'Zëri i Qytetarëve' : 'Citizens’ Voice' }]} />

        <header className="mx-auto max-w-3xl space-y-4 pt-4 text-center">
          <BrandMark className="mx-auto h-20 w-20 sm:h-24 sm:w-24" />
          <p className="hx-eyebrow justify-center">{sq ? 'Republika e Kosovës' : 'Republic of Kosovo'}</p>
          <h1 className="hx-serif text-[clamp(2.4rem,7vw,4.6rem)] font-black leading-[0.98]" style={{ color: 'var(--hx-ink)' }}>Zëri i Qytetarëve</h1>
          <p className="hx-serif text-xl font-bold italic sm:text-2xl hx-brass">{sq ? 'Çka bëjmë ne' : 'What we do'}</p>
          <p className="hx-ink-2 mx-auto max-w-2xl text-base leading-relaxed">
            {sq ? 'Një platformë e vetme që e kthen çdo qytetar në zë: raporton, shpreh mendimin dhe lexon të vërtetën.' : 'One platform that turns every citizen into a voice: report, speak up and read the truth.'}
          </p>
        </header>

        <ul className="grid gap-5 lg:grid-cols-3">
          {PILLARS.map((p) => (
            <li key={p.id}>
              <Link to={p.to} className="hx-card group flex h-full flex-col gap-4 p-6 transition hover:-translate-y-1 hover:shadow-[0_24px_50px_-30px_rgba(11,21,49,.55)] sm:p-7" style={{ borderRadius: 26 }}>
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg" style={{ background: `linear-gradient(145deg, ${p.tint}, color-mix(in srgb, ${p.tint} 55%, #0b1531))` }} aria-hidden="true">
                  <p.icon className="h-7 w-7" />
                </span>
                <div className="space-y-1.5">
                  <p className="hx-eyebrow" style={{ color: p.tint }}>{p.kicker[lang]}</p>
                  <h2 className="hx-serif text-2xl font-black leading-tight" style={{ color: 'var(--hx-ink)' }}>{p.title[lang]}</h2>
                </div>
                <p className="hx-ink-2 text-sm leading-relaxed">{p.lead[lang]}</p>
                <ul className="hx-ink-2 flex-1 space-y-2 border-t pt-4 text-sm hx-rule">
                  {p.points.map((pt) => (
                    <li key={pt.sq} className="flex gap-2.5 leading-snug"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: p.tint }} aria-hidden="true" />{pt[lang]}</li>
                  ))}
                </ul>
                <span className="inline-flex items-center gap-1.5 pt-1 text-sm font-black" style={{ color: p.tint }}>{p.cta[lang]}<ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" /></span>
              </Link>
            </li>
          ))}
        </ul>

        <section className="hx-card flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8" style={{ borderRadius: 26 }}>
          <div className="flex items-start gap-4">
            <Landmark className="mt-1 h-7 w-7 shrink-0 hx-brass" aria-hidden="true" />
            <div>
              <h2 className="hx-serif text-xl font-black" style={{ color: 'var(--hx-ink)' }}>{sq ? 'Një vend, një zë' : 'One country, one voice'}</h2>
              <p className="hx-ink-2 mt-1 max-w-2xl text-sm leading-relaxed">{sq ? 'Sa më shumë qytetarë flasin, aq më pak hapësirë ka për harresën, korrupsionin dhe gënjeshtrën.' : 'The more citizens speak, the less room there is for neglect, corruption and lies.'}</p>
            </div>
          </div>
          <Link to="/raporto" className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-xl px-5 text-sm font-black" style={{ background: 'var(--hx-ink)', color: 'var(--hx-paper)' }}>{sq ? 'Fillo me një raport' : 'Start with a report'}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        </section>
      </div>
    </div>
  );
}
