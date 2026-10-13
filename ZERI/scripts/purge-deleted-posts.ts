/**
 * Daily job: permanently remove posts that their author deleted more than 30 days ago
 * (they can be restored until then). Run it from a scheduler, e.g. once a day:
 *
 *   npx tsx scripts/purge-deleted-posts.ts
 *
 * Removes each post with its subcollections (edit history, view marks, ad-click marks).
 * It does nothing else and is safe to run repeatedly. Same credentials as the server.
 */
import '../server/loadEnv';
import { db } from '../server/firebaseAdmin';
import { purgeExpiredDeletedPosts } from '../server/forumPosts';

(async () => {
  let total = 0;
  // 200 per round; keep going until a round removes fewer than that.
  for (;;) {
    const removed = await purgeExpiredDeletedPosts(db(), Date.now(), 200);
    total += removed;
    if (removed < 200) break;
  }
  console.log(`Removed ${total} expired deleted post(s).`);
  process.exit(0);
})().catch((error) => { console.error('Purge failed:', error?.message ?? error); process.exit(1); });
