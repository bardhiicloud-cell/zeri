 import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage';

/**
 * Run with: npm run test:rules   (starts the Firestore + Storage emulators)
 */
let env: RulesTestEnvironment;

const A = 'uidAAAA';
const B = 'uidBBBB';
const bytes = (size = 8) => new Uint8Array(size).fill(1);
const MB = 1024 * 1024;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-zeri-rules',
    storage: { rules: readFileSync(path.resolve(__dirname, '../../storage.rules'), 'utf8') },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

const asUser = (uid: string, claims: Record<string, unknown> = {}) =>
  env.authenticatedContext(uid, { firebase: { sign_in_provider: 'password' }, ...claims }).storage();
const asGuest = (uid: string) =>
  env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).storage();
const anonymousVisitor = () => env.unauthenticatedContext().storage();

/** Put an object in place without going through the rules. */
async function seed(objectPath: string, contentType: string) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage(), objectPath), bytes(), { contentType });
  });
}

describe('reports/{uid}/{scope}/{file} — citizen media', () => {
  it('lets the owner upload an image, video, audio clip and document', async () => {
    const storage = asUser(A);
    await assertSucceeds(uploadBytes(ref(storage, `reports/${A}/r1/a.png`), bytes(), { contentType: 'image/png' }));
    await assertSucceeds(uploadBytes(ref(storage, `reports/${A}/r1/b.mp4`), bytes(), { contentType: 'video/mp4' }));
    await assertSucceeds(uploadBytes(ref(storage, `reports/${A}/r1/c.mp3`), bytes(), { contentType: 'audio/mpeg' }));
    await assertSucceeds(uploadBytes(ref(storage, `reports/${A}/r1/d.pdf`), bytes(), { contentType: 'application/pdf' }));
  });

  it('rejects types that can carry script or executables', async () => {
    const storage = asUser(A);
    await assertFails(uploadBytes(ref(storage, `reports/${A}/r1/x.svg`), bytes(), { contentType: 'image/svg+xml' }));
    await assertFails(uploadBytes(ref(storage, `reports/${A}/r1/x.html`), bytes(), { contentType: 'text/html' }));
    await assertFails(uploadBytes(ref(storage, `reports/${A}/r1/x.exe`), bytes(), { contentType: 'application/x-msdownload' }));
  });

  it('rejects an oversized file', async () => {
    await assertFails(
      uploadBytes(ref(asUser(A), `reports/${A}/r1/big.png`), bytes(15 * MB + 1), { contentType: 'image/png' })
    );
  });

  it('accepts an iPhone .mov and a ~30 s video up to 50 MB, but not a larger one', async () => {
    const storage = asUser(A);
    await assertSucceeds(uploadBytes(ref(storage, `reports/${A}/r1/iphone.mov`), bytes(20 * MB), { contentType: 'video/quicktime' }));
    await assertSucceeds(uploadBytes(ref(storage, `reports/${A}/r1/long.mp4`), bytes(40 * MB), { contentType: 'video/mp4' }));
    await assertFails(uploadBytes(ref(storage, `reports/${A}/r1/huge.mp4`), bytes(50 * MB + 1), { contentType: 'video/mp4' }));
  // 110 MB goes through the emulator in this test: the 5 s default fails on a busy machine.
  }, 60_000);

  it("rejects writing into someone else's prefix, and unauthenticated writes", async () => {
    await assertFails(uploadBytes(ref(asUser(B), `reports/${A}/r1/a.png`), bytes(), { contentType: 'image/png' }));
    await assertFails(uploadBytes(ref(anonymousVisitor(), `reports/${A}/r1/a.png`), bytes(), { contentType: 'image/png' }));
  });

  it('lets the owner delete their own upload (and nobody else)', async () => {
    await seed(`reports/${A}/del/a.png`, 'image/png');
    await assertFails(deleteObject(ref(asUser(B), `reports/${A}/del/a.png`)));
    await assertSucceeds(deleteObject(ref(asUser(A), `reports/${A}/del/a.png`)));
  });

  it('keeps report media publicly readable', async () => {
    await seed(`reports/${A}/pub/a.png`, 'image/png');
    await assertSucceeds(getBytes(ref(anonymousVisitor(), `reports/${A}/pub/a.png`)));
  });
});

