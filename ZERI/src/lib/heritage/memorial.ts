/**
 * Dëshmorët, familjet legjendare, "luftë çlirimtare, jo terrorizëm" dhe turizmi.
 *
 * Every date here was checked against the source linked on the entry (October 2026).
 * A date that could not be confirmed is left out rather than guessed: a missing birth
 * date shows as "—". The list is the beginning of a register, not the whole of it —
 * thousands of UÇK fighters fell — and new names belong here only with a source.
 */

export interface L { sq: string; en: string }

export interface Martyr {
  id: string;
  name: string;
  /** Nom de guerre, when the person is known by one. */
  alias?: string;
  /** ISO date, or a year (YYYY). Omitted when no source gives it. */
  born?: string;
  bornPlace?: string;
  died: string;
  diedPlace: string;
  role: L;
  /** Their last recorded words, only where a source gives them. */
  lastWords?: L;
  /** Grouping on the page. */
  era: 'pararendes' | 'uck';
  source: string;
}

export const MARTYRS: readonly Martyr[] = [
  { id: 'adem-jashari', name: 'Adem Jashari', born: '1955-11-28', bornPlace: 'Prekaz, Skënderaj', died: '1998-03-07', diedPlace: 'Prekaz', era: 'uck',
    role: { sq: 'Komandanti Legjendar i UÇK-së. Ra duke mbrojtur shtëpinë dhe familjen në Betejën e Prekazit.', en: 'Legendary Commander of the KLA. Fell defending his home and family in the Battle of Prekaz.' },
    source: 'https://en.wikipedia.org/wiki/Adem_Jashari' },
  { id: 'hamez-jashari', name: 'Hamëz Jashari', died: '1998-03-07', diedPlace: 'Prekaz', era: 'uck',
    role: { sq: 'Vëllai i madh i Ademit; ra në të njëjtën betejë. E bija, Besarta, mbijetoi.', en: 'Adem’s elder brother; fell in the same battle. His daughter Besarta survived.' },
    source: 'https://en.wikipedia.org/wiki/Adem_Jashari' },
  { id: 'zahir-pajaziti', name: 'Zahir Pajaziti', born: '1962-11-01', bornPlace: 'Turuçicë, Podujevë', died: '1997-01-31', diedPlace: 'Pestovë, Vushtrri', era: 'uck',
    role: { sq: 'Komandant i UÇK-së në Llap. Ra në pritë të policisë serbe bashkë me Hakif Zejnullahun dhe Edmond Hoxhën.', en: 'KLA commander in Llap. Killed in a Serbian police ambush with Hakif Zejnullahu and Edmond Hoxha.' },
    source: 'https://en.wikipedia.org/wiki/Zahir_Pajaziti' },
  { id: 'hakif-zejnullahu', name: 'Hakif Zejnullahu', born: '1962-06-22', bornPlace: 'Lladoc, Podujevë', died: '1997-01-31', diedPlace: 'Pestovë, Vushtrri', era: 'uck',
    role: { sq: 'Luftëtar i UÇK-së; ra në pritën e Pestovës.', en: 'KLA fighter; fell in the Pestovë ambush.' },
    source: 'https://en.wikipedia.org/wiki/Hakif_Zejnullahu' },
  { id: 'edmond-hoxha', name: 'Edmond Hoxha', died: '1997-01-31', diedPlace: 'Pestovë, Vushtrri', era: 'uck',
    role: { sq: 'Luftëtar i UÇK-së; ra në pritën e Pestovës.', en: 'KLA fighter; fell in the Pestovë ambush.' },
    source: 'https://en.wikipedia.org/wiki/Pestov%C3%AB_ambush' },
  { id: 'luan-haradinaj', name: 'Luan Haradinaj', born: '1973-11-17', bornPlace: 'Gllogjan, Deçan', died: '1997-05-06', diedPlace: 'Qafë Prush', era: 'uck',
    role: { sq: 'Luftëtar i UÇK-së; ra në kufi gjatë një përpjekjeje me forcat serbe.', en: 'KLA fighter; fell on the border in a clash with Serbian forces.' },
    source: 'https://en.wikipedia.org/wiki/Luan_Haradinaj' },
  { id: 'adrian-krasniqi', name: 'Adrian Krasniqi', died: '1997-10-16', diedPlace: 'Kliçinë, Pejë', era: 'uck',
    role: { sq: 'Ra në aksionin e UÇK-së ndaj stacionit të policisë serbe në Kliçinë.', en: 'Fell in the KLA action against the Serbian police station in Kliçinë.' },
    source: 'https://en.wikipedia.org/wiki/Muj%C3%AB_Krasniqi' },
  { id: 'bahri-fazliu', name: 'Bahri Fazliu', born: '1971', bornPlace: 'Llaushë, Podujevë', died: '1998-05-07', diedPlace: 'Bjeshka e Bogiçes', era: 'uck',
    role: { sq: 'Luftëtar i UÇK-së; ra në përpjekje me ushtrinë jugosllave. Vëllai i Fahri Fazliut.', en: 'KLA fighter; fell fighting the Yugoslav army. Brother of Fahri Fazliu.' },
    source: 'https://en.wikipedia.org/wiki/Bahri_Fazliu' },
  { id: 'agim-celaj', name: 'Agim Çelaj', born: '1961-06-12', bornPlace: 'Strellc, Pejë', died: '1998-07-19', diedPlace: 'Rahovec', era: 'uck',
    role: { sq: 'Komandant i UÇK-së; ra në luftimet për Rahovecin.', en: 'KLA commander; fell in the fighting for Rahovec.' },
    source: 'https://en.wikipedia.org/wiki/Agim_%C3%87elaj' },
  { id: 'bekim-berisha', name: 'Bekim Berisha', alias: 'Abeja', born: '1966-06-15', bornPlace: 'Graboc, Pejë', died: '1998-08-10', diedPlace: 'Junik', era: 'uck',
    role: { sq: 'Gjeneral i UÇK-së; kishte luftuar më parë në Kroaci dhe Bosnjë.', en: 'KLA general; had earlier fought in Croatia and Bosnia.' },
    source: 'https://en.wikipedia.org/wiki/Bekim_Berisha' },
  { id: 'ismet-jashari', name: 'Ismet Jashari', alias: 'Komandant Kumanova', born: '1967-04-16', bornPlace: 'Orizare, Likovë', died: '1998-08-25', diedPlace: 'Kleçkë', era: 'uck',
    role: { sq: 'Komandant i UÇK-së për zonën e Llapushës.', en: 'KLA commander of the Llapusha zone.' },
    source: 'https://en.wikipedia.org/wiki/Ismet_Jashari' },
  { id: 'ahmet-krasniqi', name: 'Ahmet Krasniqi', died: '1998-09-21', diedPlace: 'Tiranë', era: 'uck',
    role: { sq: 'Komandant i Forcave të Armatosura të Republikës së Kosovës (FARK). U vra nga persona të maskuar.', en: 'Commander of the Armed Forces of the Republic of Kosova (FARK). Killed by masked gunmen.' },
    source: 'https://en.wikipedia.org/wiki/Armed_Forces_of_the_Republic_of_Kosova' },
  { id: 'fehmi-lladrovci', name: 'Fehmi Lladrovci', born: '1956-05-15', bornPlace: 'Shkabë, Drenas', died: '1998-09-22', diedPlace: 'Shkabë, Drenas', era: 'uck',
    role: { sq: 'Komandant i UÇK-së në Drenicë. Ra në betejë krah për krah me bashkëshorten.', en: 'KLA commander in Drenica. Fell in battle side by side with his wife.' },
    source: 'https://en.wikipedia.org/wiki/Fehmi_Lladrovci' },
  { id: 'xheve-lladrovci', name: 'Xhevë Krasniqi-Lladrovci', died: '1998-09-22', diedPlace: 'Drenas', era: 'uck',
    role: { sq: 'Luftëtare e UÇK-së; ra në të njëjtën betejë me Fehmiun.', en: 'KLA fighter; fell in the same battle as Fehmi.' },
    source: 'https://en.wikipedia.org/wiki/Fehmi_Lladrovci' },
  { id: 'muje-krasniqi', name: 'Mujë Krasniqi', alias: 'Kapuçi', born: '1967-06-06', bornPlace: 'Çabiq, Klinë', died: '1998-12-14', diedPlace: 'afër Gorozhupit', era: 'uck',
    role: { sq: 'Themelues dhe komandant i hershëm i UÇK-së; lidhte Drenicën, Dukagjinin dhe Pashtrikun.', en: 'Founder and early KLA commander; linked Drenica, Dukagjin and Pashtrik.' },
    source: 'https://en.wikipedia.org/wiki/Muj%C3%AB_Krasniqi' },
  { id: 'agim-ramadani', name: 'Agim Ramadani', born: '1963-05-03', bornPlace: 'Zhegër, Gjilan', died: '1999-04-11', diedPlace: 'Koshare', era: 'uck',
    role: { sq: 'Komandant i UÇK-së në Betejën e Kosharës.', en: 'KLA commander in the Battle of Košare.' },
    source: 'https://en.wikipedia.org/wiki/Agim_Ramadani' },
  { id: 'shkelzen-haradinaj', name: 'Shkëlzen Haradinaj', born: '1970-03-25', bornPlace: 'Gllogjan, Deçan', died: '1999-04-16', diedPlace: 'Maznik, Deçan', era: 'uck',
    role: { sq: 'Luftëtar i UÇK-së; u plagos për vdekje duke mbrojtur civilët e strehuar në pyje.', en: 'KLA fighter; fatally wounded protecting civilians sheltering in the forests.' },
    source: 'https://en.wikipedia.org/wiki/Shk%C3%ABlzen_Haradinaj' },
  { id: 'sali-cekaj', name: 'Sali Çekaj', born: '1956-06-22', bornPlace: 'Broliq, Deçan', died: '1999-04-19', diedPlace: 'Koshare', era: 'uck',
    role: { sq: 'Jurist dhe komandant i FARK-ut dhe i UÇK-së; ra në Betejën e Kosharës.', en: 'Lawyer and FARK/KLA commander; fell in the Battle of Košare.' },
    source: 'https://en.wikipedia.org/wiki/Sali_%C3%87ekaj' },
  { id: 'ilaz-kodra', name: 'Ilaz Kodra', born: '1966-05-03', bornPlace: 'Prekaz i Epërm, Skënderaj', died: '1999-04-30', diedPlace: 'Shtuticë, Drenas', era: 'uck',
    role: { sq: 'Themelues i UÇK-së; komandant i Brigadës 114 "Fehmi Lladrovci".', en: 'KLA founder; commander of the 114th "Fehmi Lladrovci" Brigade.' },
    source: 'https://en.wikipedia.org/wiki/Ilaz_Kodra' },

  // Pararendësit: the people whose fall the UÇK generation grew up with.
  { id: 'nebih-meha', name: 'Nebih Meha', born: '1910', died: '1981-05-13', diedPlace: 'Prekaz i Epërm', era: 'pararendes',
    role: { sq: 'Ra bashkë me të birin, Tahirin, në rrethimin e shtëpisë së tyre.', en: 'Fell with his son Tahir when their home was besieged.' },
    source: 'https://en.wikipedia.org/wiki/Tahir_Meha' },
  { id: 'tahir-meha', name: 'Tahir Meha', born: '1943-10-10', bornPlace: 'Prekaz i Epërm', died: '1981-05-13', diedPlace: 'Prekaz i Epërm', era: 'pararendes',
    role: { sq: 'Rezistoi deri në fund në shtëpinë e rrethuar në Prekaz, 17 vjet para Jasharëve.', en: 'Resisted to the end in his besieged home in Prekaz, 17 years before the Jasharis.' },
    source: 'https://en.wikipedia.org/wiki/Tahir_Meha' },
  { id: 'jusuf-gervalla', name: 'Jusuf Gërvalla', born: '1943-10-01', bornPlace: 'Dubovik, Deçan', died: '1982-01-17', diedPlace: 'Untergruppenbach, Gjermani', era: 'pararendes',
    role: { sq: 'Poet, gazetar dhe veprimtar; u vra në mërgim bashkë me vëllain Bardhosh dhe Kadri Zekën.', en: 'Poet, journalist and activist; assassinated in exile with his brother Bardhosh and Kadri Zeka.' },
    source: 'https://en.wikipedia.org/wiki/Jusuf_G%C3%ABrvalla' },
  { id: 'bardhosh-gervalla', name: 'Bardhosh Gërvalla', died: '1982-01-17', diedPlace: 'Untergruppenbach, Gjermani', era: 'pararendes',
    role: { sq: 'Veprimtar; u vra bashkë me vëllain Jusuf.', en: 'Activist; assassinated with his brother Jusuf.' },
    source: 'https://en.wikipedia.org/wiki/Jusuf_G%C3%ABrvalla' },
  { id: 'kadri-zeka', name: 'Kadri Zeka', died: '1982-01-17', diedPlace: 'Untergruppenbach, Gjermani', era: 'pararendes',
    role: { sq: 'Veprimtar i lëvizjes kombëtare; u vra bashkë me vëllezërit Gërvalla.', en: 'National-movement activist; assassinated with the Gërvalla brothers.' },
    source: 'https://en.wikipedia.org/wiki/Jusuf_G%C3%ABrvalla' },
  { id: 'fahri-fazliu', name: 'Fahri Fazliu', died: '1989-11-02', diedPlace: 'Bregu i Diellit, Prishtinë', era: 'pararendes',
    role: { sq: 'Ra 26 vjeç bashkë me Afrim Zhitinë, pas më shumë se gjashtë orë qëndrese.', en: 'Fell aged 26 with Afrim Zhitia after more than six hours of resistance.' },
    source: 'https://kryeministri.rks-gov.net/en/?p=187268' },
  { id: 'afrim-zhitia', name: 'Afrim Zhitia', died: '1989-11-02', diedPlace: 'Bregu i Diellit, Prishtinë', era: 'pararendes',
    role: { sq: 'Ra 24 vjeç bashkë me Fahri Fazliun në bazën e tyre ilegale.', en: 'Fell aged 24 with Fahri Fazliu at their underground base.' },
    source: 'https://kryeministri.rks-gov.net/en/?p=187268' },
];

