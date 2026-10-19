import { claim, d, entry, l } from './helpers';
import type { HeritageEntry } from '../types';

const A = 'uck' as const;

/* ── 04 Ngjarje dhe vende (dosje) ─────────────────────────────────────── */
const events: HeritageEntry[] = [
  entry({
    id: 'ev-llapushnik', area: A, section: 'events', kind: 'event', era: 'war', order: 1,
    date: d('1998-05', 'range', { to: '1998-07', display: l('Maj – korrik 1998', 'May – July 1998') }),
    place: { name: 'Llapushnik', municipality: 'Drenas' },
    title: l('Llapushniku: kampi i UÇK-së dhe vendimi i ICTY-së', 'Llapushnik: the KLA camp and the ICTY judgment'),
    summary: l('ICTY konstatoi se UÇK-ja ka mbajtur një kamp të paligjshëm paraburgimi në Llapushnik në verën e 1998.', 'The ICTY found that the KLA ran an unlawful detention camp at Llapushnik in summer 1998.'),
    body: l(
      `Në çështjen Limaj et al. (2005), Gjykata konstatoi se UÇK-ja ka administruar një kamp paraburgimi në Llapushnik, ku u mbajtën, u keqtrajtuan dhe në disa raste u vranë civilë, kryesisht serbë dhe shqiptarë të akuzuar për bashkëpunim.

Vendimi është i rëndësishëm për ndershmërinë e historisë: ai tregon se krimet nuk i përkasin vetëm njërës palë. Njëkohësisht, nga tre të akuzuarit, Fatmir Limaj dhe Isak Musliu u liruan nga akuzat, ndërsa Haradin Bala u shpall fajtor. Vendimi u konfirmua në apel në vitin 2007.`,
      `In the Limaj et al. case (2005), the Tribunal found that the KLA ran a detention camp at Llapushnik, where civilians — mostly Serbs and Albanians accused of collaboration — were held, mistreated and in some cases killed.

The judgment matters for the honesty of history: it shows that crimes are not the property of one side only. At the same time, of the three accused, Fatmir Limaj and Isak Musliu were acquitted, while Haradin Bala was found guilty. The judgment was upheld on appeal in 2007.`),
    evidence: 'court-finding', sourceIds: ['icty-limaj'], sensitive: 'graphic',
  }),
  entry({
    id: 'ev-haradinaj', area: A, section: 'events', kind: 'event', era: 'war', order: 2,
    date: d('2012-11-29', 'day'),
    title: l('Çështja Haradinaj et al.: pafajësi në rigjykim', 'The Haradinaj et al. case: acquittal on retrial'),
    summary: l('ICTY e shpalli Ramush Haradinajin të pafajshëm në vitin 2008; pas rigjykimit të pjesshëm, në nëntor 2012 të tre të akuzuarit u shpallën të pafajshëm.', 'The ICTY acquitted Ramush Haradinaj in 2008; after a partial retrial, in November 2012 all three accused were acquitted.'),
    body: l(
      `Çështja kishte të bënte me akuza për krime në zonën e Dukagjinit në 1998, përfshirë një kamp në Jabllanicë. Në gjykimin e parë (2008) Haradinaj dhe Balaj u shpallën të pafajshëm, ndërsa Brahimaj u dënua për dy pika akuze. Pas apelit dhe një rigjykimi të pjesshëm, Dhoma gjyqësore e shpalli Haradinajin, Idriz Balajn dhe Lahi Brahimajn të pafajshëm më 29 nëntor 2012.

Gjykata raportoi vështirësi serioze me dëshmitarët, përfshirë frikësimin. Kjo është një e dhënë historike dhe gjyqësore e vlefshme: mungesa e dënimit nuk është e njëjtë me mungesën e viktimave.`,
      `The case concerned charges for crimes in the Dukagjin area in 1998, including a camp at Jablanica. In the first trial (2008) Haradinaj and Balaj were acquitted, while Brahimaj was convicted on two counts. After an appeal and a partial retrial, the Trial Chamber acquitted Haradinaj, Idriz Balaj and Lahi Brahimaj on 29 November 2012.

The Tribunal reported serious difficulties with witnesses, including intimidation. This is a valuable historical and judicial fact: the absence of a conviction is not the same as the absence of victims.`),
    evidence: 'court-finding', sourceIds: ['icty-haradinaj'], sensitive: 'graphic',
  }),
  entry({
    id: 'ev-zllash', area: A, section: 'events', kind: 'event', era: 'war', order: 3,
    date: d('2022-12-16', 'day'),
    title: l('Dhomat e Specializuara: çështja Mustafa (Zllash)', 'The Specialist Chambers: the Mustafa case (Zllash)'),
    summary: l('Një gjykatë e specializuar me gjyqtarë ndërkombëtarë dënoi një komandant të UÇK-së për krime lufte të kryera në Zllash në prill 1999.', 'A specialised court with international judges convicted a KLA commander of war crimes committed at Zllash in April 1999.'),
    body: l(
      `Më 16 dhjetor 2022 Paneli gjyqësor i Dhomave të Specializuara të Kosovës e shpalli fajtor Salih Mustafën për ndalim arbitrar, trajtim mizor, tortura dhe vrasje në një vend paraburgimi në Zllash në prill 1999.

Dhomat vepronin në bazë të ligjit të Kosovës dhe të një amendamenti kushtetues. Për apelin dhe vendimin përfundimtar lexoni faqen zyrtare të Dhomave, sepse statusi i çështjes mund të ketë ndryshuar.`,
      `On 16 December 2022 the Trial Panel of the Kosovo Specialist Chambers convicted Salih Mustafa of arbitrary detention, cruel treatment, torture and murder at a detention site at Zllash in April 1999.

The Chambers operated under Kosovo law and a constitutional amendment. For the appeal and final decision read the Chambers’ official page, because the status of the case may have changed.`),
    evidence: 'court-finding', sourceIds: ['ksc'], sensitive: 'graphic',
    claims: [claim('mustafa-verdict', l('Verdikti i shkallës së parë: 16 dhjetor 2022', 'First-instance verdict: 16 December 2022'), 'court-finding', '2022-12-16', ['ksc'], l('Statusi i apelit duhet kontrolluar në faqen e Dhomave.', 'The status of the appeal must be checked on the Chambers’ page.'))],
  }),
  entry({
    id: 'ev-prekazi-memorial', area: A, section: 'events', kind: 'site', era: 'war', order: 4,
    place: { name: 'Prekaz', municipality: 'Skenderaj' },
    title: l('Prekazi: vendi i përkujtimit', 'Prekaz: the memorial site'),
    summary: l('Kompleksi memorial në Prekaz e ruan kujtesën e ngjarjeve të marsit 1998.', 'The memorial complex at Prekaz preserves the memory of the events of March 1998.'),
    body: l(`Prekazi është bërë vend përkujtimi publik. Për vizitorët, rregulli është respekti: është varrezë dhe kujtesë familjare. Orët e hapjes dhe rregullat e vizitës duhen marrë nga burimi zyrtar.`, `Prekaz has become a site of public commemoration. For visitors the rule is respect: it is a cemetery and a family memory. Opening hours and visiting rules should be taken from the official source.`),
    evidence: 'official-position', sourceIds: ['mcys'],
  }),
];

