import { claim, d, entry, l } from './helpers';
import type { HeritageEntry } from '../types';

const A = 'uck' as const;

/* ── 01 Prapavija ──────────────────────────────────────────────────────── */
const background: HeritageEntry[] = [
  entry({
    id: 'bg-autonomia-1989', area: A, section: 'background', kind: 'article', era: 'nineties', order: 1, featured: true,
    date: d('1989', 'range', { to: '1990', display: l('1989 – 1990', '1989 – 1990') }),
    title: l('Humbja e autonomisë dhe shkarkimet masive', 'The loss of autonomy and mass dismissals'),
    summary: l('Vitet 1989–1990 e zhveshën Kosovën nga institucionet e veta dhe vendosën masa që prekën mijëra familje.', 'The years 1989–1990 stripped Kosovo of its institutions and imposed measures that affected thousands of families.'),
    body: l(
      `Në mars 1989 u miratuan amendamente që e kufizuan autonominë e Kosovës, dhe në korrik 1990 Serbia shpërndau Kuvendin dhe Qeverinë e Kosovës. Pasoi shkarkimi i shqiptarëve nga puna në administratë, arsim, shëndetësi dhe ndërmarrje të mëdha.

Organizata të të drejtave të njeriut, përfshirë Amnesty International, dokumentuan arrestime, dhunë policore dhe gjykime kundër shqiptarëve. Ky është konteksti në të cilin forcohet çështja e rezistencës.`,
      `In March 1989 amendments were adopted that curtailed Kosovo’s autonomy, and in July 1990 Serbia dissolved Kosovo’s Assembly and Government. Albanians were then dismissed from jobs in administration, education, health and large enterprises.

Human-rights organisations, including Amnesty International, documented arrests, police violence and trials of Albanians. This is the context in which the question of resistance hardened.`),
    evidence: 'established', sourceIds: ['malcolm-kosovo', 'amnesty-kosovo', 'judah-kosovo'], tags: ['1989', 'autonomia'],
  }),
  entry({
    id: 'bg-rezistenca-paqesore', area: A, section: 'background', kind: 'article', era: 'nineties', order: 2,
    date: d('1990', 'range', { to: '1997', display: l('1990 – 1997', '1990 – 1997') }),
    title: l('Rezistenca paqësore dhe kufijtë e saj', 'Non-violent resistance and its limits'),
    summary: l('Strategjia e Rugovës mbajti një shoqëri të tërë në institucione paralele, por nuk dha rezultat politik në vitet ’90.', 'Rugova’s strategy held a whole society together in parallel institutions but produced no political result in the 1990s.'),
    body: l(
      `Lidhja Demokratike e Kosovës ndërtoi shkolla, shëndetësi dhe qeverisje paralele, të financuara pjesërisht nga diaspora. Kjo ishte një rezistencë jo-dhunshme që u vlerësua ndërkombëtarisht.

Marrëveshja e Dejtonit e vitit 1995 e mbylli luftën në Bosnjë por nuk e trajtoi Kosovën. Shumë shqiptarë e panë këtë si dëshmi se rezistenca paqësore nuk po sillte ndryshim, dhe kjo forcoi ata që kërkonin rrugë të tjera. Se sa vendimtar ishte ky faktor është çështje debati mes historianëve.`,
      `The Democratic League of Kosovo built parallel schools, healthcare and government, financed partly by the diaspora. This was a non-violent resistance that was valued internationally.

The 1995 Dayton Agreement ended the war in Bosnia but did not address Kosovo. Many Albanians saw this as proof that peaceful resistance was bringing no change, which strengthened those who sought other paths. How decisive this factor was is a matter of debate among historians.`),
    evidence: 'contested', sourceIds: ['malcolm-kosovo', 'judah-kosovo', 'kosovo-report'], tags: ['Rugova', 'Dejton'],
  }),
  entry({
    id: 'bg-shqiperia-1997', area: A, section: 'background', kind: 'article', era: 'nineties', order: 3,
    date: d('1997-03', 'month'),
    title: l('Kriza e Shqipërisë, 1997', 'The Albanian crisis, 1997'),
    summary: l('Shembja e rendit në Shqipëri e bëri më të lehtë furnizimin me armë dhe ndryshoi balancën e brendshme në Kosovë.', 'The collapse of order in Albania made arms easier to obtain and changed the balance inside Kosovo.'),
    body: l(`Në pranverën e vitit 1997, trazirat pas rënies së skemave piramidale në Shqipëri çuan në plaçkitjen e depove ushtarake. Shumë analistë e shohin këtë si faktor që e lehtësoi armatosjen e grupeve në Kosovë. Peshën e saj e vlerësojnë ndryshe autorët.`, `In spring 1997, unrest after the collapse of pyramid schemes in Albania led to the looting of military depots. Many analysts see this as a factor that eased the arming of groups in Kosovo. Authors assess its weight differently.`),
    evidence: 'contested', sourceIds: ['judah-kla', 'kosovo-report'], tags: ['1997', 'armët'],
  }),
];

