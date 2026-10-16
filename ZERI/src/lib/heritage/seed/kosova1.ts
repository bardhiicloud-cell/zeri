import { claim, d, entry, l } from './helpers';
import type { HeritageEntry } from '../types';

/* ── I. Kosova na bashkon ───────────────────────────────────────────────── */
const bashkon: HeritageEntry[] = [
  entry({
    id: 'mikpritja', area: 'kosova', section: 'bashkon', kind: 'article', featured: true, order: 1,
    title: l('Mikpritja: një traditë që ka rregulla dhe ka fytyrë', 'Hospitality: a tradition with rules and a human face'),
    summary: l('Mikpritja në Kosovë nuk është vetëm një fjalë e bukur: ajo ka rrënjë në zakone të vjetra, në besë dhe në praktikën e përditshme.', 'Hospitality in Kosovo is not just a phrase: it is rooted in old custom, in the idea of besa, and in everyday practice.'),
    body: l(
      `Në traditën shqiptare mikut i njihet një vend i veçantë. Kanuni i Lekë Dukagjinit, i mbledhur nga Shtjefën Gjeçovi dhe i botuar në formë të plotë në vitin 1933, i kushton rregulla të hollësishme pritjes së mikut, dhe shprehja "Shtëpia e shqiptarit është e Zotit dhe e mikut" është ndër formulimet më të cituara të kësaj tradite.

**Besa** — fjala e dhënë — është pjesë e së njëjtës kulturë: ajo e bën mikpritjen një detyrim moral dhe jo thjesht një mirësjellje.

Ky pasqyrim duhet lexuar me ndershmëri. Kanuni është një trashëgimi gojore e kodifikuar, jo ligj i sotëm, dhe përmban edhe norma që shoqëria moderne i ka lënë pas, si gjakmarrja. Ajo që mbetet gjallë sot është ndjenja e pritjes: kafeja që ofrohet para çdo bisede, tavolina që shtohet kur vjen një mysafir, dhe familja që hap derën për të huajin.`,
      `In Albanian tradition the guest holds a special place. The Kanun of Lekë Dukagjini, collected by Shtjefën Gjeçovi and published in full in 1933, devotes detailed rules to receiving a guest, and the saying "The Albanian's house belongs to God and to the guest" is among the most quoted expressions of this tradition.

**Besa** — the given word — belongs to the same culture: it turns hospitality into a moral obligation rather than a simple courtesy.

This should be read honestly. The Kanun is a codified oral heritage, not today's law, and it also contains norms that modern society has left behind, such as blood feuds. What stays alive today is the feeling of welcome: the coffee offered before any conversation, the table that grows when a guest arrives, the family that opens its door to a stranger.`),
    evidence: 'established', sourceIds: ['kanun'], tags: ['mikpritja', 'besa', 'traditë'],
  }),
  entry({
    id: 'kosova-i-takon-cdokujt', area: 'kosova', section: 'bashkon', kind: 'article', order: 2,
    title: l('Kosova i takon këdo që e quan shtëpi', 'Kosovo belongs to everyone who calls it home'),
    summary: l('Kushtetuta e përcakton Kosovën si shoqëri shumetnike dhe e bazon barazinë para ligjit mbi qytetarinë, jo mbi përkatësinë.', 'The Constitution defines Kosovo as a multi-ethnic society and bases equality before the law on citizenship, not on belonging.'),
    body: l(
      `Neni 3 i Kushtetutës së Republikës së Kosovës e përshkruan vendin si shoqëri shumetnike, e përbërë nga shqiptarët dhe komunitetet e tjera, e qeverisur në mënyrë demokratike dhe me respekt të plotë për sundimin e ligjit.

Kjo nuk e fshin faktin se marrëdhëniet ndëretnike kanë qenë dhe mbeten të vështira në disa zona. Pikërisht ndaj kësaj, ky arkiv ka një rregull: çdo komunitet përshkruhet me burime dhe me emrin që ai e përdor vetë, dhe asnjë komunitet nuk paraqitet si fajtor kolektiv.

Mesazhi nuk është një slogan; është një detyrim kushtetues dhe një detyrë e përditshme e institucioneve, e shkollës dhe e secilit qytetar.`,
      `Article 3 of the Constitution of the Republic of Kosovo describes the country as a multi-ethnic society consisting of Albanians and other communities, democratically governed with full respect for the rule of law.

This does not erase the fact that inter-ethnic relations have been and remain difficult in some areas. That is why this archive follows one rule: each community is described from sources and by the name it uses for itself, and no community is presented as collectively guilty.

The message is not a slogan; it is a constitutional obligation and an everyday task for institutions, schools and every citizen.`),
    evidence: 'official-record', sourceIds: ['constitution'], tags: ['kushtetuta', 'komunitetet'],
  }),
  entry({
    id: 'komunitetet-e-kosoves', area: 'kosova', section: 'bashkon', kind: 'article', order: 3,
    title: l('Komunitetet e Kosovës dhe të drejtat e tyre', 'The communities of Kosovo and their rights'),
    summary: l('Shqiptarë, serbë, boshnjakë, turq, gorane, romë, ashkali dhe egjiptianë: ç’thotë Kushtetuta për gjuhët, përfaqësimin dhe mbrojtjen.', 'Albanians, Serbs, Bosniaks, Turks, Gorani, Roma, Ashkali and Egyptians: what the Constitution says on languages, representation and protection.'),
    body: l(
      `Kushtetuta njeh shqipen dhe serbishten si gjuhë zyrtare të Republikës. Turqishtja, boshnjakishtja dhe romanishtja kanë status të përdorimit zyrtar në nivel komunal, sipas kushteve që përcakton ligji.

Kuvendi ka 120 ulëse, nga të cilat 20 janë të rezervuara për komunitetet jo-shumicë: 10 për komunitetin serb dhe 10 për komunitetet e tjera.

Komunitetet kanë edhe mekanizma mbrojtës, si ligjet vitale dhe përfaqësimi në qeveri. Si funksionojnë këta mekanizma në praktikë — dhe ku kanë dobësi — është pjesë e debatit publik, dhe redaksia e trajton me burime të pavarura, jo me slogane.`,
      `The Constitution recognises Albanian and Serbian as official languages of the Republic. Turkish, Bosnian and Romani have official-use status at municipal level, under the conditions set by law.

The Assembly has 120 seats, of which 20 are reserved for non-majority communities: 10 for the Serb community and 10 for the other communities.

Communities also have protective mechanisms such as vital-interest laws and representation in government. How these work in practice — and where they are weak — is part of public debate, and the newsroom treats it with independent sources rather than slogans.`),
    claims: [claim('seats', l('20 nga 120 ulëset e Kuvendit janë të rezervuara për komunitetet jo-shumicë (10 serbe, 10 të tjera)', '20 of the Assembly’s 120 seats are reserved for non-majority communities (10 Serb, 10 others)'), 'official-record', '2008-06-15', ['constitution'], l('Sipas tekstit të Kushtetutës të hyrë në fuqi më 15 qershor 2008; verifikoni amendamentet.', 'According to the Constitution as it entered into force on 15 June 2008; check later amendments.'))],
    evidence: 'official-record', sourceIds: ['constitution'], tags: ['komunitetet', 'gjuha', 'kuvendi'],
  }),
  entry({
    id: 'solidariteti-1999', area: 'kosova', section: 'bashkon', kind: 'article', order: 4,
    title: l('Solidariteti në ditët më të vështira', 'Solidarity in the hardest days'),
    summary: l('Në pranverën e vitit 1999 qindra mijëra njerëz u detyruan të largoheshin; shumë prej tyre u pritën nga familje që nuk i njihnin.', 'In spring 1999 hundreds of thousands were forced to leave; many were received by families who did not know them.'),
    body: l(
      `Gjatë krizës së refugjatëve të vitit 1999, UNHCR dokumentoi se një pjesë e madhe e të larguarve nga Kosova u pritën jo në kampe, por në shtëpitë e familjeve pritëse në Shqipëri, në Maqedoninë e Veriut dhe në Mal të Zi.

Kjo është një nga format më të dokumentuara të solidaritetit civil. Histori të emërta të njerëzve konkretë nuk i botojmë pa pëlqimin e tyre; shihni më poshtë si mund të dërgoni një histori.`,
      `During the 1999 refugee crisis, UNHCR documented that a large share of those who left Kosovo were received not in camps but in the homes of host families in Albania, North Macedonia and Montenegro.

This is one of the best-documented forms of civil solidarity. We do not publish named stories of real people without their consent; see below for how to send a story.`),
    evidence: 'established', sourceIds: ['unhcr-sowr'], tags: ['solidariteti', 'refugjatët', '1999'],
  }),
  entry({
    id: 'dergo-nje-histori', area: 'kosova', section: 'bashkon', kind: 'story', order: 5,
    title: l('Dërgoni një histori: solidaritet, familje, komunitet', 'Send a story: solidarity, family, community'),
    summary: l('Redaksia mbledh histori të vërteta nga qytetarët, me pëlqim të shkruar dhe pa u shpikur asgjë.', 'The newsroom collects true stories from citizens, with written consent and nothing invented.'),
    body: l(
      `Çdo histori e botuar këtu duhet të jetë e vërtetë, e dhënë me dëshirë nga personi që e ka jetuar, dhe e pajisur me pëlqimin e tij.

- Shkruani çfarë ka ndodhur, ku dhe kur — pa mbivlerësime.
- Tregoni nëse emri mund të botohet; përndryshe e botojmë pa emër.
- Nuk botojmë foto të fëmijëve ose të njerëzve në rrezik pa leje.
- Redaksia e verifikon historinë përpara botimit dhe mund t’ju kërkojë detaje.

[Dërgoni historinë përmes “Lajmëro”](/lajmero)`,
      `Every story published here must be true, freely given by the person who lived it, and accompanied by their consent.

- Tell us what happened, where and when — without exaggeration.
- Say whether your name may be published; otherwise we publish it without one.
- We do not publish photos of children or people at risk without permission.
- The newsroom checks the story before publishing and may ask you for details.

[Send the story through “Lajmëro”](/lajmero)`),
    evidence: 'official-position', sourceIds: [], tags: ['histori', 'pëlqim'],
  }),
];

