import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, doc, setDoc } from 'firebase/firestore';
import { buildForumPost, type ComposerInput } from '../../src/lib/forumPostPayload';

/**
 * The Debati Publik composer must be able to publish under the real rules. This replays the exact
 * document the page builds (`buildForumPost`), for each kind of post a citizen can write, so a change
 * to the rules or to the payload that makes "Posto" fail for everyone is caught here.
 */
let env: RulesTestEnvironment;
const U = 'uidCitizen';

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-zeri-rules', firestore: { rules: readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8') } });
});
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', U), { id: U, name: 'Qytetar', email: 'q@x.test', role: 'citizen' });
  });
});

const asCitizen = (provider: 'password' | 'google.com') => env.authenticatedContext(U, { firebase: { sign_in_provider: provider } }).firestore();
const asGuest = () => env.authenticatedContext(U, { firebase: { sign_in_provider: 'anonymous' } }).firestore();

const input = (over: Partial<ComposerInput> = {}): ComposerInput => ({
  author: { id: U, name: 'Qytetar', avatar: null, role: 'citizen', points: 0 },
  content: 'Rruga në lagje është e prishur #rruga', category: 'Infrastrukturë', neighborhood: 'Prishtinë',
  poll: null, imageUrls: [], followersOnly: false, asAd: false, adLink: '', ...over,
});
const publish = (db: ReturnType<typeof asGuest>, over: Partial<ComposerInput> = {}) => addDoc(collection(db, 'forumPosts'), buildForumPost(input(over)));

describe('the Debati Publik composer under the real rules', () => {
  it('publishes a plain text post, signed in with e-mail or Google', async () => {
    await assertSucceeds(publish(asCitizen('password')));
    await assertSucceeds(publish(asCitizen('google.com')));
  });

  it('publishes a followers-only post, a post with photos and a post with a poll', async () => {
    await assertSucceeds(publish(asCitizen('password'), { followersOnly: true }));
    await assertSucceeds(publish(asCitizen('password'), { imageUrls: ['https://example.org/a.jpg', 'https://example.org/b.jpg'] }));
    await assertSucceeds(publish(asCitizen('password'), { poll: { question: 'Po?', totalVotes: 0, options: [{ id: 'o1', text: 'Po', votes: [] }, { id: 'o2', text: 'Jo', votes: [] }] } }));
  });

  it('refuses a guest, and a citizen who tries to mark a post as an ad', async () => {
    await assertFails(publish(asGuest()));
    await assertFails(publish(asCitizen('password'), { asAd: true, adLink: 'https://example.org' }));
  });
});
