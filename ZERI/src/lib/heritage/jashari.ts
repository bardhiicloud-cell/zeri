import type { L } from './memorial';

/** The Jashari family and the Prekaz epic, 1998. Dates are from the memorial's public record; each row names a source. */
export interface Beat { date: string; title: L; body: L }

export const PREKAZ_BEATS: readonly Beat[] = [
  { date: '22.01.1998', title: { sq: 'Sulmi i parë', en: 'The first attack' },
    body: { sq: 'Forca speciale të policisë serbe sulmuan kompleksin e Jasharëve në Prekaz për të arrestuar Ademin. Sulmi dështoi: u kthyen pa e kapur.', en: 'Serbian special police attacked the Jashari compound in Prekaz to arrest Adem. The attack failed: they withdrew without him.' } },
  { date: '05.03.1998', title: { sq: 'Rrethimi', en: 'The siege begins' },
    body: { sq: 'Policia, ushtria dhe blindat rrethuan Prekazin dhe nisën të gjuajnë me artileri e tanke shtëpitë e familjes. Ademi dhe familja nuk u dorëzuan.', en: 'Police, army and armour surrounded Prekaz and began shelling the family’s homes with artillery and tanks. Adem and his family did not surrender.' } },
  { date: '07.03.1998', title: { sq: 'Fundi i betejës', en: 'The end of the battle' },
    body: { sq: 'Pas tri ditësh, kompleksi u shkatërrua. Ra Ademi me vëllanë Hamëzin, gratë, fëmijët e pleqtë e familjes — burimet japin 56–58 të vrarë. Mbijetoi 11-vjeçarja Besarta, e bija e Hamëzit.', en: 'After three days the compound was destroyed. Adem fell with his brother Hamëz and the women, children and elders of the family — sources give 56–58 killed. 11-year-old Besarta, Hamëz’s daughter, survived.' } },
  { date: '1998–1999', title: { sq: 'Prekazi bëhet shkëndija e luftës', en: 'Prekaz becomes the spark of the war' },
    body: { sq: 'Masakra ngriti mijëra vullnetarë; UÇK-ja u shndërrua nga një grup i vogël në një lëvizje kombëtare. Rreth Prekazit u ngrit kompleksi memorial që sot vizitohet çdo vit më 5–7 mars.', en: 'The massacre brought thousands of volunteers; the KLA grew from a small group into a national movement. The memorial complex now stands at Prekaz and is visited every year on 5–7 March.' } },
];

export const JASHARI_FACTS: ReadonlyArray<{ k: string; v: L }> = [
  { k: '28.11.1955', v: { sq: 'Lindi në Prekaz, Skënderaj', en: 'Born in Prekaz, Skenderaj' } },
  { k: '1990s', v: { sq: 'Nga themeluesit e rezistencës së armatosur', en: 'Among the founders of the armed resistance' } },
  { k: '07.03.1998', v: { sq: 'Ra në Prekaz me familjen', en: 'Fell at Prekaz with his family' } },
  { k: '56–58', v: { sq: 'anëtarë të familjes të vrarë', en: 'family members killed' } },
];

export const JASHARI_SOURCE = 'https://en.wikipedia.org/wiki/Adem_Jashari';
export const PREKAZ_SOURCE = 'https://en.wikipedia.org/wiki/Attack_on_Prekaz';
