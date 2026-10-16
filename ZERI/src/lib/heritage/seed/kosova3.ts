import { claim, d, entry, l } from './helpers';
import type { HeritageEntry } from '../types';

/* ── VI. Kultura, gjuha dhe traditat ────────────────────────────────────── */
const kultura: HeritageEntry[] = [
  entry({
    id: 'gjuha-shqipe', area: 'kosova', section: 'kultura', kind: 'article', featured: true, order: 1,
    title: l('Gjuha shqipe: një degë më vete', 'The Albanian language: a branch of its own'),
    summary: l('Shqipja është e vetmja gjuhë e mbijetuar e një dege të pavarur indoevropiane; në Kosovë flitet në variantet gege dhe në standardin letrar.', 'Albanian is the only surviving language of an independent Indo-European branch; in Kosovo it is spoken in Gheg varieties and in the literary standard.'),
    body: l(
      `Shqipja ka dy dialekte kryesore, gegërishten (në veri, përfshirë Kosovën) dhe toskërishten (në jug). Libri më i vjetër i njohur i shtypur në shqip është “Meshari” i Gjon Buzukut (1555). Alfabeti i përbashkët me bazë latine u miratua në Kongresin e Manastirit në nëntor 1908, dhe standardi letrar u përcaktua në Kongresin e Drejtshkrimit të vitit 1972.

Në Kosovë, shqipja dhe serbishtja janë gjuhë zyrtare. Gegërishtja mbetet gjallë në të folmen e përditshme dhe në folklor, ndërsa standardi përdoret në shkollë dhe në media.`,
      `Albanian has two main dialects, Gheg (in the north, including Kosovo) and Tosk (in the south). The oldest known printed book in Albanian is "Meshari" by Gjon Buzuku (1555). A common Latin-based alphabet was adopted at the Congress of Monastir in November 1908, and the literary standard was set at the Orthography Congress of 1972.

In Kosovo, Albanian and Serbian are official languages. Gheg stays alive in everyday speech and folklore, while the standard is used in school and media.`),
    evidence: 'established', sourceIds: ['buzuku', 'monastir-1908', 'orthography-1972', 'constitution'], tags: ['gjuha'],
  }),
  entry({
    id: 'letersia', area: 'kosova', section: 'kultura', kind: 'article', order: 2,
    title: l('Letërsia e Kosovës', 'The literature of Kosovo'),
    summary: l('Një letërsi e ndërtuar mes folklorit, rezistencës dhe kërkimit modern të formës.', 'A literature built between folklore, resistance and the modern search for form.'),
    body: l(
      `Letërsia e shkruar e Kosovës u zhvillua fort pas Luftës së Dytë Botërore, përmes shtypit, Universitetit të Prishtinës dhe institucioneve si Instituti Albanologjik. Autorë të njohur përfshijnë Ali Podrimjen, Azem Shkrelin, Anton Pashkun, Rexhep Qosjen dhe Adem Demaçin.

Kjo listë nuk është përfundimtare; redaktorët shtojnë autorë dhe vepra me burime bibliografike, me qëllim që arkivi të mos jetë një kanon i mbyllur.`,
      `Written literature in Kosovo developed strongly after the Second World War through the press, the University of Prishtina and institutions such as the Institute of Albanology. Well-known authors include Ali Podrimja, Azem Shkreli, Anton Pashku, Rexhep Qosja and Adem Demaçi.

This list is not final; editors add authors and works with bibliographic sources, so that the archive is not a closed canon.`),
    evidence: 'established', sourceIds: ['mcys', 'uni-pr'], tags: ['letërsia'],
  }),
  entry({
    id: 'muzika-folklori', area: 'kosova', section: 'kultura', kind: 'article', order: 3,
    title: l('Muzika dhe folklori', 'Music and folklore'),
    summary: l('Lahuta, çiftelia, kënga epike dhe dasma si skenë muzikore: një trashëgimi e gjallë.', 'The lahuta, the çiftelia, epic song and the wedding as a musical stage: a living heritage.'),
    body: l(
      `Kënga epike me lahutë, e njohur përmes Ciklit të Kreshnikëve të mbledhur në vitin 1937, është një nga format më të vjetra të traditës gojore. Instrumente si çiftelia dhe sharkia janë pjesë e muzikës popullore, ndërsa dasma mbetet një nga skenat më të gjalla të këngës dhe vallëzimit.

Në ditët tona, muzika e Kosovës shtrihet nga folku tradicional te pop dhe hip-hop-i, dhe diaspora ka dhënë figura të njohura ndërkombëtarisht.`,
      `Epic song with the lahuta, known through the Cycle of the Frontier Warriors collected in 1937, is one of the oldest forms of oral tradition. Instruments such as the çiftelia and the sharkia belong to folk music, while the wedding remains one of the liveliest stages of song and dance.

Today, music from Kosovo ranges from traditional folk to pop and hip-hop, and the diaspora has produced internationally known figures.`),
    evidence: 'established', sourceIds: ['cultural-cikli', 'mcys'], tags: ['muzika', 'folklori'],
  }),
  entry({
    id: 'veshja-popullore', area: 'kosova', section: 'kultura', kind: 'article', order: 4,
    title: l('Veshja popullore dhe zejet', 'Traditional dress and crafts'),
    summary: l('Plisi, xhubleta, qëndisja dhe filigrani: zeje që ndryshojnë nga një krahinë te tjetra.', 'The plis, the xhubleta, embroidery and filigree: crafts that vary from one region to another.'),
    body: l(
      `Veshja tradicionale ndryshon sipas krahinës. Plisi, kapela e bardhë prej fije, është një nga simbolet më të njohura të veshjes së burrave. Xhubleta, veshja e grave nga veriu, ka formë këmbane dhe prodhohej nga leshi.

Prizreni dhe Gjakova njihen për punimin në filigran të argjendtë. Shumë zeje po humbasin nga mungesa e mjeshtrave të rinj, dhe ruajtja e tyre është një punë kulturore reale.`,
      `Traditional dress varies by region. The plis, the white felt cap, is one of the best-known symbols of men’s dress. The xhubleta, the northern women’s garment, is bell-shaped and made of wool.

Prizren and Gjakova are known for silver filigree work. Many crafts are disappearing for lack of young masters, and preserving them is real cultural work.`),
    evidence: 'established', sourceIds: ['emin-gjiku', 'mcys'], tags: ['veshja', 'zejet'],
  }),
  entry({
    id: 'kuzhina', area: 'kosova', section: 'kultura', kind: 'article', order: 5,
    title: l('Kuzhina: tryezë e përbashkët ballkanike', 'Cuisine: a shared Balkan table'),
    summary: l('Flija, pitet, tava, sarmat dhe ëmbëlsirat: pjata që e tregojnë mikpritjen.', 'Flija, pies, tava, sarma and sweets: dishes that show hospitality.'),
    body: l(
      `Kuzhina e Kosovës i ndan shumë pjata me vendet fqinje, dhe kjo është një pasuri, jo një problem. Ndër pjatat e njohura janë flija e pjekur me shtresa, pitet, tava dhe sarmat, bashkë me ëmbëlsira si bakllavaja.

Në shtëpi dhe në restorante, mikpritja shpesh nis me kafe ose çaj dhe vazhdon me tavolinë të gjerë. Pretendimet për “origjinën” e pjatave janë shpesh të kontestuara dhe këtu nuk marrim anë.`,
      `Kosovo’s cuisine shares many dishes with neighbouring countries, and that is a richness, not a problem. Well-known dishes include layered flija, pies, tava and sarma, with sweets such as baklava.

At home and in restaurants, hospitality often begins with coffee or tea and continues with a generous table. Claims about the "origin" of dishes are often contested and we take no side here.`),
    evidence: 'established', sourceIds: ['emin-gjiku'], tags: ['kuzhina'],
  }),
  entry({
    id: 'besimet', area: 'kosova', section: 'kultura', kind: 'article', order: 6,
    title: l('Trashëgimia fetare: xhami, kisha, teqe, manastire', 'Religious heritage: mosques, churches, tekkes, monasteries'),
    summary: l('Shteti është laik; vendi ka trashëgimi myslimane, katolike, ortodokse dhe bektashiane.', 'The state is secular; the country has Muslim, Catholic, Orthodox and Bektashi heritage.'),
    body: l(
      `Kushtetuta e përcakton Kosovën si shtet laik dhe neutral në çështjet e besimit. Shumica e banorëve janë myslimanë, ka katolikë shqiptarë dhe komunitetet ortodokse kryesisht serbe, si dhe teqe bektashiane.

Xhamia e Sinan Pashës në Prizren, Katedralja e Shenjtë Nënë Tereza në Prishtinë dhe manastiret mesjetare ortodokse janë pjesë e së njëjtës hartë kulturore. Dëmtimet e objekteve fetare në luftë dhe në mars 2004 janë të dokumentuara dhe rindërtimi është çështje e përbashkët.`,
      `The Constitution defines Kosovo as a secular state, neutral in matters of belief. Most residents are Muslim; there are Albanian Catholics and Orthodox communities, mainly Serb, as well as Bektashi tekkes.

The Sinan Pasha Mosque in Prizren, the Cathedral of Saint Mother Teresa in Prishtina and the medieval Orthodox monasteries belong to the same cultural map. Damage to religious sites in the war and in March 2004 is documented, and reconstruction is a shared concern.`),
    evidence: 'established', sourceIds: ['constitution', 'unesco-kosovo', 'mcys'], tags: ['feja', 'trashëgimia'],
  }),
  entry({
    id: 'festivalet', area: 'kosova', section: 'kultura', kind: 'article', order: 7,
    title: l('Festivalet dhe institucionet kulturore', 'Festivals and cultural institutions'),
    summary: l('Dokufest, Sunny Hill, Anibar dhe institucione si Teatri Kombëtar dhe Instituti Albanologjik.', 'Dokufest, Sunny Hill, Anibar, and institutions such as the National Theatre and the Institute of Albanology.'),
    body: l(
      `Dokufest në Prizren, i nisur në vitin 2002, është një nga festivalet kryesore të dokumentarit në rajon. Në Prishtinë mbahet Sunny Hill Festival, i lidhur me fondacionin e këngëtares Dua Lipa, dhe në Pejë festivali i animacionit Anibar.

Ndër institucionet kryesore janë Teatri Kombëtar, Instituti Albanologjik dhe Akademia e Shkencave dhe e Arteve e Kosovës. Datat e festivaleve ndryshojnë çdo vit; shihni faqet zyrtare.`,
      `Dokufest in Prizren, begun in 2002, is one of the region’s principal documentary festivals. Prishtina hosts the Sunny Hill Festival, tied to the foundation of the singer Dua Lipa, and Peja hosts the Anibar animation festival.

Key institutions include the National Theatre, the Institute of Albanology and the Academy of Sciences and Arts of Kosovo. Festival dates change every year; see the official pages.`),
    evidence: 'established', sourceIds: ['dokufest', 'sunny-hill', 'mcys'], tags: ['festivale', 'kultura'],
  }),
];

