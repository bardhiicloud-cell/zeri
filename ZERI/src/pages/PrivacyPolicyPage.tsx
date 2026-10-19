import { dt } from '@/src/lib/dt';
import { AuraHero, AuraOrbit } from '../components/aura/Aura';
import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Scale, MapPin, Clock, Trash2, Building2, Mail, Eye, Cookie, AlertTriangle } from 'lucide-react';
import { CookiePreferencesButton } from '../components/CookieConsentBanner';

const SECTIONS = [
  { id: 'kontrolluesi', icon: Building2, label: 'Kontrolluesi i të dhënave' },
  { id: 'te-dhenat', icon: Eye, label: 'Çfarë të dhënash mblidhen' },
  { id: 'baza-ligjore', icon: Scale, label: 'Baza ligjore e përpunimit' },
  { id: 'lokacioni', icon: MapPin, label: 'Mbrojtja e të dhënave të lokacionit' },
  { id: 'kohezgjatja', icon: Clock, label: 'Koha e ruajtjes' },
  { id: 'te-drejtat', icon: Trash2, label: 'Të drejtat e qytetarëve' },
  { id: 'cookies', icon: Cookie, label: 'Politika e Cookies' },
  { id: 'kontakti', icon: Mail, label: 'Kontakti dhe institucioni mbikëqyrës' },
] as const;

