/**
 * Integration point for a LICENSED music catalog.
 *
 * No catalog is bundled or invented: popular songs cannot be offered without a
 * licence, and there is no licensed provider configured for this project. The
 * Reel editor therefore lets authors add audio they own or are authorised to use
 * (they must confirm that), and shows the credit on the published Reel.
 *
 * To connect a provider later, implement `AudioCatalogProvider` and return it
 * from `getAudioCatalog()`. The editor already shows the search box whenever a
 * provider exists; nothing else needs to change. A provider MUST return only
 * tracks whose licence permits use in user videos, with the licence text in
 * `license` so it can be displayed and stored.
 */
export interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  /** Direct URL of a playable preview/full file the browser may fetch (CORS-enabled). */
  url: string;
  durationSec: number;
  /** Human-readable licence, e.g. "CC BY 4.0 — Artist". Shown to the author and viewers. */
  license: string;
}

export interface AudioCatalogProvider {
  name: string;
  search(query: string, signal?: AbortSignal): Promise<AudioTrack[]>;
}

/** null = no licensed catalog is configured (the current state). */
export function getAudioCatalog(): AudioCatalogProvider | null {
  return null;
}
