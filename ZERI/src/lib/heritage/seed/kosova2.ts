import { claim, d, entry, l } from './helpers';
import type { HeritageEntry } from '../types';

/* ── III. UÇK-ja dhe lufta e Kosovës (hub → /historia-e-uck) ────────────── */
const lufta: HeritageEntry[] = [
  entry({
    id: 'lufta-permbledhje', area: 'kosova', section: 'lufta', kind: 'article', featured: true, order: 1,
    era: 'war', date: d('1998-02', 'range', { to: '1999-06', display: l('1998 – 1999', '1998 – 1999') }),
    title: l('Lufta e Kosovës: një përmbledhje e burimëzuar', 'The Kosovo war: a sourced overview'),
    summary: l('Konflikti i armatosur mes forcave serbe/jugosllave dhe UÇK-së, i ndërlidhur me një fushatë dhune ndaj civilëve dhe me ndërhyrjen e NATO-s.', 'The armed conflict between Serbian/Yugoslav forces and the KLA, linked to a campaign of violence against civilians and to NATO’s intervention.'),
    body: l(
      `Në vitet 1998–1999 Kosova ishte skenë e një konflikti të armatosur midis forcave serbe e jugosllave dhe Ushtrisë Çlirimtare të Kosovës. Më 24 mars 1999 NATO nisi fushatën ajrore që zgjati deri më 10 qershor, kur u miratua Rezoluta 1244 e OKB-së.

Gjykata ndërkombëtare (GJPJL) ka vërtetuar se forcat serbe e jugosllave kryen krime kundër njerëzimit, përfshirë dëbimin dhe vrasjen e civilëve shqiptarë. Dokumentimi i pavarur tregon edhe krime ndaj civilëve serbë, romë dhe shqiptarë të tjerë të kryera nga individë të lidhur me UÇK-në, sidomos pas qershorit 1999; çështjet gjyqësore për to vazhdojnë.

Kjo faqe është vetëm hyrja. Arkivi i plotë — kronologjia, ngjarjet, dokumentet, drejtësia — gjendet te **Historia e UÇK-së**.

[Hapni arkivin “Historia e UÇK-së”](/historia-e-uck)`,
      `In 1998–1999 Kosovo was the scene of an armed conflict between Serbian and Yugoslav forces and the Kosovo Liberation Army. On 24 March 1999 NATO began an air campaign that lasted until 10 June, when UN Security Council Resolution 1244 was adopted.

The international tribunal (ICTY) established that Serbian and Yugoslav forces committed crimes against humanity, including the deportation and killing of Albanian civilians. Independent documentation also shows crimes against Serb, Roma and other Albanian civilians committed by individuals linked to the KLA, especially after June 1999; court proceedings on these continue.

This page is only the entrance. The full archive — timeline, events, documents, justice — is in **The history of the KLA**.

[Open the “History of the KLA” archive](/historia-e-uck)`),
    evidence: 'court-finding', sourceIds: ['icty-milutinovic', 'icty-djordjevic', 'hrw-under-orders', 'hrw-abuses-serbs-roma', 'unscr-1244'], tags: ['lufta', '1999'],
  }),
  entry({
    id: 'si-te-lexohet-lufta', area: 'kosova', section: 'lufta', kind: 'article', order: 2,
    title: l('Si e lexojmë këtë periudhë: prova, jo thirrje', 'How we read this period: evidence, not slogans'),
    summary: l('Katër rregulla të redaksisë për çdo faqe që flet për luftën.', 'Four newsroom rules for every page that speaks about the war.'),
    body: l(
      `- **Çdo shifër ka burim dhe datë.** Numrat e viktimave ndryshojnë sipas metodologjisë; i tregojmë me shënimin “vlerësim” kur janë të tillë.
- **Pretendimi nuk është konstatim.** Një akuzë ose raport që nuk është vërtetuar gjyqësisht shënohet “pretendim” dhe vlen prezumimi i pafajësisë.
- **Krimet dokumentohen kushdo qoftë autori.** Viktima nuk ndahet sipas përkatësisë.
- **Dinjiteti i të mbijetuarve vjen i pari.** Nuk botojmë emra, foto ose detaje grafike pa pëlqim të qartë dhe të dokumentuar.`,
      `- **Every figure has a source and a date.** Victim numbers differ by method; we mark them "estimate" where they are.
- **An allegation is not a finding.** An accusation or report not judicially established is marked "allegation" and the presumption of innocence applies.
- **Crimes are documented regardless of the perpetrator.** A victim is not sorted by belonging.
- **Survivors’ dignity comes first.** We do not publish names, photos or graphic detail without clear, documented consent.`),
    evidence: 'official-position', sourceIds: [], tags: ['metodologji'],
  }),
];

