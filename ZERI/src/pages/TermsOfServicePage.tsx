import { BackLink } from '../components/BackLink';
import { dt } from '@/src/lib/dt';
import { AuraHero, AuraOrbit } from '../components/aura/Aura';
import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, Scale, ShieldCheck, UserCheck,
  AlertTriangle, Sparkles,
} from 'lucide-react';
import { usePageMeta } from '../lib/usePageMeta';
import { CookiePreferencesButton } from '../components/CookieConsentBanner';
import { cn } from '../lib/utils';

interface Clause {
  n: string;
  title: string;
  body: string[];
  /** Rendered as a distinct callout where a clause has operational weight. */
  note?: { tone: 'info' | 'warn'; text: string };
}

const CLAUSES: Clause[] = [
  {
    n: '1',
    title: 'Pranimi i kushteve dhe zbatueshmëria',
    body: [
      'Këto Kushte të Përdorimit ("Kushtet") rregullojnë qasimin në Platformën Zëri Qytetarëve ("Platforma"), të përfshira faqja e internetit, aplikacionet mobile, harta e raporteve, regjistri qytetar, forumi publik, sondazhet dhe çdo shërbim tjetër i lidhur ("Shërbimet").',
      'Përdorimi i Shërbimeve nga ana juaj përbën pranim të plotë të këtyre Kushteve. Nëse nuk pajtoheni, duhet të mos i përdorni Shërbimet. Përdorimi i vazhdueshëm pasi të njoftoheni për një ndryshim material do të konsiderohet si pranim i ri.',
      'Kushtet zbatohen ndaj çdo përdorues, pavarësisht nëse identifikoheni apo jo. Kur postoni në mënyrë anonime, Platforma nuk e di identitetin tuaj, por obligimet tuaja ligjore ndikohen njësoj.',
    ],
  },
  {
    n: '2',
    title: 'Qëllimi i Platformës dhe kufijtë e saj',
    body: [
      'Platforma shërben për: raportimin qytetar të problemeve publike; përcjelljen transparente të statusit dhe afateve të zgjidhjes; pjesëmarrjen në diskutime dhe konsultime; matjen e qëndrueshmërisë së shërbimeve komunale; dhe qasjen në informacione zyrtare të institucioneve.',
      'Platforma nuk zëvendëson kanalet zyrtare të emergjencës dhe nuk zëvendëson procedurat administrative të njëjtësisë, të regjistrimit apo të gjykatave.',
      'Të dhënat e shfaqura janë me natyrë vetëraportuese dhe mund të jenë të paplotësuara ose të pavërteta. Ato nuk janë akt konvendë dhe nuk zëvendësojnë verifikimin zyrtar të institucioneve përkatëse.',
    ],
    note: {
      tone: 'warn',
      text: 'Për çdo situatë me rrezik për jetën, thirrni menjëherë 112 ose 129. Platforma nuk ofron ndihmë të menjëhershme dhe nuk zëvendëson ekipet e shpëtimit.',
    },
  },
  {
    n: '3',
    title: 'Llogaria, kredencialet dhe përgjegjësia juaj',
    body: [
      'Disa Shërbime kërkojnë llogari. Jeni përgjegjës për ruajtjen e fjalëkalimit tuaj, për çdo veprim të kryer nëpërmjet llogarisë suaj, dhe për daljen në kohë kur përdorni një pajisje të pashoqëruar.',
      'Ndalohet: përdorimi i llogarisë së një personi tjetër; krijimi i llogarive mashtruese ose të shumëfishta për shmangjen e kufizimeve; tentativat për të anashkaluar moderatorët; ose krijimi i llogarisë në emër të një personi tjetër.',
      'Ju duhet të jeni të paktën 16 vjeç ose të keni autorizimin e kujdestarit ligjor. Kur regjistroheni, ju siguroni se të dhënat e dhëna janë të sakta dhe se keni të drejtën t\'i përdorni.',
      'Njoftoni menjëherë administratorin nëse dyshoni për përdorim të paautorizuar të llogarisë suaj. Pas verifikimit, Platforma mund të ndërprejë sesionet aktive.',
    ],
  },
  {
    n: '4',
    title: 'Përmbajtja juaj: raportet, diskutimet dhe median',
    body: [
      'Ju mbani të drejtat mbi materialin që ngarkoni. Duke e dërguar në Platformë, ju akordoni një licencë joekskluzive, globale, të pashkueshme dhe falas për ta ruajtur, përpunuar, shfaqur, përshtatur dhe shpërndarë materialin vetëm që të ofrojë Shërbimet.',
      'Raportet dhe diskutimet mund të shfaqen publikisht. Ju keni një opsion për të postuar në mënyrë anonime: në këtë rast autori nuk lidhet me emrin tuaj, por përgjegjësia juaj ligjore mbetet e njëjtë.',
      'Ndalohet publikimi i: akuza të pavërteta ose të qëllimshme të padrejëta; spam, reklama mashtruese ose phishing; kërcënime, ngacmime, përndjekje ose diskriminim; përmbajtje pornografike ose të dëmtimshme për fëmijë; të dhëna personale të një personi tjetër pa arsye të ligjshme; dhe çdo material që shkel të drejtat e autorit.',
      'Shmangni futjen në raporte të fjalëkalimeve, numra dokumentesh, të dhënash bankare ose të dhënash shëndetësore që nuk janë të nevojshme për kërkesën tuaj.',
    ],
  },
  {
    n: '5',
    title: 'Moderimi, pezullimi dhe ndërhyrjet ligjore',
    body: [
      'Platforma mund të fshehë, kufizojë ose heqë përmbajtje që shkel këto Kushte, me qëllim të mbrojtjes së qytetarëve dhe të institucioneve.',
      'Moderimi kryhet nga ekipi i dedikuar i moderimit, i mbështetur nga mjete të automatizuara që tregojnë ose nuk tregojnë statusin e tyre. Masa mund të shkojnë deri te: paralajmërim, heqje e përmbajtjes, kufizim i fushave të lejuara, ose pezullim i përkohshëm ose i përhershëm i llogarisë.',
      'Çdo masë e ndërmarrë përshkruhet me shkak dhe mund të rishikohen. Vendimet e moderimit mund të apelohen brenda 30 ditësh nëpërjet kanalit të kontaktit. Masat nuk prekin të drejtat tuaja për t\'i drejtuar Agjencisë për Informim dhe Privatësi.',
      'Nëse përmbajtja shkel të drejtat tuaja të autorit ose privatësinë, mund të kërkoni heqjen e saj. Ne do ta shqyrtojmë kërkesën brenda 30 ditësh.',
    ],
  },
  {
    n: '6',
    title: 'Të dhënat personale dhe privatësia',
    body: [
      'Përpunimi i të dhënave tuaja personale rregullohet në shkallë të veçantë nga Politika e Privatësisë, e cila përbën pjesë integrale të këtyre Kushteve. Ju lutemi lexojeni atë para se të vazhdoni.',
      'Bazat ligjore të përpunimit janë: pëlqimi juaj për Cookies analitike, marketingu dhe gjurmimin e lokacionit; interesi publik për trajtimin e raporteve të qytetarëve; dhe interesi legjitim për masat e sigurisë dhe parandalimin e abuzimit.',
      'Ju keni të drejtë të informimit, të korrigjimit, të fshirjes, të kufizimit të përpunimit, të kundërshtimit dhe të portabilitetit. Të drejtat ushtrohen duke kontaktuar privatisi@zeriqytetarve.com.',
      'Mund ta ndryshoni çdo herë vendimin tuaj për Cookies dhe gjurmim në panelin e privatësisë, pa asnjë penalizim. Nëse nuk pajtoheni, Platforma vazhdon të funksionojë, por funksionet e bazuara në pëlqim nuk do të aktivizohen.',
    ],
    note: {
      tone: 'info',
      text: 'Pëlqimi nuk është kusht për qasjen në Shërbimet. Refuzimi nuk sjell asnjë pasojë negative ndaj jush.',
    },
  },
  {
    n: '7',
    title: 'Sondazhet publike dhe proceset e konsultimit',
    body: [
      'Sondazhet organizohen nga Platforma ose nga institucionet partnere. Rezultatet shfaqen publikisht dhe janë joindividuale.',
      'Votimi është i kufizuar një herë për çdo sondazh për llogari dhe pajisje. Rregullat e transparencës së zgjedhjeve ndjekin standardet e ODIHR/OSCE për zgjedhjet elektronike.',
      'Konsultimet publike ndjekin afate të caktuara dhe të njoftuara. Pas mbylljes së afatit, kontributet nuk ndryshojnë më rezultatin.',
    ],
  },
  {
    n: '8',
    title: 'Disponueshmëria, ndryshimet e shërbimit dhe forca e madhe',
    body: [
      'Synojmë për disponueshmëri të lartë dhe përgjigje të shpejtë, por nuk garantojmë funksionim të pandërprerë. Shërbimet mund të ndërpriten për mirëmbajtje, përditësime, ose rreziqe që nuk janë nën kontrollin tonë.',
      'Ne mund të ndryshojmë, shtojmë ose heqim Shërbimet. Ndryshime materiale do të njoftohen me kohë nëpërmjet kanaleve zyrtare të Platformës.',
      'Përjashtimi i përgjegjësive: deri në masën e lejuar nga ligji, Platforma nuk përgjigjet për humbje të të dhënave, humbje të mundësive ekonomike, apo dëme që nuk janë rezultat i një akti të qëllimshëm ose neglizhencës sonë.',
      'Asnjë dispozitë e këtyre Kushteve nuk përjashton të drejtat që nuk mund të kufizohen sipas ligjit vendor në fuqi.',
    ],
  },
  {
    n: '9',
    title: 'Reklamat dhe përmbajtja e palëve të treta',
    body: [
      'Përmbajtja e sponsorizuar shënohet qartë me etiketën "Reklamë" ose ekuivalent. Numrat e kontaktit të institucioneve publike nuk sponsorizohen dhe nuk bien nën këto Kushte.',
      'Ne nuk garantojmë produktet, shërbimet ose përmbajtjen e faqeve të palëve të treta. Ndjekja e një lidhjeje të jashtme është përgjegjësi juaj e plotë dhe niset nën kushtet e atij faqeje.',
      'Materialet e sponsorizuara zgjidhen nga institucionet publike sipas kritereve transparente. Pagesat nuk ndikojnë në renditjen e raporteve, në moderimin e diskutimeve ose në rezultatet e sondazheve.',
    ],
  },
  {
    n: '10',
    title: 'Intelektualja, falënderimi dhe papërgjegjësia',
    body: [
      'Logotipa, kodi dhe materialet e dizajnit të Platformës i përkasinë Platformën dhe janë të mbrojtura nga e drejta e autorit dhe e pronësisë intelektuale.',
      'Përmbajtja që postoni mbetet jote. Ne nuk e përdorim për qëllime të tjera përveç atyre që janë të nevojshme për ofrimin e Shërbimeve, siç përshkruhet në këtë faqe dhe në Politikën e Privatësisë.',
      'YouTube, Google Maps dhe OpenStreetMap ofrojnë përmbajtje sipas licencave të tyre të veçanta, që zbatohen për përdorimin e tyre brenda Platformës.',
    ],
  },
  {
    n: '11',
    title: 'Ndryshimet e këtyre Kushteve',
    body: [
      'Këto Kushte mund të ndryshohen. Ndryshime materiale do të shpallet të paktën 15 ditë para hyrjes në fuqi, me njoftim të dukshëm në Platformë dhe, kur është e mundur, me email.',
      'Versioni i fundit gjithmonë i disponueshëm në këtë faqe, me datën e fundit të përditësimit. Vazhdimi i përdorimit pas hyrjes në fuqi të ndryshimeve do të konsiderohet si pranim.',
      'Ne do të ruajim një version të mëparshëm të Kushteve nëse keni kontakt të mbetur, për t\'ju ndihmuar të kuptoni ndryshimin.',
    ],
  },
  {
    n: '12',
    title: 'Kontakti dhe zgjidhja e mosmarrëveshjeve',
    body: [
      'Për pyetje, ankesë ose kërkesë në lidhje me këto Kushte: privatisi@zeriqytetarve.com. Për raportim të abuzimit: abuzim@zeriqytetarve.com.',
      'Shpresojmë ta zgjidhim çdo ankesë me bisedë. Nëse nuk arrijmë marrëveshje, ke të drejtë t\'i drejtohesh Agjencisë për Informim dhe Privatësi, ose të parashtrosh çështje te gjykata kompetente e Kosovës.',
      'Këto Kushte rregullohen sipas ligjit të Republikës së Kosovës, duke pasur parasysh dispozitat e detyrueshme mbi konsumin.',
    ],
  },
];

