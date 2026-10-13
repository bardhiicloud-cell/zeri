/**
 * Publishes scheduled posts that are due. The web server also does this every minute while it
 * runs; on hosting that scales to zero, call this from a scheduler (e.g. every 5 minutes):
 *
 *   npx tsx scripts/publish-scheduled-posts.ts
 *
 * Safe to run repeatedly and concurrently: each post is published once.
 */
import '../server/loadEnv';
import { db } from '../server/firebaseAdmin';
import { publishDueScheduled } from '../server/scheduledPosts';

(async () => {
  let total = 0;
  for (;;) {
    const ids = await publishDueScheduled(db(), Date.now(), 50);
    total += ids.length;
    if (ids.length < 50) break;
  }
  console.log(`Published ${total} scheduled post(s).`);
  process.exit(0);
})().catch((error) => { console.error('Publish failed:', error?.message ?? error); process.exit(1); });
