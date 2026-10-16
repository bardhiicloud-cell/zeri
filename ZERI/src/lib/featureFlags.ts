/**
 * Feature flags that the owner switches deliberately.
 *
 * DEBATE_PUBLIC_ENABLED — the public Debate (/forum, posts, reels, stories, DMs).
 * OFF by decision of the owner on 2026-10-16: it stays hidden from the whole site
 * until the expansion work is finished. Nothing public may link to it, advertise it
 * or list it in the sitemap while this is false. Reopen with
 * VITE_DEBATE_PUBLIC_ENABLED=true (web) and DEBATE_PUBLIC_ENABLED=true (server).
 * The Debate admin console (/debatwp) is unaffected.
 */
export const DEBATE_PUBLIC_ENABLED = import.meta.env.VITE_DEBATE_PUBLIC_ENABLED === 'true';