export default function TermsOfServicePage() {
  usePageMeta('Kushtet e Përdorimit');

  return (
    <div className="page-shell w-full px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-4xl">
        <BackLink to="/" label="Platforma" className="mb-8" />

        <div className="mb-6">
          <AuraHero tone="slate" eyebrow={dt('Dokument ligjor')} icon={Scale} visual={<AuraOrbit core={Scale} />}
            title={dt('Kushtet e Përdorimit')}
            subtitle={dt('Rregullat që përcaktojnë përdorimin e sigurt, të drejtë dhe transparent të platformës Zëri Qytetarëve.')}
            aside={<p className="rounded-xl bg-white/10 px-3 py-2.5 text-[12px] leading-snug text-white/75">{dt('Versioni 2.0 · Përditësuar më 19 shtator 2026 · Në fuqi nga 1 tetor 2026')}</p>} />
        </div>

        <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { icon: Scale, text: dt('Juridike dhe të detyrueshme'), tone: 'text-blue-600' },
            { icon: ShieldCheck, text: dt('Të lidhura me privatësinë'), tone: 'text-emerald-600' },
            { icon: UserCheck, text: dt('Të shkruara për qytetarët'), tone: 'text-amber-600' },
          ].map((item) => (
            <div
              key={item.text}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900"
            >
              <item.icon className={cn('h-5 w-5 shrink-0', item.tone)} aria-hidden="true" />
              <span className="text-xs font-bold">{item.text}</span>
            </div>
          ))}
        </div>

        <main className="luxury-card space-y-8 rounded-[26px] p-6 sm:p-10">
          <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-relaxed text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-100">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
            <p>{dt('Ju lutemi lexoni këto kushte me kujdes para se të raportoni, komentoni ose përdorni shërbimet e platformës.')}</p>
          </div>

          <nav aria-label={dt('Përmbajtja e kushteve')} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
              {dt('Përmbajtja')}
            </p>
            <ol className="grid gap-1 sm:grid-cols-2">
              {CLAUSES.map((clause) => (
                <li key={clause.n}>
                  <a
                    href={`#klauzola-${clause.n}`}
                    className="flex items-baseline gap-2 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800/70"
                  >
                    <span className="tabular-nums text-slate-400">{clause.n}.</span>
                    <span className="truncate">{clause.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {CLAUSES.map((clause) => (
            <section key={clause.n} id={`klauzola-${clause.n}`} className="scroll-mt-20 space-y-3">
              <h2 className="title-serif flex items-baseline gap-2.5 text-lg font-black tracking-tight text-slate-900 sm:text-xl dark:text-white">
                <span className="tabular-nums text-blue-600 dark:text-blue-400">{clause.n}.</span>
                {clause.title}
              </h2>

              {clause.body.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 40)}
                  className="text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-300"
                >
                  {paragraph}
                </p>
              ))}

              {clause.note && (
                <div
                  className={cn(
                    'flex items-start gap-2.5 rounded-2xl border p-4 text-xs leading-relaxed',
                    clause.note.tone === 'warn'
                      ? 'border-amber-200 bg-amber-50/80 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200'
                      : 'border-blue-200 bg-blue-50/70 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200'
                  )}
                >
                  {clause.note.tone === 'warn' ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                  <span>{clause.note.text}</span>
                </div>
              )}
            </section>
          ))}

          <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 pt-6 dark:border-white/5">
            <CookiePreferencesButton />
            <Link
              to="/privatesia"
              className="text-xs font-bold text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400"
            >
              {dt('Politika e Privatësisë')}
            </Link>
            <Link
              to="/kontakt"
              className="text-xs font-bold text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400"
            >
              {dt('Kontakto')}
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
