import type { L } from './memorial';

/** Why visit: the things a guest is told about Kosovo before the list of places. */
export const WHY_VISIT: ReadonlyArray<{ id: string; title: L; body: L }> = [
  { id: 'mikpritja', title: { sq: 'Mikpritja si ligj', en: 'Hospitality as law' },
    body: { sq: '“Shtëpia e shqiptarit është e Zotit dhe e mikut” — fjalë e Kanunit që ende jeton. Mikun e pret kafja, rakia, sofra, dhe shpesh nuk të lejojnë ta paguash.', en: '“The Albanian’s house belongs to God and to the guest” — a line of the Kanun that still lives. A guest is met with coffee, a table laid, and often not allowed to pay.' } },
  { id: 'tradita', title: { sq: 'Tradita të gjalla', en: 'Living traditions' },
    body: { sq: 'Çiftelia dhe lahuta, veshja popullore, qilimat dhe filigrani i Prizrenit; flija, tava e Prizrenit dhe pitet e shtëpisë. Zejet e vjetra të çarshive punojnë ende.', en: 'The çifteli and lahuta, folk costume, rugs and Prizren filigree; flija, Prizren’s tava and home-baked pies. The old bazaar crafts still work.' } },
  { id: 'rinia', title: { sq: 'Një vend i ri dhe i ri në moshë', en: 'A young country, and a young one in age' },
    body: { sq: 'Kosova ka një nga popullatat më të reja të Evropës. Kafenetë e Prishtinës mbushen me muzikë, art, startup-e dhe festivale si DokuFest në Prizren.', en: 'Kosovo has one of Europe’s youngest populations. Prishtina’s cafés are full of music, art, start-ups and festivals such as DokuFest in Prizren.' } },
  { id: 'natyra', title: { sq: 'Natyrë që nuk e pret', en: 'Nature you don’t expect' },
    body: { sq: 'Në një ditë mund të kalosh nga kanionet e Rugovës te liqenet e Bjeshkëve të Nemuna dhe në pistat e Brezovicës.', en: 'In a single day you can pass from the Rugova canyons to the lakes of the Accursed Mountains and the slopes of Brezovica.' } },
];

export interface City { id: string; name: string; tag: L; body: L }

export const CITIES: readonly City[] = [
  { id: 'prishtina', name: 'Prishtina', tag: { sq: 'Kryeqyteti', en: 'The capital' },
    body: { sq: 'Qendra politike dhe kulturore: Biblioteka Kombëtare, monumenti NEWBORN, Sheshi Skënderbeu e Bulevardi Nënë Tereza.', en: 'The political and cultural centre: the National Library, the NEWBORN monument, Skanderbeg Square and Mother Teresa Boulevard.' } },
  { id: 'prizren', name: 'Prizreni', tag: { sq: 'Qyteti i Lidhjes', en: 'City of the League' },
    body: { sq: 'Ura e Gurit, Shadërvani, Kalaja dhe Lidhja Shqiptare e Prizrenit (1878). Qyteti më i ruajtur i Kosovës.', en: 'The Stone Bridge, Shadërvan, the Fortress and the Albanian League of Prizren (1878). Kosovo’s best-preserved city.' } },
  { id: 'peja', name: 'Peja', tag: { sq: 'Në portën e Bjeshkëve', en: 'At the gate of the mountains' },
    body: { sq: 'Çarshia, Patrikana e Pejës (UNESCO) dhe udhëtimi te Gryka e Rugovës.', en: 'The bazaar, the Patriarchate of Peć (UNESCO) and the road to the Rugova gorge.' } },
  { id: 'gjakova', name: 'Gjakova', tag: { sq: 'Çarshia e Madhe', en: 'The Great Bazaar' },
    body: { sq: 'Pazari i vjetër i zejtarëve, xhamia e Hadumit dhe Ura e Terzive.', en: 'The old craftsmen’s bazaar, the Hadum mosque and the Tailors’ Bridge.' } },
  { id: 'gjilani', name: 'Gjilani', tag: { sq: 'Kosova Lindore', en: 'Eastern Kosovo' },
    body: { sq: 'Qyteti i Anamoravës, me parqe dhe një skenë të gjallë kulturore.', en: 'The city of Anamorava, with parks and a lively cultural scene.' } },
  { id: 'mitrovica', name: 'Mitrovica', tag: { sq: 'Qyteti i Trepçës', en: 'City of Trepça' },
    body: { sq: 'Qyteti i minierave të Trepçës dhe urë mes veriut e jugut të vendit.', en: 'The city of the Trepça mines, a bridge between the country’s north and south.' } },
  { id: 'ferizaj', name: 'Ferizaji', tag: { sq: 'Udhëkryqi', en: 'The crossroads' },
    body: { sq: 'Qyteti i hekurudhës dhe porta për në Malet e Sharrit e Brezovicën.', en: 'The railway city and the gateway to the Sharr mountains and Brezovica.' } },
];
