import type { L } from './memorial';

/**
 * What is on record against the Serbian state apparatus of the 1990s: figures, court findings and the
 * work of Kosovo's own institutions. Every line names who said it and how strong the statement is —
 * `finding` (a court said so), `estimate` (a count with a method), `record` (an official act).
 * Nothing here is a verdict on a person who has not been tried.
 */
export type Strength = 'finding' | 'estimate' | 'record';

export interface Count { value: string; label: L; strength: Strength; source: string; sourceLabel: string; caveat?: L }

export const SEXUAL_VIOLENCE_COUNTS: readonly Count[] = [
  { value: '10.000 – 20.000', strength: 'estimate',
    label: { sq: 'gra të dhunuara, shkurt 1998 – qershor 1999 — vlerësimi i parë ndërkombëtar (OBSH, janar 2000)', en: 'women raped, February 1998 – June 1999 — the first international estimate (WHO, January 2000)' },
    source: 'https://womensnetwork.org/kwn-calls-for-respect-recognition-for-survivors-of-war-time-sexual-violence/', sourceLabel: 'Rrjeti i Grave të Kosovës',
    caveat: { sq: 'Shifra e 20.000 është e përdorur gjerësisht por kritikohet metodologjikisht nga ekspertë që kanë punuar me raportet e OKB-së; është vlerësim, jo numërim.', en: 'The 20,000 figure is widely used but is criticised on method by experts who worked on UN reports; it is an estimate, not a count.' } },
  { value: '23.200 – 45.600', strength: 'estimate',
    label: { sq: 'gra shqiptare të dhunuara, gusht 1998 – gusht 1999 — sondazh me refugjatë (Hynes & Lopes Cardozo)', en: 'ethnic Albanian women raped, August 1998 – August 1999 — a refugee survey (Hynes & Lopes Cardozo)' },
    source: 'https://womensnetwork.org/kwn-calls-for-respect-recognition-for-survivors-of-war-time-sexual-violence/', sourceLabel: 'Rrjeti i Grave të Kosovës (cituar)',
    caveat: { sq: 'Vlerësim nga një sondazh; ndërvarësi të mëdha statistikore. Cituar nga KWN.', en: 'An estimate from a survey with wide statistical bounds. Quoted by KWN.' } },
  { value: '1.629', strength: 'record',
    label: { sq: 'persona të njohur zyrtarisht nga shteti i Kosovës si viktima të dhunës seksuale të luftës (1.540 gra, 89 burra)', en: 'people formally recognised by the State of Kosovo as victims of wartime sexual violence (1,540 women, 89 men)' },
    source: 'https://vreme.com/en/vesti/zrtve-cute-politicari-se-gadjaju-brojkama-otkud-prica-o-20-000-silovanja-u-ratu-na-kosovu/', sourceLabel: 'Vreme (raportim)',
    caveat: { sq: 'Numri i njohur është shumë më i vogël se vlerësimet, sepse stigma i pengon shumë të mbijetuara të kërkojnë njohje.', en: 'The recognised number is far below the estimates because stigma keeps many survivors from applying.' } },
];

export interface Charge { id: string; side: 'intl' | 'kosova'; title: L; body: L; strength: Strength; source: string; sourceLabel: string }

