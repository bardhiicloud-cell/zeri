/**
 * Load limits for every collection the browser subscribes to.
 *
 * ─── Why this file exists ────────────────────────────────────────────────────
 *
 * Firestore has no server-side cost model that punishes an unbounded read at
 * the moment you write it — the bill arrives later, and by then the query is
 * buried in a component. Every limit here encodes a decision that was previously
 * implicit, and several of them are the difference between a viable platform
 * and one that cannot be funded.
 *
 * The arithmetic that matters at 300,000 daily visitors:
 *
 *   A listener on an unbounded collection costs one document read per open
 *   listener, plus one more per document changed while it is open. With 50
 *   ads in the collection and 300,000 visitors/day opening the home page:
 *
 *       50 reads × 300,000 = 15,000,000 document reads per day
 *
 *   At the standard $0.06 per 100,000 reads that is ~$9/day for ONE collection
 *   nobody thinks about — about $3,300/year — and it grows with the collection,
 *   not with interest in it. Four such listeners were enough to make the
 *   platform's cost curve unmanageable.
 *
 * The fix is not "fewer features". It is narrower queries: a public page needs
 * the *current* ads, not every ad ever created; the newest polls, not all of
 * them. Those reads are the same at 50 documents or 50,000.
 *
 * ─── How to choose a number ─────────────────────────────────────────────────
 *
 * A limit should be the most any legitimate render needs, not a round number.
 * If a page shows 12 cards, 24 is generous. If a collection is genuinely
 * unbounded by nature (audit logs, reports), the limit is the page size and the
 * caller paginates.
 */

/** Public-facing content: what a single page render can actually display. */
export const PUBLIC_LIMITS = {
  /** Active campaigns only; expiry is filtered server-side where possible. */
  ads: 50,
  /** Donation appeals are few by nature, but not infinite. */
  donationCauses: 100,
  /** The poll page lists current surveys, not the archive. */
  polls: 50,
  /** Categories are near-static and small; a hard cap catches a seeding bug. */
  categories: 200,
  /** The public contact directory. */
  contacts: 200,
  /** One author's reels shown on a public profile card. */
  profileReels: 50,
} as const;

/** Staff-facing content: bounded by what a supervisor reviews in one sitting. */
export const STAFF_LIMITS = {
  /** The recent-activity feed; older entries are sought by filter, not scroll. */
  auditLogs: 500,
  /** One page of the citizen directory. */
  users: 50,
  /** Health registry entries shown at once. */
  healthCases: 200,
  /** Medicine-shortage reports reviewed in one sitting (pending first). */
  medicineShortages: 300,
  /** Newsroom work-fact verification queue. */
  workFacts: 200,
  /** Support conversations open at once. */
  chats: 100,
  /** The most recent ad enquiries; older ones are sought by filter. */
  adRequests: 200,
  /** Public-debate posts a moderator reviews in one sitting (newest first). */
  forumPosts: 200,
  /** Live Debat Stories (24h ephemeral); older ones expire on their own. */
  forumStories: 200,
  /** Newsroom articles under management; the archive is paginated, not listed. */
  newsArticles: 300,
  /** Verified official/municipal profiles — a bounded directory. */
  officialProfiles: 300,
  /** Per-category report routing contacts (configuration, not content). */
  routingContacts: 300,
} as const;

/** Citizen-facing content with unbounded growth. */
export const CONTENT_LIMITS = {
  /** The report feed is paginated; this is the first page. */
  reports: 100,
  /** Comments rendered beneath one report. */
  comments: 100,
  /** Live-chat messages retained in memory. */
  liveMessages: 100,
  /** Newest posts loaded by the community social feed. */
  socialFeed: 30,
  /** Comments loaded when a social post's thread is opened. */
  socialComments: 50,
} as const;

/**
 * A listener that must never receive "the whole collection".
 *
 * Exported as a constant so the intent is greppable: if a query in this codebase
 * has no `limit(...)` and is not wrapped in `cachedCollection`, that is the bug,
 * and this name is what a reviewer searches for.
 */
export const UNBOUNDED_LISTENER_IS_A_DEFECT = true;
