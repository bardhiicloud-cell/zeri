import { MUNICIPALITY_COORDINATES } from './constants';
import { TOPIC_ROUTES } from './responsibility';
import { REPORT_TOPICS, type ReportTopicId } from './reportTopics';
import type { AccountabilityProfile } from './accountability';

/**
 * Every institution a citizen can address a report to, tied to the report topics.
 *
 * Choosing a topic ("Rrugë") surfaces the bodies that answer it, with the municipal
 * ones named after the municipality the citizen picked ("Komuna e Gjilanit – ...").
 * The stored category stays the canonical `name`, so accountability, routing and
 * older reports keep matching it.
 */
export type SectorLevel = AccountabilityProfile['level'];

export interface SectorEntry {
  /** Canonical value stored on the report. */
  name: string;
  group: string;
  level: SectorLevel;
  institution: string;
  office: string;
  responseHours: number;
  topics: readonly ReportTopicId[];
  keywords: string;
}

const G = {
  infra: 'Infrastruktura dhe Rrugët',
  health: 'Shëndetësia',
  edu: 'Arsimi dhe Shkolla',
  utilities: 'Shërbimet Publike (Kompani & Agjenci)',
  safety: 'Siguria, Policia dhe Emergjencat',
  other: 'Shërbime të Tjera (Lokal dhe Qendror)',
  citizen: 'Shërbimen Qytetare',
  env: 'Mjedsi dhe Natyrë',
  rec: 'Komuna - Rekreatim',
  politics: 'Politika, Drejtësia dhe Administrata',
  economy: 'Ekonomia, Puna dhe Financat',
  agri: 'Bujqësia, Pylltaria dhe Ushqimi',
  culture: 'Kultura, Rinia dhe Sporti',
  transport: 'Transporti dhe Komunikimi',
  family: 'Familja dhe Mirëqenia Sociale',
} as const;

const M = (name: string, group: string, institution: string, office: string, topics: ReportTopicId[], keywords: string, responseHours = 72): SectorEntry =>
  ({ name, group, level: 'Komunale', institution, office, responseHours, topics, keywords });
const C = (name: string, group: string, institution: string, office: string, topics: ReportTopicId[], keywords: string, responseHours = 120): SectorEntry =>
  ({ name, group, level: 'Qendrore', institution, office, responseHours, topics, keywords });
const P = (name: string, group: string, institution: string, office: string, topics: ReportTopicId[], keywords: string, responseHours = 48): SectorEntry =>
  ({ name, group, level: 'Publike', institution, office, responseHours, topics, keywords });
const S = (name: string, group: string, institution: string, office: string, topics: ReportTopicId[], keywords: string, responseHours = 4): SectorEntry =>
  ({ name, group, level: 'Siguri', institution, office, responseHours, topics, keywords });