/* ── 05 Civilët ──────────────────────────────────────────────────────── */
const civilians: HeritageEntry[] = [
  entry({
    id: 'civ-viktimat', area: A, section: 'civilians', kind: 'article', era: 'war', order: 1, featured: true,
    date: d('1998-01-01', 'range', { to: '2000-12-31', display: l('1 janar 1998 – 31 dhjetor 2000', '1 January 1998 – 31 December 2000') }),
    title: l('Të vrarë dhe të zhdukur: çfarë dokumentohet', 'Killed and missing: what is documented'),
    summary: l('Libri i Kujtesës së Kosovës dokumenton më shumë se 13 mijë persona të vrarë ose të zhdukur midis 1998 dhe 2000.', 'The Kosovo Memory Book documents more than 13,000 persons killed or missing between 1998 and 2000.'),
    body: l(
      `Libri i Kujtesës është një bazë të dhënash e krijuar nga Qendra për të Drejtën Humanitare dhe Qendra për të Drejtën Humanitare Kosovë. Ai dokumenton viktima emërore, me të dhëna të verifikuara, pavarësisht përkatësisë etnike ose rolit të tyre.

Ky është një dokumentim, jo një regjistër përfundimtar: punimi vazhdon dhe numri mund të ndryshojë me zbulime të reja. Për pasqyrën sipas përkatësisë, civilëve dhe luftëtarëve, shihni bazën e të dhënave direkt.`,
      `The Memory Book is a database created by the Humanitarian Law Center and the Humanitarian Law Center Kosovo. It documents named victims, with verified data, regardless of their ethnicity or role.

It is documentation, not a final register: work continues and the number may change with new discoveries. For the breakdown by ethnicity, civilians and combatants, see the database directly.`),
    claims: [claim('memory-book-13535', l('13.535 persona të vrarë ose të zhdukur, 1 janar 1998 – 31 dhjetor 2000', '13,535 persons killed or missing, 1 January 1998 – 31 December 2000'), 'estimate', '2000-12-31', ['hlc-memory'], l('Rezultat dokumentimi i Librit të Kujtesës; jo shifër përfundimtare. Verifikoni numrin e fundit direkt në bazë.', 'A Memory Book documentation result; not a final figure. Verify the latest number directly in the database.'))],
    evidence: 'estimate', sourceIds: ['hlc-memory'], sensitive: 'graphic',
  }),
  entry({
    id: 'civ-zhvendosja', area: A, section: 'civilians', kind: 'article', era: 'war', order: 2,
    date: d('1999-03', 'range', { to: '1999-06', display: l('Mars – qershor 1999', 'March – June 1999') }),
    title: l('Zhvendosja e detyruar dhe refugjatët', 'Forced displacement and refugees'),
    summary: l('Në pranverën e vitit 1999 pjesa më e madhe e popullsisë shqiptare u zhvendos brenda ose jashtë Kosovës.', 'In spring 1999 most of the Albanian population was displaced inside or outside Kosovo.'),
    body: l(
      `UNHCR dhe organizata të tjera dokumentuan largimin e qindra mijëra shqiptarëve drejt Shqipërisë, Maqedonisë dhe Malit të Zi, ndërsa të tjerë u zhvendosën brenda Kosovës. GJPJL-ja vërtetoi se këto largime ishin pjesë e një fushate dëbimi dhe terrori.

Shumica u kthyen pas qershorit 1999. Në anën tjetër, mijëra serbë, romë dhe të tjerë u larguan pas hyrjes së KFOR-it; kjo është e dokumentuar në entitetin vijues.`,
      `UNHCR and other organisations documented the departure of hundreds of thousands of Albanians to Albania, Macedonia and Montenegro, while others were displaced inside Kosovo. The ICTY found that these departures were part of a campaign of deportation and terror.

Most returned after June 1999. On the other side, thousands of Serbs, Roma and others left after KFOR entered; this is documented in the following entry.`),
    claims: [claim('refugees-800k', l('Rreth 800.000 deri 850.000 persona u larguan nga Kosova në pranverën e vitit 1999', 'Around 800,000 to 850,000 persons left Kosovo in spring 1999'), 'estimate', '1999-06', ['unhcr-sowr'], l('Vlerësim i UNHCR-së; vlerësimet ndryshojnë sipas metodologjisë dhe periudhës.', 'A UNHCR estimate; estimates differ by method and period.'))],
    evidence: 'estimate', sourceIds: ['unhcr-sowr', 'icty-milutinovic'],
  }),
  entry({
    id: 'civ-te-gjitha-palet', area: A, section: 'civilians', kind: 'article', era: 'unmik', order: 3,
    date: d('1999-06', 'range', { to: '2004-03', display: l('1999 – 2004', '1999 – 2004') }),
    title: l('Civilët serbë, romë dhe të tjerë pas luftës', 'Serb, Roma and other civilians after the war'),
    summary: l('Pas qershorit 1999 dhe sërish në mars 2004 pati dhunë ndaj komuniteteve joshqiptare; ajo është e dokumentuar dhe e pranuar.', 'After June 1999 and again in March 2004 there was violence against non-Albanian communities; it is documented and acknowledged.'),
    body: l(
      `Raportet e Human Rights Watch dhe të OKB-së dokumentojnë vrasje, rrëmbime, djegie shtëpish dhe ndjekje të serbëve, romëve dhe komuniteteve të tjera pas qershorit 1999. Një pjesë e madhe e këtyre komuniteteve u larguan nga Kosova.

Në mars 2004 u përsërit dhunë e gjerë ndëretnike, me djegie shtëpish dhe kishash ortodokse. Ky arkiv i trajton këto fakte me të njëjtën standard burimi si çdo fakt tjetër: është detyrim ndaj të gjitha viktimave.`,
      `Reports by Human Rights Watch and the UN document killings, abductions, house burnings and persecution of Serbs, Roma and other communities after June 1999. A large part of these communities left Kosovo.

In March 2004 widespread inter-ethnic violence recurred, with house burnings and burning of Orthodox churches. This archive treats these facts with the same sourcing standard as any other: it is a duty to all victims.`),
    evidence: 'established', sourceIds: ['hrw-abuses-serbs-roma', 'un-sg-unmik'], sensitive: 'graphic',
  }),
  entry({
    id: 'civ-nato', area: A, section: 'civilians', kind: 'article', era: 'war', order: 4,
    date: d('1999-03-24', 'range', { to: '1999-06-10', display: l('24 mars – 10 qershor 1999', '24 March – 10 June 1999') }),
    title: l('Civilët e vrarë nga fushata e NATO-s', 'Civilians killed by the NATO campaign'),
    summary: l('HRW dokumentoi qindra civilë të vrarë në Jugosllavi nga sulmet e NATO-s; kjo është pjesë e pasqyrës së plotë.', 'HRW documented hundreds of civilians killed in Yugoslavia by NATO strikes; this is part of the full picture.'),
    body: l(`Raporti i Human Rights Watch “Civilian Deaths in the NATO Air Campaign” (2000) përllogariti rreth 500 civilë të vrarë në rreth 90 incidente në mbarë Jugosllavinë. Në Kosovë, shembuj përfshijnë Korisën. Çështja e përgjegjësisë dhe e ligjshmërisë së disa sulmeve mbetet objekt debati.`, `The Human Rights Watch report "Civilian Deaths in the NATO Air Campaign" (2000) counted about 500 civilians killed in about 90 incidents across Yugoslavia. In Kosovo, examples include Korisa. The question of responsibility and the lawfulness of certain strikes remains debated.`),
    claims: [claim('nato-civ', l('Rreth 500 civilë të vrarë në rreth 90 incidente në Jugosllavi (HRW)', 'About 500 civilians killed in about 90 incidents across Yugoslavia (HRW)'), 'estimate', '2000-02', ['hrw-nato-civ'], l('Vlerësim i një organizate; vlerësimet e tjera ndryshojnë. Shifra mbulon të gjithë Jugosllavinë, jo vetëm Kosovën.', 'An organisation’s estimate; other estimates differ. The figure covers all of Yugoslavia, not only Kosovo.'))],
    evidence: 'estimate', sourceIds: ['hrw-nato-civ'], sensitive: 'graphic',
  }),
  entry({
    id: 'civ-shkaterrimi', area: A, section: 'civilians', kind: 'article', era: 'war', order: 5,
    title: l('Shkatërrimi i shtëpive dhe i trashëgimisë kulturore', 'Destruction of homes and cultural heritage'),
    summary: l('Shtëpi, xhami, biblioteka dhe objekte kulturore u dëmtuan ose u shkatërruan; më vonë edhe kisha ortodokse u dëmtuan.', 'Homes, mosques, libraries and cultural sites were damaged or destroyed; later Orthodox churches were also damaged.'),
    body: l(`Gjatë luftës u dokumentua shkatërrimi i një numri të madh shtëpish dhe objektesh fetare e kulturore. Pas luftës, edhe monumente ortodokse u dëmtuan, veçanërisht në mars 2004. Shifrat e dëmeve dhe lista e plotë duhen marrë nga vlerësimet zyrtare të OKB-së dhe BE-së me datë.`, `During the war the destruction of a large number of homes and religious and cultural sites was documented. After the war Orthodox monuments were also damaged, especially in March 2004. Damage figures and the full list should be taken from official UN and EU assessments with a date.`),
    evidence: 'established', sourceIds: ['osce-asseen', 'unesco-kosovo', 'un-sg-unmik'], sensitive: 'none',
  }),
];

