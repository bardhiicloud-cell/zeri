/**
 * One-off migration: give every existing `forumStories` document an explicit
 * `isHidden` flag.
 *
 * WHY: the new Firestore rules make hiding a stored, enforced property. Stories
 * created before this change have no `isHidden` field, so the rules cannot prove
 * them visible and the stories feed would stop showing them. Hidden stories
 * (the moderation panel sets `isHidden: true`) are left exactly as they are.
 *
 * ORDER OF ROLLOUT (important):
 *   1. Run this script with --apply            (documents gain isHidden: false)
 *   2. Deploy firestore.indexes.json and wait for the new index to finish building
 *   3. Deploy firestore.rules
 *   4. Deploy the web app (its query and create now send isHidden)
 *
 * It only ever writes `isHidden: false` on documents where the field is missing.
 * Default is a DRY RUN that prints counts and writes nothing.
 *
 *   npx tsx scripts/backfill-story-visibility.ts            # dry run
 *   npx tsx scripts/backfill-story-visibility.ts --apply    # write
 *
 * Credentials: the same FIREBASE_SERVICE_ACCOUNT / FIREBASE_SERVICE_ACCOUNT_PATH
 * the server uses (see server/firebaseAdmin.ts). To rehearse against the local
 * emulator set FIRESTORE_EMULATOR_HOST first; nothing real is touched then.
 */
import '../server/loadEnv';
import { db } from '../server/firebaseAdmin';
import { backfillStoryVisibility } from './storyVisibility';

const apply = process.argv.includes('--apply');

backfillStoryVisibility(db(), { apply })
  .then((r) => {
    console.log(`${apply ? 'APPLIED' : 'DRY RUN'}: scanned ${r.scanned}, already flagged ${r.alreadyFlagged}, ` +
      `${apply ? 'updated' : 'would update'} ${r.missing}.`);
    if (!apply && r.missing > 0) console.log('Re-run with --apply to write.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Backfill failed:', error?.message ?? error);
    process.exit(1);
  });
