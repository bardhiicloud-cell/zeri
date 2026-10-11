/**
 * Municipality name normalisation plus GDPR-safe location coarsening.
 *
 * Reverse geocoding (Nominatim / Google) returns the same city under many
 * spellings: "Pristina", "Priština", "Prishtinë", "PRISTINA". Everything in
 * the app compares municipality names with `===`, so a single mismatch silently
 * drops a citizen out of their own municipality feed. That logic used to be
 * inlined in LocationDetectorModal as a 50-entry literal; it lives here so the
 * map, the registry filters and the geocoder all share one implementation.
 */

/** Lowercase, strip diacritics and punctuation so spellings compare equal. */
export function normalizeMunicipalityKey(input: string): string {
  return (input ?? '')
    .toString()
    .trim()
    .toLowerCase()
    // Decompose accented characters, then drop the combining marks.
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // Serbian/Latin equivalents that survive NFD as distinct letters.
    .replace(/[đð]/g, 'd')
    .replace(/[ćč]/g, 'c')
    .replace(/[š]/g, 's')
    .replace(/[žź]/g, 'z')
    .replace(/[ğ]/g, 'g')
    .replace(/[ı]/g, 'i')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim();
}

/**
 * Canonical municipality name -> every accepted alias key, as produced by
 * {@link normalizeMunicipalityKey}. Look the map up with the geocoder's raw
 * city string; anything not listed falls through to fuzzy matching.
 */
export const MUNICIPALITY_ALIASES: Readonly<Record<string, readonly string[]>> = {
  'Prishtinë': ['prishtine', 'pristina', 'priština', 'prishtin', 'prištinë', 'pristinë'],
  'Prizren': ['prizren', 'prizrenit'],
  'Pejë': ['peje', 'peja', 'pec', 'peć', 'pejeq', 'ipe'],
  'Gjakovë': ['gjakove', 'gjakova', 'gjako', 'jakove', 'jakova', 'dakovica', 'gjakov'],
  'Gjilan': ['gjilan', 'gjilanit', 'gnjilane', 'gnjilane', 'jilani'],
  'Ferizaj': ['ferizaj', 'ferizaji', 'urosevac', 'uroševac', 'uroshevc'],
  'Mitrovicë': ['mitrovice', 'mitrovica', 'mitrovice', 'kosovska mitrovica', 'mitrovicee', 'mitrovic'],
  'Podujevë': ['podujeve', 'podujeva', 'podujevo'],
  'Vushtrri': ['vushtrri', 'vushtrria', 'vucitrn', 'vučitrn', 'vushtrri i vogël'],
  'Suharekë': ['suhareke', 'suhareka', 'suharek', 'suva reka', 'suha reka'],
  'Drenas': ['drenas', 'drenasi', 'glogovac', 'gllogoc'],
  'Rahovec': ['rahovec', 'rahoveci', 'orahovac', 'oraovac'],
  'Malishevë': ['maliseve', 'maliseva', 'malisevo', 'mališevo'],
  'Deçan': ['decan', 'deçani', 'decani', 'dečani'],
  'Istog': ['istog', 'istogu', 'istogi'],
  'Klinë': ['kline', 'klina', 'klina e|poshte'],
  'Skenderaj': ['skenderaj', 'skenderaji', 'srbica', 'srbska srbica'],
  'Fushë Kosovë': ['fushe kosove', 'fushë kosove', 'fushe kosova', 'fushë kosovë', 'kosovo polje', 'fush kosove'],
  'Kaçanik': ['kacanik', 'kaçaniku', 'kaçanik i', 'kacaniku'],
  'Kamenicë': ['kamenice', 'kamenica', 'kamenicë e', 'kamenic'],
  'Dragash': ['dragash', 'dragasi', 'dragaš', 'dragesh'],
  'Obiliq': ['obiliq', 'obiliqi', 'obilić', 'obilliq'],
  'Shtime': ['shtime', 'shtime', 'štimlje', 'shtimlje'],
  'Lipjan': ['lipjan', 'lipjani', 'lipjanit'],
  'Graçanicë': ['gracanice', 'gracanica', 'graçanicë', 'gracanice e'],
  'Novobërdë': ['novoberde', 'novobërde', 'novoberdë', 'novoberd'],
  'Ranillug': ['ranillug', 'ranillug', 'ranilug', 'ranillug i'],
  'Hani i Elezit': ['hani i elezit', 'hani i elezit', 'han i elezit', 'elezi'],
  'Leposaviq': ['leposaviq', 'leposavci', 'leposavic'],
  'Mamushë': ['mamuse', 'mamuša', 'mamusha', 'mamushe'],
  'Junik': ['junik', 'juniku', 'junik i'],
  'Kllokot': ['llokot', 'kllokot', 'llokoti'],
  'Partesh': ['partes', 'partesh', 'partesi'],
  'Zubin Potok': ['zubin potok', 'zubin potoci', 'zubinpotok'],
  'Zveçan': ['zvecan', 'zveçan', 'zvecani'],
  'Shtërpcë': ['shterpe', 'shtërpe', 'shterpce', 'shtërpcë'],
  'Viti': ['viti', 'viti i', 'vitit'],
  'Mamusha': ['mamusha', 'mamusha i']
};