/* ── 06 Dhuna seksuale ──────────────────────────────────────────────── */
const sexual: HeritageEntry[] = [
  entry({
    id: 'sv-njohja', area: A, section: 'sexual-violence', kind: 'article', era: 'war', order: 1, featured: true, sensitive: 'sexual-violence',
    title: l('Dhuna seksuale gjatë luftës: njohja', 'Sexual violence during the war: recognition'),
    summary: l('Dhuna seksuale u përdor gjatë konfliktit; numri i saktë është i panjohur sepse shumë raste nuk u raportuan kurrë.', 'Sexual violence was used during the conflict; the exact number is unknown because many cases were never reported.'),
    body: l(
      `Human Rights Watch dhe organizata të tjera dokumentuan dhunë seksuale kundër grave dhe, më rrallë, burrave gjatë konfliktit, e kryer kryesisht nga forca serbe e jugosllave. Vendimet e ICTY-së i përmendin gjithashtu në konstatimet e tyre.

Numri i saktë nuk njihet: stigmatizimi, frika dhe mungesa e shërbimeve bënë që pjesa më e madhe e rasteve të mos raportoheshin. Vlerësimet e dokumentuara dhe numri i njohur zyrtarisht, secila shifër me burimin dhe kufizimet e saj, janë më sipër te seksioni “Akuzat ndaj Serbisë së Millosheviqit”. Ky arkiv nuk shfaq detajet e akteve. Fokusi është njohja, drejtësia dhe mbështetja.`,
      `Human Rights Watch and other organisations documented sexual violence against women and, less often, men during the conflict, committed mainly by Serbian and Yugoslav forces. ICTY judgments also mention it in their findings.

The exact number is not known: stigma, fear and lack of services meant that most cases were never reported. The documented estimates and the officially recognised number, each figure with its source and limits, are in the section above, “The case against Milošević’s Serbia”. This archive does not display the details of the acts. The focus is recognition, justice and support.`),
    evidence: 'established', sourceIds: ['hrw-rape', 'icty-milutinovic'],
  }),
  entry({
    id: 'sv-ligji-2014', area: A, section: 'sexual-violence', kind: 'article', era: 'state', order: 2, sensitive: 'none',
    date: d('2014', 'year'),
    title: l('Ligji i vitit 2014 dhe statusi i të mbijetuarve', 'The 2014 law and survivors’ status'),
    summary: l('Kosova e njohu ligjërisht statusin e viktimave civile të dhunës seksuale të luftës dhe nisi procesin e njohjes.', 'Kosovo legally recognised the status of civilian victims of sexual violence in war and started the recognition process.'),
    body: l(
      `Ligji nr. 04/L-172 (2014) ndryshoi ligjin mbi statusin e dëshmorëve, invalidëve dhe veteranëve për të përfshirë viktimat civile të dhunës seksuale të luftës. Një komision qeveritar u ngrit më vonë për të shqyrtuar kërkesat dhe për të dhënë njohje dhe mbështetje.

Procesi ka patur vështirësi: pritjet, privatësia dhe stigmatizimi. Disa të mbijetuara kanë folur publikisht me pëlqimin e tyre; ky arkiv nuk citon asnjë dëshmi pa pëlqim të dokumentuar.`,
      `Law No. 04/L-172 (2014) amended the law on the status of martyrs, invalids and veterans to include civilian victims of wartime sexual violence. A government commission was set up later to review applications and grant recognition and support.

The process has had difficulties: waiting, privacy and stigma. Some survivors have spoken publicly with their own consent; this archive quotes no testimony without documented consent.`),
    evidence: 'official-record', sourceIds: ['law-survivors-2014', 'kosovo-women-network'],
  }),
  entry({
    id: 'sv-mbeshtetja', area: A, section: 'sexual-violence', kind: 'institution', order: 3, sensitive: 'none',
    title: l('Ku mund të kërkohet mbështetje', 'Where to seek support'),
    summary: l('Organizata që ofrojnë këshillim, mbështetje psikologjike dhe ligjore për të mbijetuarit.', 'Organisations that offer counselling, psychological and legal support to survivors.'),
    body: l(
      `Organizata që punojnë me të mbijetuarit përfshijnë Medica Gjakova, Qendrën e Kosovës për Rehabilitimin e të Mbijetuarve të Torturës (KRCT) dhe Rrjetin e Grave të Kosovës.

Në rast rreziku të menjëhershëm telefononi **112**. Numrat e linjave të ndihmës dhe kontaktet aktuale nuk shfaqen këtu pa u verifikuar nga redaksia; ato shtohen nga CMS-i vetëm pasi të telefonohen dhe konfirmohen.

Çdo person që dëshiron të flasë për përvojën e tij ka të drejtë ta bëjë në mënyrë konfidenciale.`,
      `Organisations working with survivors include Medica Gjakova, the Kosovo Rehabilitation Centre for Torture Victims (KRCT) and the Kosovo Women’s Network.

In immediate danger call **112**. Helpline numbers and current contacts are not shown here until verified by the newsroom; they are added through the CMS only after being called and confirmed.

Anyone who wishes to talk about their experience has the right to do so confidentially.`),
    evidence: 'official-position', sourceIds: ['medica-gjakova', 'krct', 'kosovo-women-network'],
  }),
  entry({
    id: 'sv-etika', area: A, section: 'sexual-violence', kind: 'article', order: 4, sensitive: 'none',
    title: l('Si e trajtojmë këtë temë: rregullat e redaksisë', 'How we handle this topic: newsroom rules'),
    summary: l('Pa emra, pa foto, pa detaje grafike, pa dëshmi pa pëlqim.', 'No names, no photos, no graphic detail, no testimony without consent.'),
    body: l(
      `- Nuk botojmë emra, foto, vendndodhje ose detaje që mund të identifikojnë një të mbijetuar.
- Nuk botojmë përshkrime grafike të akteve.
- Dëshmitë botohen vetëm kur personi e ka kërkuar vetë dhe ka dhënë pëlqim të shkruar, dhe kurrë nga një person i tretë.
- Çdo botim përmban informacionin e mbështetjes.
- Redaktori ka të drejtë të refuzojë përmbajtjen që rrezikon dinjitetin.`,
      `- We do not publish names, photos, locations or details that could identify a survivor.
- We do not publish graphic descriptions of acts.
- Testimonies are published only when the person has asked for it and given written consent, and never by a third party.
- Every publication carries support information.
- The editor has the right to refuse content that endangers dignity.`),
    evidence: 'official-position', sourceIds: [],
  }),
];