/* ── VII. Kosova sot ─────────────────────────────────────────────────────── */
const sot: HeritageEntry[] = [
  entry({
    id: 'sot-popullsia', area: 'kosova', section: 'sot', kind: 'article', order: 1, featured: true,
    title: l('Një vend i ri në moshë', 'A country young in age'),
    summary: l('Kosova ka një nga popullatat më të reja në Evropë; kjo është edhe mundësi, edhe presion mbi punësimin.', 'Kosovo has one of Europe’s youngest populations; this is both an opportunity and pressure on employment.'),
    body: l(
      `Popullsia e Kosovës është e re në krahasim me pjesën tjetër të kontinentit. Kjo e bën kapitalin njerëzor një nga burimet kryesore të vendit, por edhe e rrit presionin për vende pune, arsim cilësor dhe shërbime.

Të dhënat zyrtare vijnë nga Agjencia e Statistikave të Kosovës, përfshirë regjistrimin e vitit 2024; shifrat duhet lexuar me vitin e tyre.`,
      `Kosovo’s population is young by comparison with the rest of the continent. That makes human capital one of the country’s main resources, but also raises pressure for jobs, quality education and services.

Official data come from the Kosovo Agency of Statistics, including the 2024 census; figures should be read with their year.`),
    evidence: 'estimate', sourceIds: ['kas'], tags: ['popullsia', 'rinia'],
    claims: [claim('young', l('Kosova ka një nga popullatat më të reja në Evropë', 'Kosovo has one of the youngest populations in Europe'), 'estimate', '2024', ['kas'], l('Krahasim i përgjithshëm; mosha mesatare duhet marrë nga tabela e ASK-së me vitin e saj.', 'A general comparison; the median age must be taken from the KAS table with its year.'))],
  }),
  entry({
    id: 'sot-ekonomia', area: 'kosova', section: 'sot', kind: 'article', order: 2,
    title: l('Ekonomia: rritje dhe pabarazi', 'Economy: growth and inequality'),
    summary: l('Euro si monedhë, remitancat si shtyllë, punësimi i të rinjve si sfidë.', 'The euro as currency, remittances as a pillar, youth employment as a challenge.'),
    body: l(
      `Kosova përdor euron si monedhë. Remitancat nga diaspora kanë qenë një ndër burimet kryesore të të ardhurave të familjeve, dhe sektori i shërbimeve, përfshirë TI-në, ka rritje.

Sfidat janë reale: papunësia, sidomos mes të rinjve dhe grave, ekonomia joformale, dhe varësia nga energjia e prodhuar nga linjiti. Banka Botërore botoi rregullisht analiza; lexoni më të fundit me datë.`,
      `Kosovo uses the euro as its currency. Remittances from the diaspora have been among families’ main sources of income, and the services sector, including IT, is growing.

The challenges are real: unemployment, especially among young people and women, the informal economy, and dependence on lignite-based energy. The World Bank publishes regular analyses; read the most recent with its date.`),
    evidence: 'estimate', sourceIds: ['worldbank-kosovo', 'kas'], tags: ['ekonomia'],
  }),
  entry({
    id: 'sot-arsimi', area: 'kosova', section: 'sot', kind: 'article', order: 3,
    title: l('Arsimi: universitete të reja, cilësi e pabarabartë', 'Education: new universities, uneven quality'),
    summary: l('Nga Universiteti i Prishtinës te universitetet private dhe ato ndërkombëtare; testet ndërkombëtare tregojnë hendeqe cilësie.', 'From the University of Prishtina to private and international universities; international tests show quality gaps.'),
    body: l(
      `Universiteti i Prishtinës u themelua në vitin 1969; sot ekzistojnë gjithashtu universitete publike rajonale dhe institucione private, përfshirë Universitetin Amerikan në Kosovë.

Rezultatet e Kosovës në testin ndërkombëtar PISA kanë qenë nën mesataren e OECD-së. Kjo është një sfidë publike e njohur, e cila lidhet me trajnimin e mësuesve, infrastrukturën dhe kurrikulën.`,
      `The University of Prishtina was established in 1969; today there are also regional public universities and private institutions, including the American University in Kosovo.

Kosovo’s results in the international PISA test have been below the OECD average. This is a well-known public challenge, tied to teacher training, infrastructure and curriculum.`),
    evidence: 'estimate', sourceIds: ['uni-pr', 'worldbank-kosovo'], tags: ['arsimi', 'PISA'],
  }),
  entry({
    id: 'sot-teknologjia', area: 'kosova', section: 'sot', kind: 'article', order: 4,
    title: l('Teknologjia dhe sipërmarrja', 'Technology and entrepreneurship'),
    summary: l('Një ekosistem startup-esh dhe punëtorësh të pavarur po rritet, me qendra si ICK në Prishtinë.', 'An ecosystem of startups and independent workers is growing, with hubs such as ICK in Prishtina.'),
    body: l(
      `Qendra e Inovacionit të Kosovës (ICK) dhe hapësira të tjera bashkëpunimi mbështesin startup-e dhe zhvilluesit e rinj. Shumë të rinj punojnë në mënyrë të pavarur për klientë të huaj.

Rritja është e vërtetë por e brishtë: mungesa e financimit, kapitali i vogël dhe emigrimi i talenteve janë pengesa. Një pasqyrë e ndershme duhet t’i përmendë të dyja.`,
      `The Innovation Centre Kosovo (ICK) and other co-working spaces support startups and young developers. Many young people work independently for foreign clients.

The growth is real but fragile: lack of financing, small capital and the emigration of talent are obstacles. An honest picture must mention both.`),
    evidence: 'estimate', sourceIds: ['ick', 'worldbank-kosovo'], tags: ['teknologji', 'startup'],
  }),
  entry({
    id: 'sot-shendetesia', area: 'kosova', section: 'sot', kind: 'article', order: 5,
    title: l('Shëndetësia: reforma dhe mungesa e burimeve', 'Healthcare: reform and a shortage of resources'),
    summary: l('Sistemi shëndetësor përballet me mungesë burimesh dhe largim të mjekëve drejt jashtë.', 'The health system faces a shortage of resources and the departure of doctors abroad.'),
    body: l(`Shërbimi publik mbështetet te Qendra Klinike Universitare e Kosovës dhe rrjeti i qendrave të mjekësisë familjare. Sfidat përfshijnë financimin, pajisjet dhe mbajtjen e specialistëve. Reformat në sigurimin shëndetësor janë të vazhdueshme; gjendja duhet marrë nga burimet zyrtare me datë.`, `The public service relies on the University Clinical Centre of Kosovo and the network of family-medicine centres. Challenges include financing, equipment and retaining specialists. Health-insurance reforms are ongoing; the state should be taken from official sources with a date.`),
    evidence: 'estimate', sourceIds: ['worldbank-kosovo'], tags: ['shëndetësia'],
  }),
  entry({
    id: 'sot-sfidat', area: 'kosova', section: 'sot', kind: 'article', order: 6,
    title: l('Sfidat që nuk duhen fshehur', 'Challenges that should not be hidden'),
    summary: l('Sundimi i ligjit, korrupsioni, energjia, emigrimi dhe tensionet në veri: një listë e ndershme.', 'Rule of law, corruption, energy, emigration and tensions in the north: an honest list.'),
    body: l(
      `- **Sundimi i ligjit dhe korrupsioni:** raportet e BE-së dhe të Bankës Botërore i përmendin si sfida të vazhdueshme.
- **Energjia:** varësia nga linjiti dhe krizat e furnizimit; tranzicioni drejt burimeve të ripërtëritshme.
- **Emigrimi:** largimi i të rinjve dhe i profesionistëve.
- **Veriu dhe dialogu:** tensione të rishfaqura periodikisht dhe zbatim i pjesshëm i marrëveshjeve.
- **Mediat dhe shoqëria civile:** presioni mbi gazetarët dhe ndërtimi i besimit publik.

Çdo sfidë është e lidhur me burime që kontrollohen dhe përditësohen.`,
      `- **Rule of law and corruption:** EU and World Bank reports cite them as ongoing challenges.
- **Energy:** dependence on lignite and supply crises; the transition to renewables.
- **Emigration:** the departure of young people and professionals.
- **The north and the dialogue:** tensions that reappear periodically and partial implementation of agreements.
- **Media and civil society:** pressure on journalists and building public trust.

Each challenge is tied to sources that are checked and updated.`),
    evidence: 'official-position', sourceIds: ['eu-kosovo', 'worldbank-kosovo', 'eulex', 'dialogue-eu'], tags: ['sfidat'],
  }),
  entry({
    id: 'sot-pjesemarrja', area: 'kosova', section: 'sot', kind: 'article', order: 7,
    title: l('Pjesëmarrja qytetare: çfarë mund të bëni sot', 'Civic participation: what you can do today'),
    summary: l('Raportoni një problem, votoni në sondazhe, ndiqni komunën tuaj: mënyra konkrete për pjesëmarrje.', 'Report a problem, vote in polls, follow your municipality: concrete ways to take part.'),
    body: l(
      `- [Raportoni një problem](/raporto) te komuna ose institucioni përgjegjës.
- [Ndiqni raportin tuaj](/trackid) me Track ID.
- [Votoni në sondazhe](/sondazhet) publike.
- [Njihni komunën tuaj](/komunat) dhe të dhënat e saj.
- [Propozoni një ide](/Idea) për përmirësimin e jetës në qytet.`,
      `- [Report a problem](/raporto) to the responsible municipality or institution.
- [Follow your report](/trackid) with a Track ID.
- [Vote in public polls](/sondazhet).
- [Learn about your municipality](/komunat) and its data.
- [Propose an idea](/Idea) to improve life in your city.`),
    evidence: 'official-position', sourceIds: [], tags: ['pjesëmarrja'],
  }),
];

