/**
 * The music of the war of liberation, played on /historia-e-uck after the visitor says yes.
 *
 * `videoId` is the 11-character id from the YouTube address (youtube.com/watch?v=<id>). Tracks are played through the
 * YouTube player (never downloaded or re-hosted); one the owner has blocked from embedding is skipped, and a track without an id is shown with a link that
 * searches YouTube for it instead of a player, so nothing here is ever a dead embed.
 */
export interface Track { id: string; title: string; artist: string; videoId?: string }

export const PLAYLIST: readonly Track[] = [
  { id: 'mora-fjale', title: 'Mora fjalë', artist: 'Shkurte Fejza', videoId: 'CBBOtITApwg' },
  { id: 'kosova-adem-jashari', title: 'Kosova e Adem Jasharit', artist: 'Shkurte Fejza', videoId: 'D9l3lffU_Zo' },
  { id: 'marshi-uck', title: 'Marshi i UÇK-së', artist: 'Arif Vladi', videoId: 'AyJbZWK4BBQ' },
  { id: 'marshi-uck-rare', title: 'Marshi i UÇK-së (version i rrallë)', artist: 'Kënga e luftës', videoId: 'CcIBYV_ZztI' },
  { id: 'mora-fjale-live', title: 'Mora fjalë — live, Air Albania', artist: 'Stadiumi i Tiranës këndon për Ademin', videoId: '_gtv-UcRPYM' },
];

export const searchUrl = (t: Track) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${t.title} ${t.artist}`)}`;
export const hasEmbed = (list: readonly Track[] = PLAYLIST) => list.some((t) => Boolean(t.videoId));
