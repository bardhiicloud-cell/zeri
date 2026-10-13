import { beforeAll, describe, expect, it } from 'vitest';

/**
 * The server code base writes `value || undefined` to mean "omit this field".
 * The Admin SDK rejects `undefined` by default, which made report creation fail
 * for any report with an attachment and the live-feed write fail for any status
 * change without a note. `db()` must be configured to ignore undefined values.
 *
 * Run with: npm run test:rules   (provides FIRESTORE_EMULATOR_HOST)
 */
let db: () => import('firebase-admin/firestore').Firestore;

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('FIRESTORE_EMULATOR_HOST is not set - run these tests through `npm run test:rules`.');
  }
  // Set before the module is imported: it reads these at load time.
  process.env.FIREBASE_PROJECT_ID = 'demo-zeri-settings';
  delete process.env.FIREBASE_DATABASE_ID;
  delete process.env.VITE_FIREBASE_DATABASE_ID;
  delete process.env.FIREBASE_SERVICE_ACCOUNT;
  delete process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  ({ db } = await import('../../server/firebaseAdmin'));
});

describe('db() from server/firebaseAdmin', () => {
  it('stores a document that contains undefined values, leaving those fields out', async () => {
    const ref = await db().collection('probe').add({
      status: 'Approved',
      comment: undefined as string | undefined,
      media: [{ type: 'image', url: 'https://x.example/a.jpg', path: undefined }],
    });
    const stored = (await ref.get()).data()!;
    expect(stored.status).toBe('Approved');
    expect(stored).not.toHaveProperty('comment');
    expect(stored.media[0]).not.toHaveProperty('path');
    await ref.delete();
  });

  it('returns one shared instance, since settings() may be applied only once', () => {
    expect(db()).toBe(db());
  });
});