/* ── VIII. Rinia dhe diaspora ───────────────────────────────────────────── */
const diaspora: HeritageEntry[] = [
  entry({
    id: 'diaspora-historia', area: 'kosova', section: 'diaspora', kind: 'article', order: 1, featured: true,
    title: l('Diaspora: pjesë e shtetit që nga fillimi', 'The diaspora: part of the state from the beginning'),
    summary: l('Në vitet ’90 diaspora financoi shkollat dhe institucionet paralele; në 1998–99 mblodhi ndihma përmes fondeve të ndryshme.', 'In the 1990s the diaspora financed parallel schools and institutions; in 1998–99 it raised support through various funds.'),
    body: l(
      `Gjatë viteve ’90, një pjesë e të ardhurave të diasporës u kanalizua në fondin e qeverisë paralele dhe në shkollat e shtëpive private. Në 1998–1999 fondi “Vendlindja Thërret” mblodhi ndihma, dhe pas luftës remitancat ndihmuan rindërtimin.

Sot diaspora është e pranishme në Gjermani, Zvicër, Austri, SHBA dhe vende të tjera; Ministria e Punëve të Jashtme dhe Diasporës e koordinon marrëdhënien me të. Numrat e saktë ndryshojnë sipas burimeve dhe këtu nuk jepen pa datë.`,
      `During the 1990s part of the diaspora’s income was channelled into the parallel government’s fund and the home-based schools. In 1998–1999 the "Vendlindja Thërret" ("Homeland Calls") fund raised aid, and after the war remittances helped reconstruction.

Today the diaspora is present in Germany, Switzerland, Austria, the US and elsewhere; the Ministry of Foreign Affairs and Diaspora coordinates the relationship with it. Exact numbers differ by source and are not given here without a date.`),
    evidence: 'established', sourceIds: ['judah-kosovo', 'judah-kla', 'mfa'], tags: ['diaspora'],
  }),
  entry({
    id: 'profil-majlinda-kelmendi', area: 'kosova', section: 'diaspora', kind: 'biography', order: 2, livingPerson: true,
    consentNote: 'Figurë publike; vetëm fakte të botuara gjerësisht nga burime sportive zyrtare.',
    date: d('2016-08-07', 'day'),
    title: l('Majlinda Kelmendi: medalja e parë olimpike e Kosovës', 'Majlinda Kelmendi: Kosovo’s first Olympic medal'),
    summary: l('Xhudistja nga Peja fitoi medaljen e artë në Lojërat Olimpike të Rios 2016.', 'The judoka from Peja won gold at the Rio 2016 Olympic Games.'),
    body: l(`Kelmendi fitoi medaljen e artë në xhudo, kategoria deri në 52 kg, në Rio 2016, duke u bërë medaljarja e parë olimpike e Kosovës. Fitorja e saj ndodhi vetëm dy vjet pasi Kosova u njoh nga KON-i.`, `Kelmendi won gold in judo, up to 52 kg, at Rio 2016, becoming Kosovo’s first Olympic medallist. Her win came only two years after Kosovo was recognised by the IOC.`),
    evidence: 'established', sourceIds: ['olympics-kosovo'], tags: ['sporti', 'olimpike'],
  }),
  entry({
    id: 'profil-dua-lipa', area: 'kosova', section: 'diaspora', kind: 'biography', order: 3, livingPerson: true,
    consentNote: 'Figurë publike; vetëm fakte të botuara gjerësisht; pa të dhëna private.',
    title: l('Dua Lipa dhe Sunny Hill: diaspora e lidhur me vendlindjen', 'Dua Lipa and Sunny Hill: a diaspora tied to home'),
    summary: l('E lindur në Londër nga prindër nga Kosova, ajo e mbështet kulturën në Prishtinë përmes fondacionit dhe festivalit Sunny Hill.', 'Born in London to parents from Kosovo, she supports culture in Prishtina through the Sunny Hill foundation and festival.'),
    body: l(`Dua Lipa lindi në Londër, ndërsa prindërit e saj janë nga Kosova. Fondacioni Sunny Hill dhe festivali i lidhur me të mbahet në Prishtinë. Ky shembull tregon një formë të lidhjes së diasporës: kulturë, ngjarje dhe turizëm.`, `Dua Lipa was born in London to parents from Kosovo. The Sunny Hill foundation and the festival tied to it take place in Prishtina. This example shows one form of diaspora connection: culture, events and tourism.`),
    evidence: 'established', sourceIds: ['sunny-hill'], tags: ['diaspora', 'kultura'],
  }),
  entry({
    id: 'profile-te-verteta', area: 'kosova', section: 'diaspora', kind: 'story', order: 4,
    title: l('Profile të vërteta: rregullat tona', 'Real profiles: our rules'),
    summary: l('Botojmë profile vetëm kur ka burim të besueshëm dhe pëlqim ku nevojitet.', 'We publish profiles only with a reliable source and consent where needed.'),
    body: l(
      `- Figurat publike botohen vetëm me fakte të botuara gjerësisht.
- Personat privatë botohen vetëm me pëlqimin e shkruar të tyre.
- Nuk prezantojmë asnjë person si “mik i platformës” ose “i miratuar”.

[Propozoni një profil](/kontakt)`,
      `- Public figures are published only with widely published facts.
- Private persons are published only with their written consent.
- We do not present anyone as a "friend of the platform" or "approved".

[Suggest a profile](/kontakt)`),
    evidence: 'official-position', sourceIds: [], tags: ['profile', 'pëlqim'],
  }),
];