/* ── II. Historia e Kosovës ─────────────────────────────────────────────── */
const historia: HeritageEntry[] = [
  entry({
    id: 'dardania', area: 'kosova', section: 'historia', kind: 'event', era: 'ancient', date: d('-0400', 'circa', { display: l('shek. IV p.e.s. e tutje', '4th century BCE onwards') }),
    title: l('Dardania: njerëzit e lashtë të këtyre trojeve', 'Dardania: the ancient peoples of these lands'),
    summary: l('Burimet antike përmendin dardanët si popull të Ballkanit qendror, në një hapësirë që përfshin Kosovën e sotme.', 'Ancient authors record the Dardani as a people of the central Balkans, in an area that includes present-day Kosovo.'),
    body: l(
      `Autorët grekë dhe romakë e përmendin Dardaninë dhe dardanët si një popull dhe një shtet të Ballkanit qendror. Pas pushtimit romak, hapësira u përfshi në provincën Moesia Superior dhe më vonë u riorganizua si provincë e veçantë, Dardania.

Kjo pjesë është e dokumentuar. Çështja se si lidhen popullsitë antike me popullsinë e sotme trajtohet te shënimi “Vazhdimësia ilire–shqiptare”.`,
      `Greek and Roman authors mention Dardania and the Dardani as a people and polity of the central Balkans. After the Roman conquest the area was incorporated into the province of Moesia Superior and was later reorganised as a separate province, Dardania.

This part is documented. How the ancient populations relate to today’s population is treated in the entry “Illyrian–Albanian continuity”.`),
    place: { name: 'Kosova qendrore dhe Ballkani qendror' }, evidence: 'established', sourceIds: ['malcolm-kosovo', 'vickers-between'], tags: ['antikitet', 'dardania'],
  }),
  entry({
    id: 'vazhdimesia-ilire', area: 'kosova', section: 'historia', kind: 'article', era: 'ancient', date: d('-0400', 'circa', { display: l('Çështje shkencore e hapur', 'An open scholarly question') }), order: 2,
    title: l('Vazhdimësia ilire–shqiptare: çfarë dihet dhe çfarë debatohet', 'Illyrian–Albanian continuity: what is known and what is debated'),
    summary: l('Pjesa më e madhe e studiuesve e shohin shqipen si gjuhë të një dege të veçantë indoevropiane me rrënjë paleo-ballkanike; marrëdhënia e saktë me ilirishten mbetet çështje debati.', 'Most scholars see Albanian as the sole surviving member of its own Indo-European branch with Palaeo-Balkan roots; the exact relation to Illyrian remains debated.'),
    body: l(
      `Gjuhësia historike e konsideron shqipen një degë të pavarur të indoevropianishtes. Prejardhja e saj nga ilirishtja, trakishtja apo një gjuhë tjetër paleo-ballkanike nuk mund të vërtetohet drejtpërdrejt, sepse ilirishtja është e dëshmuar vetëm me emra vetjakë e vendesh.

Për këtë arsye, pohimet se shqiptarët janë pasardhës të drejtpërdrejtë të ilirëve — dhe pohimet e kundërta — janë interpretime, jo fakte të mbyllura. Ky arkiv nuk merr anë; paraqet çfarë mbështet kërkimi dhe ku mbarojnë provat.`,
      `Historical linguistics regards Albanian as an independent branch of Indo-European. Its descent from Illyrian, Thracian or another Palaeo-Balkan language cannot be proven directly, because Illyrian is attested only through personal and place names.

For that reason, claims that Albanians are direct descendants of the Illyrians — and the opposite claims — are interpretations, not closed facts. This archive does not take a side; it shows what research supports and where the evidence ends.`),
    evidence: 'contested', sourceIds: ['malcolm-kosovo', 'vickers-between'], tags: ['gjuhësi', 'ilirët', 'debat'],
  }),
  entry({
    id: 'ulpiana', area: 'kosova', section: 'historia', kind: 'site', era: 'ancient', date: d('0100', 'circa', { display: l('shek. II – VI e.s.', '2nd – 6th centuries CE') }),
    title: l('Ulpiana: qyteti romak afër Prishtinës', 'Ulpiana: the Roman city near Prishtina'),
    summary: l('Vend arkeologjik i një qyteti romak dhe të vonë antik, i ripërtërirë në shekullin VI si Justiniana Secunda.', 'An archaeological site of a Roman and late-antique city, refounded in the 6th century as Justiniana Secunda.'),
    body: l(
      `Ulpiana ishte qytet i rëndësishëm i provincës së Dardanisë. Pas një tërmeti në shekullin VI u rindërtua nga perandori Justinian dhe u quajt Justiniana Secunda. Vendi ndodhet në periferi të Lipjanit dhe konsiderohet ndër vendet më të rëndësishme arkeologjike të Kosovës.

Për gjendjen aktuale të gërmimeve dhe të mbrojtjes, kontrolloni burimin zyrtar.`,
      `Ulpiana was an important city in the province of Dardania. After an earthquake in the 6th century it was rebuilt by Emperor Justinian and renamed Justiniana Secunda. The site lies near Lipjan and is regarded as one of Kosovo’s most important archaeological sites.

For the present state of excavation and protection, check the official source.`),
    place: { name: 'Ulpiana', municipality: 'Lipjan / Gračanicë' }, evidence: 'established', sourceIds: ['mcys'], tags: ['arkeologji'],
  }),
  entry({
    id: 'mesjeta-manastiret', area: 'kosova', section: 'historia', kind: 'site', era: 'medieval', date: d('1321', 'range', { to: '1350', display: l('shek. XIII – XIV', '13th – 14th centuries') }),
    title: l('Mesjeta: manastiret dhe shteti mesjetar', 'The Middle Ages: monasteries and the medieval state'),
    summary: l('Në mesjetë Kosova ishte pjesë e shtetit të Nemanjiqëve; manastiret e Deçanit, Graçanicës dhe Patrikanës së Pejës janë sot nën mbrojtje ndërkombëtare.', 'In the Middle Ages Kosovo belonged to the Nemanjić state; the monasteries of Dečani, Gračanica and the Patriarchate of Peć are today under international protection.'),
    body: l(
      `Në shekujt XII–XIV zonat e Kosovës ishin pjesë e shtetit mesjetar serb. Në këtë periudhë u ndërtuan manastire të rëndësishme, si Graçanica, Deçani dhe qendra e Patrikanës së Pejës.

“Monumentet Mesjetare në Kosovë” janë regjistruar nga UNESCO në vitin 2004 dhe janë zgjeruar në vitin 2006; ato ndodhen edhe në Listën e Trashëgimisë në Rrezik. UNESCO i regjistron nën emrin e Serbisë, ndërsa Kosova nuk është anëtare e UNESCO-s — një shembull se si edhe trashëgimia kulturore është pjesë e çështjes së statusit.

Këto monumente janë trashëgimi e përbashkët e vendit dhe të njerëzimit; mbrojtja e tyre është detyrim i të gjithëve.`,
      `In the 12th–14th centuries, the lands of Kosovo were part of the medieval Serbian state. Important monasteries were built in this period, such as Gračanica, Dečani and the Patriarchate of Peć.

"Medieval Monuments in Kosovo" were inscribed by UNESCO in 2004 and extended in 2006; they are also on the List of World Heritage in Danger. UNESCO lists them under Serbia, while Kosovo is not a UNESCO member — an example of how even cultural heritage is part of the status question.

These monuments are a shared heritage of the country and of humanity; protecting them is everyone’s duty.`),
    evidence: 'established', sourceIds: ['unesco-kosovo', 'unesco-vote-2015', 'malcolm-kosovo'], tags: ['UNESCO', 'manastire', 'mesjeta'],
  }),
  entry({
    id: 'beteja-1389', area: 'kosova', section: 'historia', kind: 'event', era: 'medieval', date: d('1389-06-15', 'day', { display: l('15/28 qershor 1389', '15/28 June 1389') }),
    title: l('Beteja e Kosovës (1389): ngjarja dhe kujtesa', 'The Battle of Kosovo (1389): the event and the memory'),
    summary: l('Një betejë reale pranë Fushë Kosovës; rrëfimet për pjesëmarrësit, rezultatin dhe kuptimin e saj janë kontestuar nga historiografitë.', 'A real battle near Fushë Kosova; narratives about its participants, outcome and meaning are contested between historiographies.'),
    body: l(
      `Beteja ndodhi më 15 qershor (kalendari julian; 28 qershor sipas atij gregorian) 1389 midis ushtrisë osmane të Sulltan Muratit dhe një koalicioni të udhëhequr nga Princ Lazari. Burimet bashkëkohore janë të pakta, dhe shumica e detajeve që njihen sot vijnë nga burime të mëvonshme, shpesh me karakter legjendar.

Është e diskutueshme se kush ishte në koalicion, si përfundoi beteja dhe çfarë efekti pati. Në kujtesën kombëtare serbe ajo u bë ngjarje themeluese; në kujtesat e tjera ka kuptime të tjera. Si historian, duhet ndarë ngjarja nga miti dhe të shihet se si ky mit është përdorur më vonë në politikë.`,
      `The battle took place on 15 June (Julian calendar; 28 June Gregorian) 1389 between the Ottoman army of Sultan Murad and a coalition led by Prince Lazar. Contemporary sources are scarce, and most details known today come from later, often legendary, sources.

Who was in the coalition, how the battle ended and what effect it had are debated. In Serbian national memory it became a founding event; other memories give it other meanings. A historian should separate the event from the myth and look at how the myth was later used in politics.`),
    place: { name: 'Fushë Kosova', municipality: 'Fushë Kosovë' }, evidence: 'contested', sourceIds: ['malcolm-kosovo', 'vickers-between', 'judah-kosovo'], tags: ['mesjeta', 'beteja', 'mit'],
  }),
  entry({
    id: 'osmanet', area: 'kosova', section: 'historia', kind: 'event', era: 'ottoman', date: d('1455', 'year'),
    title: l('Periudha osmane', 'The Ottoman period'),
    summary: l('Kontrolli osman u konsolidua në shekullin XV dhe zgjati deri në 1912; ndryshoi qytetet, fenë dhe ekonominë.', 'Ottoman control was consolidated in the 15th century and lasted until 1912; it reshaped towns, religion and economy.'),
    body: l(
      `Pas rënies së Novo Bërdës (1455), Kosova ishte nën kontroll osman deri në luftërat ballkanike të 1912. Qytete si Prizreni, Gjakova dhe Peja u zhvilluan si qendra tregtare e zejtare, dhe një pjesë e popullsisë ndryshoi fe gjatë shekujve.

Periudha ka lënë trashëgimi të madhe arkitekturore: xhami, hamame, ura dhe çarshi. Ajo shihet ndryshe nga historiografitë e ndryshme, por trashëgimia e saj është pjesë e së përbashkëtës.`,
      `After the fall of Novo Brdo (1455), Kosovo was under Ottoman control until the Balkan Wars of 1912. Towns such as Prizren, Gjakova and Peja developed as trade and craft centres, and part of the population changed religion over the centuries.

The period left a large architectural legacy: mosques, baths, bridges and bazaars. It is seen differently by different historiographies, but its heritage belongs to everyone.`),
    evidence: 'established', sourceIds: ['malcolm-kosovo', 'vickers-between'], tags: ['osman'],
  }),
  entry({
    id: 'lidhja-e-prizrenit', area: 'kosova', section: 'historia', kind: 'event', era: 'modern', date: d('1878-06-10', 'day'), featured: true,
    title: l('Lidhja Shqiptare e Prizrenit', 'The League of Prizren'),
    summary: l('Më 10 qershor 1878 në Prizren u mblodh një kuvend që u bë qendra e lëvizjes politike shqiptare për autonomi dhe mbrojtje të trojeve.', 'On 10 June 1878 an assembly met in Prizren that became the centre of the Albanian political movement for autonomy and defence of Albanian lands.'),
    body: l(
      `Lidhja u themelua gjatë krizës së Lindjes pas luftës ruso-turke, kur Kongresi i Berlinit po vendoste për kufijtë e Ballkanit. Në fillim ajo u mbështet edhe nga qarqe osmane, por shpejt kërkesat e saj u shndërruan në program autonomie shqiptare.

Lidhja u shua nga autoritetet osmane në vitin 1881, por ka mbetur simbol i zgjimit politik kombëtar. Në Prizren sot ndodhet një kompleks muzeor që i kushtohet kësaj ngjarjeje.`,
      `The League was founded during the Eastern crisis after the Russo-Turkish war, as the Congress of Berlin was deciding the borders of the Balkans. At first it was supported by some Ottoman circles, but its demands soon grew into a programme of Albanian autonomy.

The League was suppressed by the Ottoman authorities in 1881 but remains a symbol of national political awakening. Prizren today has a museum complex devoted to the event.`),
    place: { name: 'Prizren', municipality: 'Prizren' }, evidence: 'established', sourceIds: ['malcolm-kosovo', 'vickers-between'], tags: ['Prizren', '1878'],
  }),
  entry({
    id: 'luftrat-ballkanike', area: 'kosova', section: 'historia', kind: 'event', era: 'modern', date: d('1912', 'range', { to: '1913' }),
    title: l('Luftërat ballkanike: Kosova ndahet nga Shqipëria', 'The Balkan Wars: Kosovo separated from Albania'),
    summary: l('Në vitin 1912 Shqipëria shpalli pavarësinë; Kosova mbeti jashtë kufijve të shtetit të ri.', 'In 1912 Albania declared independence; Kosovo remained outside the new state’s borders.'),
    body: l(
      `Gjatë luftërave ballkanike (1912–1913) Serbia dhe Mali i Zi pushtuan Kosovën. Konferenca e Londrës (1913) e njohu Shqipërinë si shtet, por nuk përfshiu Kosovën brenda kufijve të saj.

Burime të kohës dhe raporte ndërkombëtare dokumentojnë dhunë ndaj civilëve shqiptarë gjatë pushtimit. Ky fillim e ka formësuar kujtesën historike të shqiptarëve të Kosovës për dekada.`,
      `During the Balkan Wars (1912–1913) Serbia and Montenegro occupied Kosovo. The London Conference (1913) recognised Albania as a state but did not include Kosovo within its borders.

Contemporary sources and international reports document violence against Albanian civilians during the occupation. This beginning shaped the historical memory of Kosovo Albanians for decades.`),
    evidence: 'established', sourceIds: ['malcolm-kosovo', 'vickers-between'], tags: ['1912', 'luftërat ballkanike'],
  }),
  entry({
    id: 'lufta-e-dyte-bujan', area: 'kosova', section: 'historia', kind: 'event', era: 'yugoslav', date: d('1943-12-31', 'range', { to: '1944-01-02', display: l('31 dhjetor 1943 – 2 janar 1944', '31 Dec 1943 – 2 Jan 1944') }),
    title: l('Lufta e Dytë Botërore dhe Konferenca e Bujanit', 'World War II and the Bujan Conference'),
    summary: l('Gjatë luftës pjesa më e madhe e Kosovës ishte e bashkuar me Shqipërinë nën kontrollin italian; Konferenca e Bujanit është ngjarje me interpretime të ndryshme.', 'During the war most of Kosovo was joined to Albania under Italian control; the Bujan Conference is an event with different interpretations.'),
    body: l(
      `Në vitin 1941 një pjesë e madhe e Kosovës u bashkua me Shqipërinë nën kontrollin italian. Në fund të vitit 1943 dhe në fillim të 1944, në Bujan, u mblodh një konferencë e komunistëve shqiptarë të Kosovës, e cila miratoi një rezolutë për të drejtën e vetëvendosjes.

Historianët debatojnë për kuptimin dhe zbatimin e kësaj rezolute, dhe për ndikimin që pati në vendimet e mëvonshme, kur Kosova mbeti në Jugosllavi.`,
      `In 1941 a large part of Kosovo was joined to Albania under Italian control. At the end of 1943 and the start of 1944, in Bujan, a conference of Kosovo Albanian communists was held that adopted a resolution on the right to self-determination.

Historians debate the meaning and implementation of that resolution and its influence on later decisions, when Kosovo remained in Yugoslavia.`),
    evidence: 'contested', sourceIds: ['malcolm-kosovo', 'judah-kosovo'], tags: ['Bujan', 'LDB'],
  }),
  entry({
    id: 'autonomia-1974', area: 'kosova', section: 'historia', kind: 'event', era: 'yugoslav', date: d('1945', 'range', { to: '1974' }),
    title: l('Nga krahina autonome te Kushtetuta e 1974', 'From autonomous region to the 1974 Constitution'),
    summary: l('Brenda Jugosllavisë socialiste Kosova kaloi nga një krahinë autonome te statusi i njësisë konstituive de facto.', 'Within socialist Yugoslavia Kosovo moved from an autonomous region to a de facto constituent unit.'),
    body: l(
      `Pas luftës, Kosova u bë krahinë autonome brenda Serbisë. Kushtetuta e Jugosllavisë e vitit 1974 i dha Kosovës shumicën e kompetencave të një njësie federale: përfaqësim në organet federale dhe institucione të veta.

Universiteti i Prishtinës u themelua në vitin 1969 dhe u bë qendër e jetës intelektuale. Autonomia ishte e kufizuar, por ofroi një hapësirë për zhvillim institucional dhe kulturor që më pas u ndërpre.`,
      `After the war, Kosovo became an autonomous region within Serbia. The 1974 Yugoslav Constitution gave Kosovo most of the powers of a federal unit: representation in federal bodies and its own institutions.

The University of Prishtina was established in 1969 and became the centre of intellectual life. Autonomy was limited but offered room for institutional and cultural development that was later interrupted.`),
    evidence: 'established', sourceIds: ['malcolm-kosovo', 'uni-pr'], tags: ['1974', 'autonomia', 'universiteti'],
  }),
  entry({
    id: 'demonstratat-1981', area: 'kosova', section: 'historia', kind: 'event', era: 'yugoslav', date: d('1981-03', 'month'),
    title: l('Demonstratat e vitit 1981', 'The 1981 demonstrations'),
    summary: l('Protesta studentore në Prishtinë, e përhapur në qytete të tjera, që u përgjigj me gjendje të jashtëzakonshme.', 'Student protests in Prishtina that spread to other towns and were met with a state of emergency.'),
    body: l(
      `Protestat filluan në mars 1981 nga një problem i kushteve të jetesës së studentëve dhe u shndërruan në kërkesa politike, përfshirë statusin e Kosovës si republikë. Autoritetet jugosllave futën gjendjen e jashtëzakonshme dhe kryen arrestime masive.

Numrat e viktimave dhe të të dënuarve ndryshojnë sipas burimeve; këtu nuk japim shifër pa burim të saktë.`,
      `The protests began in March 1981 over students’ living conditions and developed into political demands, including Kosovo’s status as a republic. The Yugoslav authorities declared a state of emergency and made mass arrests.

Figures for victims and convictions differ by source; we do not give a number here without a precise source.`),
    evidence: 'established', sourceIds: ['malcolm-kosovo', 'judah-kosovo'], tags: ['1981', 'studentët'],
  }),
  entry({
    id: 'humbja-e-autonomise-1989', area: 'kosova', section: 'historia', kind: 'event', era: 'nineties', date: d('1989-03', 'range', { to: '1990-07' }),
    title: l('1989–1990: kufizimi dhe shfuqizimi i autonomisë', '1989–1990: curtailment and abolition of autonomy'),
    summary: l('Amendamentet e vitit 1989 dhe vendimet e vitit 1990 e zhveshën Kosovën nga institucionet e veta dhe çuan në shkarkime masive.', 'The 1989 amendments and the 1990 decisions stripped Kosovo of its institutions and led to mass dismissals.'),
    body: l(
      `Në mars 1989 Kuvendi i Kosovës u vu nën presion për të miratuar amendamente që e kufizuan autonominë. Në korrik 1990 Serbia e shpërndau Kuvendin dhe Qeverinë e Kosovës.

Pasoi shkarkimi i mijëra shqiptarëve nga puna në administratë, në shëndetësi, në arsim dhe në ndërmarrje, dhe mbyllja e institucioneve shkollore shqipe. Këto ngjarje u dokumentuan nga organizata të të drejtave të njeriut dhe krijuan kontekstin e krizës së viteve ’90.`,
      `In March 1989 the Assembly of Kosovo was put under pressure to adopt amendments that curtailed autonomy. In July 1990 Serbia dissolved the Assembly and Government of Kosovo.

Thousands of Albanians were then dismissed from jobs in administration, health, education and enterprises, and Albanian-language educational institutions were closed. These events were documented by human-rights organisations and set the context for the crisis of the 1990s.`),
    evidence: 'established', sourceIds: ['malcolm-kosovo', 'amnesty-kosovo', 'judah-kosovo'], tags: ['1989', '1990'],
  }),
  entry({
    id: 'rezistenca-paqesore', area: 'kosova', section: 'historia', kind: 'event', era: 'nineties', date: d('1990-09-07', 'range', { to: '1998-02', display: l('1990 – 1998', '1990 – 1998') }),
    title: l('Rezistenca paqësore dhe institucionet paralele', 'Non-violent resistance and parallel institutions'),
    summary: l('Shqiptarët e Kosovës ndërtuan shkolla, shëndetësi dhe qeverisje paralele nën udhëheqjen e Ibrahim Rugovës.', 'Kosovo Albanians built parallel schools, healthcare and government under the leadership of Ibrahim Rugova.'),
    body: l(
      `Në shtator 1990 u shpall në Kaçanik Kushtetuta e Republikës së Kosovës, dhe në shtator 1991 u mbajt një referendum për pavarësi që nuk u njoh nga Beogradi. Në maj 1992 u zgjodh Ibrahim Rugova president i këtij shteti paralel.

Nën udhëheqjen e Lidhjes Demokratike të Kosovës u ndërtuan shkolla dhe klinika në shtëpi private, financuar pjesërisht nga diaspora. Kjo rezistencë ishte e paqësore dhe e jashtëzakonshme për kohën; por mungesa e rezultateve politike, sidomos pas Marrëveshjes së Dejtonit të vitit 1995 që nuk e trajtoi Kosovën, forcoi kërkimin për rrugë të tjera.`,
      `In September 1990 the Constitution of the Republic of Kosovo was proclaimed in Kaçanik, and in September 1991 a referendum on independence was held that Belgrade did not recognise. In May 1992 Ibrahim Rugova was elected president of this parallel state.

Under the leadership of the Democratic League of Kosovo, schools and clinics were built in private homes, financed partly by the diaspora. This resistance was non-violent and remarkable for its time; but the lack of political results, especially after the 1995 Dayton Agreement that did not address Kosovo, strengthened the search for other paths.`),
    evidence: 'established', sourceIds: ['malcolm-kosovo', 'judah-kosovo', 'vickers-between'], tags: ['Rugova', 'LDK', 'rezistenca'],
  }),
  entry({
    id: 'ibrahim-rugova', area: 'kosova', section: 'historia', kind: 'biography', era: 'nineties', date: d('1944', 'range', { to: '2006', display: l('1944 – 2006', '1944 – 2006') }),
    title: l('Ibrahim Rugova (1944–2006)', 'Ibrahim Rugova (1944–2006)'),
    summary: l('Shkrimtar dhe udhëheqës i Lidhjes Demokratike të Kosovës, president i Kosovës prej 1992 deri në vdekje.', 'Writer and leader of the Democratic League of Kosovo, president of Kosovo from 1992 until his death.'),
    body: l(
      `Rugova ishte studiues i letërsisë dhe kryetar i Lidhjes së Shkrimtarëve të Kosovës para se të bëhej udhëheqësi politik më i njohur i viteve ’90. Ai mbrojti rezistencën jo-dhunshme dhe u zgjodh president në zgjedhjet paralele të vitit 1992.

Pas luftës, ai udhëhoqi LDK-në në zgjedhjet e para dhe u bë president i Kosovës në vitin 2002. Vdiq më 21 janar 2006.`,
      `Rugova was a literary scholar and head of the Kosovo Writers’ Association before becoming the best-known political leader of the 1990s. He championed non-violent resistance and was elected president in the parallel elections of 1992.

After the war he led the LDK in the first elections and became President of Kosovo in 2002. He died on 21 January 2006.`),
    evidence: 'established', sourceIds: ['judah-kosovo', 'malcolm-kosovo'], tags: ['biografi', 'Rugova'],
  }),
  entry({
    id: 'adem-demaci', area: 'kosova', section: 'historia', kind: 'biography', era: 'yugoslav', date: d('1936', 'range', { to: '2018', display: l('1936 – 2018', '1936 – 2018') }),
    title: l('Adem Demaçi (1936–2018)', 'Adem Demaçi (1936–2018)'),
    summary: l('Shkrimtar dhe i burgosur politik, një nga figurat më të njohura të rezistencës shqiptare në Jugosllavi.', 'Writer and political prisoner, one of the best-known figures of Albanian resistance in Yugoslavia.'),
    body: l(
      `Demaçi u njoh si shkrimtar, autor i romanit “Gjarpërinjtë e gjakut”, dhe si i burgosur politik, që kaloi dekada të gjata në burgje jugosllave. Pas lirimit u bë zë moral i rezistencës dhe më vonë përfaqësues politik i UÇK-së.

Numri i saktë i viteve të burgimit dhe detajet e rolit të tij në vitet 1998–1999 duhet të lexohen në biografitë e botuara dhe në arkivat e shtypit të kohës.`,
      `Demaçi became known as a writer, author of the novel "Gjarpërinjtë e gjakut", and as a political prisoner who spent long decades in Yugoslav prisons. After release he became a moral voice of the resistance and later a political representative of the KLA.

The exact number of years in prison and the details of his role in 1998–1999 should be read in published biographies and contemporary press archives.`),
    livingPerson: false, evidence: 'established', sourceIds: ['judah-kla', 'malcolm-kosovo'], tags: ['biografi'],
  }),
  entry({
    id: 'unmik-2001-2004', area: 'kosova', section: 'historia', kind: 'event', era: 'unmik', date: d('1999-06-10', 'range', { to: '2008-02', display: l('1999 – 2008', '1999 – 2008') }),
    title: l('Administrimi i OKB-së (UNMIK) dhe ngjarjet e marsit 2004', 'UN administration (UNMIK) and the March 2004 unrest'),
    summary: l('Pas Rezolutës 1244 Kosova u administrua nga OKB-ja; në mars 2004 dhuna ndëretnike u shpërthye në mënyrë të gjerë.', 'After Resolution 1244 Kosovo was administered by the UN; in March 2004 inter-ethnic violence broke out widely.'),
    body: l(
      `Misioni i OKB-së (UNMIK) ushtroi autoritetin legjislativ dhe ekzekutiv deri sa u ngritën Institucionet e Përkohshme të Vetëqeverisjes. Kuvendi u zgjodh për herë të parë në nëntor 2001.

Më 17–18 mars 2004 shpërtheu dhuna ndëretnike në mbarë Kosovën, me viktima nga komunitetet shqiptare dhe serbe, dhe me djegie e dëmtime të kishave ortodokse dhe shtëpive. Ngjarja është dokumentuar nga OKB-ja dhe organizatat e të drejtave të njeriut; ajo tregoi brishtësinë e paqes dhe u bë shtysë për riformësimin e procesit të statusit.`,
      `The UN mission (UNMIK) exercised legislative and executive authority until the Provisional Institutions of Self-Government were set up. The Assembly was elected for the first time in November 2001.

On 17–18 March 2004 inter-ethnic violence broke out across Kosovo, with victims in both Albanian and Serb communities and with burning and damage to Orthodox churches and homes. The event is documented by the UN and human-rights organisations; it showed the fragility of peace and prompted a reshaping of the status process.`),
    evidence: 'established', sourceIds: ['un-sg-unmik', 'unscr-1244'], tags: ['UNMIK', '2004'],
  }),
];

export const KOSOVA_PART1 = [...bashkon, ...historia];