export default function PrivacyPolicyPage() {
  return (
    <div className="page-shell w-full px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-8">
          <AuraHero tone="blue" eyebrow={dt('Ligji Nr. 06/L-082')} icon={ShieldCheck} visual={<AuraOrbit core={ShieldCheck} />}
            title={dt('Politika e Privatësisë')}
            subtitle={dt('Si mbledhim, përdorim, ruajmë dhe mbrojmë të dhënat tuaja personale në Platformën Zëri Qytetarëve, në përputhje me Ligjin për Mbrojtjen e të Dhënave Personale.')}
            aside={<p className="rounded-xl bg-white/10 px-3 py-2.5 text-[12px] leading-snug text-white/75">{dt('Versioni i fundit:')} 1.0 · {dt('Në fuqi nga:')} 01.01.2025</p>} />
        </div>

        <nav aria-label={dt('Përmbajtja e politikës')} className="luxury-card mb-8 rounded-[20px] p-3">
          <ul className="grid gap-1 sm:grid-cols-2">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-(--color-brand-primary) dark:text-slate-300 dark:hover:bg-slate-800/70"
                >
                  <section.icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{section.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-4">
          {/* 1. KONTROLLUESI */}
          <section id="kontrolluesi" className="luxury-card scroll-mt-20 rounded-[24px] p-5 sm:p-6">
            <h2 className="title-serif text-xl font-black tracking-tight">1. {dt('Kontrolluesi i të dhënave')}</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {dt('Kontrolluesi i të dhënave personale është Platforma Zëri Qytetarëve ("ZERI"), e cila zhvillohet dhe operohet nga Institucioni qendror i qeverisjes dixhitale të Republikës së Kosovës.')}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {dt('Kontaktuesi i brendshëm i mbrojtjes së të dhënave (Data Protection Officer) emërohet nga Kontrolluesi dhe koordinon zbatimin e këtij ligji brenda platformës. Adresa zytyre e kontaktit për çdo kërkesë të qytetarit gjendet në fund të këtij dokumenti.')}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {dt('Platforma funksionon si një kanal dixhital i qytetarëve ndaj institucioneve publike. Kontrolluesi nuk tregton të dhëna personale me qytetarë dhe nuk i përdor për qëllime të tjera, përveç atyre që përshkruhen në këtë politikë.')}
            </p>
          </section>

          {/* 2. TË DHËNAT E MBLEDHURA */}
          <section id="te-dhenat" className="luxury-card scroll-mt-20 rounded-[24px] p-5 sm:p-6">
            <h2 className="title-serif text-xl font-black tracking-tight">2. {dt('Çfarë të dhënash mblidhen')}</h2>
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="text-sm font-black text-(--color-brand-primary)">a) {dt('Të dhënat e llogarisë dhe profilit')}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {dt('Emri, adresa elektronike, numri i telefonit, fotografia e profilit dhe roli juaj në platformë. Kur postoni në Debatin Publik ose në Reels, ruajtemi edhe përmbajtja e mesazhit, kohët e botimit, reagimet dhe lidhjet tuaja me përmbajtjen. Mesazhet mund të postohen në mënyrë anonime, në të cilën rast nuk ruhet asnjë identifikues.')}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-black text-(--color-brand-primary)">b) {dt('Të dhënat e raporteve')}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {dt('Përmbajtja e raportimit, kategoria, niveli i urgjencës, adresa e incidentit dhe bashkëkoordinatat e përafërta të raportimit (deri në 2 shifra dhjetore, pra rreth 1,1 km), të nevojshme për të identifikuar komunën dhe kartën gjeografike. Raportet mund të postohen në mënyrë anonime.')}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-black text-(--color-brand-primary)">c) {dt('Të dhënat e lokacionit')}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {dt('Koordinatat tuaja gjeografike përdoren vetëm në kohën e identifikimit të komunës ose kur kontrolloni nëse ka probleme të pazgjidhura pranë jush (funksioni Njoftimet në Afërsi). Ato nuk ruhen në shërbimet tona: përdoren për një kërkesë të vetme geokodimi dhe pastaj hidhen tej. Nëse pranoni, ruhet vetëm emri i komunës.')}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-black text-(--color-brand-primary)">d) {dt('Mediat në Reels')}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {dt('Videot, fotografitë, audiosit dhe tekstet që ngarkoni janë pjesë e përmbajtjes publike të forumit. Ato shfaqen me emrin ose anonimisht sipas zgjedhjes suaj dhe mund të fshihen nga një moderator kur shkaktojnë dhunim të rregullave të platformës ose të ligjit.')}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-black text-(--color-brand-primary)">e) {dt('Të dhënat teknike')}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {dt('Adresa IP (e maskuar nëse lejohet analitika), tipi i shfletuesit dhe pajisja, dhe regjistri i aktivitetit. Këto përdoren vetëm për sigurinë, zbërthjen e gabimeve dhe matjen e përdorimit.')}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-black text-(--color-brand-primary)">f) {dt('Të dhënat shëndetësore')}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {dt('Regjistri shëndetësor është i veçantë. Të dhënat shëndetësore janë kategori e veçantë e të dhënave dhe përpunohen vetëm me pëlqim të veçantë, të shprehur, të qartë dhe të lirë. Regjistri është i mbyllur për qytetarët e tjerë dhe i dukshëm vetëm për administratorët e autorizuar të sistemit shëndetësor.')}
                </p>
              </div>
            </div>
          </section>

          {/* 3. BAZA LIGJORE */}
          <section id="baza-ligjore" className="luxury-card scroll-mt-20 rounded-[24px] p-5 sm:p-6">
            <h2 className="title-serif text-xl font-black tracking-tight">3. {dt('Baza ligjore e përpunimit')}</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {dt('Sipas Ligjit Nr. 06/L-082, Kontrolluesi i mbështet përpunimin e të dhënave tuaja personale në bazën e këtyre bazave ligjore:')}
            </p>
            <ul className="mt-4 space-y-3">
              <li className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-white/5 dark:bg-slate-800/40">
                <p className="text-sm font-black text-slate-800 dark:text-white">{dt('Pëlqimi juaj (Neni 9)')}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {dt('Baza kryesore për Cookies jo-esenciale, matjen analitike, gjurmimin e lokacionit, regjistrimin e përdoruesve dhe marketingun. Pëlqimi është specifik, i shprehur, i qartë, i lirë, mund të tërhiqet në çdo kohë dhe tërheqja e tij nuk prek të drejtat tuaja të tjera. Mungesa e pëlqimit nuk nënkupton pëlqim.')}
                </p>
              </li>
              <li className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-white/5 dark:bg-slate-800/40">
                <p className="text-sm font-black text-slate-800 dark:text-white">{dt('Interesi publik (Neni 6)')}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {dt('Baza për ruajtjen e raporteve të qytetarëve mbi probleme komune, si dhe e përkthimit të tyre te institucionet përgjegjëse, për qëllime të interesit publik. Kjo bazë nuk kërkon pëlqim, por nuk justifikon asnjë përpunim të tepërt të të dhënave.')}
                </p>
              </li>
              <li className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-white/5 dark:bg-slate-800/40">
                <p className="text-sm font-black text-slate-800 dark:text-white">{dt('Përpunimi i domosdoshëm (Neni 6)')}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {dt('Zbatohet për Cookies të domosdoshme, për ruajtjen e sesionit, për sigurimin e funksionimit të shërbimit dhe për kryerjen e një kontrate me ju (p.sh. kur raportoni një problem).')}
                </p>
              </li>
              <li className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-white/5 dark:bg-slate-800/40">
                <p className="text-sm font-black text-slate-800 dark:text-white">{dt('Interesi legjitim (Neni 7)')}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {dt('Zbatohet për masa të sigurisë që mbrojnë platformën dhe qytetarët, siç janë kufizimet e normave të kërkesave, parandalimi i abuzimit të sistemit dhe ruajtja e regjistrave të sigurisë. Këto masa janë proporcionalisht të domosdoshme dhe nuk prekin në thelb të drejtat tuaja.')}
                </p>
              </li>
              <li className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-white/5 dark:bg-slate-800/40">
                <p className="text-sm font-black text-slate-800 dark:text-white">{dt('Të dhënat shëndetësore (Neni 10)')}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {dt('Përpunohen vetëm me pëlqim të veçantë, të shprehur dhe të qartë nga subjekti i të dhënave, ose me bazën e interesit publik në shërbimet shëndetësore, sipas ligjit përkatës shëndetësor.')}
                </p>
              </li>
            </ul>
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
              <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-200">
                {dt('Lajm i mirë: përpunimi i raporteve të qytetarëve mbi probleme komune bazohet në interesin publik, ndaj nuk kërkohet pëlqim. Pëlqimi kërkohet vetëm për gjëra që janë plotësisht opsionale: Cookies, analitika, lokacioni dhe marketingu.')}
              </p>
            </div>
          </section>

          {/* 4. LOKACIONI */}
          <section id="lokacioni" className="luxury-card scroll-mt-20 rounded-[24px] p-5 sm:p-6">
            <h2 className="title-serif text-xl font-black tracking-tight">4. {dt('Mbrojtja e të dhënave të lokacionit')}</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {dt('Kjo është pjesa ku transparenca është më e rëndësishme, prandaj po e shpjegojmë hapat konkretë:')}
            </p>
            <ul className="mt-4 space-y-2.5">
              {[
                dt('Lejohet vetëm pas pëlqimit të qartë tuaj në panelin e privatësisë dhe pas lejes së shfletuesit. Pa të dyja, sistemi nuk kërkon fare vendndodhje.'),
                dt('Koordinatat përdoren për një kërkesë të vetme geokodimi që cakton emrin e komunës, pastaj hidhen menjëherë tej.'),
                dt('Në asnjë rast nuk ruhen koordinatet e sakta në serverin tonë ose në Firebase. Ruhet vetëm teksti i komunës.'),
                dt('Kur kontrolloni Njoftimet në Afërsi, përdoren koordinata të rrumbullakosura në rrjetin e anonimizimit rreth 1,1 km. Kjo mjafton për të gjetur një zonë me probleme, por është shumë më e paafte për të identifikuar një familje.'),
                dt('I gjithë funksioni i Njoftimeve në Afërsi ndalohet përderisa nuk ka pëlqim. Edhe pas pëlqimit, pyetja bëhet vetëm një herë në sesion.'),
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 5. KOHËZGJATJA */}
          <section id="kohezgjatja" className="luxury-card scroll-mt-20 rounded-[24px] p-5 sm:p-6">
            <h2 className="title-serif text-xl font-black tracking-tight">5. {dt('Kohëzgjatja e ruajtjes së të dhënave')}</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:border-white/5">
                    <th className="py-2.5 pr-3">{dt('Lloji i të dhënave')}</th>
                    <th className="py-2.5 pr-3">{dt('Koha e ruajtjes')}</th>
                    <th className="py-2.5">{dt('Arsyeja')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {[
                    [dt('Raportet e qytetarëve'), dt('Deri në 5 vjet pas mbylljes'), dt('Interesi publik dhe transparenca')],
                    [dt('Profili dhe të dhënat e llogarisë'), dt('Deri në 2 vjet pas mbylljes së llogarisë'), dt('Përkujtim i pjesëmarrjes')],
                    [dt('Mesazhet dhe Reels'), dt('Derisa ekzistojnë, ose 2 vjet pas fshirjes'), dt('Debat publik dhe moderimi')],
                    [dt('Të dhënat shëndetësore'), dt('5 vjet pas largimit të regjistrit'), dt('Kërkesa ligjore dhe shëndetësore')],
                    [dt('Pëlqimet për Cookies'), dt('12 muaj pas vendimit'), dt('Kërkesa e provueshmërisë së pëlqimit')],
                    [dt('Të dhënat analitike'), dt('14 muaj'), dt('Matja anonime e përdorimit')],
                    [dt('Regjistrat e sigurisë'), dt('6 muaj'), dt('Parandalimi i abuzimit')],
                  ].map((row) => (
                    <tr key={row[0]}>
                      <td className="py-3 pr-3 font-bold text-slate-800 dark:text-white">{row[0]}</td>
                      <td className="py-3 pr-3 text-slate-500 dark:text-slate-400">{row[1]}</td>
                      <td className="py-3 text-slate-500 dark:text-slate-400">{row[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {dt("Pas skadimit, të dhënat fshihen ose anonimizohen. Anonimizimi nënkupton heqjen e çdo mundësie për t'i lidhur më tej me një person të caktuar.")}
            </p>
          </section>

          {/* 6. TË DREJTAT */}
          <section id="te-drejtat" className="luxury-card scroll-mt-20 rounded-[24px] p-5 sm:p-6">
            <h2 className="title-serif text-xl font-black tracking-tight">6. {dt('Të drejtat tuaja si subjekt i të dhënave')}</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {dt("Sipas Ligjit Nr. 06/L-082, ju gjeni në posed të të drejtave të mëposhtme, të cilat mund t'i ushtroni në çdo kohë:")}
            </p>
            <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {[
                [Eye, dt('E drejta e informimit'), dt('Të njoftoheni nëse dhe si përpunohen të dhënat tuaja.')],
                [Trash2, dt('E drejta e fshirjes (harimit)'), dt('Të fshini llogarinë dhe të gjitha të dhënat tuaja nga Firebase dhe nga serverat tanë, brenda afatit ligjor.')],
                [ShieldCheck, dt('E drejta e korrigjimit'), dt('Të rregulloni çdo të dhënë të pasaktë ose të papërfunduar.')],
                [AlertTriangle, dt('E drejta e kundërshtimit'), dt('Të kundërshtoni përpunimin kur mendoni se nuk ka bazë ligjore.')],
                [Clock, dt('E drejta e kufizimit të përpunimit'), dt('Të kërkoni pezullim përkohësisht të përpunimit.')],
                [Scale, dt('E drejta e portabilitetit'), dt('Të merrni të dhënat tuaja në një format të lexueshëm.')],
              ].map(([Icon, title, description]) => {
                const ItemIcon = Icon as typeof Eye;
                return (
                  <li key={title as string} className="flex items-start gap-2.5 rounded-2xl border border-slate-100 p-3.5 dark:border-white/5">
                    <ItemIcon className="mt-0.5 h-4 w-4 shrink-0 text-(--color-brand-primary)" aria-hidden="true" />
                    <span>
                      <span className="block text-xs font-black text-slate-800 dark:text-white">{title as string}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">{description as string}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
              <p className="text-sm font-black text-blue-900 dark:text-blue-200">{dt('Si ta bëni kërkesën "të harrohem"?')}</p>
              <p className="mt-1 text-sm leading-relaxed text-blue-800/80 dark:text-blue-200/80">
                {dt("Hyni në panelin e profilit, zgjidhni \"Fshi llogarinë time\", ose dërgoni një kërkesë me email. Fshirja heq llogarinë, të dhënat e profilit, mesazhet, raportet dhe Reels-et tuaja, si nga databaza ashtu edhe nga skedarët e ruajtur. Për ruajtje të detyrueshme ligjore (si regjistrat e shëndetësorisë), ato anonimizohen në vend që të fshihen.")}
              </p>
              <Link
                to="/kontakt"
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-xs font-black text-white transition hover:brightness-110"
              >
                {dt('Dërgo kërkesë për privatësi')}
              </Link>
            </div>
          </section>

          {/* 7. COOKIES */}
          <section id="cookies" className="luxury-card scroll-mt-20 rounded-[24px] p-5 sm:p-6">
            <h2 className="title-serif text-xl font-black tracking-tight">7. {dt('Politika e Cookies')}</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {dt('Platforma përdor Cookies dhe teknologji të ngjashme. Ato ndahen në tri kategori, sipas ndarjes së detyrueshme nga ligji.')}
            </p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <p className="text-sm font-black text-emerald-900 dark:text-emerald-200">{dt('Cookies të domosdoshme (Esenciale)')}</p>
                <p className="mt-1 text-sm leading-relaxed text-emerald-800/80 dark:text-emerald-200/80">
                  {dt('Kërkohen për të mbajtur sesionin tuaj, hyrjen në llogari (Firebase Authentication), mbrojtjen nga sulmet dhe ruajtjen e gjuhës së zgjedhur. Nuk mund të çaktivizohen pa e bërë platformën të papërdorshme. Baza ligjore: përpunimi i domosdoshëm, pa pëlqim.')}
                </p>
              </div>
              <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
                <p className="text-sm font-black text-blue-900 dark:text-blue-200">{dt('Cookies analitike dhe statistikore')}</p>
                <p className="mt-1 text-sm leading-relaxed text-blue-800/80 dark:text-blue-200/80">
                  {dt('Google Analytics 4 mat vizitat dhe faqet e shfrytëzuara për të kuptuar si përdoret platforma. Aktivizohet vetëm pas pëlqimit tuaj. Edhe kur aktivizohet, IP-ja maskohet, Google Signals dhe sinjalizimet e personalizimit të reklamave mbeten të çaktivizuara, dhe ruajtja afat-shkurtër në shfletues është e ndaluar. Baza ligjore: pëlqimi juaj.')}
                </p>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 dark:border-rose-900/50 dark:bg-rose-950/20">
                <p className="text-sm font-black text-rose-900 dark:text-rose-200">{dt('Cookies të marketingut dhe reklamave')}</p>
                <p className="mt-1 text-sm leading-relaxed text-rose-800/80 dark:text-rose-200/80">
                  {dt('Sistemi i reklamave AdminAds mat performancën e faqeve të sponsorizuara nga komunat dhe institucionet. Aktivizohet vetëm pas pëlqimit tuaj, mund të çaktivizohet në çdo kohë dhe nuk lidhet me të dhënat shëndetësore ose me regjistrin e raporteve. Baza ligjore: pëlqimi juaj.')}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <CookiePreferencesButton />
              <Link to="/kushtet-e-perdorimit" className="text-xs font-bold text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400">
                {dt('Kushtet e Përdorimit')}
              </Link>
            </div>
          </section>

          {/* 8. KONTAKTI */}
          <section id="kontakti" className="luxury-card scroll-mt-20 rounded-[24px] p-5 sm:p-6">
            <h2 className="title-serif text-xl font-black tracking-tight">8. {dt('Kontakti dhe institucioni mbikëqyrës')}</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {dt("Për çdo pyetje, kërkesë ose ankesë në lidhje me mbrojtjen e të dhënave tuaja personale, mund t'i drejtoheni Kontrolluesit. Përjashtim nga kjo, nëse nuk merrni përgjigje të kënaqshme, keni të drejtën t'i drejtoheni Agjencisë për Informim dhe Privatësi (AIP), institucioni shtetëror i pavarur i mbikëqyrjes së mbrojtjes së të dhënave personale.")}
            </p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                <p className="text-sm font-black text-slate-800 dark:text-white">{dt('Kontrolluesi: Platforma ZERI')}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{dt('Email:')}{' '}
                  <a href="mailto:privatisi@zeriqytetare.republiks" className="font-bold text-blue-600 dark:text-blue-400">privatisi@zeriqytetare.republiks</a>
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                <p className="text-sm font-black text-slate-800 dark:text-white">{dt('Institucioni Mbikëqyrës: Agjencia për Informim dhe Privatësi (AIP)')}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  {dt("Agjencia për Informim dhe Privatësi është autoriteti shtetëror i pavarur, i ngarkuar me mbikëqyrjen e zbatimit të Ligjit Nr. 06/L-082 për Mbrojtjen e të Dhënave Personale në Kosovë. Nëse keni ndonjë ankesë që nuk trajtohet nga Kontrolluesi, mund t'i adresoni kësaj autoriteti.")}
                </p>
              </div>
            </div>
          </section>
        </div>

        <footer className="mt-8 text-center text-xs text-slate-400">
          <p>{dt('Kjo politikë u përditësua në përputhje me Ligjin Nr. 06/L-082 dhe GDPR-në e Bashkimit Europian.')}
          </p>
        </footer>
      </div>
    </div>
  );
}
