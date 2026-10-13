/**
 * One-off: remove the author's e-mail from every existing forum post.
 *
 *   npx tsx scripts/scrub-post-emails.ts            # dry run (counts, writes nothing)
 *   npx tsx scripts/scrub-post-emails.ts --apply    # remove the field
 *
 * New posts no longer store it and the Firestore rules refuse it. Same credentials
 * as the server (FIREBASE_SERVICE_ACCOUNT / _PATH); set FIRESTORE_EMULATOR_HOST to
 * rehearse locally.
 */
import '../server/loadEnv';
import { db } from '../server/firebaseAdmin';
import { scrubPostEmails } from './postMaintenance';

const apply = process.argv.includes('--apply');
scrubPostEmails(db(), { apply })
  .then((r) => {
    console.log(`${apply ? 'APPLIED' : 'DRY RUN'}: scanned ${r.scanned}, ${apply ? 'removed e-mail from' : 'would remove e-mail from'} ${r.withEmail} posts.`);
    if (!apply && r.withEmail > 0) console.log('Re-run with --apply to write.');
    process.exit(0);
  })
  .catch((error) => { console.error('Scrub failed:', error?.message ?? error); process.exit(1); });