export const CHARGES: readonly Charge[] = [
  // — Ndërkombëtare —
  { id: 'milosevic', side: 'intl', strength: 'record',
    title: { sq: 'Millosheviqi u akuzua për krime kundër njerëzimit në Kosovë', en: 'Milošević was indicted for crimes against humanity in Kosovo' },
    body: { sq: 'Më 24 maj 1999, në mes të fushatës, ICTY ngriti aktakuzë ndaj Slobodan Millosheviqit dhe katër zyrtarëve të tjerë për deportim, vrasje dhe përndjekje të shqiptarëve të Kosovës. Millosheviqi vdiq në paraburgim në vitin 2006, para vendimit.', en: 'On 24 May 1999, mid-campaign, the ICTY indicted Slobodan Milošević and four other officials for deportation, murder and persecution of Kosovo Albanians. Milošević died in custody in 2006, before a verdict.' },
    source: 'https://www.icty.org/en/case/slobodan_milosevic', sourceLabel: 'ICTY IT-99-37' },
  { id: 'milutinovic', side: 'intl', strength: 'finding',
    title: { sq: 'Pesë nga udhëheqja më e lartë politike, ushtarake e policore u dënuan', en: 'Five members of the top political, military and police leadership were convicted' },
    body: { sq: 'ICTY (2009, apeli 2014) dënoi Nikola Šainoviqin, Nebojša Pavkoviqin, Sreten Lukiqin, Dragoljub Ojdaniqin dhe Vladimir Lazareviqin për deportim, zhvendosje të dhunshme, vrasje dhe përndjekje të shqiptarëve. Gjykata konstatoi një fushatë të organizuar terrori dhe dëbimi nga forcat e Jugosllavisë dhe të Serbisë.', en: 'The ICTY (2009, appeal 2014) convicted Nikola Šainović, Nebojša Pavković, Sreten Lukić, Dragoljub Ojdanić and Vladimir Lazarević of deportation, forcible transfer, murder and persecution of Kosovo Albanians. The court found an organised campaign of terror and expulsion by Yugoslav and Serbian forces.' },
    source: 'https://www.icty.org/en/press/five-senior-serb-officials-convicted-kosovo-crimes-one-acquitted', sourceLabel: 'ICTY, shpallja e aktgjykimit' },
  { id: 'djordjevic', side: 'intl', strength: 'finding',
    title: { sq: 'Shefi i policisë publike: 18 vjet burg', en: 'The head of the public security police: 18 years' },
    body: { sq: 'Vlastimir Đorđeviq, shefi i Departamentit të Sigurisë Publike, u dënua në vitin 2011 me 27 vjet burg dhe në apel (2014) me 18 vjet, për rolin në dëbimin e qindra mijëra shqiptarëve dhe në vrasjet.', en: 'Vlastimir Đorđević, head of the Public Security Department, was sentenced in 2011 to 27 years and on appeal (2014) to 18 years for his part in the expulsion of hundreds of thousands of Albanians and in the killings.' },
    source: 'https://www.icty.org/en/case/djordjevic', sourceLabel: 'ICTY IT-05-87/1' },
  { id: 'hrw-orders', side: 'intl', strength: 'finding',
    title: { sq: 'Dhuna seksuale si armë e spastrimit etnik', en: 'Sexual violence as a weapon of ethnic cleansing' },
    body: { sq: 'Hetuesit e OSBE-së dhe të Human Rights Watch arritën që në vitin 1999 në përfundimin se dhuna seksuale u përdor si armë e spastrimit etnik në Kosovë, e kryer kryesisht nga forca serbe e jugosllave.', en: 'OSCE and Human Rights Watch investigators concluded as early as 1999 that sexual violence was used as a weapon of ethnic cleansing in Kosovo, committed mainly by Serbian and Yugoslav forces.' },
    source: 'https://helsinki.org.rs/kosovo_t35.html', sourceLabel: 'Helsinki Committee (Serbi), duke cituar OSBE/HRW' },
  { id: 'congress', side: 'intl', strength: 'record',
    title: { sq: 'Kongresi amerikan kërkon fundin e pandëshkueshmërisë', en: 'The US Congress calls for an end to impunity' },
    body: { sq: 'Rezoluta H.Con.Res.26 (Kongresi i 119-të) kërkon që Serbia t’i sjellë para drejtësisë përgjegjësit e krimeve seksuale të luftës të vitit 1999 dhe të përfundojë pandëshkueshmërinë, me rastin e Vasfije Krasniqi Goodman.', en: 'Resolution H.Con.Res.26 (119th Congress) calls on Serbia to bring those responsible for the 1999 sexual war crimes to justice and to end impunity, citing the case of Vasfije Krasniqi Goodman.' },
    source: 'https://www.congress.gov/bill/119th-congress/house-concurrent-resolution/26/text', sourceLabel: 'congress.gov' },
  // — Kosovare —
  { id: 'kosova-courts', side: 'kosova', strength: 'finding',
    title: { sq: 'Gjykata e Prishtinës dënoi dy ish-policë serbë', en: 'A Pristina court convicted two former Serbian police officers' },
    body: { sq: 'Në korrik 2025 gjykata në Prishtinë i dënoi në mungesë dy ish-policë serbë me nga 15 vjet burg për përdhunimin e një gruaje shqiptare në vitin 1999. Vendimi mund të ankimohet.', en: 'In July 2025 a Pristina court convicted two former Serbian police officers in absentia, 15 years each, for the rape of an ethnic Albanian woman in 1999. The verdict can be appealed.' },
    source: 'https://balkaninsight.com/2025/07/28/kosovo-court-convicts-two-serbs-in-absentia-of-wartime-rape/', sourceLabel: 'Balkan Insight' },
  { id: 'kosova-spo', side: 'kosova', strength: 'record',
    title: { sq: 'Prokuroria Speciale: 13 aktakuza për krime lufte në 2024', en: 'The Special Prosecution: 13 war-crimes indictments in 2024' },
    body: { sq: 'Sipas Qendrës për të Drejtën Humanitare Kosovë, Zyra e Prokurorit Special ngriti në vitin 2024 trembëdhjetë aktakuza, gjashtë prej tyre në mungesë kundër 11 të dyshuarve, të gjithë pjesëtarë të supozuar të forcave ushtarake ose policore serbe. Raporti paralajmëron se mungesa e bashkëpunimit gjyqësor të Serbisë vazhdon ta pengojë drejtësinë.', en: 'According to the Humanitarian Law Center Kosovo, the Special Prosecutor’s Office filed thirteen indictments in 2024, six of them in absentia against 11 suspects, all alleged members of Serbian military or police forces. The report warns that Serbia’s lack of judicial cooperation continues to obstruct justice.' },
    source: 'https://balkaninsight.com/2025/04/04/kosovo-increased-wartime-sexual-abuse-indictments-in-2024-report/btj/', sourceLabel: 'Balkan Insight / HLC Kosovë' },
  { id: 'kosova-law', side: 'kosova', strength: 'record',
    title: { sq: 'Ligji i vitit 2014: shteti i Kosovës i njeh të mbijetuarat', en: 'The 2014 law: the State of Kosovo recognises survivors' },
    body: { sq: 'Ligji nr. 04/L-172 e njeh statusin e viktimave civile të dhunës seksuale të luftës dhe u jep pension e mbështetje. Deri tani janë njohur 1.629 persona, ndërsa Rrjeti i Grave të Kosovës kërkon respekt dhe njohje për të gjitha të mbijetuarat.', en: 'Law No. 04/L-172 recognises civilian victims of wartime sexual violence and grants them a pension and support. So far 1,629 people have been recognised, while the Kosovo Women’s Network demands respect and recognition for all survivors.' },
    source: 'https://womensnetwork.org/kwn-calls-for-respect-recognition-for-survivors-of-war-time-sexual-violence/', sourceLabel: 'Rrjeti i Grave të Kosovës' },
  { id: 'kosova-memory', side: 'kosova', strength: 'estimate',
    title: { sq: 'Libri i Kujtesës: 13.535 të vrarë ose të zhdukur', en: 'The Memory Book: 13,535 killed or missing' },
    body: { sq: 'Dokumentimi emëror i Qendrës për të Drejtën Humanitare numëron 13.535 persona të vrarë ose të zhdukur në Kosovë midis 1 janarit 1998 dhe 31 dhjetorit 2000; shumica dërrmuese e civilëve ishin shqiptarë. Më shumë se një mijë e gjashtëqind janë ende të zhdukur (ICRC).', en: 'The Humanitarian Law Center’s name-by-name documentation counts 13,535 people killed or missing in Kosovo between 1 January 1998 and 31 December 2000; the large majority of civilians were Albanians. More than sixteen hundred are still missing (ICRC).' },
    source: 'https://www.kosovomemorybook.org', sourceLabel: 'Libri i Kujtesës i Kosovës' },
];

export const STRENGTH_LABEL: Record<Strength, L> = {
  finding: { sq: 'Konstatim gjyqësor', en: 'Court finding' },
  estimate: { sq: 'Vlerësim', en: 'Estimate' },
  record: { sq: 'Akt zyrtar / dokumentim', en: 'Official record' },
};
