const photoUrls = import.meta.glob('../assets/municipalities/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

const SLUGS: Record<string, string> = {
  'Deçan': 'decan', 'Dragash': 'dragash', 'Drenas': 'drenas', 'Ferizaj': 'ferizaj',
  'Fushë Kosovë': 'fushe-kosove', 'Gjakovë': 'gjakove', 'Gjilan': 'gjilan', 'Graçanicë': 'gracanice',
  'Hani i Elezit': 'hani-i-elezit', 'Istog': 'istog', 'Junik': 'junik', 'Kaçanik': 'kacanik',
  'Kamenicë': 'kamenice', 'Klinë': 'kline', 'Kllokot': 'kllokot', 'Leposaviq': 'leposaviq',
  'Lipjan': 'lipjan', 'Malishevë': 'malisheve', 'Mamushë': 'mamushe', 'Mitrovicë': 'mitrovice',
  'Mitrovica e Veriut': 'mitrovica-veriut', 'Novobërdë': 'novoberde', 'Obiliq': 'obiliq',
  'Partesh': 'partesh', 'Pejë': 'peje', 'Podujevë': 'podujeve', 'Prishtinë': 'prishtine',
  'Prizren': 'prizren', 'Rahovec': 'rahovec', 'Ranillug': 'ranillug', 'Shtërpcë': 'shterpce',
  'Shtime': 'shtime', 'Skenderaj': 'skenderaj', 'Suharekë': 'suhareke', 'Viti': 'viti',
  'Vushtrri': 'vushtrri', 'Zubin Potok': 'zubin-potok', 'Zveçan': 'zvecan',
};

export type MunicipalityPhotoMode = 'day' | 'night';

export function getMunicipalitySlug(name: string): string | undefined {
  return SLUGS[name];
}

export function getMunicipalityPhoto(name: string, mode: MunicipalityPhotoMode): string | undefined {
  const slug = SLUGS[name];
  return slug ? photoUrls[`../assets/municipalities/${slug}-${mode}.webp`] : undefined;
}