/* ── IV. Pavarësia e Kosovës ────────────────────────────────────────────── */
const pavaresia: HeritageEntry[] = [
  entry({
    id: 'rruga-drejt-2008', area: 'kosova', section: 'pavaresia', kind: 'article', era: 'unmik', order: 1,
    date: d('2005', 'range', { to: '2007-12', display: l('2005 – 2007', '2005 – 2007') }),
    title: l('Rruga drejt 17 shkurtit 2008', 'The road to 17 February 2008'),
    summary: l('Negociatat e statusit, propozimi i Ahtisaarit dhe dështimi i bisedimeve të fundit.', 'The status negotiations, the Ahtisaari proposal and the failure of the last talks.'),
    body: l(
      `Në vitin 2005 OKB-ja nisi procesin e statusit dhe emëroi ish-presidentin finlandez Martti Ahtisaari si të dërguar të veçantë. Bisedimet në Vjenë mes Prishtinës dhe Beogradit nuk dhanë marrëveshje.

Në mars 2007 Ahtisaari paraqiti Propozimin gjithëpërfshirës, që parashikonte “pavarësi të mbikëqyrur” me mbrojtje të fortë për komunitetet. Serbia dhe Rusia e hodhën poshtë; Këshilli i Sigurimit nuk arriti të miratojë një rezolutë të re. Një rreth i fundit bisedimesh nën trojkën BE–SHBA–Rusi, deri në dhjetor 2007, nuk solli kompromis.`,
      `In 2005 the UN began the status process and appointed former Finnish president Martti Ahtisaari as special envoy. Talks in Vienna between Prishtina and Belgrade produced no agreement.

In March 2007 Ahtisaari presented the Comprehensive Proposal, envisaging "supervised independence" with strong protection for communities. Serbia and Russia rejected it; the Security Council failed to adopt a new resolution. A last round of talks under an EU–US–Russia troika, until December 2007, brought no compromise.`),
    evidence: 'established', sourceIds: ['ahtisaari', 'unscr-1244', 'kosovo-report'], tags: ['Ahtisaari', 'status'],
  }),
  entry({
    id: 'deklarata-17-shkurt', area: 'kosova', section: 'pavaresia', kind: 'event', era: 'state', order: 2, featured: true,
    date: d('2008-02-17', 'day'),
    title: l('Deklarata e Pavarësisë, 17 shkurt 2008', 'The Declaration of Independence, 17 February 2008'),
    summary: l('Kuvendi i Kosovës e shpalli Kosovën shtet të pavarur dhe sovran, duke pranuar detyrimet e Planit Ahtisaari.', 'The Assembly of Kosovo declared Kosovo an independent and sovereign state, accepting the obligations of the Ahtisaari Plan.'),
    body: l(
      `Më 17 shkurt 2008, në një seancë të veçantë në Prishtinë, Kuvendi i Kosovës miratoi Deklaratën e Pavarësisë. Dokumenti e përcakton Kosovën si republikë demokratike, laike dhe shumetnike dhe e lidh me detyrimet e Propozimit të Ahtisaarit. Është hartuar edhe në gjuhë të tjera, në mënyrë që të kuptohet ndërkombëtarisht.

Lexoni tekstin origjinal dhe procesverbalin e seancës në arkivin zyrtar të Kuvendit. Ky arkiv nuk e zëvendëson dokumentin; e shpjegon dhe e lidh me burimin.

Dokumenti origjinal i nënshkruar ruhet nga Kuvendi. Redaksia nuk e ka ende një kopje dixhitale të marrë nga burim zyrtar, andaj nuk e shfaq këtu; kur ta marrë nga Kuvendi me të drejtë publikimi, mund të shtohet përmes CMS-it me të gjitha të dhënat e të drejtave.`,
      `On 17 February 2008, in a special session in Prishtina, the Assembly of Kosovo adopted the Declaration of Independence. The document defines Kosovo as a democratic, secular and multi-ethnic republic and ties it to the obligations of the Ahtisaari Proposal. It was also drafted in other languages so it would be understood internationally.

Read the original text and the minutes of the session in the Assembly’s official archive. This archive does not replace the document; it explains it and links it to its source.

The signed original is kept by the Assembly. The newsroom does not hold a digital copy obtained from an official source, so it is not shown here; once obtained from the Assembly with the right to publish, it can be added through the CMS with all rights data.`),
    place: { name: 'Prishtinë', municipality: 'Prishtinë' }, evidence: 'official-record', sourceIds: ['declaration', 'assembly-record', 'ahtisaari'], tags: ['deklarata', '17 shkurt'],
    claims: [
      claim('attendance', l('109 nga 120 deputetët ishin të pranishëm dhe votuan për Deklaratën', '109 of the 120 deputies were present and voted for the Declaration'), 'official-record', '2008-02-17', ['assembly-record'], l('Deputetët e komunitetit serb nuk morën pjesë. Numri duhet verifikuar me procesverbalin e Kuvendit.', 'The Serb-community deputies did not take part. The number must be checked against the Assembly minutes.')),
    ],
  }),
  entry({
    id: 'nenshkruesit', area: 'kosova', section: 'pavaresia', kind: 'document', era: 'state', order: 3,
    date: d('2008-02-17', 'day'),
    title: l('Nënshkruesit e Deklaratës dhe procesverbali parlamentar', 'The signatories of the Declaration and the parliamentary record'),
    summary: l('Lista e saktë e nënshkruesve merret nga arkivi zyrtar i Kuvendit; ky shënim e mban vendin e saj deri në importimin e verifikuar.', 'The exact list of signatories is taken from the Assembly’s official archive; this entry holds its place until the verified import.'),
    body: l(
      `Deklarata u miratua nga deputetët e pranishëm në seancën e 17 shkurtit 2008. Në seancë morën pjesë Kryetari i Kuvendit, Kryeministri dhe Presidenti i Kosovës në atë kohë.

**Lista e emrave nuk është shkruar këtu nga kujtesa.** Ajo duhet të importohet nga procesverbali dhe dokumenti zyrtar i Kuvendit dhe të kontrollohet nga një redaktor i dytë. Në CMS ekziston një shënim i tipit “Dokument” ku futet lista, me referencën e arkivit.

Kjo është një zgjedhje e vetëdijshme: për një listë emrash historikë, një gabim është më i rëndë se një boshllëk i shënuar hapur.`,
      `The Declaration was adopted by the deputies present at the session of 17 February 2008. The session was attended by the Speaker of the Assembly, the Prime Minister and the President of Kosovo at the time.

**The list of names has not been written here from memory.** It must be imported from the Assembly’s official minutes and document and checked by a second editor. The CMS has a "Document" entry type where the list is entered, with the archive reference.

This is a deliberate choice: for a list of historical names, a mistake is worse than an openly marked gap.`),
    evidence: 'official-record', sourceIds: ['assembly-record', 'declaration'], tags: ['nënshkruesit', 'kuvendi'],
  }),
  entry({
    id: 'kushtetuta-2008', area: 'kosova', section: 'pavaresia', kind: 'event', era: 'state', order: 4,
    date: d('2008-06-15', 'day'),
    title: l('Kushtetuta e Republikës së Kosovës (në fuqi nga 15 qershori 2008)', 'The Constitution of the Republic of Kosovo (in force since 15 June 2008)'),
    summary: l('Miratuar në prill 2008, hyri në fuqi më 15 qershor 2008 dhe përcakton Kosovën si shtet laik, demokratik dhe shumetnik.', 'Adopted in April 2008, it entered into force on 15 June 2008 and defines Kosovo as a secular, democratic and multi-ethnic state.'),
    body: l(
      `Kushtetuta u miratua në prill 2008 dhe hyri në fuqi më 15 qershor 2008. Ajo garanton të drejtat e njeriut, ndan pushtetet, vendos një Gjykatë Kushtetuese dhe parashikon mbrojtje të veçantë për komunitetet jo-shumicë.

Neni 8 e përcakton shtetin si laik dhe neutral në çështjet e besimit fetar. Amendamentet e mëvonshme, përfshirë ato për Dhomat e Specializuara, duhet lexuar në Gazetën Zyrtare.`,
      `The Constitution was adopted in April 2008 and entered into force on 15 June 2008. It guarantees human rights, separates powers, establishes a Constitutional Court and provides special protection for non-majority communities.

Article 8 defines the state as secular and neutral in matters of religious belief. Later amendments, including those on the Specialist Chambers, should be read in the Official Gazette.`),
    evidence: 'official-record', sourceIds: ['constitution'], tags: ['kushtetuta', 'ndërtimi i shtetit'],
  }),
  entry({
    id: 'imf-wb-2009', area: 'kosova', section: 'pavaresia', kind: 'event', era: 'state', date: d('2009-06-29', 'day'),
    title: l('Anëtarësimi në FMN dhe Bankën Botërore', 'Membership of the IMF and the World Bank'),
    summary: l('Në qershor 2009 Kosova u bë anëtare e institucioneve financiare ndërkombëtare.', 'In June 2009 Kosovo became a member of the international financial institutions.'),
    body: l(`Anëtarësimi hapi qasjen në financim zhvillimor dhe në ndihmën teknike. Statusi i anëtarësimit duhet kontrolluar në burimet e institucioneve.`, `Membership opened access to development finance and technical assistance. Current membership status should be checked on the institutions’ own sources.`),
    evidence: 'official-record', sourceIds: ['worldbank-kosovo', 'mfa'], tags: ['FMN', 'Banka Botërore'],
  }),
  entry({
    id: 'gjnd-2010', area: 'kosova', section: 'pavaresia', kind: 'event', era: 'state', date: d('2010-07-22', 'day'), featured: true,
    title: l('Opinioni këshillimdhënës i Gjykatës Ndërkombëtare të Drejtësisë (2010)', 'The advisory opinion of the International Court of Justice (2010)'),
    summary: l('GJND konstatoi se shpallja e pavarësisë nuk shkelte të drejtën ndërkombëtare të përgjithshme dhe as Rezolutën 1244.', 'The ICJ found that the declaration of independence did not violate general international law or Resolution 1244.'),
    body: l(
      `Më 22 korrik 2010 Gjykata Ndërkombëtare e Drejtësisë, me 10 vota kundër 4, dha opinionin se miratimi i Deklaratës së Pavarësisë nuk shkeli të drejtën ndërkombëtare të përgjithshme, Rezolutën 1244 apo Kornizën Kushtetuese.

Është e rëndësishme të kuptohet çfarë NUK tha: opinioni nuk vendosi nëse Kosova ka fituar shtetësi dhe nuk e shqyrtoi çështjen e njohjes. Ai ishte opinion këshillimdhënës dhe jo vendim detyrues.`,
      `On 22 July 2010 the International Court of Justice, by 10 votes to 4, gave the opinion that adopting the Declaration of Independence did not violate general international law, Resolution 1244 or the Constitutional Framework.

It is important to understand what it did NOT say: the opinion did not decide whether Kosovo has achieved statehood and did not examine the question of recognition. It was an advisory opinion, not a binding judgment.`),
    evidence: 'court-finding', sourceIds: ['icj-2010'], tags: ['GJND', 'e drejta ndërkombëtare'],
  }),
  entry({
    id: 'ico-2012', area: 'kosova', section: 'pavaresia', kind: 'event', era: 'state', date: d('2012-09-10', 'day'),
    title: l('Fundi i pavarësisë së mbikëqyrur (shtator 2012)', 'The end of supervised independence (September 2012)'),
    summary: l('Grupi Drejtues Ndërkombëtar e shpalli përfundimin e mbikëqyrjes ndërkombëtare mbi zbatimin e Planit Ahtisaari.', 'The International Steering Group declared the end of international supervision of the Ahtisaari Plan’s implementation.'),
    body: l(`Në shtator 2012 u mbyll Zyra Civile Ndërkombëtare. Kjo shënoi kalimin nga një periudhë mbikëqyrjeje te një shtet pa mbikëqyrje formale, ndonëse prania e KFOR-it dhe e EULEX-it vazhdoi.`, `In September 2012 the International Civilian Office was closed. This marked the passage from a period of supervision to a state without formal supervision, although the presence of KFOR and EULEX continued.`),
    evidence: 'official-record', sourceIds: ['ahtisaari', 'eulex', 'nato-kfor'], tags: ['ICO', 'mbikëqyrja'],
  }),
  entry({
    id: 'dialogu-2013', area: 'kosova', section: 'pavaresia', kind: 'event', era: 'state', date: d('2013-04-19', 'day'),
    title: l('Dialogu Prishtinë–Beograd: Brukseli (2013) dhe Ohri (2023)', 'The Prishtina–Belgrade dialogue: Brussels (2013) and Ohrid (2023)'),
    summary: l('Dialogu me ndërmjetësim të BE-së ka prodhuar marrëveshje të rëndësishme, por zbatimi i tyre mbetet i debatuar.', 'The EU-facilitated dialogue has produced important agreements, but their implementation remains disputed.'),
    body: l(
      `Më 19 prill 2013 u arrit Marrëveshja e Brukselit për normalizimin e marrëdhënieve. Më 27 shkurt 2023 u arrit Marrëveshja për rrugën drejt normalizimit, e plotësuar me një aneks në Ohër.

Palët interpretojnë ndryshe detyrimet që rrjedhin prej tyre, dhe zbatimi i disa pikave është ende i pazgjidhur. Për gjendjen e fundit lexoni burimet e BE-së.`,
      `On 19 April 2013 the Brussels Agreement on normalising relations was reached. On 27 February 2023 the Agreement on the Path to Normalisation was reached, completed by an annex in Ohrid.

The parties interpret the obligations arising from them differently, and implementation of some points is still unresolved. For the latest state, read EU sources.`),
    claims: [claim('dialogue-status', l('Zbatimi i marrëveshjeve të vitit 2013 dhe 2023 është i pjesshëm dhe i debatuar', 'Implementation of the 2013 and 2023 agreements is partial and disputed'), 'official-position', '2025', ['dialogue-eu'], l('Gjendje e përshkruar në terma të përgjithshëm; kërkohet datë dhe burim i saktë para botimit përfundimtar.', 'Described in general terms; a precise date and source are needed before final publication.'))],
    evidence: 'official-position', sourceIds: ['dialogue-eu'], tags: ['dialogu', 'BE'],
  }),
  entry({
    id: 'saa-2016', area: 'kosova', section: 'pavaresia', kind: 'event', era: 'state', date: d('2016-04-01', 'day'),
    title: l('Marrëveshja e Stabilizim-Asociimit në fuqi (1 prill 2016)', 'Stabilisation and Association Agreement in force (1 April 2016)'),
    summary: l('Marrëveshja i dha Kosovës kornizën e parë kontraktuale me BE-në.', 'The agreement gave Kosovo its first contractual framework with the EU.'),
    body: l(`Marrëveshja u nënshkrua më 27 tetor 2015 dhe hyri në fuqi më 1 prill 2016.`, `The agreement was signed on 27 October 2015 and entered into force on 1 April 2016.`),
    evidence: 'official-record', sourceIds: ['eu-kosovo'], tags: ['BE', 'MSA'],
  }),
  entry({
    id: 'aplikimi-be-2022', area: 'kosova', section: 'pavaresia', kind: 'event', era: 'state', date: d('2022-12-14', 'day'),
    title: l('Aplikimi për anëtarësim në BE (14 dhjetor 2022)', 'Application for EU membership (14 December 2022)'),
    summary: l('Kosova dorëzoi kërkesën për anëtarësim; pesë shtete anëtare të BE-së nuk e njohin pavarësinë e saj.', 'Kosovo submitted its membership application; five EU member states do not recognise its independence.'),
    body: l(`Aplikimi u dorëzua më 14 dhjetor 2022. Statusi i procesit varet nga vendime të Këshillit të BE-së; kontrolloni gjendjen e datës.`, `The application was submitted on 14 December 2022. The status of the process depends on decisions of the EU Council; check the current state.`),
    claims: [claim('eu-nonrec', l('Pesë shtete anëtare të BE-së nuk e njohin pavarësinë e Kosovës', 'Five EU member states do not recognise Kosovo’s independence'), 'official-position', '2025', ['eu-kosovo', 'mfa'], l('Gjendja duhet verifikuar në datën e botimit.', 'The state must be checked at the date of publication.'))],
    evidence: 'official-record', sourceIds: ['eu-kosovo'], tags: ['BE'],
  }),
  entry({
    id: 'vizat-2024', area: 'kosova', section: 'pavaresia', kind: 'event', era: 'state', date: d('2024-01-01', 'day'),
    title: l('Liberalizimi i vizave me BE-në (1 janar 2024)', 'Visa liberalisation with the EU (1 January 2024)'),
    summary: l('Qytetarët e Kosovës me pasaportë biometrike udhëtojnë pa viza për qëndrime afatshkurtra në zonën Shengen.', 'Kosovo citizens with biometric passports travel visa-free for short stays in the Schengen area.'),
    body: l(`Liberalizimi hyri në fuqi më 1 janar 2024. Kushtet e hyrjes dhe afatet e qëndrimit duhen kontrolluar te burimet e BE-së para udhëtimit.`, `Liberalisation took effect on 1 January 2024. Entry conditions and stay limits should be checked in EU sources before travel.`),
    evidence: 'official-record', sourceIds: ['eu-kosovo'], tags: ['vizat', 'Shengen'],
  }),
];