/* ── 07 Të zhdukurit ───────────────────────────────────────────────── */
const missing: HeritageEntry[] = [
  entry({
    id: 'mis-situata', area: A, section: 'missing', kind: 'article', order: 1, featured: true,
    title: l('Të zhdukurit: një plagë që ende nuk mbyllet', 'The missing: a wound that is still open'),
    summary: l('Më shumë se një mijë e gjashtëqind persona ende konsiderohen të zhdukur, sipas ICRC-së.', 'More than sixteen hundred persons are still considered missing, according to the ICRC.'),
    body: l(
      `Familjet e të zhdukurve, shqiptare, serbe e të tjera, vazhdojnë të presin informacion për fatin e të afërmve të tyre. ICRC mban listën e personave të zhdukur dhe ndihmon në koordinimin e kërkimit.

Numri ndryshon me çdo identifikim të ri; ai duhet lexuar me datën e burimit. Për secilin rast të ri ose për ndihmë, kontaktoni ICRC-në ose Komisionin Qeveritar për Persona të Zhdukur.`,
      `Families of the missing, Albanian, Serb and others, continue to wait for information on the fate of their relatives. The ICRC keeps the list of missing persons and helps coordinate the search.

The number changes with every new identification; it should be read with the source’s date. For any new case or for help, contact the ICRC or the Government Commission on Missing Persons.`),
    claims: [claim('missing-1600', l('Rreth 1.600 persona ende konsiderohen të zhdukur', 'About 1,600 persons are still considered missing'), 'estimate', '2024', ['icrc-missing'], l('Të verifikohet me listën më të fundit të ICRC-së dhe të shënohet data e saktë.', 'To be verified against the ICRC’s latest list and the exact date noted.'))],
    evidence: 'estimate', sourceIds: ['icrc-missing'],
  }),
  entry({
    id: 'mis-varrezat', area: A, section: 'missing', kind: 'article', order: 2,
    title: l('Varrezat masive dhe transferimi i trupave', 'Mass graves and the transfer of bodies'),
    summary: l('ICTY konstatoi se trupa nga Kosova u transportuan në Serbi për t’u fshehur; ato u zbuluan më vonë në vende si Batajnica.', 'The ICTY found that bodies from Kosovo were transported to Serbia to be concealed; they were later discovered at sites such as Batajnica.'),
    body: l(`Në çështjen Đorđević, ICTY konstatoi se trupa të të vrarëve në Kosovë u transportuan në Serbi dhe u varrosën në vende të fshehta. Mbetje të tilla u gjetën që nga viti 2001, përfshirë pranë Batajnicës. Identifikimi vazhdon me ADN dhe kërkimin e vazhdueshëm.`, `In the Đorđević case, the ICTY found that bodies of those killed in Kosovo were transported to Serbia and buried at concealed sites. Such remains have been found since 2001, including near Batajnica. Identification continues with DNA and ongoing search.`),
    evidence: 'court-finding', sourceIds: ['icty-djordjevic', 'icrc-missing'], sensitive: 'graphic',
  }),
  entry({
    id: 'mis-grupi-punues', area: A, section: 'missing', kind: 'institution', order: 3,
    title: l('Grupi i Punës për Personat e Zhdukur', 'The Working Group on Missing Persons'),
    summary: l('Një mekanizëm i mbështetur nga ICRC-ja që bashkon Prishtinën dhe Beogradin për çështjen e të zhdukurve.', 'An ICRC-supported mechanism that brings Prishtina and Belgrade together on the question of the missing.'),
    body: l(`Grupi i Punës për Personat e Zhdukur bashkon përfaqësues nga Prishtina dhe Beogradi nën kryesimin e ICRC-së, me qëllim ndarjen e informacionit dhe zgjidhjen e rasteve. Përmbajtja e fundit e punës së tij shihet në raportet e ICRC-së.`, `The Working Group on Missing Persons brings together representatives from Prishtina and Belgrade under the chairmanship of the ICRC, for sharing information and resolving cases. The latest content of its work appears in ICRC reports.`),
    evidence: 'official-record', sourceIds: ['icrc-missing', 'dialogue-eu'],
  }),
];