describe('forum_dms/{uid}/… — direct-message media', () => {
  it('lets the uploader store an image but not a document', async () => {
    const storage = asUser(A);
    await assertSucceeds(uploadBytes(ref(storage, `forum_dms/${A}/c1/a.png`), bytes(), { contentType: 'image/png' }));
    await assertFails(uploadBytes(ref(storage, `forum_dms/${A}/c1/a.pdf`), bytes(), { contentType: 'application/pdf' }));
  });

  it('is readable only by the uploader - not by other users or guests', async () => {
    await seed(`forum_dms/${A}/c1/secret.png`, 'image/png');
    await assertSucceeds(getBytes(ref(asUser(A), `forum_dms/${A}/c1/secret.png`)));
    await assertFails(getBytes(ref(asUser(B), `forum_dms/${A}/c1/secret.png`)));
    await assertFails(getBytes(ref(asGuest('uidGUEST'), `forum_dms/${A}/c1/secret.png`)));
    await assertFails(getBytes(ref(anonymousVisitor(), `forum_dms/${A}/c1/secret.png`)));
  });
});

describe('legacy forum prefixes', () => {
  it.each(['forum', 'forum_reels', 'forumStories'])('%s accepts an image but not an arbitrary file type', async (prefix) => {
    const storage = asUser(A);
    await assertSucceeds(uploadBytes(ref(storage, `${prefix}/${A}/a.png`), bytes(), { contentType: 'image/png' }));
    await assertFails(uploadBytes(ref(storage, `${prefix}/${A}/a.html`), bytes(), { contentType: 'text/html' }));
    await assertFails(uploadBytes(ref(storage, `${prefix}/${A}/a.zip`), bytes(), { contentType: 'application/zip' }));
  });
});

describe('avatars/{uid}/{file}', () => {
  it('accepts a small raster image from the owner', async () => {
    await assertSucceeds(uploadBytes(ref(asUser(A), `avatars/${A}/me.png`), bytes(), { contentType: 'image/png' }));
  });

  it('rejects svg, oversize files and other users', async () => {
    await assertFails(uploadBytes(ref(asUser(A), `avatars/${A}/me.svg`), bytes(), { contentType: 'image/svg+xml' }));
    await assertFails(uploadBytes(ref(asUser(A), `avatars/${A}/big.png`), bytes(5 * MB + 1), { contentType: 'image/png' }));
    await assertFails(uploadBytes(ref(asUser(B), `avatars/${A}/me.png`), bytes(), { contentType: 'image/png' }));
  });
});

describe('health/{uid}/{record}/{file} — private health documents', () => {
  it('accepts an image or a PDF from the owner, nothing else', async () => {
    const storage = asUser(A);
    await assertSucceeds(uploadBytes(ref(storage, `health/${A}/rec/a.pdf`), bytes(), { contentType: 'application/pdf' }));
    await assertSucceeds(uploadBytes(ref(storage, `health/${A}/rec/a.jpg`), bytes(), { contentType: 'image/jpeg' }));
    await assertFails(uploadBytes(ref(storage, `health/${A}/rec/a.txt`), bytes(), { contentType: 'text/plain' }));
  });

  it('is readable by the owner and by admins, not by other citizens or visitors', async () => {
    await seed(`health/${A}/rec/doc.pdf`, 'application/pdf');
    await assertSucceeds(getBytes(ref(asUser(A), `health/${A}/rec/doc.pdf`)));
    await assertSucceeds(getBytes(ref(asUser(B, { admin: true }), `health/${A}/rec/doc.pdf`)));
    await assertFails(getBytes(ref(asUser(B), `health/${A}/rec/doc.pdf`)));
    await assertFails(getBytes(ref(anonymousVisitor(), `health/${A}/rec/doc.pdf`)));
  });
});

describe('everything else is denied', () => {
  it('denies unknown prefixes', async () => {
    await assertFails(uploadBytes(ref(asUser(A), `misc/${A}/a.png`), bytes(), { contentType: 'image/png' }));
    await assertFails(getBytes(ref(asUser(A), `misc/${A}/a.png`)));
  });
});