/* ── V. FSK-ja dhe siguria ───────────────────────────────────────────────── */
const siguria: HeritageEntry[] = [
  entry({
    id: 'fsk-historiku', area: 'kosova', section: 'siguria', kind: 'institution', era: 'state', order: 1, featured: true,
    date: d('2009-01', 'month', { display: l('Janar 2009', 'January 2009') }),
    title: l('Nga TMK-ja te FSK-ja: historiku institucional', 'From the KPC to the KSF: institutional history'),
    summary: l('Forca e Sigurisë së Kosovës u krijua në janar 2009, pas shpërbërjes së Trupave të Mbrojtjes së Kosovës.', 'The Kosovo Security Force was created in January 2009, after the dissolution of the Kosovo Protection Corps.'),
    body: l(
      `Pas demilitarizimit të UÇK-së në shtator 1999 u krijua Trupat e Mbrojtjes së Kosovës (TMK), një organizatë civile emergjente nën UNMIK-un. Plani Ahtisaari parashikonte krijimin e një force të re, të armatosur lehtë.

FSK-ja u krijua zyrtarisht në janar 2009, në bazë të Ligjit për FSK-në. Mandati i saj fillestar ishte përgjigja ndaj emergjencave, mbrojtja civile dhe asgjësimi i mjeteve shpërthyese, brenda Kosovës dhe jashtë saj. Në vitet e mëpasshme u zhvilluan trajnimet dhe partneritetet ndërkombëtare.`,
      `After the demilitarisation of the KLA in September 1999, the Kosovo Protection Corps (KPC) was created as an emergency civil organisation under UNMIK. The Ahtisaari Plan envisaged creating a new, lightly armed force.

The KSF was officially created in January 2009 on the basis of the Law on the KSF. Its initial mandate was emergency response, civil protection and explosive ordnance disposal, in Kosovo and abroad. In the following years training and international partnerships were developed.`),
    evidence: 'official-record', sourceIds: ['ksf-law-2008', 'ahtisaari', 'ksf-mod'], tags: ['FSK', 'TMK'],
  }),
  entry({
    id: 'fsk-misioni', area: 'kosova', section: 'siguria', kind: 'institution', era: 'state', order: 2,
    date: d('2018-12-14', 'day'),
    title: l('Mandati zyrtar dhe ligjet e vitit 2018', 'The official mandate and the 2018 laws'),
    summary: l('Më 14 dhjetor 2018 Kuvendi miratoi ligje që e zgjerojnë mandatin e FSK-së; qëndrimet e partnerëve dhe të komuniteteve ndryshonin.', 'On 14 December 2018 the Assembly adopted laws that widen the KSF’s mandate; the views of partners and communities differed.'),
    body: l(
      `Më 14 dhjetor 2018 Kuvendi miratoi ligjet për Forcën e Sigurisë së Kosovës dhe për Ministrinë e Mbrojtjes. Institucionet e Kosovës e përshkruajnë këtë si fillim të një procesi afatgjatë të transformimit të FSK-së në forca të armatosura.

Reagimet ishin të ndryshme: përfaqësuesit e komunitetit serb e kundërshtuan, dhe NATO shprehu keqardhje për vendimin dhe tha se do të rishqyrtonte nivelin e angazhimit të saj. Këto janë qëndrime zyrtare të datuara, jo vlerësime të këtij arkivi.

Numrat e personelit të parashikuar me ligj nuk janë dhënë këtu; ato duhet të merren nga teksti zyrtar i ligjit me datën e tij.`,
      `On 14 December 2018 the Assembly adopted the laws on the Kosovo Security Force and on the Ministry of Defence. Kosovo’s institutions describe this as the start of a long-term process of transforming the KSF into an armed force.

Reactions differed: representatives of the Serb community opposed it, and NATO expressed regret at the decision and said it would review the level of its engagement. These are dated official positions, not assessments of this archive.

Personnel numbers provided by law are not given here; they should be taken from the official text of the law with its date.`),
    evidence: 'official-position', sourceIds: ['ksf-laws-2018', 'nato-kfor'], tags: ['FSK', '2018'],
  }),
  entry({
    id: 'fsk-sherbimi-publik', area: 'kosova', section: 'siguria', kind: 'institution', era: 'state', order: 3,
    title: l('Roli i shërbimit publik: emergjenca, mbrojtja civile, bashkëpunimi', 'Public service role: emergencies, civil protection, cooperation'),
    summary: l('Ligji i përcakton FSK-në edhe si mbështetje për autoritetet civile në raste fatkeqësish.', 'The law defines the KSF also as support for civil authorities in disasters.'),
    body: l(
      `Ndër detyrat e përcaktuara me ligj janë reagimi ndaj fatkeqësive natyrore, mbrojtja civile, asgjësimi i mjeteve shpërthyese dhe mbështetja e autoriteteve civile. Në nivel ndërkombëtar, Kosova ka një partneritet shtetëror me Gardën Kombëtare të Iowa-s të SHBA-së.

Operacionet e veçanta, datat dhe numri i personelit të përfshirë nuk janë përfshirë këtu pa komunikatë zyrtare të datuar. Redaktorët i shtojnë ato vetëm nga burime zyrtare.`,
      `The duties defined by law include response to natural disasters, civil protection, explosive ordnance disposal and support to civil authorities. Internationally, Kosovo has a state partnership with the Iowa National Guard of the United States.

Specific operations, dates and numbers of personnel involved are not included here without a dated official statement. Editors add them only from official sources.`),
    evidence: 'official-record', sourceIds: ['ksf-law-2008', 'iowa-ng', 'ksf-mod'], tags: ['FSK', 'emergjenca'],
  }),
  entry({
    id: 'fsk-informacion', area: 'kosova', section: 'siguria', kind: 'article', order: 4,
    title: l('Informacioni publik dhe informacioni i ndjeshëm', 'Public and sensitive information'),
    summary: l('Ky arkiv nuk publikon asgjë që mund të vërë në rrezik operacionet ose personelin.', 'This archive publishes nothing that could endanger operations or personnel.'),
    body: l(
      `Ky arkiv trajton FSK-në vetëm me burime zyrtare dhe të datuara. Nuk botojmë vendndodhje, kapacitete, pajisje ose emra të personelit që nuk janë publikuar zyrtarisht, dhe nuk jepen vlerësime ushtarake.

Rekrutimi, kushtet dhe afatet shpallen me konkurse zyrtare nga Ministria e Mbrojtjes; kontrolloni gjithmonë burimin zyrtar të ditës.`,
      `This archive treats the KSF only from official, dated sources. We do not publish locations, capabilities, equipment or personnel names that have not been officially published, and we give no military assessments.

Recruitment, requirements and deadlines are announced in official competitions by the Ministry of Defence; always check the official source of the day.`),
    evidence: 'official-position', sourceIds: ['ksf-mod'], tags: ['FSK', 'politika'],
  }),
];

export const KOSOVA_PART2 = [...lufta, ...pavaresia, ...siguria];
