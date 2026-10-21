/** Authors and licences of the photographs in /public/heritage/photos (all from Wikimedia Commons, free licences). Generated from the file pages; edit the author here if a source changes. */
export interface PhotoCredit { author: string; license: string; source: string }

export const PHOTO_CREDITS: Record<string, PhotoCredit> = {
  'prizren': { author: 'Marcin Konsek', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:2011_Prizren,_Most_kamienny.JPG' },
  'rugova': { author: 'SUHEJLO', license: 'CC BY 4.0', source: 'https://commons.wikimedia.org/wiki/File:Rugova_Canyon_in_the_Accursed_Mountains.jpg' },
  'bjeshket': { author: 'SUHEJLO', license: 'CC BY 4.0', source: 'https://commons.wikimedia.org/wiki/File:Accursed_Mountains_in_the_West_part_of_Kosovo_(Albania,_Montenegro_and_Kosovo).jpg' },
  'mirusha': { author: 'Veton Kastrati', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Mirusha_waterfall_from_a_different_view.jpg' },
  'radavc': { author: 'Arben Llapashtica', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Radavc_Shpella.jpg' },
  'sharri': { author: 'Ben Njeri', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Aproaching_top_of_Brezovica.jpg' },
  'gadime': { author: 'Flamur Murati', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:From_inside_the_Marble_Cave_in_Gadime,municipality_of_Lipjan_26.JPG' },
  'germia': { author: 'Fitore Syla', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Germia_1.jpg' },
  'batllava': { author: 'Violetamyftari', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Batllava_lake.JPG' },
  'ulpiana': { author: 'Julianruizp', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Archaeological_Park_Ulpiana,_Thermae.jpg' },
  'novoberde': { author: 'Arben Llapashtica', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Medieval_Novo_Brdo_Fortress_after_reconstruction.jpg' },
  'gjakova': { author: 'Bdx', license: 'CC0', source: 'https://commons.wikimedia.org/wiki/File:Restaurant_in_the_Old_Bazaar_of_Gjakova,_2025.jpg' },
  'kullat': { author: 'Sali Shoshi', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Kulla_Biblioteke.jpg' },
  'unesco': { author: 'Julian Nyča', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Visoki_De%C4%8Dani,_exterior_view_(Julian_Ny%C4%8Da).jpg' },
  'prishtina': { author: 'Karrota', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:NEWBORN_Monument.jpg' },
  'prekaz': { author: 'KushtrimHoti7', license: 'CC BY 4.0', source: 'https://commons.wikimedia.org/wiki/File:Kompleksi_Memorial_Adem_Jashari_n%C3%AB_Prekaz,_Skenderaj.jpg' },
  'koshare': { author: 'Nentor oseku', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Koshare.JPG' },
  'arinjte': { author: 'albinfo', license: 'CC0', source: 'https://commons.wikimedia.org/wiki/File:Bear_Sanctuary_Prishtina_Bear_3_(OSCAL19_trip).jpg' },
  'qyteti-prizren': { author: 'Marcin Konsek', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:2011_Prizren,_Meczet_Sinana_Paszy_04.JPG' },
  'qyteti-peja': { author: 'Albinfo', license: 'CC BY 4.0', source: 'https://commons.wikimedia.org/wiki/File:Peja_city_center_in_winter_(WPWTR17).jpg' },
  'qyteti-gjakova': { author: 'ShkelzenRexha', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:07_Gjakova_Naten_Gjakova_at_Night.jpg' },
  'qyteti-gjilani': { author: 'Planeti', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Gjilani_pas_dite.jpg' },
  'qyteti-mitrovica': { author: 'GentiBehramaj', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Ibar_Bridge_in_Mitrovica,_Kosovo_00_59_05_535000.jpeg' },
  'qyteti-prishtina': { author: 'Petrit Daku', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Prishtina_by_night.jpg' },
  'qyteti-ferizaj': { author: 'Fjolle Ramadani', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:25_gusht.jpg' },
};

/** "Author · licence" for places where the credit cannot be a link (for example inside another link). */
export function photoCreditText(name: string): string | undefined {
  const c = PHOTO_CREDITS[name];
  return c ? `${c.author} · ${c.license}` : undefined;
}