export interface Family { id: string; name: string; place: string; body: L; members: string[]; source: string }

export const LEGENDARY_FAMILIES: readonly Family[] = [
  { id: 'jashari', name: 'Familja Jashari', place: 'Prekaz, Skënderaj',
    body: {
      sq: 'Më 5–7 mars 1998 forcat serbe rrethuan kompleksin e familjes. Ademi, Hamëzi dhe të afërmit e tyre nuk u dorëzuan. Ranë mbi 50 anëtarë të familjes — gra, fëmijë e pleq mes tyre (burimet japin 56–58 të vrarë gjithsej). Mbijetoi vetëm Besarta, vajza e Hamëzit. Prekazi u bë zemra e luftës për liri.',
      en: 'On 5–7 March 1998 Serbian forces besieged the family compound. Adem, Hamëz and their relatives did not surrender. More than 50 family members fell — women, children and elders among them (sources give 56–58 killed in all). Only Besarta, Hamëz’s daughter, survived. Prekaz became the heart of the fight for freedom.',
    },
    members: ['adem-jashari', 'hamez-jashari'], source: 'https://en.wikipedia.org/wiki/Attack_on_Prekaz' },
  { id: 'lladrovci', name: 'Familja Lladrovci', place: 'Shkabë, Drenas',
    body: { sq: 'Fehmiu dhe Xheva, burrë e grua, luftuan dhe ranë së bashku më 22 shtator 1998 — simbol i barazisë së burrit e gruas në luftën për liri.', en: 'Fehmi and Xheva, husband and wife, fought and fell together on 22 September 1998 — a symbol of men and women standing equal in the fight for freedom.' },
    members: ['fehmi-lladrovci', 'xheve-lladrovci'], source: 'https://en.wikipedia.org/wiki/Fehmi_Lladrovci' },
  { id: 'haradinaj', name: 'Familja Haradinaj', place: 'Gllogjan, Deçan',
    body: { sq: 'Dy vëllezër të familjes ranë në luftë: Luani në maj 1997 dhe Shkëlzeni në prill 1999, duke mbrojtur civilët. Dukagjini u bë një nga zonat kryesore të qëndresës.', en: 'Two brothers of the family fell: Luan in May 1997 and Shkëlzen in April 1999, protecting civilians. Dukagjin became one of the main zones of resistance.' },
    members: ['luan-haradinaj', 'shkelzen-haradinaj'], source: 'https://en.wikipedia.org/wiki/Shk%C3%ABlzen_Haradinaj' },
  { id: 'meha', name: 'Familja Meha', place: 'Prekaz i Epërm',
    body: { sq: 'Më 13 maj 1981 Tahiri dhe babai i tij Nebihu qëndruan deri në fund në shtëpinë e rrethuar. Shembulli i tyre u bë frymëzim për brezin që themeloi UÇK-në.', en: 'On 13 May 1981 Tahir and his father Nebih held out to the end in their besieged home. Their example inspired the generation that founded the KLA.' },
    members: ['nebih-meha', 'tahir-meha'], source: 'https://en.wikipedia.org/wiki/Tahir_Meha' },
  { id: 'gervalla', name: 'Familja Gërvalla', place: 'Dubovik, Deçan',
    body: { sq: 'Vëllezërit Jusuf dhe Bardhosh Gërvalla, bashkë me Kadri Zekën, u vranë në mërgim më 17 janar 1982. Ata konsiderohen pararendës të UÇK-së.', en: 'The brothers Jusuf and Bardhosh Gërvalla were assassinated in exile with Kadri Zeka on 17 January 1982. They are regarded as forerunners of the KLA.' },
    members: ['jusuf-gervalla', 'bardhosh-gervalla', 'kadri-zeka'], source: 'https://en.wikipedia.org/wiki/Jusuf_G%C3%ABrvalla' },
  { id: 'fazliu', name: 'Familja Fazliu', place: 'Llaushë, Podujevë',
    body: { sq: 'Fahriu ra në Prishtinë më 1989; nëntë vjet më vonë, në maj 1998, ra edhe vëllai i tij më i vogël, Bahriu, si luftëtar i UÇK-së.', en: 'Fahri fell in Prishtina in 1989; nine years later, in May 1998, his younger brother Bahri fell as a KLA fighter.' },
    members: ['fahri-fazliu', 'bahri-fazliu'], source: 'https://en.wikipedia.org/wiki/Bahri_Fazliu' },
];