export const SECTOR_CATALOG: readonly SectorEntry[] = [
  // ── Infrastrukturë dhe rrugë
  M('Komuna - Drejtoria e Infrastrukturës (Rrugë lokale, Gropa, Asfaltim në qytet/fshat)', G.infra, 'Komuna - Drejtoria e Infrastrukturës', 'Drejtoria e Infrastrukturës', ['rruge', 'infrastrukture', 'transport'], 'rrugë, gropë, grop, asfalt, trotuar, dëmtime, kubëza, baltë, pluhur, shtruar, ndërtim, infrastrukturë, lagje, fshat, rrug, rruga, urë, sinjalizim, semafor'),
  C('Ministria e Infrastrukturës (Rrugë magjistrale, Autostrada, Rrugë rajonale)', G.infra, 'Ministria e Mjedisit, Planifikimit Hapësinor dhe Infrastrukturës', 'Sektori i Infrastrukturës', ['rruge', 'infrastrukture', 'transport'], 'rrugë, autostradë, shpronësim, magjistrale, nacionale, rrug, rruga, ura, hekurudha, ndërtim, infrastrukturë'),
  C('Infrastruktura Rrugore e Kosovës (Autostrada, Rrugë nacionale, Mirëmbajtje dimërore)', G.infra, 'Infrastruktura Rrugore e Kosovës', 'Mirëmbajtja e Rrugëve Nacionale', ['rruge', 'infrastrukture'], 'autostradë, nacionale, magjistrale, borë, kripë, shenja, bariera, tuneli, rrugë nacionale'),
  M('Komuna - Parkingjet dhe Qarkullimi (Parkim ilegal, Zona blu, Sinjalizim)', G.transport, 'Komuna - Parkingjet dhe Qarkullimi', 'Drejtoria e Shërbimeve Publike', ['parking', 'transport', 'rruge'], 'parking, parkim, parkingje, zona blu, makina, bllokim, trotuar, rimorkim, kolona, qarkullim'),

  // ── Shëndetësi
  M('Komuna - QKMF / Ambulancat lokale (Shëndetësia primare)', G.health, 'Komuna - QKMF / Ambulancat lokale', 'Drejtoria e Shëndetësisë', ['shendetesi'], 'spital, mjekësi, barna, ambulancë, qkmf, mjek, shëndet, vizitë, mjeku i familjes, lokal, komuna', 24),
  C('Ministria e Shëndetësisë / SHSKUK (QKUK, Spitalet Rajonale)', G.health, 'Ministria e Shëndetësisë / SHSKUK', 'Shërbimi Shëndetësor', ['shendetesi'], 'spital, qkuk, shskuk, operacion, emergjencë, pacient, barna, shëndetësi, nivel qendror, radhë, listë pritjeje', 24),
  C('Instituti Kombëtar i Shëndetësisë Publike (Epidemi, Higjiena, Vaksinim)', G.health, 'Instituti Kombëtar i Shëndetësisë Publike', 'Shëndeti Publik', ['shendetesi'], 'epidemi, vaksinë, vaksinim, higjienë, ujë i pijshëm, sëmundje ngjitëse, ikshpk', 48),
  C('Agjencia e Kosovës për Produkte dhe Pajisje Mjekësore (Barna, Farmaci)', G.health, 'Agjencia e Kosovës për Produkte dhe Pajisje Mjekësore', 'Farmaceutika', ['shendetesi'], 'barna, farmaci, recetë, pajisje mjekësore, bar i falsifikuar, apoteka', 72),

  // ── Arsim
  M('Komuna - Drejtoria e Arsimit (Kopshte, Shkolla fillore dhe të mesme)', G.edu, 'Komuna - Drejtoria e Arsimit', 'Drejtoria e Arsimit', ['arsim', 'femije-familje'], 'shkollë, kopsht, çerdhe, arsim, nxënës, mësues, klasa, fillore, mesme, shkolla, transport shkollor, ngrohje shkollë'),
  C('Ministria e Arsimit, Shkencës dhe Teknologjisë (Universitetet, Kurrikulat)', G.edu, 'Ministria e Arsimit, Shkencës, Teknologjisë dhe Inovacionit', 'Arsimi i Lartë dhe Shkenca', ['arsim', 'shkence-inovacion', 'teknologji-digjitalizim'], 'fakultet, universitet, diplomë, libër, student, edukim, arsimi i lartë, MASHT, bursë, kurrikulë, shkencë, hulumtim'),
  C('Inspektorati i Arsimit (Cilësia e mësimdhënies, Shkelje në shkolla)', G.edu, 'Ministria e Arsimit, Shkencës, Teknologjisë dhe Inovacionit', 'Inspektorati i Arsimit', ['arsim'], 'inspektorat arsimi, shkelje, mësues, diplomë e falsifikuar, rregjistrim, mësim i dobët', 96),

  // ── Shërbime publike
  P('Ujësjellësi Rajonal - KRU (Mungesë uji, Gyp i pëlcitur, Faturim)', G.utilities, 'KRU / Komuna - Shërbimet e Ujit', 'Shërbimet Publike', ['uje-kanalizim'], 'ujë, pijshëm, gyp, kru, reduktim, ndërprerje, faturë, pusetë, rrjedhje, ujësjellës, kanalizim, ujt, uj, uji'),
  M('Komuna - Kanalizimi lokal dhe Ujërat e zeza (Zgjerim rrjeti, Bllokim i madh)', G.utilities, 'KRU / Komuna - Shërbimet e Ujit', 'Shërbimet Publike', ['uje-kanalizim', 'mjedis'], 'kanalizim, ujë i zi, pusetë, erë, bllokim, shpërthim, rrjedhje, fecale, ujrat e zeza, komuna'),
  C('Autoriteti Rregullativ i Ujit - ARRU (Çmimi i ujit, Ankesa ndaj KRU)', G.utilities, 'Autoriteti Rregullativ i Ujit', 'Rregullimi i Shërbimeve të Ujit', ['uje-kanalizim'], 'arru, çmim uji, tarifë, kru, ankesë, matës uji, faturim i gabuar', 96),
  P('KEDS / KESCO (Ndërprerje e rrymës, Kabllo e rrezikshme, Fatura)', G.utilities, 'KEDS / KESCO dhe Komuna', 'Energjia dhe Ndriçimi', ['energji'], 'rrymë, dritë, keds, kesco, trafo, kabllo, ndërprerje, faturë, shtyllë, defekt, energji, prishje, rryma, tension', 24),
  M('Komuna - Ndriçimi Publik (Llamba të djegura në rrugë, Errësirë)', G.utilities, 'KEDS / KESCO dhe Komuna', 'Energjia dhe Ndriçimi', ['energji', 'rruge', 'infrastrukture'], 'dritë, ndriçim, llambë, errësirë, shtyllë, djegur, publik, rrugë, poça, dritat', 24),
  P('BESA / KESH (Energjia elektrike, defekt në linja, shpërndarje)', G.utilities, 'KEDS / KESCO dhe Komuna', 'Energjia dhe Ndriçimi', ['energji'], 'besa, kesh, energji, rrymë, elektrike, defekt, shpërndarje, linja, transformator', 24),
  C('Zyra e Rregullatorit për Energji - ZRRE (Çmimi i rrymës, Ankesa ndaj furnizuesit)', G.utilities, 'Zyra e Rregullatorit për Energji', 'Rregullimi i Energjisë', ['energji'], 'zrre, ero, çmim rryme, tarifë, furnizues, ankesë, matës, kosto', 96),
  P('Termokos / Ngrohja Qendrore (Ngrohje, Radiatorë, Faturim)', G.utilities, 'Termokos / Komuna', 'Shërbimet Publike', ['energji'], 'ngrohje, termokos, ngrohtore, radiator, ftohtë, ngrohja qendrore, kaldaja', 48),
  P('Kompania \'Pastrimi\' (Vonesa në mbledhjen e bërllokut/mbeturinave)', G.utilities, 'Kompania Pastrimi / Komuna - Mjedisi', 'Mjedisi dhe Higjiena', ['mbeturina'], 'mbeturina, bërllok, pastrimi, kontejner, kamion, erë, pastrim, mbetje, berrllok'),
  M('Komuna - Deponi Ilegale, Ndotje e natyrës, dhe Mjedisi', G.utilities, 'Kompania Pastrimi / Komuna - Mjedisi', 'Mjedisi dhe Higjiena', ['mbeturina', 'mjedis', 'pyje-natyre'], 'mbeturina, bërllok, deponi, ilegale, hedhje, natyrë, lumë, pyll, papastërti, mjedis, komuna'),
  P('Telecom Kosovo / Vala (Internet, Telefon fiks, TV kabel)', G.utilities, 'Telecom Kosovo', 'Telekomunikacioni', ['telekomunikacion'], 'telecom, vala, internet, wifi, fiks, tv, kabel, telefon, signal, ipko, z mobile, rrjeti', 72),
  C('Autoriteti Rregullativ i Komunikimeve Elektronike dhe Postare - ARKEP', G.transport, 'Autoriteti Rregullativ i Komunikimeve Elektronike dhe Postare', 'Rregullimi i Komunikimeve', ['telekomunikacion'], 'arkep, operator, spam, sms, faturë telefoni, kontratë, shpejtësi interneti, antenë'),
  P('Posta e Kosovës (Dërgesa, Posta e shpejtë, Paket)', G.utilities, 'Posta e Kosovës', 'Shërbimet Postare', ['telekomunikacion', 'tregti-cmime'], 'posta, dërgesa, paket, shpejtë, post, korrespondencë, dokument'),

  // ── Siguri dhe emergjenca
  S('Policia e Kosovës / Siguria Publike (Krim, Aksident, Prishje e rendit)', G.safety, 'Policia e Kosovës / MPB', 'Siguria Publike', ['polici-siguri'], 'polici, krim, vjedhje, aksident, rrahje, siguri, rrezik, patrollë, armë, rendi, qetësia, drogë, dhunë, kërcënim'),
  M('Inspekcioni Komunal (Zhurmë në lokale, Tregje, Ndërtime pa leje)', G.safety, 'Inspekcioni Komunal', 'Inspekcioni', ['ndertim-banim', 'tregti-cmime', 'mjedis', 'biznes', 'urbanizem'], 'inspektor, treg, çmim, zhurmë, orar, market, ushqim, skaduar, muzikë, kafiteri, lokal, ndërtim, pa leje, uzurpim, inspeksioni'),
  S('Zjarrfikësit dhe Shpëtimi', G.safety, 'Agjencia e Menaxhimit të Emergjencave', 'Emergjencat', ['emergjenca'], 'zjarr, zjarrfikës, tym, djegie, shpëtim, aksident, emergjencë, pyll, 193, 112', 1),
  M('Komuna - Mbrojtja Civile (Përmbytje, Rrëshqitje dheu, Dëbora)', G.safety, 'Agjencia e Menaxhimit të Emergjencave', 'Emergjencat', ['emergjenca'], 'përmbytje, rrëshqitje, dëborë, stuhi, tërmet, mbrojtje civile, evakuim, vërshim, rrezik natyror', 12),
  C('Ministria e Mbrojtjes / FSK (Asistencë në fatkeqësi, Municion i pashpërthyer)', G.safety, 'Agjencia e Menaxhimit të Emergjencave', 'Emergjencat', ['emergjenca', 'polici-siguri'], 'fsk, mina, municion, bombë, eksploziv, ushtri, asistencë fatkeqësi, mbrojtja', 24),

  // ── Shërbime të tjera komunale
  M('Komuna - Qentë endacakë & Kafshët e rrezikshme', G.other, 'Komuna - Zyra përkatëse', 'Administrata Komunale', ['mjedis', 'blegtori'], 'qen, endacak, kafshë, rrezik, sulm, kafshim, strehimore, mace, rrugë, qent'),
  M('Komuna - Transporti Publik (Urbanët, Stacionet, Vonesat)', G.other, 'Komuna - Zyra përkatëse', 'Drejtoria e Shërbimeve Publike', ['transport'], 'autobus, transport, publik, orar, stacion, urban, biletë, vonesë, cilësi, udhëtar, autobusi'),
  M('Komuna - Parqet, Hapësirat e gjelbra, Drunjtë (Mirëmbajtja)', G.other, 'Kompania Pastrimi / Komuna - Mjedisi', 'Mjedisi dhe Higjiena', ['mjedis', 'pyje-natyre'], 'ambient, park, dru, prerje, dëmtim, natyrë, gjelbërim, bar, park, pyll, drunj, lojëra fëmijësh'),
  M('Komuna - Qasja për Personat me Aftësi të Kufizuara (Rampa, Barrierat)', G.other, 'Komuna - Zyra përkatëse', 'Administrata Komunale', ['rruge', 'mireqenie-sociale', 'infrastrukture'], 'qasje, PAK, aftësi, kufizuar, karrocë, shkallë, rampë, pengesë, trotuar'),
  M('Komuna - Zyra e Kryetarit dhe Shërbimi ndaj Qytetarëve (Ankesa, Transparencë, Kuvendi Komunal)', G.politics, 'Komuna - Zyra përkatëse', 'Zyra e Kryetarit', ['komuna', 'politike', 'financa-buxhet', 'teknologji-digjitalizim'], 'kryetar, kuvend komunal, ankesë, transparencë, seancë, vendim, administratë, shërbim, kryetari'),
  M('Komuna - Drejtoria e Financave (Taksa komunale, Tarifa, Buxheti)', G.economy, 'Komuna - Zyra përkatëse', 'Drejtoria e Financave', ['financa-buxhet', 'tatime-dogana', 'komuna'], 'taksë, tarifë, buxhet, shpenzim, tatim në pronë, lejet, borxh, komunale, tatimi në pronë'),
  M('Komuna - Drejtoria e Urbanizmit (Leje ndërtimi, Plan rregullues, Zonim)', G.infra, 'Komuna - Zyra përkatëse', 'Drejtoria e Urbanizmit', ['ndertim-banim', 'urbanizem'], 'leje, ndërtimi, urbanizëm, plan rregullues, zonim, objekt, kat shtesë, legalizim, ndërtim pa leje, banim'),
  M('Komuna - Drejtoria e Kadastrit dhe Pronës (Pronë komunale, Certifikata)', G.citizen, 'Komuna - Zyra përkatëse', 'Drejtoria e Kadastrit', ['ndertim-banim', 'urbanizem'], 'kadastër, pronë komunale, certifikatë pronësie, parcelë, kufi, tokë, uzurpim'),
  M('Komuna - Drejtoria e Kulturës, Rinisë dhe Sportit (Objekte sportive, Qendra rinore)', G.culture, 'Komuna - Zyra përkatëse', 'Drejtoria e Kulturës, Rinisë dhe Sportit', ['sport', 'rinia', 'kulture-trashegimi'], 'sport, stadium, fushë, palestër, kulturë, qendër rinore, teatër, bibliotekë, rini, aktivitet'),
  M('Komuna - Trashëgimia Kulturore (Monumente lokale, Objekte historike)', G.culture, 'Komuna - Zyra përkatëse', 'Drejtoria e Kulturës, Rinisë dhe Sportit', ['kulture-trashegimi'], 'monument, trashëgimi, kala, kishë, xhami, vendbanim historik, kullë, objekt historik, muze, varrezë'),
  M('Komuna - Drejtoria e Bujqësisë dhe Zhvillimit Rural (Subvencione, Rrugë fushore)', G.agri, 'Komuna - Zyra përkatëse', 'Drejtoria e Bujqësisë dhe Zhvillimit Rural', ['bujqesi', 'blegtori'], 'bujqësi, subvencion, tokë bujqësore, rrugë fushore, ujitje, fermer, blegtor, kooperativë, grant'),
  M('Komuna - Drejtoria e Zhvillimit Ekonomik (Biznese lokale, Panaire, Tregjet)', G.economy, 'Komuna - Zyra përkatëse', 'Drejtoria e Zhvillimit Ekonomik', ['biznes', 'ekonomi', 'punesim', 'tregti-cmime', 'industri'], 'biznes, panair, treg, zhvillim ekonomik, investim, zonë ekonomike, leje biznesi, shitës, kioska'),
  M('Komuna - Qendra për Punë Sociale (Fëmijë në rrezik, Dhunë në familje, Kujdestari)', G.family, 'Komuna - Zyra përkatëse', 'Drejtoria e Shëndetësisë dhe Mirëqenies Sociale', ['femije-familje', 'gruaja', 'mireqenie-sociale'], 'punë sociale, fëmijë në rrezik, dhunë në familje, kujdestari, jetim, i moshuar, strehim, përkujdesje, abuzim', 24),
  M('Komuna - Shërbimet Sociale (Ndihma, Vaksinim, Assistencë)', G.citizen, 'Komuna - Zyra përkatëse', 'Drejtoria e Shëndetësisë dhe Mirëqenies Sociale', ['mireqenie-sociale', 'femije-familje'], 'ndihmë, sociale, social, pension, vaksinim, bamirësi, familje'),
  M('Komuna - Zyra për Barazi Gjinore dhe të Drejtat e Njeriut', G.family, 'Komuna - Zyra përkatëse', 'Zyra e Kryetarit', ['gruaja', 'rinia'], 'barazi gjinore, diskriminim, të drejtat e njeriut, grua, ngacmim, pabarazi, zyra e të drejtave'),
  M('Komuna - Gjendja Civile (Certifikata, Regjistrime, Dokumente)', G.citizen, 'Komuna - Zyra përkatëse', 'Administrata Komunale', ['komuna'], 'certifikatë lindjeje, martese, vdekjes, gjendja civile, regjistër, dokument komunal, vërtetim'),
  M('Komuna - Hapësira e lira për Aktivitete të jashtme', G.rec, 'Komuna - Zyra përkatëse', 'Drejtoria e Kulturës, Rinisë dhe Sportit', ['sport', 'rinia', 'mjedis'], 'park, lirë, aktivitet, jashtme, rekreatim, sport, grimotë'),
  M('Komuna - Pazari dhe Tregu (Higjiena, Çmimet, Vendet e shitjes)', G.other, 'Inspekcioni Komunal', 'Inspekcioni', ['tregti-cmime', 'biznes'], 'pazar, treg, shitës, çmim, higjienë, ushqim, bankë shitjeje, tregu i gjelbër'),

  // ── Nivel qendror: administratë, drejtësi, zgjedhje
  C('Ministria e Punëve të Brendshme (Pasaporta, Letërnjoftime, Gjendja Civile)', G.other, 'Ministria e Punëve të Brendshme', 'Shërbimet Administrative', ['polici-siguri', 'komuna', 'qeveri'], 'dokumente, pasaportë, letërnjoftim, kufiri, MPB, patentë shofer, vula'),
  C('Ministria e Drejtësisë (Gjykatat, Prokuroria, Noteria)', G.politics, 'Ministria e Drejtësisë', 'Drejtësia', ['drejtesi'], 'gjykatë, prokurori, burg, avokat, drejtësi, ligj, dënim, korrupsion, hak, noter, vonesë në gjykim'),
  C('Agjencia Kundër Korrupsionit (Konflikt interesi, Pasuri e deklaruar)', G.politics, 'Ministria e Drejtësisë', 'Drejtësia', ['politike', 'drejtesi', 'qeveri'], 'korrupsion, ryshfet, konflikt interesi, deklarim pasurie, nepotizëm, favorizim, zyrtar'),
  C('Ombudspersoni (Shkelje të të drejtave të njeriut nga institucionet)', G.politics, 'Ministria e Drejtësisë', 'Drejtësia', ['drejtesi', 'gruaja', 'femije-familje', 'politike'], 'ombudsperson, të drejtat e njeriut, diskriminim, shkelje, institucion, pakicë, dhunë'),
  C('Komisioni Qendror i Zgjedhjeve (Votimi, Listat e votuesve, Parregullsi)', G.politics, 'Zyra e Kryeministrit', 'Zyra e Kryetarit', ['zgjedhje'], 'zgjedhje, votim, votues, lista, qendër votimi, parregullsi, kqz, fushatë, votë të blera'),
  C('Zyra e Kryeministrit / Qeveria (Vendime qeveritare, Shërbime shtetërore)', G.politics, 'Zyra e Kryeministrit', 'Zyra e Kryetarit', ['qeveri', 'politike'], 'qeveri, kryeministër, ministri, vendim qeverie, institucion shtetëror, administratë publike'),
  C('Kuvendi i Kosovës (Deputetët, Ligjet, Komisionet)', G.politics, 'Zyra e Kryeministrit', 'Zyra e Kryetarit', ['politike', 'zgjedhje'], 'kuvend, deputet, ligj, komision, seancë, parti, politikë'),
  C('Ministria e Administrimit të Pushtetit Lokal (Ankesa për komunat)', G.politics, 'Ministria e Administrimit të Pushtetit Lokal', 'Pushteti Lokal', ['komuna', 'politike'], 'mapl, pushtet lokal, komunë, kryetar, ankesë për komunën, mosveprim komune, kuvend komunal', 96),
  C('Komisioni Rregullativ i Prokurimit Publik (Tendera, Prokurim, Kontrata)', G.economy, 'Ministria e Financave, Punës dhe Transfereve', 'Financat dhe Mirëqenia Sociale', ['financa-buxhet', 'politike', 'infrastrukture'], 'prokurim, tender, kontratë publike, oferta, shpenzim publik, manipulim, shpallje'),

  // ── Ekonomi, punë, financa
  C('Ministria e Financave, Punës dhe Transfereve (ATK, Dogana, Pensionet)', G.other, 'Ministria e Financave, Punës dhe Transfereve', 'Financat dhe Mirëqenia Sociale', ['financa-buxhet', 'punesim', 'tatime-dogana', 'mireqenie-sociale', 'ekonomi'], 'financa, para, tatim, atk, dogana, punë, pagë, pension, social, ndihmë, skema sociale'),
  C('Administrata Tatimore e Kosovës - ATK (Evazion, Kupon fiskal, TVSH)', G.economy, 'Ministria e Financave, Punës dhe Transfereve', 'Financat dhe Mirëqenia Sociale', ['tatime-dogana', 'biznes', 'tregti-cmime'], 'atk, evazion, kupon fiskal, tvsh, pa faturë, biznes pa regjistrim, punë pa kontratë'),
  C('Dogana e Kosovës (Kontrabandë, Importi, Pika kufitare)', G.economy, 'Ministria e Financave, Punës dhe Transfereve', 'Financat dhe Mirëqenia Sociale', ['tatime-dogana', 'tregti-cmime'], 'dogana, kontrabandë, import, kufi, mall pa deklaruar, taksë doganore, pikë kufitare', 72),
  C('Inspektorati i Punës (Kushtet e punës, Paga e papaguar, Punë pa kontratë)', G.economy, 'Ministria e Financave, Punës dhe Transfereve', 'Financat dhe Mirëqenia Sociale', ['punesim'], 'inspektorat i punës, pagë e papaguar, kontratë pune, orë shtesë, siguri në punë, aksident në punë, punëtor', 72),
  C('Agjencia e Punësimit (Zyra e punës, Trajnime, Të papunët)', G.economy, 'Ministria e Financave, Punës dhe Transfereve', 'Financat dhe Mirëqenia Sociale', ['punesim', 'rinia'], 'zyra e punës, i papunë, trajnim, vend pune, regjistrim, praktikë'),
  C('Trusti Pensional i Kosovës (Kursimet pensionale)', G.economy, 'Ministria e Financave, Punës dhe Transfereve', 'Financat dhe Mirëqenia Sociale', ['mireqenie-sociale', 'punesim'], 'trusti, pension, kursime, kontribut, tërheqje, pensionist', 96),
  C('Ministria e Ekonomisë (Energjia, Minierat, Privatizimi)', G.economy, 'Ministria e Ekonomisë', 'Ekonomia', ['ekonomi', 'energji', 'industri'], 'ekonomi, energji, miniera, privatizim, ndërmarrje publike, nxjerrje mineralesh, koncesion'),
  C('Ministria e Industrisë dhe Tregtisë / MINT (Mbrojtja e Konsumatorit)', G.other, 'Ministria e Industrisë, Ndërmarrësisë, Tregtisë dhe Inovacionit', 'Industria dhe Tregtia', ['tregti-cmime', 'industri', 'biznes'], 'industri, tregti, biznes, inspektorat qendror, çmime, konsumator, fabrikë, naftë, doganë'),
  C('Inspektorati i Tregut (Siguria e produkteve, Çmime të rritura, Mall i skaduar)', G.economy, 'Ministria e Industrisë, Ndërmarrësisë, Tregtisë dhe Inovacionit', 'Industria dhe Tregtia', ['tregti-cmime'], 'inspektorat tregu, produkt i skaduar, çmim i rritur, mall i falsifikuar, shitje pa leje, garanci'),
  C('Agjencia e Zhvillimit të Biznesit (Regjistrimi, Leje tregti)', G.citizen, 'Ministria e Industrisë, Ndërmarrësisë, Tregtisë dhe Inovacionit', 'Industria dhe Tregtia', ['biznes'], 'biznes, regjistrim, tregti, leje, kompani, nipt'),
  C('Agjencia e Mbrotjes së Konsumatorit (Çmime, Skauda)', G.citizen, 'Ministria e Industrisë, Ndërmarrësisë, Tregtisë dhe Inovacionit', 'Industria dhe Tregtia', ['tregti-cmime'], 'konsumator, çmim, skauda, mbrojtje, super, bazar, kualitet'),
  C('Autoriteti Kosovar i Konkurrencës (Monopol, Marrëveshje çmimesh)', G.economy, 'Ministria e Industrisë, Ndërmarrësisë, Tregtisë dhe Inovacionit', 'Industria dhe Tregtia', ['tregti-cmime', 'ekonomi', 'biznes'], 'monopol, kartel, konkurrencë, marrëveshje çmimesh, dominim tregu', 168),
  C('Agjencia e Kosovës e Privatizimit (Prona shoqërore, Ndërmarrje të privatizuara)', G.economy, 'Ministria e Ekonomisë', 'Ekonomia', ['ekonomi', 'industri'], 'privatizim, pronë shoqërore, ndërmarrje shoqërore, likuidim, punëtorë të ish-ndërmarrjeve', 168),

  // ── Mjedis, bujqësi
  C('Ministria e Mjedisit, Planifikimit Hapësinor dhe Infrastrukturës (Leje mjedisore, Plan hapësinor)', G.env, 'Ministria e Mjedisit, Planifikimit Hapësinor dhe Infrastrukturës', 'Sektori i Infrastrukturës', ['mjedis', 'urbanizem', 'infrastrukture', 'ndertim-banim'], 'leje mjedisore, planifikim hapësinor, ndotje industriale, gurore, hidrocentral, ndërtim në zonë të mbrojtur'),
  C('Agjencia e Kosovës për Mbrojtjen e Mjedisit (Cilësia e ajrit, Ndotja e ujit)', G.env, 'Ministria e Mjedisit, Planifikimit Hapësinor dhe Infrastrukturës', 'Sektori i Infrastrukturës', ['mjedis'], 'ajër, ndotje, tym, pluhur, lumë i ndotur, kimikate, ndotje e ajrit, pm10, ndotje industriale', 72),
  C('Agjencia Meteorologjake e Kosovës (Parashikimet e motit, Stuhie)', G.env, 'Agjencia e Menaxhimit të Emergjencave', 'Emergjencat', ['mjedis', 'emergjenca'], 'meteo, mot, stuhie, reshje, borë, parashikim, klima'),
  C('Ministria e Bujqësisë, Pylltarisë dhe Zhvillimit Rural (Subvencione, Pyjet, Tokat)', G.agri, 'Ministria e Bujqësisë, Pylltarisë dhe Zhvillimit Rural', 'Bujqësia', ['bujqesi', 'blegtori', 'pyje-natyre'], 'subvencion, grant bujqësor, tokë bujqësore, pyll, fermer, bujk, kulturë, ujitje, lopë, qumësht'),
  C('Agjencia Pyjore e Kosovës (Prerje ilegale, Zjarre në pyje, Mbrojtja e pyjeve)', G.agri, 'Ministria e Bujqësisë, Pylltarisë dhe Zhvillimit Rural', 'Bujqësia', ['pyje-natyre'], 'prerje ilegale, pyll, dru zjarri, pylltar, gjueti, zjarr në pyll, tërheqje druri', 48),
  C('Agjencia e Ushqimit dhe Veterinarisë (Siguria e ushqimit, Sëmundje shtazore)', G.agri, 'Ministria e Bujqësisë, Pylltarisë dhe Zhvillimit Rural', 'Bujqësia', ['blegtori', 'tregti-cmime', 'shendetesi'], 'ushqim, veterinar, sëmundje shtazore, mish, qumësht, helmim ushqimor, thertore, fermë, ruajtje ushqimi', 48),

  // ── Kulturë, rini, sport
  C('Ministria e Kulturës, Rinisë dhe Sportit (Trashëgimia, Sporti, Rinia)', G.culture, 'Ministria e Kulturës, Rinisë dhe Sportit', 'Kultura, Rinia dhe Sporti', ['kulture-trashegimi', 'sport', 'rinia'], 'kulturë, trashëgimi, monument, muze, arkeologji, sport, federatë, rini, grant kulturor, teatër'),

  // ── Transport
  C('Inspektorati i Transportit Rrugor (Linja pa leje, Taksi, Autobusë të vjetër)', G.transport, 'Ministria e Mjedisit, Planifikimit Hapësinor dhe Infrastrukturës', 'Sektori i Infrastrukturës', ['transport', 'rruge'], 'taksi, linjë ndërqytetëse, autobus, pa leje, inspektorat transporti, tarifë, kontroll teknik, trafik'),
  P('Hekurudhat e Kosovës (Trenat, Stacionet, Vonesa)', G.transport, 'Hekurudhat e Kosovës', 'Shërbimet Publike', ['transport'], 'tren, hekurudhë, stacion, biletë, vonesë treni, vagon'),
  P('Aeroporti Ndërkombëtar i Prishtinës (Shërbime, Siguria, Parkingu)', G.transport, 'Aeroporti Ndërkombëtar i Prishtinës', 'Shërbimet Publike', ['transport', 'diaspora'], 'aeroport, fluturim, bagazh, biletë, parking aeroporti, kontroll, vonesë'),

  // ── Familja, gruaja, diaspora, teknologji, Evropa
  C('Agjencia për Barazi Gjinore (Diskriminim gjinor, Ngacmim seksual)', G.family, 'Zyra e Kryeministrit', 'Zyra e Kryetarit', ['gruaja', 'punesim'], 'barazi gjinore, diskriminim, ngacmim, grua, nënë, shtatzëni, paga e pabarabartë', 96),
  C('Ministria e Punëve të Jashtme dhe Diasporës (Konsullata, Dokumente jashtë vendit)', G.politics, 'Ministria e Punëve të Jashtme dhe Diasporës', 'Diaspora dhe Marrëdhëniet me Botën', ['diaspora', 'integrim-bota'], 'diasporë, mërgatë, konsullatë, ambasadë, vizë, dokument jashtë vendit, viza, bashkim evropian, integrim'),
  C('Agjencia e Shoqërisë së Informacionit (e-Kosova, Shërbime digjitale)', G.other, 'Zyra e Kryeministrit', 'Zyra e Kryetarit', ['teknologji-digjitalizim'], 'e-kosova, shërbim digjital, portal, platformë online, autentikim, aplikim online, sistem i rrënuar', 96),
  C('Agjencia për Informim dhe Privatësi (Mbrojtja e të dhënave personale)', G.politics, 'Ministria e Drejtësisë', 'Drejtësia', ['teknologji-digjitalizim', 'drejtesi'], 'të dhëna personale, privatësi, kamera, rrjedhje të dhënash, gdpr, publikim pa leje', 120),
  C('Agjencia e Pronarëzimit të Kosovës (Akte pronash, Hiri, Noter)', G.citizen, 'Ministria e Drejtësisë', 'Drejtësia', ['ndertim-banim', 'urbanizem', 'drejtesi'], 'pronë, apartament, vula, hiri, noter, titull, pasurie, kadastër'),
];

