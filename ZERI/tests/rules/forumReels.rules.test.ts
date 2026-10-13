import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query,
  serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';

/**
 * `forumReels` security rules. Run with: npm run test:rules
 * (needs Java 21; the script starts the Firestore emulator).
 */
let env: RulesTestEnvironment;

const A = 'uidAAAA';
const B = 'uidBBBB';
const BANNED = 'uidBANN';

const citizen = (uid: string) =>
  env.authenticatedContext(uid, { firebase: { sign_in_provider: 'password' } }).firestore();
const guest = (uid: string) =>
  env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
const staff = (uid: string) =>
  env.authenticatedContext(uid, { firebase: { sign_in_provider: 'password' }, agent: true }).firestore();

const newReel = (uid: string, extra: Record<string, unknown> = {}) => ({
  authorId: uid,
  authorName: 'Arta',
  mediaUrl: 'https://example.test/a.mp4',
  mediaPath: `forum_reels/${uid}/1_a.mp4`,
  mediaType: 'video',
  caption: 'Rruga #prishtina',
  hashtags: ['prishtina'],
  durationSec: 12.5,
  isHidden: false,
  likedBy: [],
  createdAt: serverTimestamp(),
  ...extra,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-zeri-reels',
    firestore: { rules: readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8') },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const uid of [A, B]) await setDoc(doc(db, 'users', uid), { id: uid, name: uid, role: 'citizen' });
    await setDoc(doc(db, 'users', BANNED), { id: BANNED, name: 'b', role: 'citizen', isBanned: true });
    const created = new Date('2026-10-01T10:00:00Z');
    await setDoc(doc(db, 'forumReels', 'visible'), { ...newReel(A), likedBy: [B], createdAt: created });
    await setDoc(doc(db, 'forumReels', 'hidden'), { ...newReel(A), isHidden: true, createdAt: created });
  });
});

describe('forumReels read', () => {
  it('lets anyone list visible reels when the query filters isHidden == false', async () => {
    const q = query(collection(env.unauthenticatedContext().firestore(), 'forumReels'),
      where('isHidden', '==', false), orderBy('createdAt', 'desc'), limit(8));
    await assertSucceeds(getDocs(q));
  });

  it('refuses an unfiltered list, which could include hidden reels', async () => {
    await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), 'forumReels')));
  });

  it('hides moderated reels from the public but not from the author or staff', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'forumReels', 'hidden')));
    await assertFails(getDoc(doc(citizen(B), 'forumReels', 'hidden')));
    await assertSucceeds(getDoc(doc(citizen(A), 'forumReels', 'hidden')));
    await assertSucceeds(getDoc(doc(staff(B), 'forumReels', 'hidden')));
  });
});

describe('forumReels create', () => {
  it('allows a signed-in citizen to publish their own reel', async () => {
    await assertSucceeds(setDoc(doc(citizen(A), 'forumReels', 'new'), newReel(A)));
  });

  it('refuses guests, banned users and the signed-out', async () => {
    await assertFails(setDoc(doc(guest(A), 'forumReels', 'g'), newReel(A)));
    await assertFails(setDoc(doc(citizen(BANNED), 'forumReels', 'b'), newReel(BANNED)));
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'forumReels', 'u'), newReel(A)));
  });

  it('refuses impersonation and media under another user', async () => {
    await assertFails(setDoc(doc(citizen(B), 'forumReels', 'x'), newReel(A)));
    await assertFails(setDoc(doc(citizen(A), 'forumReels', 'x'), newReel(A, { mediaPath: `forum_reels/${B}/1.mp4` })));
  });

  it('refuses pre-seeded engagement, pre-hidden state and forged timestamps', async () => {
    await assertFails(setDoc(doc(citizen(A), 'forumReels', 'x'), newReel(A, { likedBy: [B, 'c'] })));
    await assertFails(setDoc(doc(citizen(A), 'forumReels', 'x'), newReel(A, { isHidden: true })));
    await assertFails(setDoc(doc(citizen(A), 'forumReels', 'x'), newReel(A, { createdAt: new Date('2020-01-01') })));
  });

  it('refuses invalid media, long captions, long videos and unknown fields', async () => {
    await assertFails(setDoc(doc(citizen(A), 'forumReels', 'x'), newReel(A, { mediaType: 'image' })));
    await assertFails(setDoc(doc(citizen(A), 'forumReels', 'x'), newReel(A, { caption: 'x'.repeat(301) })));
    await assertFails(setDoc(doc(citizen(A), 'forumReels', 'x'), newReel(A, { durationSec: 600 })));
    await assertFails(setDoc(doc(citizen(A), 'forumReels', 'x'), newReel(A, { viewCount: 1_000_000 })));
    await assertFails(setDoc(doc(citizen(A), 'forumReels', 'x'), newReel(A, { verified: true })));
  });
});