/* ── 08 Ndërhyrja ndërkombëtare ───────────────────────────────────── */
const intervention: HeritageEntry[] = [
  entry({
    id: 'int-rambuje', area: A, section: 'intervention', kind: 'article', era: 'war', order: 1,
    date: d('1999-03-18', 'day'),
    title: l('Rambujeja dhe dështimi i diplomacisë', 'Rambouillet and the failure of diplomacy'),
    summary: l('Marrëveshja nuk u pranua nga delegacioni jugosllav; palët interpretojnë ndryshe arsyet.', 'The Yugoslav delegation did not accept the agreement; parties interpret the reasons differently.'),
    body: l(`Më 18 mars 1999 delegacioni shqiptar e nënshkroi Marrëveshjen e Përkohshme, ndërsa ajo jugosllave nuk e pranoi. Debati vazhdon mbi pjesën e Aneksit ushtarak dhe mbi vullnetin e palëve për kompromis.`, `On 18 March 1999 the Albanian delegation signed the Interim Agreement, while the Yugoslav one did not accept it. The debate continues over the military annex and the parties’ will to compromise.`),
    evidence: 'contested', sourceIds: ['rambouillet', 'kosovo-report'],
  }),
  entry({
    id: 'int-allied-force', area: A, section: 'intervention', kind: 'article', era: 'war', order: 2,
    date: d('1999-03-24', 'range', { to: '1999-06-10' }),
    title: l('Operation Allied Force dhe pyetja e ligjshmërisë', 'Operation Allied Force and the question of legality'),
    summary: l('Ndërhyrja nuk kishte autorizim të Këshillit të Sigurimit; statusi i saj ligjor dhe moral mbetet i debatuar.', 'The intervention had no Security Council authorisation; its legal and moral status remains debated.'),
    body: l(`Komisioni i Pavarur Ndërkombëtar për Kosovën e quajti ndërhyrjen “të paligjshme por legjitime”. Të tjerë e mbrojnë bazën e saj ligjore ose e kundërshtojnë. Ky arkiv i tregon të dyja pikëpamjet pa ia imponuar lexuesit një verdikt.`, `The Independent International Commission on Kosovo called the intervention "illegal but legitimate". Others defend its legal basis or oppose it. This archive presents both views without imposing a verdict on the reader.`),
    evidence: 'contested', sourceIds: ['kosovo-report', 'unscr-1244'],
  }),
  entry({
    id: 'int-1244', area: A, section: 'intervention', kind: 'document', era: 'unmik', order: 3,
    date: d('1999-06-10', 'day'), featured: true,
    title: l('Rezoluta 1244 dhe administrimi ndërkombëtar', 'Resolution 1244 and international administration'),
    summary: l('Rezoluta vendosi UNMIK-un dhe KFOR-in dhe e la statusin përfundimtar të hapur; e njëjta rezolutë ruan referencën ndaj sovranitetit të RFJ-së.', 'The resolution established UNMIK and KFOR and left the final status open; it also retains a reference to the sovereignty of the FRY.'),
    body: l(`Rezoluta 1244 (10 qershor 1999) krijoi administrimin e përkohshëm të OKB-së dhe autorizoi praninë ndërkombëtare të sigurisë (KFOR). Ajo përmban referencë ndaj sovranitetit dhe integritetit territorial të Republikës Federale të Jugosllavisë; prandaj shpesh citohet nga Serbia. Gjykata Ndërkombëtare e Drejtësisë në vitin 2010 konstatoi se shpallja e pavarësisë nuk e shkelte atë.`, `Resolution 1244 (10 June 1999) created the interim UN administration and authorised the international security presence (KFOR). It contains a reference to the sovereignty and territorial integrity of the Federal Republic of Yugoslavia, which is why it is often cited by Serbia. The International Court of Justice in 2010 found that the declaration of independence did not violate it.`),
    evidence: 'official-record', sourceIds: ['unscr-1244', 'icj-2010'],
  }),
];