const BY_NAME = new Map(SECTOR_CATALOG.map(entry => [entry.name, entry]));

/** The catalog entry for a stored category, if the category came from this catalog. */
export function sectorByName(name: string | undefined | null): SectorEntry | undefined {
  return name ? BY_NAME.get(name) : undefined;
}

const fold = (value: string) =>
  value.toLocaleLowerCase('sq-AL').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ë/g, 'e').replace(/ç/g, 'c');

/** "Gjilan" → "Gjilanit" is not safe to derive, so the label uses the plain name. */
export function sectorLabel(entry: SectorEntry, municipality: string): string {
  if (entry.level !== 'Komunale' || !municipality) return entry.name;
  return entry.name.replace(/^Komuna - /, `Komuna ${municipality} - `);
}

export const LEVEL_LABEL: Record<SectorLevel, string> = {
  Komunale: 'Komunal',
  Qendrore: 'Qendror',
  Publike: 'Ndërmarrje publike',
  Siguri: 'Siguri / Urgjencë',
};

export interface SectorSuggestion {
  entry: SectorEntry;
  label: string;
  /** One plain line saying why it is suggested. */
  reason: string;
  score: number;
}

/**
 * Bodies that answer a topic, best first.
 *
 * Order: the body the topic's routing rule names first (municipal topics start with
 * the municipality, central topics with the ministry, zone topics with both), then
 * the others for the topic; words from the title/description lift an entry whose
 * keywords they match. With no municipality yet, municipal entries are still offered
 * but flagged so the citizen knows the location decides the final recipient.
 */