describe('forumReels editor fields', () => {
  it('accepts a cover under the author folder and a short audio credit', async () => {
    await assertSucceeds(setDoc(doc(citizen(A), 'forumReels', 'c1'), newReel(A, {
      coverUrl: 'https://example.test/c.jpg', coverPath: `forum_reels/${A}/1_cover.jpg`, audioTitle: 'My song',
    })));
  });

  it('refuses a cover pointing into another user\'s folder, a cover without its path, or a long credit', async () => {
    await assertFails(setDoc(doc(citizen(A), 'forumReels', 'c2'), newReel(A, { coverUrl: 'https://x.test/c.jpg', coverPath: `forum_reels/${B}/c.jpg` })));
    await assertFails(setDoc(doc(citizen(A), 'forumReels', 'c3'), newReel(A, { coverUrl: 'https://x.test/c.jpg' })));
    await assertFails(setDoc(doc(citizen(A), 'forumReels', 'c4'), newReel(A, { audioTitle: 'x'.repeat(81) })));
    await assertFails(setDoc(doc(citizen(A), 'forumReels', 'c5'), newReel(A, { audioTitle: 42 })));
  });

  it('does not let the author change the cover or credit afterwards (only the caption is editable)', async () => {
    await assertFails(updateDoc(doc(citizen(A), 'forumReels', 'visible'), { coverUrl: 'https://evil.test/x.jpg' }));
    await assertFails(updateDoc(doc(citizen(A), 'forumReels', 'visible'), { audioTitle: 'Famous Artist' }));
  });
});

describe('forumReels likes', () => {
  it('lets a citizen like and unlike with their own uid', async () => {
    await assertSucceeds(updateDoc(doc(citizen(A), 'forumReels', 'visible'), { likedBy: arrayUnion(A) }));
    await assertSucceeds(updateDoc(doc(citizen(B), 'forumReels', 'visible'), { likedBy: arrayRemove(B) }));
  });

  it("refuses adding someone else, removing someone else's like or adding many", async () => {
    await assertFails(updateDoc(doc(citizen(A), 'forumReels', 'visible'), { likedBy: arrayUnion('someone') }));
    await assertFails(updateDoc(doc(citizen(A), 'forumReels', 'visible'), { likedBy: arrayRemove(B) }));
    await assertFails(updateDoc(doc(citizen(A), 'forumReels', 'visible'), { likedBy: [B, A, 'x', 'y'] }));
    await assertFails(updateDoc(doc(citizen(A), 'forumReels', 'visible'), { likedBy: [A] }));
  });

  it('refuses guest likes and likes bundled with other changes', async () => {
    await assertFails(updateDoc(doc(guest('anon1'), 'forumReels', 'visible'), { likedBy: arrayUnion('anon1') }));
    await assertFails(updateDoc(doc(citizen(A), 'forumReels', 'visible'), { likedBy: arrayUnion(A), caption: 'x' }));
  });
});

describe('forumReels comments', () => {
  const comment = (uid: string, extra: Record<string, unknown> = {}) => ({
    authorId: uid, authorName: 'Arta', text: 'Mirë!', createdAt: serverTimestamp(), ...extra,
  });
  const seedComment = async () => env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'forumReels', 'visible', 'comments', 'c1'), { ...comment(B), createdAt: new Date() });
  });

  it('lets anyone read comments of a visible reel but not of a hidden one', async () => {
    await seedComment();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'forumReels', 'hidden', 'comments', 'c1'), { ...comment(B), createdAt: new Date() });
    });
    await assertSucceeds(getDocs(collection(env.unauthenticatedContext().firestore(), 'forumReels', 'visible', 'comments')));
    await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), 'forumReels', 'hidden', 'comments')));
    await assertSucceeds(getDocs(collection(staff(A), 'forumReels', 'hidden', 'comments')));
  });

  it('lets a citizen comment as themselves, not guests, not as someone else', async () => {
    await assertSucceeds(setDoc(doc(citizen(A), 'forumReels', 'visible', 'comments', 'n1'), comment(A)));
    await assertFails(setDoc(doc(guest('anon1'), 'forumReels', 'visible', 'comments', 'n2'), comment('anon1')));
    await assertFails(setDoc(doc(citizen(A), 'forumReels', 'visible', 'comments', 'n3'), comment(B)));
    await assertFails(setDoc(doc(citizen(BANNED), 'forumReels', 'visible', 'comments', 'n4'), comment(BANNED)));
  });

  it('refuses empty, long, forged-time and extra-field comments and comments on hidden reels', async () => {
    const at = (id: string) => doc(citizen(A), 'forumReels', 'visible', 'comments', id);
    await assertFails(setDoc(at('e1'), comment(A, { text: '' })));
    await assertFails(setDoc(at('e2'), comment(A, { text: 'x'.repeat(301) })));
    await assertFails(setDoc(at('e3'), comment(A, { createdAt: new Date('2020-01-01') })));
    await assertFails(setDoc(at('e4'), comment(A, { pinned: true })));
    await assertFails(setDoc(doc(citizen(A), 'forumReels', 'hidden', 'comments', 'e5'), comment(A)));
  });

  it('never allows edits; the author or staff may delete', async () => {
    await seedComment();
    await assertFails(updateDoc(doc(citizen(B), 'forumReels', 'visible', 'comments', 'c1'), { text: 'edited' }));
    await assertFails(deleteDoc(doc(citizen(A), 'forumReels', 'visible', 'comments', 'c1')));
    await assertSucceeds(deleteDoc(doc(citizen(B), 'forumReels', 'visible', 'comments', 'c1')));
    await seedComment();
    await assertSucceeds(deleteDoc(doc(staff(A), 'forumReels', 'visible', 'comments', 'c1')));
  });
});

