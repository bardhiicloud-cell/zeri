/**
 * One-off: write `hashtags` on posts created before the field existed, so hashtag pages find them.
 *
 *   npx tsx scripts/backfill-post-hashtags.ts            # dry run
 *   npx tsx scripts/backfill-post-hashtags.ts --apply    # write
 */
import '../server/loadEnv';
import { db } from '../server/firebaseAdmin';
import { backfillPostHashtags } from './postMaintenance';

const apply = process.argv.includes('--apply');
backfillPostHashtags(db(), { apply })
  .then((r) => {
    console.log(`${apply ? 'APPLIED' : 'DRY RUN'}: scanned ${r.scanned}, ${apply ? 'updated' : 'would update'} ${r.posts} posts.`);
    if (!apply && r.posts > 0) console.log('Re-run with --apply to write.');
    process.exit(0);
  })
  .catch((error) => { console.error('Backfill failed:', error?.message ?? error); process.exit(1); });
