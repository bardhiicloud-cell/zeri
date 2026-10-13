/**
 * One-off: give every existing forum post an explicit `visibility: 'public'` when it has none.
 *
 *   npx tsx scripts/backfill-post-visibility.ts            # dry run
 *   npx tsx scripts/backfill-post-visibility.ts --apply    # write
 *
 * Run BEFORE deploying the new firestore.rules and firestore.indexes.json: the rules serve
 * only `visibility == 'public'` posts to the public, so posts without the field would
 * disappear from the feed. Posts already marked 'followers' stay private.
 */
import '../server/loadEnv';
import { db } from '../server/firebaseAdmin';
import { backfillPostVisibility } from './postMaintenance';

const apply = process.argv.includes('--apply');
backfillPostVisibility(db(), { apply })
  .then((r) => {
    console.log(`${apply ? 'APPLIED' : 'DRY RUN'}: scanned ${r.scanned}, ${apply ? 'set public on' : 'would set public on'} ${r.missing} posts.`);
    if (!apply && r.missing > 0) console.log('Re-run with --apply to write.');
    process.exit(0);
  })
  .catch((error) => { console.error('Backfill failed:', error?.message ?? error); process.exit(1); });