/** The case that the UÇK fought a war of liberation — each point a fact with its source. */
export interface Point { title: L; body: L; source: string; sourceLabel: string }

export const LIBERATION_POINTS: readonly Point[] = [
  { title: { sq: 'Pas një dekade rezistence paqësore', en: 'After a decade of peaceful resistance' },
    body: { sq: 'Pasi autonomia e Kosovës u shfuqizua më 1989, shqiptarët zgjodhën rezistencën paqësore: institucione paralele, shkolla në shtëpi, zgjedhje të lira. Dhuna e shtetit vetëm u shtua. UÇK-ja doli nga ky realitet — për të mbrojtur familjet, tokën dhe të drejtën për të jetuar të lirë.', en: 'After Kosovo’s autonomy was abolished in 1989, Albanians chose peaceful resistance: parallel institutions, home schooling, free elections. State violence only grew. The KLA came out of that reality — to protect families, land and the right to live free.' },
    source: 'https://en.wikipedia.org/wiki/Kosovo_Liberation_Army', sourceLabel: 'Kosovo Liberation Army' },
  { title: { sq: 'Etiketa "terroriste" u tërhoq nga vetë diplomacia', en: 'Diplomacy itself dropped the "terrorist" label' },
    body: { sq: 'Në shkurt 1998 i dërguari amerikan Robert Gelbard e quajti UÇK-në grup terrorist. Brenda pak muajve, diplomatët amerikanë dhe evropianë po takonin komandantët e UÇK-së dhe e trajtonin si palë në bisedime.', en: 'In February 1998 the US envoy Robert Gelbard called the KLA a terrorist group. Within months American and European diplomats were meeting KLA commanders and treating the KLA as a party to talks.' },
    source: 'https://en.wikipedia.org/wiki/Robert_S._Gelbard', sourceLabel: 'Robert S. Gelbard' },
  { title: { sq: 'Palë në Rambuje', en: 'A party at Rambouillet' },
    body: { sq: 'Në bisedimet e Rambujesë (shkurt–mars 1999) delegacioni i Kosovës, me përfaqësues të UÇK-së, nënshkroi marrëveshjen e paqes më 18 mars 1999. Delegacioni jugosllav refuzoi.', en: 'At the Rambouillet talks (February–March 1999) the Kosovo delegation, including KLA representatives, signed the peace accord on 18 March 1999. The Yugoslav delegation refused.' },
    source: 'https://en.wikipedia.org/wiki/Rambouillet_Agreement', sourceLabel: 'Rambouillet Agreement' },
  { title: { sq: 'Gjykata ndërkombëtare: konflikt i armatosur, jo "aksion antiterror"', en: 'An international court: armed conflict, not "counter-terrorism"' },
    body: { sq: 'Tribunali i Hagës (ICTY), në çështjen Limaj e të tjerë (30 nëntor 2005), e trajtoi luftën në Kosovë si konflikt të armatosur ndërmjet forcave serbe dhe UÇK-së si forcë e organizuar — pra sipas ligjeve të luftës. Limaj dhe Musliu u shpallën të pafajshëm.', en: 'The Hague Tribunal (ICTY), in Limaj et al. (30 November 2005), treated the war in Kosovo as an armed conflict between Serbian forces and the KLA as an organised force — under the laws of war. Limaj and Musliu were acquitted.' },
    source: 'https://www.icty.org/en/case/limaj', sourceLabel: 'ICTY — Limaj et al.' },
  { title: { sq: 'Çarmatosje e nënshkruar me NATO-n', en: 'Demilitarisation signed with NATO' },
    body: { sq: 'Më 21 qershor 1999 UÇK-ja nënshkroi me KFOR-in marrëveshjen e çarmatosjes dhe transformimit. Më 21 shtator 1999 NATO konfirmoi se UÇK-ja i kishte përmbushur detyrimet; ajo u shndërrua në Trupat Mbrojtëse të Kosovës.', en: 'On 21 June 1999 the KLA signed the demilitarisation and transformation undertaking with KFOR. On 21 September 1999 NATO confirmed it had complied; it became the Kosovo Protection Corps.' },
    source: 'https://www.nato.int/docu/pr/1999/p99-125e.htm', sourceLabel: 'NATO, 21.09.1999' },
  { title: { sq: 'Përgjegjësia është individuale', en: 'Responsibility is individual' },
    body: { sq: 'Gjykatat ndërkombëtare kanë gjykuar raste individuale, siç bëhet pas çdo lufte dhe për çdo palë. Asnjë gjykatë ndërkombëtare nuk e ka cilësuar UÇK-në organizatë terroriste. Lufta e saj ishte për çlirim.', en: 'International courts have tried individual cases, as after every war and for every side. No international court has classed the KLA as a terrorist organisation. Its war was one of liberation.' },
    source: 'https://www.icty.org/en/case/limaj', sourceLabel: 'ICTY' },
];