/* ── IX. Kosova për vizitorët ───────────────────────────────────────────── */
const place = (id: string, name: string, municipality: string, order: number, sq: string, en: string, title?: [string, string]) =>
  entry({
    id, area: 'kosova', section: 'vizitore', kind: 'site', order,
    title: title ? l(title[0], title[1]) : l(name, name),
    summary: l(sq.split('\n')[0], en.split('\n')[0]),
    body: l(sq, en), place: { name, municipality }, evidence: 'established', sourceIds: ['tourism-ks', 'mcys'], tags: ['turizëm', name.toLowerCase()],
  });

const vizitore: HeritageEntry[] = [
  place('prishtina', 'Prishtinë', 'Prishtinë', 1,
    `Kryeqyteti, qendra politike, universitare dhe kulturore.\nNë Prishtinë mund të shihni Bibliotekën Kombëtare, monumentin “Newborn”, bulevardin Nënë Tereza, Katedralen e Shenjtë Nënë Tereza dhe Parkun e Gërmisë. Qyteti është baza më e mirë për të nisur udhëtimet.`,
    `The capital, and the political, university and cultural centre.\nIn Prishtina you can see the National Library, the "Newborn" monument, Mother Teresa Boulevard, the Cathedral of Saint Mother Teresa and Germia Park. The city is the best base for day trips.`),
  place('prizreni', 'Prizren', 'Prizren', 2,
    `Qyteti historik i Kosovës, me çarshi, xhami dhe kala.\nXhamia e Sinan Pashës, Ura e Gurit, Kalaja dhe Kompleksi i Lidhjes së Prizrenit janë ndalesat kryesore. Në gusht mbahet Dokufest.`,
    `Kosovo’s historic city, with bazaar, mosques and fortress.\nThe Sinan Pasha Mosque, the Stone Bridge, the Fortress and the League of Prizren complex are the main stops. Dokufest takes place in August.`),
  place('peja', 'Pejë', 'Pejë', 3,
    `Qytet në këmbë të Bjeshkëve të Nemuna.\nNga Peja hyhet në Gryka e Rugovës; aty ndodhet edhe Patrikana e Pejës, e regjistruar nga UNESCO. Kërkohet kujdes nga kushtet e motit për shtigjet malore.`,
    `A city at the foot of the Accursed Mountains.\nFrom Peja you enter the Rugova Gorge; the Patriarchate of Peć, listed by UNESCO, is also here. Take care with weather conditions on mountain trails.`),
  place('gjakova', 'Gjakovë', 'Gjakovë', 4,
    `Qytet me çarshinë e vjetër dhe zeje tradicionale.\nÇarshia e Madhe dhe Xhamia e Hadumit janë pjesë e trashëgimisë osmane. Qyteti u dëmtua rëndë në luftë dhe është rindërtuar.`,
    `A city with an old bazaar and traditional crafts.\nThe Great Bazaar and the Hadum Mosque belong to the Ottoman heritage. The city was badly damaged in the war and has been rebuilt.`),
  place('mitrovica', 'Mitrovicë', 'Mitrovicë', 5,
    `Qytet industrial i ndarë nga lumi Ibër.\nMitrovica është e lidhur me minierën e Trepçës. Pjesa veriore ka shumicë serbe dhe e jugut shumicë shqiptare; para udhëtimit kontrolloni këshillat e qeverisë suaj dhe situatën aktuale.`,
    `An industrial city divided by the Ibar river.\nMitrovica is tied to the Trepça mine. The northern part has a Serb majority and the south an Albanian majority; before travelling check your government’s advice and the current situation.`),
  place('gjilani', 'Gjilan', 'Gjilan', 6,
    `Qendër rajonale e lindjes së Kosovës, në Anamoravë.\nGjilani është bazë e mirë për të njohur rajonin lindor. Për vendet e vizitës, ngjarjet vendore dhe akomodimin shihni burimet e komunës.`,
    `A regional centre of eastern Kosovo, in Anamorava.\nGjilan is a good base for getting to know the eastern region. For places to visit, local events and accommodation see the municipality’s sources.`),
  place('ferizaji', 'Ferizaj', 'Ferizaj', 7,
    `Nyje komunikimi në jug të vendit.\nFerizaji është një nyje hekurudhore dhe rrugore dhe pika e nisjes drejt Sharrit dhe Brezovicës.`,
    `A transport hub in the south of the country.\nFerizaj is a rail and road junction and the starting point for the Sharr mountains and Brezovica.`),
  place('rugova', 'Gryka e Rugovës', 'Pejë', 8,
    `Një nga vendet më të bukura natyrore.\nGryka e Rugovës ka shtigje, via ferrata dhe lidhet me shtigjen ndërkombëtare Peaks of the Balkans. Verifikoni sezonin dhe udhëzimet e sigurisë.`,
    `One of the most beautiful natural places.\nThe Rugova Gorge has trails, a via ferrata and connects to the international Peaks of the Balkans trail. Check the season and safety guidance.`,
    ['Gryka e Rugovës dhe Bjeshkët e Nemuna', 'Rugova Gorge and the Accursed Mountains']),
  place('sharri-brezovica', 'Sharri / Brezovicë', 'Štrpce / Shtërpcë', 9,
    `Mali i Sharrit, parku kombëtar dhe qendra e skijimit.\nSharri ofron skijim dimrin dhe ecje verën. Kontrolloni statusin e shërbimeve dhe zonën e rrezikut para shtegtimit.`,
    `The Sharr mountain, the national park and ski area.\nSharr offers skiing in winter and hiking in summer. Check service status and risk areas before hiking.`,
    ['Sharri dhe Brezovica', 'Sharr and Brezovica']),
  place('natyra', 'Shpella e Gadimes / Ujëvarat e Mirushës', 'Gadime / Malishevë', 10,
    `Shpella dhe ujëvarat si vende të ndalesës.\nShpella e Gadimes dhe Ujëvarat e Mirushës janë vende natyrore që vizitohen shpesh. Orarët dhe kushtet ndryshojnë.`,
    `Caves and waterfalls as stops.\nThe Gadime Cave and the Mirusha Waterfalls are natural sites that are visited often. Hours and conditions change.`,
    ['Shpella e Gadimes dhe Ujëvarat e Mirushës', 'Gadime Cave and the Mirusha Waterfalls']),
  entry({
    id: 'praktike', area: 'kosova', section: 'vizitore', kind: 'article', order: 11,
    title: l('Informacion praktik për vizitorët', 'Practical information for visitors'),
    summary: l('Monedha, numrat e emergjencës, hyrja dhe këshilla për udhëtimin.', 'Currency, emergency numbers, entry and travel advice.'),
    body: l(
      `- **Monedha:** euro.
- **Emergjencat:** 112 si numër i përgjithshëm; kontrolloni numrat e policisë, zjarrfikësve dhe urgjencës në burimin zyrtar para udhëtimit.
- **Kodi telefonik:** +383.
- **Hyrja:** rregullat varen nga shtetësia; kontrolloni Ministrinë e Punëve të Jashtme dhe këshillat e qeverisë suaj.
- **Aeroporti:** Aeroporti Ndërkombëtar “Adem Jashari” pranë Prishtinës.
- **Siguria:** kontrolloni këshillat e udhëtimit të vendit tuaj, veçanërisht për pjesën veriore.`,
      `- **Currency:** euro.
- **Emergencies:** 112 as the general number; check police, fire and ambulance numbers on the official source before travelling.
- **Dialling code:** +383.
- **Entry:** rules depend on nationality; check the Ministry of Foreign Affairs and your government’s advice.
- **Airport:** "Adem Jashari" International Airport near Prishtina.
- **Safety:** check your country’s travel advice, especially for the northern part.`),
    evidence: 'official-position', sourceIds: ['mfa', 'tourism-ks'], tags: ['praktike'],
    claims: [claim('emergency', l('112 është numri i përgjithshëm i emergjencës në Kosovë', '112 is Kosovo’s general emergency number'), 'official-position', '2025', ['tourism-ks'], l('Të verifikohet me burimin zyrtar para botimit përfundimtar.', 'To be verified with the official source before final publication.'))],
  }),
];

