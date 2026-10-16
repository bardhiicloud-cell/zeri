import type { HeritageSource } from '../types';

/**
 * Source register shipped with the archive.
 *
 * Rules kept here on purpose:
 *  - `url` is the institution's own address (or the document's canonical symbol address); no deep
 *    link is written from memory. A deep link that is not certain is left out and the document is
 *    identified by `reference` (docket / symbol / title) so a researcher can find it.
 *  - `linkChecked` is `false` for every entry: the build environment had no outbound access to
 *    these hosts, so no link was opened. An editor sets it to `true` in the CMS after opening it.
 */
const s = (
  id: string, type: HeritageSource['type'], publisher: string, title: string,
  extra: Partial<HeritageSource> = {},
): HeritageSource => ({ id, type, publisher, title, linkChecked: false, origin: 'seed', ...extra });

export const SEED_SOURCES: HeritageSource[] = [
  // ── Courts & tribunals ──────────────────────────────────────────────────────
  s('icty-milutinovic', 'court', 'ICTY (Tribunali Ndërkombëtar Penal për ish-Jugosllavinë)', 'Prosecutor v. Milutinović et al., IT-05-87 — Trial Judgement', {
    date: '2009-02-26', url: 'https://www.icty.org/en/case/milutinovic', reference: 'IT-05-87; Appeals Judgement (Šainović et al.) 23 Janar 2014' }),
  s('icty-djordjevic', 'court', 'ICTY', 'Prosecutor v. Đorđević, IT-05-87/1 — Trial and Appeals Judgements', {
    date: '2011-02-23', url: 'https://www.icty.org/en/case/djordjevic', reference: 'IT-05-87/1; Appeals Judgement 27 Janar 2014' }),
  s('icty-limaj', 'court', 'ICTY', 'Prosecutor v. Limaj et al., IT-03-66 — Trial Judgement', {
    date: '2005-11-30', url: 'https://www.icty.org/en/case/limaj', reference: 'IT-03-66; Appeals Judgement 27 shtator 2007' }),
  s('icty-haradinaj', 'court', 'ICTY', 'Prosecutor v. Haradinaj et al., IT-04-84 / IT-04-84bis — Judgements', {
    date: '2012-11-29', url: 'https://www.icty.org/en/case/haradinaj', reference: 'IT-04-84; IT-04-84bis (rigjykimi)' }),
  s('icty-milosevic', 'court', 'ICTY', 'Prosecutor v. Milošević, IT-02-54 — Kosovo indictment', {
    date: '1999-05-24', url: 'https://www.icty.org/en/case/slobodan_milosevic', reference: 'IT-99-37 (aktakuza për Kosovën, e konfirmuar 24 maj 1999)' }),
  s('ksc', 'court', 'Dhomat e Specializuara të Kosovës dhe Zyra e Prokurorit të Specializuar', 'Kosovo Specialist Chambers & Specialist Prosecutor’s Office — informacione për çështjet', {
    url: 'https://www.scp-ks.org', note: 'Statusi i çdo çështjeje ndryshon; lexoni vendimin e fundit në faqen e Dhomave.' }),
  s('icj-2010', 'court', 'Gjykata Ndërkombëtare e Drejtësisë (GJND)', 'Accordance with International Law of the Unilateral Declaration of Independence in respect of Kosovo — Advisory Opinion', {
    date: '2010-07-22', url: 'https://www.icj-cij.org/case/141', reference: 'ICJ Reports 2010, p. 403' }),

  // ── UN, NATO & international organisations ──────────────────────────────────
  s('unscr-1244', 'international', 'Këshilli i Sigurimit i OKB-së', 'Rezoluta 1244 (1999)', {
    date: '1999-06-10', url: 'https://undocs.org/S/RES/1244(1999)', reference: 'S/RES/1244 (1999)' }),
  s('unscr-1199', 'international', 'Këshilli i Sigurimit i OKB-së', 'Rezoluta 1199 (1998)', {
    date: '1998-09-23', url: 'https://undocs.org/S/RES/1199(1998)', reference: 'S/RES/1199 (1998)' }),
  s('ahtisaari', 'international', 'Të Dërguarit e Veçantë të OKB-së për Kosovën (M. Ahtisaari)', 'Comprehensive Proposal for the Kosovo Status Settlement', {
    date: '2007-03-26', url: 'https://undocs.org/S/2007/168/Add.1', reference: 'S/2007/168/Add.1' }),
  s('unhcr-sowr', 'international', 'UNHCR', 'The State of the World’s Refugees 2000 — kapitulli për Kosovën', {
    date: '2000', url: 'https://www.unhcr.org', reference: 'The State of the World’s Refugees 2000: Fifty Years of Humanitarian Action, kap. 10' }),
  s('icrc-missing', 'international', 'Komiteti Ndërkombëtar i Kryqit të Kuq (ICRC)', 'Persons Missing in Connection with the Events in Kosovo — Book of Missing Persons dhe përditësimet', {
    url: 'https://www.icrc.org', note: 'Numri i të zhdukurve përditësohet; përdorni versionin më të fundit të ICRC-së.' }),
  s('osce-asseen', 'international', 'OSBE / ODIHR', 'Kosovo/Kosova: As Seen, As Told (1999)', {
    date: '1999', url: 'https://www.osce.org', reference: 'OSCE ODIHR, Kosovo/Kosova As Seen, As Told, Pjesa I (tetor 1998–qershor 1999)' }),
  s('osce-kvm', 'international', 'OSBE', 'Misioni Verifikues i OSBE-së në Kosovë (KVM) — raporte dhe mandati', {
    date: '1998-10', url: 'https://www.osce.org', reference: 'Vendimi i Këshillit të Përhershëm PC.DEC/263 (1998)' }),
  s('un-sg-unmik', 'international', 'OKB / UNMIK', 'Raportet e Sekretarit të Përgjithshëm për Misionin e OKB-së në Kosovë', {
    url: 'https://unmik.unmissions.org', note: 'Seria e raporteve periodike drejtuar Këshillit të Sigurimit.' }),
  s('nato-kfor', 'international', 'NATO / KFOR', 'KFOR — historiku dhe mandati', {
    url: 'https://jfcnaples.nato.int/kfor', note: 'Faqja zyrtare e misionit; strukturat dhe numrat ndryshojnë.' }),
  s('coe-marty', 'international', 'Asambleja Parlamentare e Këshillit të Evropës', 'Inhuman treatment of people and illicit trafficking in human organs in Kosovo (raporti Marty)', {
    date: '2010-12-12', url: 'https://assembly.coe.int', reference: 'Doc. 12462; Rezoluta 1782 (2011)', note: 'Raport i një rapporteuri parlamentar — jo vendim gjyqësor.' }),

  // ── Human rights & documentation ────────────────────────────────────────────
  s('hlc-memory', 'archive', 'Qendra për të Drejtën Humanitare (HLC) dhe Qendra për të Drejtën Humanitare Kosovë', 'Libri i Kujtesës së Kosovës / Kosovo Memory Book Database', {
    url: 'https://www.kosovomemorybook.org', note: 'Bazë të dhënash e dokumentimit të viktimave 1 janar 1998 – 31 dhjetor 2000; punë në vazhdim, jo regjistër përfundimtar.' }),
  s('hrw-under-orders', 'ngo', 'Human Rights Watch', 'Under Orders: War Crimes in Kosovo', {
    date: '2001-10', url: 'https://www.hrw.org/reports/2001/kosovo/', reference: 'HRW, tetor 2001' }),
  s('hrw-rape', 'ngo', 'Human Rights Watch', 'Kosovo: Rape as a Weapon of “Ethnic Cleansing”', {
    date: '2000-03', url: 'https://www.hrw.org/reports/2000/fry/', reference: 'HRW, mars 2000' }),
  s('hrw-nato-civ', 'ngo', 'Human Rights Watch', 'Civilian Deaths in the NATO Air Campaign', {
    date: '2000-02', url: 'https://www.hrw.org', reference: 'HRW, shkurt 2000' }),
  s('hrw-abuses-serbs-roma', 'ngo', 'Human Rights Watch', 'Abuses Against Serbs and Roma in the New Kosovo', {
    date: '1999-08', url: 'https://www.hrw.org', reference: 'HRW, gusht 1999' }),
  s('amnesty-kosovo', 'ngo', 'Amnesty International', 'Raportet për Kosovën 1998–1999', {
    url: 'https://www.amnesty.org', note: 'Seria e raporteve; identifikoni dokumentin e saktë para citimit.' }),
  s('kosovo-report', 'academic', 'Independent International Commission on Kosovo (Goldstone/Hurst)', 'The Kosovo Report: Conflict, International Response, Lessons Learned', {
    date: '2000', reference: 'Oxford University Press, 2000' }),
  s('malcolm-kosovo', 'book', 'Noel Malcolm', 'Kosovo: A Short History', { date: '1998', reference: 'Macmillan, 1998 (mbi historiografinë e debatuar)' }),
  s('judah-kosovo', 'book', 'Tim Judah', 'Kosovo: What Everyone Needs to Know', { date: '2008', reference: 'Oxford University Press, 2008' }),
  s('vickers-between', 'book', 'Miranda Vickers', 'Between Serb and Albanian: A History of Kosovo', { date: '1998', reference: 'Hurst, 1998' }),
  s('di-lellio-kla', 'book', 'Anna Di Lellio (red.)', 'The Case for Kosova: Passage to Independence', { date: '2006', reference: 'Anthem Press, 2006' }),
  s('judah-kla', 'book', 'Tim Judah', 'Kosovo: War and Revenge', { date: '2000', reference: 'Yale University Press, 2000' }),

  // ── Kosovo institutions ─────────────────────────────────────────────────────
  s('constitution', 'government', 'Republika e Kosovës — Gazeta Zyrtare', 'Kushtetuta e Republikës së Kosovës', {
    date: '2008-06-15', url: 'https://gzk.rks-gov.net', reference: 'Në fuqi nga 15 qershori 2008; amendamentet e mëvonshme në Gazetën Zyrtare' }),
  s('declaration', 'government', 'Kuvendi i Republikës së Kosovës', 'Deklarata e Pavarësisë së Kosovës', {
    date: '2008-02-17', url: 'https://www.kuvendikosoves.org', reference: 'Seanca e Kuvendit, 17 shkurt 2008; procesverbali dhe dokumenti origjinal ruhen në arkivin e Kuvendit' }),
  s('assembly-record', 'archive', 'Kuvendi i Republikës së Kosovës', 'Procesverbali i seancës së 17 shkurtit 2008 dhe lista e nënshkruesve', {
    date: '2008-02-17', url: 'https://www.kuvendikosoves.org', note: 'Burimi parësor për listën e nënshkruesve; duhet marrë nga arkivi zyrtar i Kuvendit.' }),
  s('mfa', 'government', 'Ministria e Punëve të Jashtme dhe Diasporës', 'Njohjet ndërkombëtare të Republikës së Kosovës', {
    url: 'https://www.mfa-ks.net', note: 'Lista e njohjeve ndryshon me kalimin e kohës dhe është e kontestuar nga Serbia për disa raste; shihni datën e ekstraktit.' }),
  s('ksf-mod', 'government', 'Ministria e Mbrojtjes e Republikës së Kosovës', 'Forca e Sigurisë së Kosovës — mandati, misioni dhe lajmet zyrtare', {
    url: 'https://mod.rks-gov.net', note: 'Adresa duhet verifikuar; përdorni vetëm të dhëna të publikuara zyrtarisht.' }),
  s('ksf-law-2008', 'government', 'Kuvendi i Kosovës', 'Ligji nr. 03/L-027 për Forcën e Sigurisë së Kosovës', {
    date: '2008', url: 'https://gzk.rks-gov.net', reference: 'Ligji nr. 03/L-027' }),
  s('ksf-laws-2018', 'government', 'Kuvendi i Kosovës', 'Ligjet për Forcat e Sigurisë së Kosovës dhe për Ministrinë e Mbrojtjes (14 dhjetor 2018)', {
    date: '2018-12-14', url: 'https://gzk.rks-gov.net', reference: 'Ligji nr. 06/L-122 dhe nr. 06/L-123 — numrat të verifikohen në Gazetën Zyrtare' }),
  s('kas', 'government', 'Agjencia e Statistikave të Kosovës (ASK)', 'Regjistrimi i popullsisë 2024 dhe seritë statistikore', {
    url: 'https://ask.rks-gov.net' }),
  s('worldbank-kosovo', 'international', 'Banka Botërore', 'Kosovo — Country Overview dhe Kosovo Economic Update', {
    url: 'https://www.worldbank.org/en/country/kosovo' }),
  s('eu-kosovo', 'international', 'Bashkimi Evropian / Komisioni Evropian', 'Kosova — marrëdhëniet me BE-në, Marrëveshja e Stabilizim-Asociimit dhe liberalizimi i vizave', {
    url: 'https://enlargement.ec.europa.eu', note: 'SAA në fuqi nga 1 prill 2016; liberalizimi i vizave nga 1 janar 2024.' }),
  s('dialogue-eu', 'international', 'Shërbimi Evropian për Veprim të Jashtëm (EEAS)', 'Dialogu Beograd–Prishtinë: marrëveshjet e Brukselit (2013) dhe Ohrit (2023)', {
    url: 'https://www.eeas.europa.eu', reference: 'Marrëveshja e Brukselit 19 prill 2013; Marrëveshja për rrugën drejt normalizimit, 27 shkurt 2023' }),
  s('unesco-kosovo', 'international', 'UNESCO', 'Medieval Monuments in Kosovo (Vendi i Trashëgimisë Botërore)', {
    date: '2006', url: 'https://whc.unesco.org', reference: 'Regjistruar 2004, zgjeruar 2006; në Listën e Trashëgimisë në Rrezik', note: 'UNESCO e regjistron nën emrin e Serbisë; Kosova nuk është anëtare e UNESCO-s.' }),
  s('ick', 'government', 'Innovation Centre Kosovo (ICK)', 'Ekosistemi i teknologjisë dhe i sipërmarrjes në Kosovë', {
    url: 'https://ick-ks.org' }),
  s('law-survivors-2014', 'government', 'Kuvendi i Kosovës', 'Ligji nr. 04/L-172 për statusin e viktimave civile të dhunës seksuale të luftës (ndryshim i Ligjit nr. 04/L-054)', {
    date: '2014', url: 'https://gzk.rks-gov.net', reference: 'Ligji nr. 04/L-172; shtrirja e statusit të viktimave civile të dhunës seksuale të luftës' }),
  s('olympics-kosovo', 'international', 'Komiteti Olimpik Ndërkombëtar / Olympics.com', 'Kosova në Lojërat Olimpike (Rio 2016, Tokio 2020)', {
    url: 'https://olympics.com' }),
  s('uefa-fifa', 'international', 'UEFA / FIFA', 'Pranimi i Federatës së Futbollit të Kosovës (13 maj 2016)', {
    date: '2016-05-13', url: 'https://www.uefa.com' }),
  s('unesco-vote-2015', 'international', 'UNESCO', 'Konferenca e Përgjithshme 2015 — votimi për anëtarësimin e Kosovës', {
    date: '2015-11-09', url: 'https://www.unesco.org' }),
  s('kanun', 'book', 'Kanuni i Lekë Dukagjinit (mbledhur nga Shtjefën Gjeçovi)', 'Kanuni i Lekë Dukagjinit', {
    date: '1933', reference: 'Botimi i parë i plotë 1933; përmbajtja është traditë gojore e kodifikuar, me debat për përdorimin historik' }),
  s('buzuku', 'academic', 'Gjon Buzuku', 'Meshari (1555) — libri më i vjetër i njohur i shtypur në gjuhën shqipe', { date: '1555' }),
  s('monastir-1908', 'academic', 'Kongresi i Manastirit', 'Kongresi i Manastirit dhe alfabeti i përbashkët (nëntor 1908)', { date: '1908-11' }),
  s('orthography-1972', 'academic', 'Kongresi i Drejtshkrimit, Tiranë', 'Kongresi i Drejtshkrimit i gjuhës shqipe (1972)', { date: '1972' }),
  s('unesco-intangible', 'international', 'UNESCO', 'Lista e trashëgimisë së paprekshme kulturore — kontrolloni gjendjen për çdo element', {
    url: 'https://ich.unesco.org', note: 'Kosova nuk është palë e Konventës; elementet regjistrohen nga shtete të tjera.' }),
  s('cultural-cikli', 'academic', 'Bernardin Palaj, Donat Kurti', 'Cikli i Kreshnikëve (mbledhur 1937)', { date: '1937', reference: 'Visari i Kombit, Shkodër, 1937' }),
  s('iowa-ng', 'government', 'Garda Kombëtare e Iowa-s / Programi i Partneritetit Shtetëror', 'Partneriteti me Kosovën', {
    url: 'https://www.iowanationalguard.com', note: 'Partneriteti me FSK-në; kontrolloni vitin e fillimit në burim.' }),
  s('eulex', 'international', 'EULEX Kosovë', 'Misioni i BE-së për sundimin e ligjit në Kosovë', { url: 'https://www.eulex-kosovo.eu' }),
  s('tourism-ks', 'government', 'Ministria e Industrisë, Sipërmarrjes dhe Tregtisë / Turizmi', 'Informacion zyrtar për turizmin në Kosovë', {
    url: 'https://kosovo-tourism.rks-gov.net', note: 'Adresa duhet verifikuar.' }),
  s('dokufest', 'other', 'Dokufest', 'Festivali Ndërkombëtar i Dokumentarit dhe Shkurtmetrazhit (Prizren)', { url: 'https://dokufest.com' }),

  s('unscr-1160', 'international', 'Këshilli i Sigurimit i OKB-së', 'Rezoluta 1160 (1998)', {
    date: '1998-03-31', url: 'https://undocs.org/S/RES/1160(1998)', reference: 'S/RES/1160 (1998)' }),
  s('unscr-1203', 'international', 'Këshilli i Sigurimit i OKB-së', 'Rezoluta 1203 (1998)', {
    date: '1998-10-24', url: 'https://undocs.org/S/RES/1203(1998)', reference: 'S/RES/1203 (1998)' }),
  s('rambouillet', 'international', 'Konferenca e Rambujesë / OKB', 'Interim Agreement for Peace and Self-Government in Kosovo (Rambouillet Accords)', {
    date: '1999-03-18', reference: 'S/1999/648 — simboli duhet verifikuar në arkivin e OKB-së' }),
  s('kumanovo-mta', 'international', 'KFOR / Forcat e Armatosura të RFJ-së', 'Military Technical Agreement (Kumanovo)', {
    date: '1999-06-09', reference: 'Nënshkruar në Kumanovë, 9 qershor 1999' }),
  s('mcys', 'government', 'Ministria e Kulturës, Rinisë dhe Sportit', 'Trashëgimia kulturore: regjistri i monumenteve dhe institucionet kulturore', {
    url: 'https://mkrs-ks.org', note: 'Adresa duhet verifikuar.' }),
  s('uni-pr', 'government', 'Universiteti i Prishtinës “Hasan Prishtina”', 'Historiku i Universitetit', { url: 'https://www.uni-pr.edu' }),
  s('emin-gjiku', 'government', 'Muzeu i Kosovës / Etnologjia', 'Koleksioni etnologjik i Kosovës (veshje, zeje, banesa)', {
    note: 'Referencë muzeale; kërkohet citimi i saktë i katalogut.' }),
  s('sunny-hill', 'other', 'Sunny Hill Foundation', 'Fondacioni Sunny Hill dhe festivali Sunny Hill (Prishtinë)', { note: 'Faqja zyrtare e fondacionit; adresa duhet verifikuar.' }),
  s('kosovo-women-network', 'ngo', 'Rrjeti i Grave të Kosovës (KWN)', 'Raportet mbi të mbijetuarat e dhunës seksuale të luftës dhe mbështetjen', { url: 'https://womensnetwork.org' }),
  s('krct', 'ngo', 'Qendra e Kosovës për Rehabilitimin e të Mbijetuarve të Torturës (KRCT)', 'Shërbimet e rehabilitimit dhe dokumentimi', { url: 'https://krct.org' }),
  s('medica-gjakova', 'ngo', 'Medica Gjakova', 'Shërbimet për gratë e mbijetuara të dhunës', { url: 'https://medicagjakova.org' }),
];