/* ── 02 Lindja e UÇK-së ───────────────────────────────────────────────── */
const emergence: HeritageEntry[] = [
  entry({
    id: 'uck-fillimet', area: A, section: 'emergence', kind: 'article', era: 'nineties', order: 1,
    date: d('1996', 'year'),
    title: l('Fillimet: nga rrjetet e fshehta te sulmet e para të pretenduara', 'Beginnings: from clandestine networks to the first claimed attacks'),
    summary: l('Rrënjët e UÇK-së lidhen me rrjete të fshehta të viteve ’80 e ’90; sulmet e para që iu atribuuan datojnë nga 1996.', 'The roots of the KLA are tied to clandestine networks of the 1980s and 1990s; the first attacks attributed to it date from 1996.'),
    body: l(
      `Grupe të fshehta të lidhura me lëvizje politike si Lëvizja Popullore e Kosovës vepronin që nga vitet ’80, shpesh nga diaspora. Në prill 1996 u kryen sulme të njëkohshme kundër objekteve të policisë dhe zyrtarëve serbë; një deklaratë në emër të UÇK-së i mori përsipër.

Detajet e organizimit të hershëm janë ende objekt kërkimi, sepse struktura ishte e fshehtë dhe burimet janë pjesërisht dëshmi personale. Ky shënim paraqet vetëm çfarë përmendet gjerësisht në literaturën e botuar.`,
      `Clandestine groups tied to political movements such as the Popular Movement of Kosovo had been operating since the 1980s, often from the diaspora. In April 1996 simultaneous attacks were carried out on police facilities and Serbian officials; a statement in the name of the KLA claimed them.

The details of early organisation remain a subject of research because the structure was secret and sources are partly personal testimony. This entry presents only what is widely mentioned in the published literature.`),
    evidence: 'contested', sourceIds: ['judah-kla', 'malcolm-kosovo', 'di-lellio-kla'], tags: ['UÇK', 'LPK'],
  }),
  entry({
    id: 'uck-pamja-e-pare-1997', area: A, section: 'emergence', kind: 'event', era: 'war', order: 2,
    date: d('1997-11-28', 'day'), place: { name: 'Llaushë', municipality: 'Skenderaj' },
    title: l('28 nëntor 1997: paraqitja e parë publike', '28 November 1997: the first public appearance'),
    summary: l('Në varrimin e mësuesit Halit Geci, në Llaushë, tre burra me uniforma dhe maska u paraqitën në emër të UÇK-së.', 'At the funeral of the teacher Halit Geci, in Llaushë, three uniformed and masked men appeared in the name of the KLA.'),
    body: l(`Varrimi i mësuesit Halit Geci në Llaushë të Drenicës, më 28 nëntor 1997, konsiderohet paraqitja e parë publike e UÇK-së. Pas kësaj, popullariteti i saj u rrit në Drenicë dhe më gjerë.`, `The funeral of the teacher Halit Geci in Llaushë, Drenica, on 28 November 1997 is regarded as the KLA’s first public appearance. After this its popularity grew in Drenica and beyond.`),
    evidence: 'established', sourceIds: ['judah-kla', 'vickers-between'], tags: ['UÇK', '1997'],
  }),
  entry({
    id: 'uck-struktura', area: A, section: 'emergence', kind: 'article', era: 'war', order: 3,
    title: l('Struktura, zonat operative dhe financimi', 'Structure, operational zones and funding'),
    summary: l('UÇK-ja u organizua në zona operative; financimi dhe furnizimi erdhën pjesërisht nga diaspora.', 'The KLA was organised in operational zones; funding and supply came partly from the diaspora.'),
    body: l(
      `Literatura përmend zonat operative të Drenicës, Llapit, Dukagjinit, Shalës, Pashtrikut dhe Nerodimes, me shtabin e përgjithshëm që koordinonte veprimet. Financimi vinte nga kontribute të diasporës dhe burime të tjera.

Madhësia e UÇK-së ndryshon sipas burimeve dhe periudhës; nuk ka një numër të vetëm të pranuar gjerësisht, andaj këtu nuk jepet shifër.`,
      `The literature mentions the operational zones of Drenica, Llap, Dukagjin, Shala, Pashtrik and Nerodime, with a general staff coordinating actions. Funding came from diaspora contributions and other sources.

The size of the KLA differs by source and period; there is no single widely accepted number, so no figure is given here.`),
    evidence: 'estimate', sourceIds: ['judah-kla', 'di-lellio-kla'], tags: ['UÇK', 'struktura'],
  }),
  entry({
    id: 'uck-statusi-nderkombetar', area: A, section: 'emergence', kind: 'article', era: 'war', order: 4,
    date: d('1998-03-31', 'day'),
    title: l('Si e cilësoi bashkësia ndërkombëtare UÇK-në në 1998', 'How the international community described the KLA in 1998'),
    summary: l('Rezoluta 1160 dënoi përdorimin e forcës së tepruar nga policia serbe dhe, njëkohësisht, aktet terroriste të UÇK-së.', 'Resolution 1160 condemned excessive force by Serbian police and, at the same time, terrorist acts by the KLA.'),
    body: l(
      `Më 31 mars 1998 Rezoluta 1160 e Këshillit të Sigurimit dënoi përdorimin e forcës së tepruar nga policia serbe kundër civilëve dhe, bashkë me të, “të gjitha aktet e terrorizmit” nga UÇK-ja. Rezoluta vendosi embargo armësh për Jugosllavinë.

Ky shënim tregon një realitet të ndërlikuar: bashkësia ndërkombëtare i dënoi të dyja palët në fazën e hershme, dhe më vonë qëndrimet ndryshuan. Çdo përshkrim që e paraqet UÇK-në vetëm si “heroike” ose vetëm si “terroriste” është i paplotë.`,
      `On 31 March 1998 Security Council Resolution 1160 condemned the use of excessive force by Serbian police against civilians and, alongside it, "all acts of terrorism" by the KLA. The resolution imposed an arms embargo on Yugoslavia.

This entry shows a complicated reality: the international community condemned both sides at the early stage, and positions later changed. Any account that presents the KLA only as "heroic" or only as "terrorist" is incomplete.`),
    evidence: 'official-record', sourceIds: ['unscr-1160'], tags: ['OKB', 'UÇK'],
  }),
];