describe('forumReelReports', () => {
  const report = (uid: string, extra: Record<string, unknown> = {}) => ({
    reelId: 'visible', reporterId: uid, reason: 'spam', details: '', status: 'open', createdAt: serverTimestamp(), ...extra,
  });

  it('lets a citizen file one report under their own deterministic id', async () => {
    await assertSucceeds(setDoc(doc(citizen(B), 'forumReelReports', `visible_${B}`), report(B)));
  });

  it('refuses a second overwrite, guests, forged reporters and bad ids', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'forumReelReports', `visible_${B}`), { ...report(B), createdAt: new Date() });
    });
    await assertFails(setDoc(doc(citizen(B), 'forumReelReports', `visible_${B}`), report(B)));
    await assertFails(setDoc(doc(guest('anon1'), 'forumReelReports', 'visible_anon1'), report('anon1')));
    await assertFails(setDoc(doc(citizen(A), 'forumReelReports', `visible_${A}`), report(B)));
    await assertFails(setDoc(doc(citizen(A), 'forumReelReports', 'visible_other'), report(A)));
  });

  it('refuses unknown reasons, long details, pre-resolved status and extra fields', async () => {
    const ref = () => doc(citizen(A), 'forumReelReports', `visible_${A}`);
    await assertFails(setDoc(ref(), report(A, { reason: 'because' })));
    await assertFails(setDoc(ref(), report(A, { details: 'x'.repeat(301) })));
    await assertFails(setDoc(ref(), report(A, { status: 'resolved' })));
    await assertFails(setDoc(ref(), report(A, { severity: 9 })));
  });

  it('is readable by staff only, and only staff can resolve', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'forumReelReports', `visible_${B}`), { ...report(B), createdAt: new Date() });
    });
    await assertFails(getDoc(doc(citizen(B), 'forumReelReports', `visible_${B}`)));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'forumReelReports', `visible_${B}`)));
    await assertSucceeds(getDoc(doc(staff(A), 'forumReelReports', `visible_${B}`)));
    await assertSucceeds(updateDoc(doc(staff(A), 'forumReelReports', `visible_${B}`), { status: 'resolved', resolvedBy: A }));
    await assertFails(updateDoc(doc(citizen(B), 'forumReelReports', `visible_${B}`), { status: 'resolved' }));
    await assertFails(updateDoc(doc(staff(A), 'forumReelReports', `visible_${B}`), { reason: 'other' }));
  });
});

describe('forumReels edit, moderation and delete', () => {
  it('lets the author edit the caption only', async () => {
    await assertSucceeds(updateDoc(doc(citizen(A), 'forumReels', 'visible'), { caption: 'E re', hashtags: [] }));
    await assertFails(updateDoc(doc(citizen(A), 'forumReels', 'visible'), { mediaUrl: 'https://evil.test/x.mp4' }));
    await assertFails(updateDoc(doc(citizen(A), 'forumReels', 'hidden'), { isHidden: false }));
    await assertFails(updateDoc(doc(citizen(B), 'forumReels', 'visible'), { caption: 'hijack' }));
  });

  it('lets staff hide and restore but not rewrite content', async () => {
    await assertSucceeds(updateDoc(doc(staff(B), 'forumReels', 'visible'), { isHidden: true, hiddenReason: 'spam', hiddenBy: B }));
    await assertSucceeds(updateDoc(doc(staff(B), 'forumReels', 'hidden'), { isHidden: false }));
    await assertFails(updateDoc(doc(staff(B), 'forumReels', 'visible'), { caption: 'edited by staff' }));
  });

  it('leaves deleting to the server for authors (which also cleans Storage) and to staff directly', async () => {
    await assertFails(deleteDoc(doc(citizen(B), 'forumReels', 'visible')));
    await assertFails(deleteDoc(doc(citizen(A), 'forumReels', 'visible')));
    await assertSucceeds(deleteDoc(doc(staff(B), 'forumReels', 'hidden')));
  });

  it('never lets a client write the view counter', async () => {
    await assertFails(updateDoc(doc(citizen(A), 'forumReels', 'visible'), { viewCount: 99999 }));
    await assertFails(setDoc(doc(citizen(A), 'forumReels', 'v1'), newReel(A, { viewCount: 5000 })));
  });
});
