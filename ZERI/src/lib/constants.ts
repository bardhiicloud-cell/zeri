export const KOSOVO_MUNICIPALITIES = [
  'Deçan', 'Dragash', 'Drenas', 'Ferizaj', 'Fushë Kosovë', 'Gjakovë', 'Gjilan', 'Graçanicë',
  'Hani i Elezit', 'Istog', 'Junik', 'Kaçanik', 'Kamenicë', 'Klinë', 'Kllokot', 'Leposaviq',
  'Lipjan', 'Malishevë', 'Mamushë', 'Mitrovicë', 'Mitrovica e Veriut', 'Novobërdë', 'Obiliq',
  'Partesh', 'Pejë', 'Podujevë', 'Prishtinë', 'Prizren', 'Rahovec', 'Ranillug', 'Shtërpcë',
  'Shtime', 'Skenderaj', 'Suharekë', 'Viti', 'Vushtrri', 'Zubin Potok', 'Zveçan'
].sort();

export const ALL_MUNICIPALITIES_OPTION = 'Të gjitha Komunat';

/**
 * The 24 "core" municipalities surfaced in the forum/neighborhood pickers.
 * This is intentionally a separate list from KOSOVO_MUNICIPALITIES: the full
 * 38-municipality registry lives in the same file and is used by the map,
 * the public registry filters and the admin panels.
 */
export const FORUM_MUNICIPALITIES = [
  ALL_MUNICIPALITIES_OPTION, 'Prishtinë', 'Prizren', 'Pejë', 'Ferizaj', 'Gjilan',
  'Mitrovicë', 'Gjakovë', 'Podujevë', 'Vushtrri', 'Suharekë', 'Drenas',
  'Rahovec', 'Malishevë', 'Deçan', 'Istog', 'Klinë', 'Skenderaj',
  'Fushë Kosovë', 'Kaçanik', 'Kamenicë', 'Dragash', 'Obiliq', 'Shtime'
] as const;

export type ForumMunicipality = typeof FORUM_MUNICIPALITIES[number];

/**
 * Historic alias. Kept as a real constant (not a re-export) so that no page
 * module has to export plain data alongside a React component: mixing the two
 * breaks Vite's React Fast Refresh boundary.
 */
export const CITY_NEIGHBORHOODS: readonly string[] = FORUM_MUNICIPALITIES;

export const KOSOVO_BOUNDS: [[number, number], [number, number]] = [
  [41.85, 20.01], // South-West
  [43.26, 21.79]  // North-East
];

export const MUNICIPALITY_COORDINATES: Record<string, [number, number]> = {
  'Deçan': [42.5378, 20.2778],
  'Dragash': [42.0633, 20.6558],
  'Drenas': [42.6254, 20.8931],
  'Ferizaj': [42.3706, 21.1558],
  'Fushë Kosovë': [42.6318, 21.0850],
  'Gjakovë': [42.3833, 20.4333],
  'Gjilan': [42.4633, 21.4694],
  'Graçanicë': [42.6025, 21.1969],
  'Hani i Elezit': [42.1508, 21.2961],
  'Istog': [42.7808, 20.4875],
  'Junik': [42.4744, 20.2783],
  'Kaçanik': [42.2319, 21.2594],
  'Kamenicë': [42.5761, 21.5800],
  'Klinë': [42.6214, 20.5778],
  'Kllokot': [42.3683, 21.3739],
  'Leposaviq': [43.1039, 20.8028],
  'Lipjan': [42.5217, 21.1258],
  'Malishevë': [42.4822, 20.7458],
  'Mamushë': [42.3314, 20.7289],
  'Mitrovicë': [42.8914, 20.8660],
  'Mitrovica e Veriut': [42.8986, 20.8697],
  'Novobërdë': [42.6158, 21.4319],
  'Obiliq': [42.6869, 21.0706],
  'Partesh': [42.4019, 21.4542],
  'Pejë': [42.6593, 20.2887],
  'Podujevë': [42.9111, 21.1894],
  'Prishtinë': [42.6629, 21.1655],
  'Prizren': [42.2139, 20.7397],
  'Rahovec': [42.3994, 20.6533],
  'Ranillug': [42.4908, 21.6025],
  'Shtërpcë': [42.2394, 21.0272],
  'Shtime': [42.4331, 21.0397],
  'Skenderaj': [42.7483, 20.7853],
  'Suharekë': [42.3586, 20.8250],
  'Viti': [42.3214, 21.3583],
  'Vushtrri': [42.8231, 20.9675],
  'Zubin Potok': [42.9144, 20.6897],
  'Zveçan': [42.9056, 20.8406]
};