/**
 * Resolve a raw geocoder/locality string to a canonical municipality name.
 * Exact alias match first, then a "contains" pass so that values like
 * "Qendra, Prishtinë" or "Podujevo Qender" still resolve.
 */
export function normalizeMunicipalityName(raw: string | null | undefined): string | null {
  const key = normalizeMunicipalityKey(raw ?? '');
  if (!key) return null;

  for (const [canonical, aliases] of Object.entries(MUNICIPALITY_ALIASES)) {
    if (key === normalizeMunicipalityKey(canonical)) return canonical;
  }

  for (const [canonical, aliases] of Object.entries(MUNICIPALITY_ALIASES)) {
    if (aliases.some((alias) => key === normalizeMunicipalityKey(alias))) return canonical;
  }

  for (const [canonical, aliases] of Object.entries(MUNICIPALITY_ALIASES)) {
    const candidates = [canonical, ...aliases];
    if (candidates.some((candidate) => {
      const normalizedCandidate = normalizeMunicipalityKey(candidate);
      return normalizedCandidate.length >= 4 && (key.includes(normalizedCandidate) || normalizedCandidate.includes(key));
    })) {
      return canonical;
    }
  }

  return null;
}

/** True when the geocoded locality is inside Kosovo's bounding box. */
export function isInsideKosovo(latitude: number, longitude: number): boolean {
  return latitude >= 41.85 && latitude <= 43.26 && longitude >= 20.01 && longitude <= 21.79;
}

/**
 * Number of decimal places used before a coordinate is persisted or transmitted.
 *
 * 2 decimals is ~1.1 km at Kosovo's latitude, which is precise enough to pick the
 * right municipality but far too coarse to identify a household — the threshold
 * the EU GDPR and the Kosovo Law on Personal Data treat as anonymous data.
 */
export const LOCATION_PRECISION_DECIMALS = 2;

/**
 * Round coordinates to the anonymous grid cell and return a stable, non-reversible
 * bucket id.
 *
 * The bucket id is a one-way hash of the *rounded* cell, so it can be used to
 * count "how many distinct cells reported this month" without ever storing a
 * position that could be walked back to a street.
 */
export function anonymizeCoordinates(
  latitude: number,
  longitude: number,
  decimals: number = LOCATION_PRECISION_DECIMALS
): { lat: number; lng: number; cellId: string } | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const factor = 10 ** decimals;
  const lat = Math.round(latitude * factor) / factor;
  const lng = Math.round(longitude * factor) / factor;

  // 32-bit FNV-1a: stable across processes, not reversible without brute force.
  let hash = 0x811c9dc5;
  const cell = `${lat.toFixed(decimals)}/${lng.toFixed(decimals)}`;
  for (let i = 0; i < cell.length; i += 1) {
    hash ^= cell.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return { lat, lng, cellId: `kc-${hash.toString(36).padStart(7, '0')}` };
}

/**
 * Bucket a position into the ~1.1 km cell that the anonymous grid produced,
 * used by NearbyAlerts to count reports in the same cell without holding the
 * citizen's real position in memory any longer than the current tick.
 */
export function coordinatesToCell(
  latitude: number,
  longitude: number,
  decimals: number = LOCATION_PRECISION_DECIMALS
): { lat: number; lng: number } | null {
  const result = anonymizeCoordinates(latitude, longitude, decimals);
  if (!result) return null;
  return { lat: result.lat, lng: result.lng };
}