/* ── 09 Drejtësia ───────────────────────────────────────────────────── */
const justice: HeritageEntry[] = [
  entry({
    id: 'jus-icty', area: A, section: 'justice', kind: 'article', era: 'unmik', order: 1, featured: true,
    date: d('2009-02-26', 'day'),
    title: l('ICTY: çfarë u vërtetua për Kosovën', 'The ICTY: what was established about Kosovo'),
    summary: l('Gjykata vërtetoi krime kundër njerëzimit të forcave serbe e jugosllave dhe gjykoi edhe raste që lidhen me UÇK-në.', 'The Tribunal established crimes against humanity by Serbian and Yugoslav forces and also tried cases involving the KLA.'),
    body: l(
      `Në çështjen Milutinović et al. (2009), Dhoma e Gjyqit i shpalli fajtorë pesë zyrtarë të lartë për krime kundër njerëzimit dhe shkelje të ligjeve të luftës, përfshirë dëbimin, zhvendosjen e detyruar, vrasjet dhe përndjekjen; Milan Milutinović u shpall i pafajshëm. Çështja Đorđević vërtetoi përgjegjësinë e një prej udhëheqësve të policisë. Vendimet e apelit (2014) duhen lexuar për rezultatin përfundimtar të secilit.

Në anën e UÇK-së: Limaj et al. (2005) – një i akuzuar i dënuar, dy të liruar; Haradinaj et al. (2008; rigjykimi 2012) – në fund të tre të akuzuarit u shpallën të pafajshëm. Slobodan Milošević vdiq para vendimit.

Këto janë konstatime gjyqësore, jo pikëpamje të redaksisë, dhe secili vendim ka historinë e vet të apelit.`,
      `In the Milutinović et al. case (2009), the Trial Chamber convicted five senior officials of crimes against humanity and violations of the laws of war, including deportation, forcible transfer, murder and persecution; Milan Milutinović was acquitted. The Đorđević case established the responsibility of one of the police leaders. Appeal decisions (2014) should be read for the final outcome of each.

On the KLA side: Limaj et al. (2005) — one accused convicted, two acquitted; Haradinaj et al. (2008; retrial 2012) — all three accused were acquitted in the end. Slobodan Milošević died before judgment.

These are judicial findings, not editorial opinions, and each decision has its own appeal history.`),
    evidence: 'court-finding', sourceIds: ['icty-milutinovic', 'icty-djordjevic', 'icty-limaj', 'icty-haradinaj', 'icty-milosevic'],
  }),
  entry({
    id: 'jus-ksc', area: A, section: 'justice', kind: 'institution', era: 'state', order: 2,
    date: d('2023-04-03', 'day'),
    title: l('Dhomat e Specializuara të Kosovës', 'The Kosovo Specialist Chambers'),
    summary: l('Gjykatë e specializuar me seli në Hagë, e krijuar për të gjykuar krime të pretenduara të kryera nga ish-luftëtarë të UÇK-së.', 'A specialised court seated in The Hague, created to try alleged crimes committed by former KLA fighters.'),
    body: l(
      `Dhomat e Specializuara dhe Zyra e Prokurorit të Specializuar u krijuan me ligj të Kosovës dhe amendament kushtetues në vitin 2015, me gjyqtarë dhe prokurorë ndërkombëtarë. Mandati i tyre mbulon krime të pretenduara nga janari 1998 deri në dhjetor 2000.

Në çështjen kundër Hashim Thaçit dhe tre ish-udhëheqësve të tjerë të UÇK-së, aktakuza përfshin krime kundër njerëzimit dhe krime lufte. Të akuzuarit kanë mohuar akuzat dhe gjyqi filloi më 3 prill 2023. Deri në vendimin përfundimtar vlen prezumimi i pafajësisë. Statusi i vendimit duhet lexuar në faqen e Dhomave me datë.`,
      `The Specialist Chambers and the Specialist Prosecutor’s Office were created by Kosovo law and a constitutional amendment in 2015, with international judges and prosecutors. Their mandate covers alleged crimes from January 1998 to December 2000.

In the case against Hashim Thaçi and three other former KLA leaders, the indictment includes crimes against humanity and war crimes. The accused have denied the charges and the trial began on 3 April 2023. Until a final judgment the presumption of innocence applies. The status of the decision should be read on the Chambers’ page with a date.`),
    evidence: 'allegation', sourceIds: ['ksc'],
    claims: [claim('thaci-trial', l('Gjyqi kundër Thaçit et al. filloi më 3 prill 2023', 'The trial against Thaçi et al. began on 3 April 2023'), 'official-record', '2023-04-03', ['ksc'], l('Statusi i vendimit përfundimtar nuk është verifikuar këtu; shih faqen e Dhomave.', 'The status of the final judgment is not verified here; see the Chambers’ page.'))],
  }),
  entry({
    id: 'jus-marty', area: A, section: 'justice', kind: 'article', era: 'state', order: 3,
    date: d('2010-12-12', 'day'),
    title: l('Raporti Marty (2010): pretendime, jo konstatime', 'The Marty report (2010): allegations, not findings'),
    summary: l('Një raport parlamentar i Këshillit të Evropës paraqiti pretendime për trafik organesh; ai nuk ishte vendim gjyqësor.', 'A Council of Europe parliamentary report presented allegations of organ trafficking; it was not a judicial decision.'),
    body: l(
      `Në dhjetor 2010 raportuesi Dick Marty paraqiti në Asamblenë Parlamentare të Këshillit të Evropës një raport me pretendime për trajtim çnjerëzor dhe trafik organesh të njerëzve gjatë dhe pas konfliktit. Raporti ishte politik dhe nuk përbën konstatim gjyqësor.

Në vijim, një Task Forcë Hetimore e BE-së shqyrtoi pretendimet, dhe Dhomat e Specializuara u krijuan për të gjykuar krime të pretenduara. Për secilin pretendim, vlen e njëjta rregull: derisa gjykata të vendosë, ai mbetet pretendim.`,
      `In December 2010 rapporteur Dick Marty presented to the Parliamentary Assembly of the Council of Europe a report containing allegations of inhuman treatment and organ trafficking of people during and after the conflict. The report was political and is not a judicial finding.

Subsequently an EU Special Investigative Task Force examined the allegations, and the Specialist Chambers were created to try alleged crimes. For each allegation the same rule applies: until a court decides, it remains an allegation.`),
    evidence: 'allegation', sourceIds: ['coe-marty', 'ksc'],
  }),
  entry({
    id: 'jus-eulex', area: A, section: 'justice', kind: 'institution', era: 'state', order: 4,
    title: l('Gjykimet në Kosovë dhe roli i EULEX-it', 'Trials in Kosovo and the role of EULEX'),
    summary: l('Gjykata të Kosovës, me gjyqtarë ndërkombëtarë gjatë një periudhe, shqyrtuan raste të krimeve të luftës.', 'Kosovo courts, with international judges during one period, examined war-crimes cases.'),
    body: l(`Gjykatat e Kosovës dhe misioni EULEX gjykuan raste të krimeve të luftës, me sukses të përzier. Vëzhguesit e pavarur kanë kritikuar numrin e kufizuar të dënimeve dhe vështirësitë me dëshmitarët. Raporti i detajuar duhet lexuar nga burimet e EULEX-it dhe OSBE-së.`, `Kosovo’s courts and the EULEX mission tried war-crimes cases, with mixed success. Independent observers have criticised the limited number of convictions and difficulties with witnesses. The detailed account should be read from EULEX and OSCE sources.`),
    evidence: 'established', sourceIds: ['eulex', 'osce-asseen'],
  }),
  entry({
    id: 'jus-trashegimia', area: A, section: 'justice', kind: 'article', era: 'state', order: 5,
    title: l('Trashëgimia: kujtesa, pajtimi dhe puna që mbetet', 'Legacy: memory, reconciliation and the work that remains'),
    summary: l('Kujtesa e luftës është e ndarë; pajtimi kërkon të vërtetën për të gjitha viktimat.', 'The memory of the war is divided; reconciliation needs the truth for all victims.'),
    body: l(`Kujtesa e luftës është e ndryshme për komunitete të ndryshme, dhe ndonjëherë e kundërt. Një trashëgimi e ndershme kërkon: dokumentim të të gjitha viktimave, drejtësi për krimet kushdo që i ka kryer, gjetjen e të zhdukurve, mbështetje për të mbijetuarit, dhe edukim që nuk i kthen viktimat në simbole.`, `The memory of the war differs between communities, and sometimes conflicts. An honest legacy requires: documenting all victims, justice for crimes whoever committed them, finding the missing, support for survivors, and education that does not turn victims into symbols.`),
    evidence: 'official-position', sourceIds: ['hlc-memory', 'kosovo-report'],
  }),
];

