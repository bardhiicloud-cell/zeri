/**
 * Per-citizen Debati Publik preferences, stored on the user's own profile
 * document (`users/{id}.forumPrefs`). Other citizens' clients read them from the
 * same users list the forum already loads, which is how privacy and notification
 * choices are honoured on the sender's side.
 *
 * These are client-enforced: they shape what the app lets a signed-in citizen do,
 * not a server-side guarantee against a modified client. Direct-message privacy
 * and blocking are the exception — those are enforced by the server.
 */
export type ProfileVisibility = 'public' | 'followers' | 'private';
export type Audience = 'everyone' | 'followers' | 'nobody';

export interface ForumNotifyPrefs {
  likes: boolean;
  comments: boolean;
  replies: boolean;
  follows: boolean;
  mentions: boolean;
  reposts: boolean;
}

export type AccountType = 'personal' | 'business';

export const BUSINESS_CATEGORIES = [
  'Restorant & Kafe', 'Shitore & Tregti', 'Shërbime profesionale', 'Teknologji & Media',
  'Arsim & Trajnime', 'Shëndetësi & Mirëqenie', 'Ndërtim & Pasuri e paluajtshme',
  'Turizëm & Akomodim', 'Art & Kulturë', 'Organizatë joqeveritare', 'Institucion publik', 'Tjetër',
] as const;

export interface BusinessProfile {
  category: string;
  email: string;
  phone: string;
  website: string;
  address: string;
}

export const EMPTY_BUSINESS: BusinessProfile = { category: 'Tjetër', email: '', phone: '', website: '', address: '' };

export interface ForumPrefs {
  /** A business account gets contact buttons on the profile and detailed insights. */
  accountType: AccountType;
  business: BusinessProfile;
  /** Who can watch my Reels. */
  reelsVisibility: ProfileVisibility;
  /** Who can open the full profile (posts, reels, bio). */
  profileVisibility: ProfileVisibility;
  /** Show follower / following counts and lists to other citizens. */
  showFollowLists: boolean;
  /** Who may comment on my posts. */
  whoCanComment: Audience;
  /** Who may @mention me (a mention notifies me). */
  whoCanMention: Audience;
  allowReposts: boolean;
  notify: ForumNotifyPrefs;
}

export const DEFAULT_FORUM_PREFS: ForumPrefs = {
  accountType: 'personal',
  business: EMPTY_BUSINESS,
  reelsVisibility: 'public',
  profileVisibility: 'public',
  showFollowLists: true,
  whoCanComment: 'everyone',
  whoCanMention: 'everyone',
  allowReposts: true,
  notify: { likes: true, comments: true, replies: true, follows: true, mentions: true, reposts: true },
};

const VISIBILITIES: ProfileVisibility[] = ['public', 'followers', 'private'];
const AUDIENCES: Audience[] = ['everyone', 'followers', 'nobody'];

/** Only http(s) links are kept (no javascript: or data: URLs); a bare domain gets https://. */
export function normalizeWebsite(raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
  } catch {
    return '';
  }
}

/** Reads a (possibly missing or malformed) stored value into a complete, valid object. */
export function normalizeForumPrefs(raw: unknown): ForumPrefs {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<ForumPrefs> & { notify?: Partial<ForumNotifyPrefs> };
  const d = DEFAULT_FORUM_PREFS;
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
  const n: Partial<ForumNotifyPrefs> = r.notify || {};
  const bz: Partial<BusinessProfile> = (r.business && typeof r.business === 'object' ? r.business : {}) as Partial<BusinessProfile>;
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  return {
    accountType: r.accountType === 'business' ? 'business' : 'personal',
    business: {
      category: (BUSINESS_CATEGORIES as readonly string[]).includes(bz.category as string) ? (bz.category as string) : EMPTY_BUSINESS.category,
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(bz.email, 120)) ? text(bz.email, 120) : '',
      phone: text(bz.phone, 30).replace(/[^\d+()\-\s]/g, ''),
      website: normalizeWebsite(text(bz.website, 200)),
      address: text(bz.address, 140),
    },
    reelsVisibility: VISIBILITIES.includes(r.reelsVisibility as ProfileVisibility) ? (r.reelsVisibility as ProfileVisibility) : d.reelsVisibility,
    profileVisibility: VISIBILITIES.includes(r.profileVisibility as ProfileVisibility) ? (r.profileVisibility as ProfileVisibility) : d.profileVisibility,
    showFollowLists: bool(r.showFollowLists, d.showFollowLists),
    whoCanComment: AUDIENCES.includes(r.whoCanComment as Audience) ? (r.whoCanComment as Audience) : d.whoCanComment,
    whoCanMention: AUDIENCES.includes(r.whoCanMention as Audience) ? (r.whoCanMention as Audience) : d.whoCanMention,
    allowReposts: bool(r.allowReposts, d.allowReposts),
    notify: {
      likes: bool(n.likes, d.notify.likes),
      comments: bool(n.comments, d.notify.comments),
      replies: bool(n.replies, d.notify.replies),
      follows: bool(n.follows, d.notify.follows),
      mentions: bool(n.mentions, d.notify.mentions),
      reposts: bool(n.reposts, d.notify.reposts),
    },
  };
}

export function prefsOf(user: { forumPrefs?: unknown } | null | undefined): ForumPrefs {
  return normalizeForumPrefs(user?.forumPrefs);
}

/** Maps a notification category written by the debate to the preference that controls it. */
const CATEGORY_TO_NOTIFY: Record<string, keyof ForumNotifyPrefs> = {
  forum_like: 'likes',
  forum_repost: 'reposts',
  forum_quote: 'reposts',
  forum_mention: 'mentions',
  forum_follow: 'follows',
};

export function wantsNotification(
  recipient: { forumPrefs?: unknown } | null | undefined,
  category: string,
  /** `forum_reply` is either a comment on a post or a reply to a comment. */
  kind?: 'comment' | 'reply'
): boolean {
  const notify = prefsOf(recipient).notify;
  if (category === 'forum_reply') return kind === 'reply' ? notify.replies : notify.comments;
  const key = CATEGORY_TO_NOTIFY[category];
  return key ? notify[key] : true;
}

/** Does an audience setting let `actor` through? `followers` means people who follow the owner. */
export function audienceAllows(audience: Audience, actorFollowsOwner: boolean): boolean {
  if (audience === 'everyone') return true;
  if (audience === 'followers') return actorFollowsOwner;
  return false;
}

/** Can `viewer` open this profile in full? The owner always can. */
export function canViewProfile(
  prefs: ForumPrefs,
  opts: { isOwner: boolean; viewerFollowsOwner: boolean; viewerIsStaff?: boolean }
): boolean {
  if (opts.isOwner || opts.viewerIsStaff) return true;
  if (prefs.profileVisibility === 'public') return true;
  if (prefs.profileVisibility === 'followers') return opts.viewerFollowsOwner;
  return false;
}

/** Can `viewer` watch this author's Reels? Same rule as the profile. */
export function canViewReels(
  prefs: ForumPrefs,
  opts: { isOwner: boolean; viewerFollowsOwner: boolean; viewerIsStaff?: boolean }
): boolean {
  if (opts.isOwner || opts.viewerIsStaff) return true;
  if (prefs.reelsVisibility === 'public') return true;
  if (prefs.reelsVisibility === 'followers') return opts.viewerFollowsOwner;
  return false;
}

export const isBusiness = (user: { forumPrefs?: unknown } | null | undefined): boolean => prefsOf(user).accountType === 'business';
