/**
 * The music of the war of liberation, played on /historia-e-uck after the visitor says yes.
 *
 * `videoId` is the 11-character id from the YouTube address (youtube.com/watch?v=<id>). Add the ids of
 * the recordings the newsroom has the right to embed; a track without one is shown with a link that
 * searches YouTube for it instead of a player, so nothing here is ever a dead embed.
 */
export interface Track { id: string; title: string; artist: string; videoId?: string }

export const PLAYLIST: readonly Track[] = [
  { id: 'mora-fjale', title: 'Mora fjalë', artist: 'Shkurte Fejza' },
  { id: 'adem-jashari', title: 'Adem Jashari', artist: 'Kënga e Prekazit' },
  { id: 'uck-himn', title: 'Himni i UÇK-së', artist: 'Ushtria Çlirimtare e Kosovës' },
  { id: 'kenga-e-lirise', title: 'Këngë për lirinë', artist: 'Këngë patriotike' },
];

export const searchUrl = (t: Track) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${t.title} ${t.artist}`)}`;
export const hasEmbed = (list: readonly Track[] = PLAYLIST) => list.some((t) => Boolean(t.videoId));