/* ── X. Kosova në botë ─────────────────────────────────────────────────── */
const bota: HeritageEntry[] = [
  entry({
    id: 'njohjet', area: 'kosova', section: 'bota', kind: 'article', order: 1, featured: true,
    title: l('Njohja ndërkombëtare', 'International recognition'),
    summary: l('Kosova është njohur nga më shumë se njëqind shtete anëtare të OKB-së sipas qeverisë së saj; lista është e kontestuar nga Serbia.', 'Kosovo is recognised by more than a hundred UN member states according to its government; the list is contested by Serbia.'),
    body: l(
      `Pas shpalljes së pavarësisë më 17 shkurt 2008, njohja erdhi nga shtete të ndryshme, përfshirë shumicën e shteteve të BE-së dhe të NATO-s, por jo të gjitha. Kosova nuk është anëtare e OKB-së; kjo kërkon rekomandimin e Këshillit të Sigurimit.

Numri i saktë i njohjeve është i diskutueshëm: Ministria e Punëve të Jashtme të Kosovës jep një numër, ndërsa Serbia pretendon se disa shtete e kanë tërhequr njohjen. Ky shënim nuk jep një shifër të vetme pa datë; shihni listën zyrtare me datën e saj.`,
      `After the declaration of independence on 17 February 2008, recognition came from various states, including most EU and NATO states, but not all. Kosovo is not a UN member; this requires a recommendation from the Security Council.

The exact number of recognitions is disputed: Kosovo’s Ministry of Foreign Affairs gives one number, while Serbia claims some states have withdrawn recognition. This entry gives no single figure without a date; see the official list with its date.`),
    claims: [claim('recog', l('Kosova është njohur nga më shumë se 100 shtete anëtare të OKB-së (sipas MPJD-së)', 'Kosovo is recognised by more than 100 UN member states (according to the MFA)'), 'official-position', '2025', ['mfa'], l('Vlerësim zyrtar i Kosovës; Serbia e kontestoi listën. Datoni dhe krahasoni me burimin para botimit.', 'An official Kosovo claim; Serbia disputes the list. Date it and compare with the source before publishing.'))],
    evidence: 'official-position', sourceIds: ['mfa', 'icj-2010'], tags: ['njohja'],
  }),
  entry({
    id: 'anetaresimet', area: 'kosova', section: 'bota', kind: 'article', order: 2,
    title: l('Anëtarësimet ndërkombëtare', 'International memberships'),
    summary: l('FMN dhe Banka Botërore (2009), KON (2014), UEFA dhe FIFA (2016) — por jo OKB-ja, UNESCO apo INTERPOL-i.', 'IMF and World Bank (2009), IOC (2014), UEFA and FIFA (2016) — but not the UN, UNESCO or INTERPOL.'),
    body: l(
      `- **FMN dhe Banka Botërore:** qershor 2009.
- **Komiteti Olimpik Ndërkombëtar:** dhjetor 2014.
- **UEFA dhe FIFA:** 13 maj 2016.
- **UNESCO:** votimi i vitit 2015 nuk arriti shumicën e kërkuar prej dy të tretave.
- **OKB:** nuk është anëtare.

Statusi i këtyre marrëdhënieve ndryshon; secila datë dhe gjendje duhet kontrolluar në burimin e organizatës.`,
      `- **IMF and World Bank:** June 2009.
- **International Olympic Committee:** December 2014.
- **UEFA and FIFA:** 13 May 2016.
- **UNESCO:** the 2015 vote did not reach the required two-thirds majority.
- **UN:** not a member.

The status of these relationships changes; each date and state must be checked at the organisation’s source.`),
    evidence: 'official-record', sourceIds: ['worldbank-kosovo', 'olympics-kosovo', 'uefa-fifa', 'unesco-vote-2015'], tags: ['anëtarësimet'],
    claims: [claim('uefa', l('Kosova u pranua në UEFA dhe FIFA më 13 maj 2016', 'Kosovo was admitted to UEFA and FIFA on 13 May 2016'), 'official-record', '2016-05-13', ['uefa-fifa'])],
  }),
  entry({
    id: 'sporti-bota', area: 'kosova', section: 'bota', kind: 'article', order: 3,
    title: l('Sporti: nga përjashtimi te medaljet', 'Sport: from exclusion to medals'),
    summary: l('Një shtet i njohur nga federatat sportive vetëm pas vitit 2014 ka tashmë medalje olimpike.', 'A state admitted to sporting federations only after 2014 already has Olympic medals.'),
    body: l(
      `Kosova debutoi si anëtare e KON-it në Rio 2016, ku Majlinda Kelmendi fitoi medaljen e artë në xhudo. Në Tokio 2020 Distria Krasniqi dhe Nora Gjakova fituan medalje të arta në xhudo.

Ndeshja e parë zyrtare e kualifikimeve të Kupës së Botës, e luajtur me Finlandën më 6 shtator 2016, përfundoi 1–1. Rezultatet e reja sportive duhen gjurmuar tek burimet e federatave.`,
      `Kosovo made its debut as an IOC member in Rio 2016, where Majlinda Kelmendi won gold in judo. In Tokyo 2020 Distria Krasniqi and Nora Gjakova won gold medals in judo.

The first official World Cup qualifying match, played against Finland on 6 September 2016, ended 1–1. New sporting results should be tracked at the federations’ sources.`),
    evidence: 'established', sourceIds: ['olympics-kosovo', 'uefa-fifa'], tags: ['sporti'],
  }),
  entry({
    id: 'kfor-eulex', area: 'kosova', section: 'bota', kind: 'article', order: 4,
    title: l('KFOR, EULEX dhe prania ndërkombëtare', 'KFOR, EULEX and the international presence'),
    summary: l('Prania ushtarake e NATO-s dhe misioni i BE-së për sundimin e ligjit kanë mandate të ndryshme.', 'NATO’s military presence and the EU rule-of-law mission have different mandates.'),
    body: l(`KFOR vepron në bazë të Rezolutës 1244 të OKB-së, ndërsa EULEX është mision i BE-së për sundimin e ligjit. Mandati, numri i personelit dhe funksionet e secilit ndryshojnë dhe duhet të merren nga faqet e tyre zyrtare me datë.`, `KFOR operates under UN Security Council Resolution 1244, while EULEX is the EU rule-of-law mission. The mandate, number of personnel and functions of each change and should be taken from their official pages with a date.`),
    evidence: 'official-record', sourceIds: ['nato-kfor', 'eulex', 'unscr-1244'], tags: ['KFOR', 'EULEX'],
  }),
];

export const KOSOVA_PART3 = [...kultura, ...sot, ...diaspora, ...vizitore, ...bota];