/* ── 10 Dokumente ───────────────────────────────────────────────────── */
const documents: HeritageEntry[] = [
  entry({
    id: 'doc-regjistri', area: A, section: 'documents', kind: 'document', order: 1, featured: true,
    title: l('Regjistri i dokumenteve parësore', 'Register of primary documents'),
    summary: l('Dokumentet kryesore me simbol ose referencë, që lexuesi t’i gjejë vetë.', 'The main documents with symbol or reference, so the reader can find them.'),
    body: l(
      `- **Rezoluta 1160** (31 mars 1998) — S/RES/1160 (1998)
- **Rezoluta 1199** (23 shtator 1998) — S/RES/1199 (1998)
- **Rezoluta 1203** (24 tetor 1998) — S/RES/1203 (1998)
- **Marrëveshja e Përkohshme e Rambujesë** (18 mars 1999) — S/1999/648
- **Marrëveshja ushtarako-teknike e Kumanovës** (9 qershor 1999)
- **Rezoluta 1244** (10 qershor 1999) — S/RES/1244 (1999)
- **Vendimet e ICTY** — Milutinović et al. (IT-05-87), Đorđević (IT-05-87/1), Limaj et al. (IT-03-66), Haradinaj et al. (IT-04-84)
- **Aktakuza e Dhomave të Specializuara** — shihni faqen e Dhomave

Çdo simbol i dokumentit duhet verifikuar në arkivin zyrtar përpara citimit akademik.`,
      `- **Resolution 1160** (31 March 1998) — S/RES/1160 (1998)
- **Resolution 1199** (23 September 1998) — S/RES/1199 (1998)
- **Resolution 1203** (24 October 1998) — S/RES/1203 (1998)
- **Rambouillet Interim Agreement** (18 March 1999) — S/1999/648
- **Kumanovo Military Technical Agreement** (9 June 1999)
- **Resolution 1244** (10 June 1999) — S/RES/1244 (1999)
- **ICTY judgments** — Milutinović et al. (IT-05-87), Đorđević (IT-05-87/1), Limaj et al. (IT-03-66), Haradinaj et al. (IT-04-84)
- **Specialist Chambers indictment** — see the Chambers’ page

Every document symbol should be verified in the official archive before academic citation.`),
    evidence: 'official-record', sourceIds: ['unscr-1160', 'unscr-1199', 'unscr-1203', 'rambouillet', 'kumanovo-mta', 'unscr-1244', 'icty-milutinovic', 'ksc'],
  }),
  entry({
    id: 'doc-arkivat', area: A, section: 'documents', kind: 'institution', order: 2,
    title: l('Arkiva ku mund të kërkohet', 'Archives where research can be done'),
    summary: l('Arkiva dhe baza të të dhënave publike për kërkuesit.', 'Public archives and databases for researchers.'),
    body: l(
      `- **Libri i Kujtesës së Kosovës** (HLC) — baza e të dhënave të viktimave.
- **Arkivi i ICTY** dhe baza e të dhënave të gjyqeve — transkripte, prova, vendime.
- **ICRC** — lista e personave të zhdukur.
- **Arkivat e OKB-së dhe të OSBE-së** — raportet e UNMIK-ut dhe të KVM-së.
- **Dhomat e Specializuara** — dokumentet e çështjeve.

Fotografitë e luftës nuk shfaqen këtu pa dokumentuar të drejtën e autorit dhe pëlqimin e personave të paraqitur. Shtohen përmes CMS-it me kredi, licencë dhe konfirmim privatësie.`,
      `- **Kosovo Memory Book** (HLC) — database of victims.
- **ICTY archive** and trial database — transcripts, exhibits, judgments.
- **ICRC** — list of missing persons.
- **UN and OSCE archives** — UNMIK and KVM reports.
- **Specialist Chambers** — case documents.

War photographs are not displayed here without documented copyright and the consent of the persons depicted. They are added through the CMS with credit, licence and privacy confirmation.`),
    evidence: 'official-record', sourceIds: ['hlc-memory', 'icrc-missing', 'osce-kvm', 'ksc'],
  }),
  entry({
    id: 'doc-standardet', area: A, section: 'documents', kind: 'article', order: 3,
    title: l('Standardet e provës të këtij arkivi', 'The evidence standards of this archive'),
    summary: l('Tetë statuse prove dhe rregulli i vetëm: asnjë shifër pa burim dhe datë.', 'Eight evidence statuses and one rule: no figure without source and date.'),
    body: l(
      `Çdo shënim ka status prove të dukshëm: fakt i dokumentuar, konstatim gjyqësor, dokument zyrtar, qëndrim zyrtar, vlerësim, dëshmi personale, interpretim i kontestuar ose pretendim. Pohimet sasiore deklarohen veçmas me burim dhe datën për të cilën vlejnë.

Asnjë emër viktime, citim ose dokument nuk shpiket. Nëse dikush gjen një gabim, ai korrigjohet publikisht dhe shënohet në historikun e shënimit.`,
      `Every entry has a visible evidence status: documented fact, judicial finding, official record, official position, estimate, personal testimony, contested interpretation or allegation. Quantitative claims are declared separately with a source and the date to which they apply.

No victim name, quotation or document is invented. If someone finds an error, it is corrected publicly and noted in the entry’s history.`),
    evidence: 'official-position', sourceIds: [],
  }),
];

export const UCK_PART2 = [...events, ...civilians, ...sexual, ...missing, ...intervention, ...justice, ...documents];