export function suggestSectors(input: { topicId?: string; municipality?: string; text?: string }, max = 6): SectorSuggestion[] {
  const topicId = input.topicId as ReportTopicId | undefined;
  const topicKnown = Boolean(topicId && REPORT_TOPICS.some(topic => topic.id === topicId));
  const route = topicKnown ? TOPIC_ROUTES[topicId!] : undefined;
  const municipality = input.municipality ?? '';
  const words = Array.from(new Set(fold(input.text ?? '').split(/[^a-z0-9]+/).filter(word => word.length >= 4)));

  const scored: SectorSuggestion[] = [];
  for (const entry of SECTOR_CATALOG) {
    const onTopic = topicKnown && entry.topics.includes(topicId!);
    const haystack = fold(`${entry.name} ${entry.keywords}`);
    const hits = words.filter(word => haystack.includes(word)).length;
    if (!onTopic && hits === 0) continue;

    let score = onTopic ? 10 : 0;
    // The first topic listed is the entry's main one.
    if (onTopic && entry.topics[0] === topicId) score += 3;
    if (route) {
      const municipal = entry.level === 'Komunale';
      if (route.rule === 'municipal' && municipal) score += 4;
      if (route.rule === 'central' && !municipal) score += 4;
      // Zone topics start with the municipality (the urban default), the state second.
      if (route.rule === 'zone') score += municipal ? 3 : 1;
    }
    score += Math.min(hits, 4) * 2;
    if (!onTopic) score -= 4;

    const reason = onTopic
      ? entry.level === 'Komunale'
        ? municipality ? `Përgjegjësi e komunës ${municipality}` : 'Përgjegjësi komunale; zgjidhni komunën'
        : 'Përgjegjësi e nivelit qendror'
      : 'Përputhet me përshkrimin tuaj';
    scored.push({ entry, label: sectorLabel(entry, municipality), reason, score });
  }
  return scored.sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name, 'sq')).slice(0, max);
}

