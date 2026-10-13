/**
 * One-off: record, on each post, who commented on it (`commentAuthorIds`).
 *
 *   npx tsx scripts/backfill-comment-authors.ts            # dry run
 *   npx tsx scripts/backfill-comment-authors.ts --apply    # write
 *
 * New comments maintain the field automatically; this covers older posts so account
 * erasure can anonymise their comments too.
 */
import '../server/loadEnv';
import { db } from '../server/firebaseAdmin';
import { backfillCommentAuthors } from './postMaintenance';

const apply = process.argv.includes('--apply');
backfillCommentAuthors(db(), { apply })
  .then((r) => {
    console.log(`${apply ? 'APPLIED' : 'DRY RUN'}: scanned ${r.scanned}, ${apply ? 'updated' : 'would update'} ${r.posts} posts.`);
    if (!apply && r.posts > 0) console.log('Re-run with --apply to write.');
    process.exit(0);
  })
  .catch((error) => { console.error('Backfill failed:', error?.message ?? error); process.exit(1); });