/* ── 03 Kronologjia 1998–1999 ──────────────────────────────────────────── */
const T = (
  id: string, date: string, sq: string, en: string, sqBody: string, enBody: string,
  sourceIds: string[], extra: Partial<HeritageEntry> = {},
) => entry({
  id, area: A, section: 'timeline', kind: 'event', era: 'war', date: d(date, date.length === 10 ? 'day' : date.length === 7 ? 'month' : 'year'),
  title: l(sq, en), summary: l(sqBody.split('\n')[0], enBody.split('\n')[0]), body: l(sqBody, enBody),
  evidence: 'established', sourceIds, tags: ['kronologji'], ...extra,
});

const timeline: HeritageEntry[] = [
  T('t-1998-02-drenica', '1998-02-28', 'Operacione policore në Drenicë (Likoshan, Qirez)', 'Police operations in Drenica (Likoshan, Qirez)',
    `Fundi i shkurtit 1998 shënon përshkallëzimin e dhunës në Drenicë.\nOperacionet e njësive speciale policore serbe në fshatrat Likoshan e Qirez shkaktuan viktima civile. Numrat e saktë të viktimave merren nga Libri i Kujtesës.`,
    `The end of February 1998 marks the escalation of violence in Drenica.\nOperations by Serbian special police units in the villages of Likoshan and Qirez caused civilian casualties. Exact victim numbers are taken from the Memory Book.`,
    ['hlc-memory', 'icty-milutinovic'], { place: { name: 'Likoshan, Qirez', municipality: 'Skenderaj' }, sensitive: 'graphic' }),
  T('t-1998-03-prekaz', '1998-03-05', 'Prekazi: sulmi ndaj familjes Jashari (5–7 mars)', 'Prekaz: the attack on the Jashari family (5–7 March)',
    `Një operacion i gjatë i forcave serbe në Prekaz vrau Adem Jasharin dhe shumë anëtarë të familjes së tij.\nNdër të vrarët ishin gra dhe fëmijë. Ngjarja është marrë në shqyrtim nga ICTY, dhe Prekazi është bërë vend përkujtimor. Numri i saktë i viktimave citohet nga Libri i Kujtesës dhe nga vendimet gjyqësore.`,
    `A long operation by Serbian forces in Prekaz killed Adem Jashari and many members of his family.\nAmong the dead were women and children. The event was examined by the ICTY, and Prekaz has become a memorial site. The exact number of victims is cited from the Memory Book and the court judgments.`,
    ['icty-milutinovic', 'hlc-memory', 'hrw-under-orders'], { place: { name: 'Prekaz', municipality: 'Skenderaj' }, sensitive: 'graphic' }),
  T('t-1998-03-1160', '1998-03-31', 'Rezoluta 1160 e OKB-së', 'UN Security Council Resolution 1160',
    `Këshilli i Sigurimit dënoi forcën e tepruar të policisë serbe dhe aktet terroriste të UÇK-së.\nVendosi embargo armësh dhe kërkoi dialog politik.`,
    `The Security Council condemned excessive force by Serbian police and terrorist acts by the KLA.\nIt imposed an arms embargo and called for political dialogue.`, ['unscr-1160'], { evidence: 'official-record' }),
  T('t-1998-summer', '1998-07', 'Verë 1998: ofensivat dhe zhvendosjet e para të mëdha', 'Summer 1998: offensives and the first large displacements',
    `Gjatë verës luftimet u shtrinë në Dukagjin, Llap e më gjerë.\nDhjetëra mijëra civilë u larguan nga shtëpitë, shpesh drejt maleve dhe fshatrave të tjera. Burimet ndërkombëtare dokumentuan djegie shtëpish dhe zhvendosje.`,
    `During the summer fighting spread to Dukagjin, Llap and beyond.\nTens of thousands of civilians left their homes, often for the mountains and other villages. International sources documented house burnings and displacement.`,
    ['hrw-under-orders', 'unscr-1199', 'osce-asseen']),
  T('t-1998-09-1199', '1998-09-23', 'Rezoluta 1199 e OKB-së', 'UN Security Council Resolution 1199',
    `Këshilli i Sigurimit kërkoi armëpushim dhe ndërprerjen e veprimeve kundër civilëve.\nPreambula e rezolutës vë re numrin e madh të njerëzve të zhvendosur nga shtëpitë e tyre.`,
    `The Security Council demanded a ceasefire and an end to actions against civilians.\nThe resolution’s preamble notes the large number of people displaced from their homes.`, ['unscr-1199'], {
      evidence: 'official-record',
      claims: [claim('displaced-1199', l('Mbi 230.000 persona të zhvendosur nga shtëpitë (shtator 1998)', 'Over 230,000 persons displaced from their homes (September 1998)'), 'official-record', '1998-09-23', ['unscr-1199'], l('Shifër e cituar në preambulën e rezolutës; verifikoni formulimin e saktë në tekstin origjinal.', 'A figure cited in the resolution’s preamble; verify the exact wording in the original text.'))],
    }),
  T('t-1998-09-obrinje', '1998-09-26', 'Gornje Obrinje / Obri e Epërme', 'Gornje Obrinje / Upper Obrinje',
    `Familje civile u vranë në fshatin Obri e Epërme në Drenicë.\nNgjarja është e dokumentuar nga organizata të të drejtave të njeriut dhe shqyrtuar nga ICTY. Lexoni vendimin për përmbajtjen e saktë të konstatimeve.`,
    `Civilian families were killed in the village of Upper Obrinje in Drenica.\nThe event is documented by human-rights organisations and examined by the ICTY. Read the judgment for the exact content of the findings.`,
    ['icty-milutinovic', 'hrw-under-orders', 'hlc-memory'], { place: { name: 'Obri e Epërme', municipality: 'Drenas' }, sensitive: 'graphic' }),
  T('t-1998-10-holbrooke', '1998-10-13', 'Marrëveshja Holbrooke–Milošević dhe Misioni Verifikues i OSBE-së', 'The Holbrooke–Milošević agreement and the OSCE Verification Mission',
    `Në tetor 1998 u arrit një marrëveshje që lejoi 2.000 vëzhgues të OSBE-së (KVM) në Kosovë.\nMisioni mbikëqyri armëpushimin dhe dokumentoi incidente derisa u tërhoq më 20 mars 1999. Rezoluta 1203 e mbështeti marrëveshjen.`,
    `In October 1998 an agreement was reached allowing OSCE observers (the KVM) into Kosovo.\nThe mission monitored the ceasefire and documented incidents until it withdrew on 20 March 1999. Resolution 1203 endorsed the arrangement.`,
    ['osce-kvm', 'unscr-1203'], { evidence: 'official-record' }),
  T('t-1999-01-racak', '1999-01-15', 'Reçaku', 'Račak (Reçak)',
    `Në Reçak u gjetën 45 trupa; ngjarja u bë pikë kthese ndërkombëtare.\nVëzhguesit e OSBE-së e vizituan vendin dhe ekipi i mjekësisë ligjore i BE-së (nën drejtimin e Finlandës) shqyrtoi trupat. Autoritetet serbe e kundërshtuan karakterizimin e ngjarjes si masakër civilësh; vendimet e ICTY dhe raportet e pavarura duhen lexuar për përmbajtjen e saktë.`,
    `At Račak 45 bodies were found; the event became an international turning point.\nOSCE observers visited the site and an EU forensic team (led by Finland) examined the bodies. Serbian authorities contested the characterisation of the event as a massacre of civilians; the ICTY judgments and independent reports should be read for their exact content.`,
    ['osce-kvm', 'icty-milutinovic', 'hrw-under-orders'], {
      place: { name: 'Reçak', municipality: 'Shtime' }, sensitive: 'graphic',
      claims: [claim('racak-45', l('45 persona të vrarë u gjetën në Reçak më 15–16 janar 1999', '45 persons were found killed in Račak on 15–16 January 1999'), 'established', '1999-01-16', ['osce-kvm', 'hrw-under-orders'], l('Numri i trupave nuk kontestohet gjerësisht; karakterizimi i ngjarjes u kontestua nga Serbia.', 'The number of bodies is not widely disputed; the characterisation of the event was disputed by Serbia.'))],
    }),
  T('t-1999-02-rambouillet', '1999-02-06', 'Konferenca e Rambujesë (6–23 shkurt) dhe Parisi (15–18 mars)', 'The Rambouillet conference (6–23 February) and Paris (15–18 March)',
    `Negociatat u zhvilluan nën presionin e kërcënimit me forcë të NATO-s.\nMë 18 mars 1999 delegacioni shqiptar e nënshkroi Marrëveshjen e Përkohshme; delegacioni jugosllav nuk e pranoi. Sa ishte arsyeja e dështimit — dhe nëse kushtet ishin të pranueshme — është çështje debati midis historianëve.`,
    `The negotiations took place under the threat of NATO force.\nOn 18 March 1999 the Albanian delegation signed the Interim Agreement; the Yugoslav delegation did not accept it. Why it failed — and whether the terms were acceptable — is debated among historians.`,
    ['rambouillet', 'kosovo-report'], { evidence: 'contested' }),
  T('t-1999-03-kvm', '1999-03-20', 'Tërhiqet Misioni Verifikues i OSBE-së', 'The OSCE Verification Mission withdraws',
    `Vëzhguesit u tërhoqën para fillimit të fushatës ajrore.\nPas tërheqjes, dokumentimi i pavarur në terren u bë shumë më i vështirë.`,
    `Observers withdrew before the start of the air campaign.\nAfter the withdrawal independent documentation on the ground became much more difficult.`, ['osce-kvm']),
  T('t-1999-03-nato', '1999-03-24', 'NATO nis fushatën ajrore (Operation Allied Force)', 'NATO begins the air campaign (Operation Allied Force)',
    `Fushata zgjati 78 ditë, deri më 10 qershor 1999.\nNdërhyrja nuk kishte miratim të Këshillit të Sigurimit. Komisioni i Pavarur Ndërkombëtar për Kosovën e quajti atë “të paligjshme por legjitime” — një formulim që mbetet i debatuar.`,
    `The campaign lasted 78 days, until 10 June 1999.\nThe intervention had no Security Council authorisation. The Independent International Commission on Kosovo called it "illegal but legitimate" — a formulation that remains debated.`,
    ['kosovo-report', 'unscr-1244'], { evidence: 'contested' }),
  T('t-1999-03-deportimet', '1999-03-25', 'Dëbimet masive dhe vrasjet', 'Mass expulsions and killings',
    `Pas fillimit të bombardimeve, forca serbe e jugosllave nisën dëbimet në shkallë të gjerë të civilëve shqiptarë.\nGJPJL-ja vërtetoi se këto ishin pjesë e një fushate dhune kundër popullatës civile, dhe gjeti përgjegjësi penale për zyrtarët e lartë.`,
    `After the bombing began, Serbian and Yugoslav forces started large-scale expulsions of Albanian civilians.\nThe ICTY found that these were part of a campaign of violence against the civilian population and found criminal responsibility of senior officials.`,
    ['icty-milutinovic', 'icty-djordjevic', 'unhcr-sowr'], { evidence: 'court-finding', sensitive: 'graphic' }),
  T('t-1999-03-krusha', '1999-03-26', 'Krusha e Madhe', 'Velika Kruša (Krusha e Madhe)',
    `Në Krushën e Madhe u vranë burra të fshatit gjatë një operacioni të forcave serbe.\nNgjarja është dokumentuar nga Human Rights Watch dhe Libri i Kujtesës; shihni burimet për emrat dhe shifrën e verifikuar.`,
    `In Velika Kruša men of the village were killed during an operation by Serbian forces.\nThe event is documented by Human Rights Watch and the Memory Book; see the sources for the names and the verified figure.`,
    ['hrw-under-orders', 'hlc-memory'], { place: { name: 'Krusha e Madhe', municipality: 'Rahovec' }, sensitive: 'graphic' }),
  T('t-1999-03-suhareka', '1999-03-26', 'Suhareka', 'Suhareka (Suva Reka)',
    `Në Suharekë u vranë civilë shqiptarë në fund të marsit 1999.\nHuman Rights Watch e përfshiu ngjarjen në raportin “Under Orders”; shihni burimet për të dhënat e verifikuara dhe çështjet gjyqësore.`,
    `In Suhareka Albanian civilians were killed at the end of March 1999.\nHuman Rights Watch included the event in its report "Under Orders"; see the sources for the verified data and the court cases.`,
    ['hrw-under-orders', 'hlc-memory'], { place: { name: 'Suharekë', municipality: 'Suharekë' }, sensitive: 'graphic' }),
  T('t-1999-03-izbica', '1999-03-28', 'Izbica', 'Izbica (Izbicë)',
    `Në Izbicë të Skenderajt u vranë burra dhe djem gjatë një operacioni.\nNgjarja dokumentohet në raportet e HRW dhe në bazën e HLC-së.`,
    `In Izbica, Skenderaj, men and boys were killed during an operation.\nThe event is documented in HRW reports and in the HLC database.`,
    ['hrw-under-orders', 'hlc-memory'], { place: { name: 'Izbicë', municipality: 'Skenderaj' }, sensitive: 'graphic' }),
  T('t-1999-04-meja', '1999-04-27', 'Meja (Gjakovë)', 'Meja (Gjakova)',
    `Në Mejë dhe në fshatrat përreth u vranë burra shqiptarë në prill 1999.\nICTY e ka shqyrtuar këtë ngjarje në çështjen Đorđević; lexoni vendimin për konstatimet e sakta.`,
    `In Meja and the surrounding villages Albanian men were killed in April 1999.\nThe ICTY examined this event in the Đorđević case; read the judgment for the exact findings.`,
    ['icty-djordjevic', 'hlc-memory'], { place: { name: 'Mejë', municipality: 'Gjakovë' }, sensitive: 'graphic' }),
  T('t-1999-04-koshare', '1999-04-09', 'Beteja e Kosharës (prill–qershor)', 'The battle of Košare (April–June)',
    `Luftime në kufirin Shqipëri–Kosovë, ku UÇK-ja dhe njësi të Shqipërisë u përfshinë.\nVlerësimet e humbjeve dhe të rezultatit ndryshojnë ndjeshëm sipas burimeve.`,
    `Fighting on the Albania–Kosovo border in which the KLA and Albanian units were involved.\nEstimates of losses and of the outcome differ significantly by source.`,
    ['judah-kla', 'kosovo-report'], { evidence: 'contested', place: { name: 'Koshare', municipality: 'Gjakovë (kufiri)' } }),
  T('t-1999-05-korisa', '1999-05-13', 'Korisa: civilë të vrarë nga një sulm i NATO-s', 'Korisa: civilians killed in a NATO strike',
    `Një sulm ajror i NATO-s vrau civilë në Korisë.\nHRW e dokumentoi si një nga ngjarjet më të rënda të viktimave civile të fushatës. NATO ka pranuar gabime në disa raste.`,
    `A NATO air strike killed civilians at Korisa.\nHRW documented it as one of the most serious civilian-casualty events of the campaign. NATO has acknowledged errors in some cases.`,
    ['hrw-nato-civ'], { place: { name: 'Korisë', municipality: 'Prizren' }, sensitive: 'graphic' }),
  T('t-1999-05-dubrava', '1999-05-19', 'Burgu i Dubravës', 'Dubrava prison',
    `Më 19 maj 1999 një sulm i NATO-s goditi burgun e Dubravës; në ditët në vijim të burgosur u vranë nga forcat serbe.\nHRW i ka dokumentuar të dyja ngjarjet veçmas; ato nuk duhen ngatërruar.`,
    `On 19 May 1999 a NATO strike hit Dubrava prison; in the following days prisoners were killed by Serbian forces.\nHRW documented both events separately; they should not be confused.`,
    ['hrw-under-orders', 'hrw-nato-civ'], { place: { name: 'Dubravë', municipality: 'Istog' }, sensitive: 'graphic' }),
  T('t-1999-05-milosevic', '1999-05-24', 'ICTY ngre aktakuzë kundër Miloševićit dhe katër të tjerëve', 'The ICTY indicts Milošević and four others',
    `Aktakuza u konfirmua më 24 maj dhe u bë publike më 27 maj 1999.\nMiloševići vdiq në paraburgim më 11 mars 2006, para vendimit përfundimtar. Kjo do të thotë se për të nuk ka konstatim gjyqësor të fajësisë.`,
    `The indictment was confirmed on 24 May and made public on 27 May 1999.\nMilošević died in detention on 11 March 2006, before a final judgment. This means there is no judicial finding of guilt for him.`,
    ['icty-milosevic'], { evidence: 'court-finding' }),
  T('t-1999-06-mta', '1999-06-09', 'Marrëveshja ushtarako-teknike e Kumanovës', 'The Kumanovo Military Technical Agreement',
    `Forcat jugosllave pranuan të tërhiqen nga Kosova.\nMë 10 qershor NATO pezulloi bombardimet dhe Këshilli i Sigurimit miratoi Rezolutën 1244.`,
    `Yugoslav forces agreed to withdraw from Kosovo.\nOn 10 June NATO suspended the bombing and the Security Council adopted Resolution 1244.`, ['kumanovo-mta', 'unscr-1244'], { evidence: 'official-record' }),
  T('t-1999-06-kfor', '1999-06-12', 'KFOR hyn në Kosovë', 'KFOR enters Kosovo',
    `Forcat e NATO-s hynë në Kosovë dhe nisi kthimi i refugjatëve.\nUNHCR dokumentoi se shumica e refugjatëve u kthyen brenda disa muajsh.`,
    `NATO forces entered Kosovo and the return of refugees began.\nUNHCR documented that most refugees returned within a few months.`, ['nato-kfor', 'unhcr-sowr']),
  T('t-1999-06-hakmarrja', '1999-06-15', 'Dhuna ndaj serbëve, romëve dhe të tjerëve pas qershorit 1999', 'Violence against Serbs, Roma and others after June 1999',
    `Pas hyrjes së KFOR-it u regjistruan vrasje, rrëmbime dhe djegie shtëpish ndaj serbëve, romëve dhe të tjerëve.\nHRW dhe organizata të tjera e dokumentuan këtë dhunë; shumë njerëz u larguan. Disa raste janë shqyrtuar gjyqësisht.`,
    `After KFOR entered, killings, abductions and house burnings against Serbs, Roma and others were recorded.\nHRW and other organisations documented this violence; many people left. Some cases have been examined in court.`,
    ['hrw-abuses-serbs-roma', 'icty-haradinaj', 'ksc'], { sensitive: 'graphic' }),
  T('t-1999-09-tmk', '1999-09-20', 'Demilitarizimi i UÇK-së dhe krijimi i TMK-së', 'Demilitarisation of the KLA and creation of the KPC',
    `UÇK-ja nënshkroi angazhimin për demilitarizim.\nNjë pjesë e anëtarëve u integruan në Trupat e Mbrojtjes së Kosovës, një organizatë civile emergjente.`,
    `The KLA signed an undertaking on demilitarisation.\nPart of its members were integrated into the Kosovo Protection Corps, a civil emergency organisation.`, ['un-sg-unmik', 'nato-kfor'], { evidence: 'official-record' }),
];

export const UCK_PART1 = [...background, ...emergence, ...timeline];