/* ── Turizmi ─────────────────────────────────────────────────────────────── */

export type PlaceKind = 'natyre' | 'histori' | 'kujtese';

export interface Place { id: string; name: string; municipality: string; kind: PlaceKind; icon: string; hue: number; body: L; tip?: L }

export const PLACE_KINDS: Record<PlaceKind, L> = {
  natyre: { sq: 'Natyrë', en: 'Nature' },
  histori: { sq: 'Histori & kulturë', en: 'History & culture' },
  kujtese: { sq: 'Kujtesë', en: 'Remembrance' },
};

export const PLACES: readonly Place[] = [
  { id: 'prizren', name: 'Prizreni historik', municipality: 'Prizren', kind: 'histori', icon: 'Landmark', hue: 28,
    body: { sq: 'Ura e Gurit, Shadërvani, Kalaja mbi qytet dhe Kompleksi i Lidhjes Shqiptare të Prizrenit (1878). Qyteti më i ruajtur osman i Kosovës.', en: 'The Stone Bridge, Shadërvan square, the fortress above town and the League of Prizren complex (1878). Kosovo’s best-preserved Ottoman town.' },
    tip: { sq: 'Dokufest në gusht', en: 'Dokufest in August' } },
  { id: 'rugova', name: 'Gryka e Rugovës', municipality: 'Pejë', kind: 'natyre', icon: 'Mountain', hue: 150,
    body: { sq: 'Kanion i thellë me shkëmbinj vertikalë, via ferrata, zip-line dhe shtigje drejt Bjeshkëve të Nemuna.', en: 'A deep gorge with sheer cliffs, via ferrata, zip-line and trails into the Accursed Mountains.' },
    tip: { sq: 'Maj–tetor', en: 'May–October' } },
  { id: 'bjeshket', name: 'Bjeshkët e Nemuna', municipality: 'Pejë · Deçan · Junik', kind: 'natyre', icon: 'TreePine', hue: 120,
    body: { sq: 'Park kombëtar me liqene akullnajore dhe majën Gjeravica, më e larta në Kosovë.', en: 'A national park with glacial lakes and Gjeravica, Kosovo’s highest peak.' } },
  { id: 'mirusha', name: 'Ujëvarat e Mirushës', municipality: 'Malishevë · Klinë', kind: 'natyre', icon: 'Waves', hue: 190,
    body: { sq: 'Një varg ujëvarash dhe liqenesh të vegjël në kanionin e lumit Mirusha.', en: 'A chain of waterfalls and small lakes in the Mirusha river canyon.' },
    tip: { sq: 'Verë', en: 'Summer' } },
  { id: 'radavc', name: 'Burimi i Drinit të Bardhë & Shpella e Radavcit', municipality: 'Pejë', kind: 'natyre', icon: 'Droplets', hue: 200,
    body: { sq: 'Burimi i lumit del nga shkëmbi me një ujëvarë; pranë tij shpella me stalaktite.', en: 'The river springs from the rock as a waterfall; beside it a cave of stalactites.' } },
  { id: 'sharri', name: 'Malet e Sharrit & Brezovica', municipality: 'Shtërpcë · Prizren', kind: 'natyre', icon: 'Snowflake', hue: 210,
    body: { sq: 'Park kombëtar dhe qendra kryesore e skijimit në Kosovë; shtigje alpine në verë.', en: 'A national park and Kosovo’s main ski centre; alpine trails in summer.' },
    tip: { sq: 'Ski: dhjetor–mars', en: 'Ski: December–March' } },
  { id: 'gadime', name: 'Shpella e Gadimes', municipality: 'Lipjan', kind: 'natyre', icon: 'Gem', hue: 260,
    body: { sq: 'Shpellë mermeri me formacione kristalore të rralla, e hapur për vizitorë.', en: 'A marble cave with rare crystal formations, open to visitors.' } },
  { id: 'germia', name: 'Parku i Gërmisë', municipality: 'Prishtinë', kind: 'natyre', icon: 'Trees', hue: 135,
    body: { sq: 'Pyll i madh në skaj të kryeqytetit: shtigje, liqen dhe pishinë verore.', en: 'A large forest on the edge of the capital: trails, a lake and a summer pool.' } },
  { id: 'batllava', name: 'Liqeni i Batllavës', municipality: 'Podujevë', kind: 'natyre', icon: 'Sailboat', hue: 185,
    body: { sq: 'Liqen artificial mes kodrave, vend i preferuar për fundjavë.', en: 'A reservoir among the hills, a favourite weekend spot.' } },
  { id: 'ulpiana', name: 'Ulpiana', municipality: 'Graçanicë', kind: 'histori', icon: 'Columns3', hue: 35,
    body: { sq: 'Qytet antik dardan e romak, me gërmime arkeologjike të hapura.', en: 'An ancient Dardanian and Roman city with open excavations.' } },
  { id: 'novoberde', name: 'Kalaja e Novobërdës (Artana)', municipality: 'Novobërdë', kind: 'histori', icon: 'Castle', hue: 20,
    body: { sq: 'Fortesë mesjetare mbi qytetin e dikurshëm minerar, një nga më të rëndësishmit e Ballkanit.', en: 'A medieval fortress above a once-great mining town of the Balkans.' } },
  { id: 'gjakova', name: 'Çarshia e Madhe e Gjakovës', municipality: 'Gjakovë', kind: 'histori', icon: 'Store', hue: 40,
    body: { sq: 'Pazari i vjetër me zejtarë, xhaminë e Hadumit dhe Urën e Terzive afër qytetit.', en: 'The old bazaar of craftsmen, the Hadum mosque and the Tailors’ Bridge nearby.' } },
  { id: 'kullat', name: 'Kullat e Dukagjinit', municipality: 'Junik · Deçan', kind: 'histori', icon: 'House', hue: 30,
    body: { sq: 'Kullat prej guri të arkitekturës tradicionale shqiptare, disa të restauruara për vizitorë.', en: 'Stone tower-houses of traditional Albanian architecture, some restored for visitors.' } },
  { id: 'unesco', name: 'Monumentet mesjetare (UNESCO)', municipality: 'Deçan · Pejë · Prizren', kind: 'histori', icon: 'Church', hue: 300,
    body: { sq: 'Manastiri i Deçanit, Patrikana e Pejës dhe kisha të tjera mesjetare — trashëgimi botërore në Kosovë.', en: 'Dečani Monastery, the Patriarchate of Peć and other medieval churches — world heritage in Kosovo.' } },
  { id: 'prishtina', name: 'Prishtina e re', municipality: 'Prishtinë', kind: 'histori', icon: 'Building2', hue: 225,
    body: { sq: 'Monumenti NEWBORN, Biblioteka Kombëtare, Sheshi Skënderbeu dhe kafenetë e Bulevardit Nënë Tereza.', en: 'The NEWBORN monument, the National Library, Skanderbeg Square and the cafés of Mother Teresa Boulevard.' } },
  { id: 'prekaz', name: 'Kompleksi Memorial "Adem Jashari"', municipality: 'Skënderaj', kind: 'kujtese', icon: 'Flame', hue: 0,
    body: { sq: 'Shtëpitë e shkatërruara të familjes Jashari dhe varrezat e tyre — vendi më i vizituar i kujtesës kombëtare.', en: 'The ruined homes of the Jashari family and their graves — the most visited place of national remembrance.' },
    tip: { sq: '5–7 mars: Epopeja e UÇK-së', en: '5–7 March: KLA Epic' } },
  { id: 'koshare', name: 'Kosharja', municipality: 'Gjakovë', kind: 'kujtese', icon: 'Flag', hue: 350,
    body: { sq: 'Vendi i Betejës së Kosharës në kufi me Shqipërinë, ku ranë Agim Ramadani, Sali Çekaj e shumë të tjerë.', en: 'The Košare battlefield on the Albanian border, where Agim Ramadani, Sali Çekaj and many others fell.' } },
  { id: 'arinjte', name: 'Strehimorja e Ariut', municipality: 'Prishtinë (Mramor)', kind: 'natyre', icon: 'PawPrint', hue: 95,
    body: { sq: 'Arinj të shpëtuar nga robëria jetojnë të lirë pranë liqeneve të Mramorit.', en: 'Bears rescued from captivity live freely by the Mramor lakes.' } },
];

/** "1955-11-28" → "28.11.1955"; "1971" stays; empty → "—". */
export function formatMemorialDate(value?: string): string {
  if (!value) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : value;
}

/** Age at death when both dates are full dates; null otherwise. */
export function ageAtDeath(born?: string, died?: string): number | null {
  const b = born && /^\d{4}-\d{2}-\d{2}$/.test(born) ? new Date(born) : null;
  const d = died && /^\d{4}-\d{2}-\d{2}$/.test(died) ? new Date(died) : null;
  if (!b || !d) return null;
  let age = d.getUTCFullYear() - b.getUTCFullYear();
  if (d.getUTCMonth() < b.getUTCMonth() || (d.getUTCMonth() === b.getUTCMonth() && d.getUTCDate() < b.getUTCDate())) age -= 1;
  return age;
}
