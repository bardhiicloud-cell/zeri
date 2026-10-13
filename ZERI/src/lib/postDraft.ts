/**
 * The post being written is kept in this browser so a refresh, a closed tab or a dropped
 * connection does not lose it. Text only (a file cannot be stored here), per account, and it is
 * removed as soon as the post is published or scheduled. Storage can be unavailable (private
 * mode, blocked site data), so every access is guarded and the composer works without it.
 */
const KEY = 'zeri_post_draft_v1';
export const DRAFT_MAX_AGE_MS = 7 * 86_400_000;

export interface PostDraft {
  uid: string;
  content: string;
  category: string;
  followersOnly: boolean;
  savedAt: number;
}

export function loadDraft(uid: string, now: number = Date.now(), storage: Pick<Storage, 'getItem'> | null = safeStorage()): PostDraft | null {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Partial<PostDraft>;
    if (draft.uid !== uid || typeof draft.content !== 'string' || !draft.content.trim()) return null;
    if (typeof draft.savedAt !== 'number' || now - draft.savedAt > DRAFT_MAX_AGE_MS) return null;
    return {
      uid, content: draft.content.slice(0, 5000), category: typeof draft.category === 'string' ? draft.category : 'all',
      followersOnly: draft.followersOnly === true, savedAt: draft.savedAt,
    };
  } catch {
    return null;
  }
}

/** Saves the draft, or removes it when there is nothing worth keeping. */
export function saveDraft(draft: Omit<PostDraft, 'savedAt'>, now: number = Date.now(), storage: Pick<Storage, 'setItem' | 'removeItem'> | null = safeStorage()): void {
  try {
    if (!storage) return;
    if (!draft.content.trim()) { storage.removeItem(KEY); return; }
    storage.setItem(KEY, JSON.stringify({ ...draft, savedAt: now }));
  } catch { /* Storage may be full or blocked; the post can still be written. */ }
}

export const clearDraft = (storage: Pick<Storage, 'removeItem'> | null = safeStorage()): void => {
  try { storage?.removeItem(KEY); } catch { /* ignore */ }
};

function safeStorage(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}