const EARTH_KM = 6371;
export const KOSOVO_BOUNDS = { minLat: 41.85, maxLat: 43.27, minLng: 20.0, maxLng: 21.81 } as const;

export function insideKosovo(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= KOSOVO_BOUNDS.minLat && lat <= KOSOVO_BOUNDS.maxLat
    && lng >= KOSOVO_BOUNDS.minLng && lng <= KOSOVO_BOUNDS.maxLng;
}

function distanceKm(a: [number, number], b: [number, number]): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

/** The municipality whose centre is closest to a point, with the distance. */
export function nearestMunicipality(lat: number, lng: number): { name: string; km: number } | null {
  let best: { name: string; km: number } | null = null;
  for (const [name, center] of Object.entries(MUNICIPALITY_COORDINATES)) {
    const km = distanceKm([lat, lng], center);
    if (!best || km < best.km) best = { name, km };
  }
  return best;
}

export type LocationCheck =
  | { status: 'ok' }
  | { status: 'outside'; message: string }
  | { status: 'mismatch'; message: string; suggested: string };

/** Pin and municipality must agree; a pin outside Kosovo is refused, a far-off municipality is flagged. */
export function checkLocation(lat: number, lng: number, municipality: string): LocationCheck {
  if (!insideKosovo(lat, lng)) {
    return { status: 'outside', message: 'Pika në hartë është jashtë Kosovës. Zhvendoseni gjilpërën te vendi i problemit.' };
  }
  const nearest = nearestMunicipality(lat, lng);
  const chosen = MUNICIPALITY_COORDINATES[municipality];
  if (!nearest || !chosen) return { status: 'ok' };
  const toChosen = distanceKm([lat, lng], chosen);
  // Municipalities are up to ~35 km across; beyond that the pin is almost surely in another one.
  if (toChosen > 35 && nearest.name !== municipality && nearest.km + 15 < toChosen) {
    return {
      status: 'mismatch',
      suggested: nearest.name,
      message: `Pika në hartë duket më afër komunës ${nearest.name} se ${municipality}. Kontrolloni komunën ose lëvizeni gjilpërën.`,
    };
  }
  return { status: 'ok' };
}
