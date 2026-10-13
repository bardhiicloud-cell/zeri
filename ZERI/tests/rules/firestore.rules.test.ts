import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';

/**
 * Run with: npm run test:rules
 * Needs Java 21 on PATH; the script starts the Firestore emulator.
 */
let env: RulesTestEnvironment;

const A = 'uidAAAA';
const B = 'uidBBBB';
const C = 'uidCCCC';
const CONV = `${A}_${B}`;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-zeri-rules',
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
    for (const uid of [A, B, C]) {
      await setDoc(doc(db, 'users', uid), { id: uid, name: uid, email: `${uid}@x.test`, role: 'citizen' });
    }
    await setDoc(doc(db, 'forum_conversations', CONV), { participants: [A, B], lastMessage: 'hi' });
    await setDoc(doc(db, 'forum_conversations', CONV, 'messages', 'm1'), {
      senderId: A,
      text: 'secret',
      createdAt: new Date(),
    });
  });
});

const asUser = (uid: string) =>
  env.authenticatedContext(uid, { firebase: { sign_in_provider: 'password' } }).firestore();
const asGuest = (uid: string) =>
  env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();

describe('users — privileged fields are not self-assignable', () => {
  it.each([
    ['permissions', ['agents']],
    ['municipality', 'Prishtinë'],
    ['municipalityPlan', 'premium'],
    ['badges', ['x']],
    ['role', 'admin'],
    ['isBanned', false],
    ['points', 9999],
    ['isVerified', true],
  ])('denies a citizen updating own %s', async (field, value) => {
    await assertFails(updateDoc(doc(asUser(A), 'users', A), { [field]: value }));
  });

  it('still lets a citizen update own name and avatar', async () => {
    await assertSucceeds(
      updateDoc(doc(asUser(A), 'users', A), { name: 'New', avatar: 'https://x.test/a.png' })
    );
  });

  it('denies creating a profile that carries permissions or municipality', async () => {
    await assertFails(setDoc(doc(asUser('uidNEW'), 'users', 'uidNEW'), { id: 'uidNEW', permissions: ['agents'] }));
    await assertFails(setDoc(doc(asUser('uidNEW'), 'users', 'uidNEW'), { id: 'uidNEW', municipality: 'Prizren' }));
  });

  it('allows creating a plain profile', async () => {
    await assertSucceeds(setDoc(doc(asUser('uidNEW'), 'users', 'uidNEW'), { id: 'uidNEW', name: 'N' }));
  });

  it("denies one citizen writing another's profile", async () => {
    await assertFails(updateDoc(doc(asUser(C), 'users', A), { name: 'hijack' }));
  });
});

describe('isBanned', () => {
  // Any rule gated by canAct() shows the ban check; creating a forum post is one
  // that stays client-written.
  const post = () => ({ authorId: B, content: 'hello', visibility: 'public', likes: [], comments: [], reactions: {}, createdAt: serverTimestamp() });

  it('does not lock out a profile that has no isBanned field', async () => {
    // Users created by /api/v1/auth/sync carry no isBanned property.
    await assertSucceeds(addDoc(collection(asUser(B), 'forumPosts'), post()));
  });

  it('denies an account whose profile is banned', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'users', B), { isBanned: true });
    });
    await assertFails(addDoc(collection(asUser(B), 'forumPosts'), post()));
  });
});

describe('forum_conversations — direct messages are private to participants', () => {
  it('lets both participants read the thread', async () => {
    await assertSucceeds(getDocs(collection(asUser(A), 'forum_conversations', CONV, 'messages')));
    await assertSucceeds(getDocs(collection(asUser(B), 'forum_conversations', CONV, 'messages')));
  });

  it('denies a third signed-in user reading the thread', async () => {
    await assertFails(getDocs(collection(asUser(C), 'forum_conversations', CONV, 'messages')));
    await assertFails(getDoc(doc(asUser(C), 'forum_conversations', CONV, 'messages', 'm1')));
  });

  it('denies an anonymous (guest) user and an unauthenticated client', async () => {
    await assertFails(getDocs(collection(asGuest(C), 'forum_conversations', CONV, 'messages')));
    await assertFails(
      getDocs(collection(env.unauthenticatedContext().firestore(), 'forum_conversations', CONV, 'messages'))
    );
  });

  it('denies every client write of a message, even by a participant: sending goes through the server', async () => {
    for (const who of [B, A, C]) {
      await assertFails(
        addDoc(collection(asUser(who), 'forum_conversations', CONV, 'messages'), { senderId: who, text: 'x', createdAt: new Date() })
      );
    }
  });

  it('denies creating or changing a conversation from the client (requests, counters and status are server-owned)', async () => {
    await assertFails(setDoc(doc(asUser(C), 'forum_conversations', 'uidXXXX_uidYYYY'), { participants: [C, 'uidXXXX'] }));
    await assertFails(setDoc(doc(asUser(C), 'forum_conversations', `${B}_${C}`), { participants: [B, C] }));
    await assertFails(updateDoc(doc(asUser(A), 'forum_conversations', CONV), { participants: [A, B, C] }));
    await assertFails(updateDoc(doc(asUser(A), 'forum_conversations', CONV), { lastMessage: 'yo' }));
    await assertFails(updateDoc(doc(asUser(A), 'forum_conversations', CONV), { status: 'active', 'unreadCount.uidAAAA': 0 }));
  });

  it('still lets a sender delete (unsend) their own message', async () => {
    await assertSucceeds(deleteDoc(doc(asUser(A), 'forum_conversations', CONV, 'messages', 'm1')));
  });
});

describe('forum_blocks and forum_dm_settings — private, server-written', () => {
  const seed = async () => env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'forum_blocks', `${A}_${B}`), { blockerId: A, blockedId: B });
    await setDoc(doc(ctx.firestore(), 'forum_dm_settings', A), { privacy: 'following' });
  });

  it('lets only the blocker read a block; the blocked person and strangers cannot', async () => {
    await seed();
    await assertSucceeds(getDoc(doc(asUser(A), 'forum_blocks', `${A}_${B}`)));
    await assertFails(getDoc(doc(asUser(B), 'forum_blocks', `${A}_${B}`)));
    await assertFails(getDoc(doc(asUser(C), 'forum_blocks', `${A}_${B}`)));
  });

  it('lets a user list only their own blocks', async () => {
    await seed();
    await assertSucceeds(getDocs(query(collection(asUser(A), 'forum_blocks'), where('blockerId', '==', A))));
    await assertFails(getDocs(query(collection(asUser(B), 'forum_blocks'), where('blockerId', '==', A))));
    await assertFails(getDocs(collection(asUser(A), 'forum_blocks')));
  });

  it('refuses client writes of blocks and settings', async () => {
    await assertFails(setDoc(doc(asUser(A), 'forum_blocks', `${A}_${C}`), { blockerId: A, blockedId: C }));
    await assertFails(setDoc(doc(asUser(A), 'forum_dm_settings', A), { privacy: 'following' }));
    await seed();
    await assertFails(deleteDoc(doc(asUser(A), 'forum_blocks', `${A}_${B}`)));
  });

  it('shows DM settings to their owner only', async () => {
    await seed();
    await assertSucceeds(getDoc(doc(asUser(A), 'forum_dm_settings', A)));
    await assertFails(getDoc(doc(asUser(B), 'forum_dm_settings', A)));
  });
});

const withClaims = (uid: string, claims: Record<string, unknown>) =>
  env.authenticatedContext(uid, { firebase: { sign_in_provider: 'password' }, ...claims }).firestore();

describe('settings — overlapping wildcard must not re-open restricted documents', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'settings', 'ads-private'), { adSenseClientId: 'ca-pub-test' });
      await setDoc(doc(db, 'settings', 'general'), { showReels: true });
      await setDoc(doc(db, 'settings', 'other'), { foo: 'bar' });
    });
  });

  it('keeps settings/ads-private away from the public and from plain staff', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'settings', 'ads-private')));
    await assertFails(getDoc(doc(asUser(C), 'settings', 'ads-private')));
    await assertFails(getDoc(doc(withClaims(C, { agent: true }), 'settings', 'ads-private')));
  });

  it('lets only the superadmin read and write settings/ads-private (not a plain admin)', async () => {
    await assertSucceeds(getDoc(doc(withClaims(C, { admin: true, superadmin: true }), 'settings', 'ads-private')));
    await assertSucceeds(updateDoc(doc(withClaims(C, { admin: true, superadmin: true }), 'settings', 'ads-private'), { adSenseSlot: '1' }));
    await assertFails(getDoc(doc(withClaims(C, { admin: true }), 'settings', 'ads-private')));
    await assertFails(updateDoc(doc(withClaims(C, { admin: true }), 'settings', 'ads-private'), { adSenseSlot: '1' }));
  });

  it('keeps settings/general publicly readable', async () => {
    await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'settings', 'general')));
  });

  it('lets an admin change public settings but not the AdSense fields', async () => {
    const admin = withClaims(C, { admin: true });
    await assertSucceeds(updateDoc(doc(admin, 'settings', 'general'), { showReels: false }));
    await assertFails(updateDoc(doc(admin, 'settings', 'general'), { adSenseCode: '<script>x</script>' }));
    const owner = withClaims(C, { admin: true, superadmin: true });
    await assertSucceeds(updateDoc(doc(owner, 'settings', 'general'), { adSenseClientId: 'ca-pub-1' }));
  });

  it('keeps other settings documents public to read and admin-only to write', async () => {
    await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'settings', 'other')));
    await assertFails(updateDoc(doc(asUser(C), 'settings', 'other'), { foo: 'x' }));
    await assertSucceeds(updateDoc(doc(withClaims(C, { admin: true }), 'settings', 'other'), { foo: 'x' }));
  });
});

describe('editorialLog — server-write-only', () => {
  it('denies any client from forging an entry, even one that satisfies the old rule', async () => {
    await assertFails(
      addDoc(collection(asUser(C), 'editorialLog'), {
        actorUserId: C,
        at: serverTimestamp(),
        denied: true,
        actorMunicipality: 'Prizren',
      })
    );
    await assertFails(
      addDoc(collection(withClaims(C, { admin: true }), 'editorialLog'), {
        actorUserId: C,
        at: serverTimestamp(),
        denied: true,
      })
    );
  });
});

describe('liveMessages — authenticated and bound to the sender', () => {
  const message = (uid: string) => ({ userId: uid, text: 'hello', createdAt: serverTimestamp() });

  it('denies unauthenticated posts', async () => {
    await assertFails(addDoc(collection(env.unauthenticatedContext().firestore(), 'liveMessages'), message(A)));
  });

  it('denies posting as someone else', async () => {
    await assertFails(addDoc(collection(asUser(C), 'liveMessages'), message(A)));
  });

  it('allows a signed-in user to post as themself', async () => {
    await assertSucceeds(addDoc(collection(asUser(A), 'liveMessages'), message(A)));
  });
});

describe('polls — counters are server-owned', () => {
  const options = [
    { id: 'a', text: 'A', votes: 0 },
    { id: 'b', text: 'B', votes: 0 },
  ];

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'polls', 'p1'), { question: 'q', options, totalVotes: 0 });
      await setDoc(doc(ctx.firestore(), 'polls', 'p1', 'votes', A), { optionId: 'a' });
    });
  });

  it('is publicly readable', async () => {
    await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'polls', 'p1')));
  });

  it('denies a citizen or guest rewriting the results', async () => {
    const forged = [
      { id: 'a', text: 'A', votes: 100000 },
      { id: 'b', text: 'B', votes: 0 },
    ];
    await assertFails(updateDoc(doc(asUser(C), 'polls', 'p1'), { options: forged }));
    await assertFails(updateDoc(doc(asGuest(C), 'polls', 'p1'), { options: forged }));
    await assertFails(updateDoc(doc(asUser(C), 'polls', 'p1'), { totalVotes: 100000 }));
  });

  it('still lets an admin or newsadmin edit a poll', async () => {
    await assertSucceeds(updateDoc(doc(withClaims(C, { admin: true }), 'polls', 'p1'), { question: 'edited' }));
    await assertSucceeds(updateDoc(doc(withClaims(C, { newsadmin: true }), 'polls', 'p1'), { question: 'edited again' }));
  });

  it('lets a voter read only their own ballot record, and never write one', async () => {
    await assertSucceeds(getDoc(doc(asUser(A), 'polls', 'p1', 'votes', A)));
    await assertFails(getDoc(doc(asUser(C), 'polls', 'p1', 'votes', A)));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'polls', 'p1', 'votes', A)));
    await assertFails(setDoc(doc(asUser(C), 'polls', 'p1', 'votes', C), { optionId: 'b' }));
    await assertFails(updateDoc(doc(asUser(A), 'polls', 'p1', 'votes', A), { optionId: 'b' }));
  });
});

describe('healthRegistry — special-category data is limited to health staff', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'healthRegistry', 'h1'), {
        authorId: A,
        fullName: 'Test Person',
        healthCondition: 'x',
        diagnosis: 'x',
        status: 'pending',
      });
    });
  });

  it('lets the owner read their own record', async () => {
    await assertSucceeds(getDoc(doc(asUser(A), 'healthRegistry', 'h1')));
  });

  it.each([
    ['admin', { admin: true }],
    ['superadmin', { admin: true, superadmin: true }],
    ['approver', { approver: true }],
    ['a staffer granted the health section', { agent: true, perm_health: true }],
  ])('lets %s read and update the record', async (_label, claims) => {
    const db = withClaims(C, claims);
    await assertSucceeds(getDoc(doc(db, 'healthRegistry', 'h1')));
    await assertSucceeds(updateDoc(doc(db, 'healthRegistry', 'h1'), { status: 'verified' }));
  });

  it.each([
    ['an ads admin', { adsadmin: true }],
    ['a news admin', { newsadmin: true }],
    ['a frontline agent without the health section', { agent: true }],
    ['another citizen', {}],
  ])('keeps %s out', async (_label, claims) => {
    const db = withClaims(C, claims);
    await assertFails(getDoc(doc(db, 'healthRegistry', 'h1')));
    await assertFails(updateDoc(doc(db, 'healthRegistry', 'h1'), { status: 'verified' }));
  });

  it('keeps the record from unauthenticated visitors', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'healthRegistry', 'h1')));
  });
});

describe('notifications — citizens can no longer write them; the server does', () => {
  const forumNotice = (overrides: Record<string, unknown> = {}) => ({
    title: 'Arta ju komentoi',
    message: 'Pa komentin tuaj',
    channel: 'forum',
    category: 'forum_reply',
    type: 'info',
    priority: 'normal',
    audience: 'user',
    userId: B,
    actorId: A,
    actorName: 'Arta',
    state: 'published',
    link: '/forum',
    sender: 'Arta',
    createdAt: serverTimestamp(),
    ...overrides,
  });

  it('refuses every citizen-written notification: replies, likes, mentions and direct messages alike', async () => {
    await assertFails(addDoc(collection(asUser(A), 'notifications'), forumNotice()));
    await assertFails(addDoc(collection(asUser(A), 'notifications'), forumNotice({ channel: 'forum_dm', link: '/' })));
    await assertFails(addDoc(collection(asUser(A), 'notifications'), forumNotice({ link: 'https://evil.example/login' })));
    await assertFails(addDoc(collection(asUser(A), 'notifications'), forumNotice({ audience: 'all' })));
  });

  it('still lets staff publish broadcasts', async () => {
    await assertSucceeds(
      addDoc(collection(withClaims(C, { admin: true }), 'notifications'), {
        title: 'Njoftim',
        message: 'Per te gjithe',
        audience: 'all',
        state: 'published',
        link: 'https://example.org/news',
        createdAt: serverTimestamp(),
      })
    );
  });
});

describe('forumPosts — everything after creation is server-owned', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'forumPosts', 'f1'), {
        authorId: B, content: 'hello', likes: [], reposts: [], comments: [], reactions: {},
      });
    });
  });

  const newPost = (overrides: Record<string, unknown> = {}) => ({
    authorId: B, content: 'Një diskutim', visibility: 'public', likes: [], comments: [], reactions: {}, isHidden: false, createdAt: serverTimestamp(), ...overrides,
  });

  it('requires an explicit visibility of public or followers', async () => {
    await assertSucceeds(addDoc(collection(asUser(B), 'forumPosts'), newPost({ visibility: 'followers' })));
    await assertFails(addDoc(collection(asUser(B), 'forumPosts'), newPost({ visibility: 'secret' })));
    const { visibility: _v, ...without } = newPost();
    await assertFails(addDoc(collection(asUser(B), 'forumPosts'), without));
  });

  it('lets a citizen publish an empty post under their own id', async () => {
    await assertSucceeds(addDoc(collection(asUser(B), 'forumPosts'), newPost()));
    await assertSucceeds(addDoc(collection(asUser(B), 'forumPosts'), newPost({ poll: { question: 'q', totalVotes: 0, options: [] } })));
  });

  it('refuses pre-seeded engagement, delete/edit state, counters, and the author e-mail', async () => {
    for (const bad of [
      { likes: ['x', 'y'] }, { reposts: ['x'] }, { comments: [{ id: '1' }] }, { reactions: { love: ['x'] } },
      { deletedAt: new Date() }, { editedAt: new Date() }, { viewCount: 9999 }, { adClicks: 500 }, { authorEmail: 'me@example.org' },
      { poll: { question: 'q', totalVotes: 40, options: [] } }, { authorId: A },
    ]) {
      await assertFails(addDoc(collection(asUser(B), 'forumPosts'), newPost(bad)));
    }
  });

  it('only ads staff may publish a sponsored post', async () => {
    await assertFails(addDoc(collection(asUser(B), 'forumPosts'), newPost({ isAd: true, adLink: 'https://example.org' })));
    await assertSucceeds(addDoc(collection(asUser(B), 'forumPosts'), newPost({ isAd: false })));
    await assertSucceeds(addDoc(collection(withClaims(B, { adsadmin: true }), 'forumPosts'), newPost({ isAd: true, adLink: 'https://example.org' })));
  });

  it('refuses a guest and a banned account', async () => {
    await assertFails(addDoc(collection(asGuest(B), 'forumPosts'), newPost()));
  });

  it('denies every client update of comments, replies, reactions, poll, likes, reposts and edits — even by the author', async () => {
    for (const who of [C, B]) {
      await assertFails(updateDoc(doc(asUser(who), 'forumPosts', 'f1'), { reactions: { like: [who] } }));
      await assertFails(updateDoc(doc(asUser(who), 'forumPosts', 'f1'), { comments: [{ id: '1', authorId: who, content: 'hi' }] }));
      await assertFails(updateDoc(doc(asUser(who), 'forumPosts', 'f1'), { poll: { question: 'q', totalVotes: 99, options: [] } }));
      await assertFails(updateDoc(doc(asUser(who), 'forumPosts', 'f1'), { likes: ['a', 'b'] }));
      await assertFails(updateDoc(doc(asUser(who), 'forumPosts', 'f1'), { reposts: ['x'] }));
      await assertFails(updateDoc(doc(asUser(who), 'forumPosts', 'f1'), { content: 'sneaky edit' }));
      await assertFails(updateDoc(doc(asUser(who), 'forumPosts', 'f1'), { deletedAt: new Date() }));
      await assertFails(updateDoc(doc(asUser(who), 'forumPosts', 'f1'), { isApproved: true }));
      await assertFails(updateDoc(doc(asUser(who), 'forumPosts', 'f1'), { isAd: true }));
    }
  });

  it('keeps moderation flags and engagement for the server routes, even for staff', async () => {
    const admin = withClaims(C, { admin: true });
    await assertFails(updateDoc(doc(admin, 'forumPosts', 'f1'), { isHidden: true }));
    await assertFails(updateDoc(doc(admin, 'forumPosts', 'f1'), { comments: [{ id: 'x', authorId: C, content: 'forged' }] }));
    await assertFails(updateDoc(doc(admin, 'forumPosts', 'f1'), { isAd: true }));
    await assertSucceeds(updateDoc(doc(admin, 'forumPosts', 'f1'), { category: 'mjedis' }));
  });

  it('allows hard delete only for the superadmin; the author must use the server (soft delete)', async () => {
    await assertFails(deleteDoc(doc(asUser(B), 'forumPosts', 'f1')));
    await assertFails(deleteDoc(doc(asUser(C), 'forumPosts', 'f1')));
    await assertSucceeds(deleteDoc(doc(withClaims(C, { superadmin: true }), 'forumPosts', 'f1')));
  });
});

describe('forumPosts — followers-only posts are unreadable to the public', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'forumPosts', 'pub'), { authorId: B, content: 'public', visibility: 'public', createdAt: new Date() });
      await setDoc(doc(db, 'forumPosts', 'priv'), { authorId: B, content: 'private', visibility: 'followers', createdAt: new Date() });
      await setDoc(doc(db, 'forumPosts', 'legacy'), { authorId: B, content: 'old', createdAt: new Date() });
    });
  });

  it('serves a public post to anyone, a followers-only post to its author and staff only', async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(anon, 'forumPosts', 'pub')));
    await assertFails(getDoc(doc(anon, 'forumPosts', 'priv')));
    await assertFails(getDoc(doc(asUser(C), 'forumPosts', 'priv')));
    await assertSucceeds(getDoc(doc(asUser(B), 'forumPosts', 'priv')));
    await assertSucceeds(getDoc(doc(withClaims(C, { agent: true }), 'forumPosts', 'priv')));
  });

  it('allows the public feed query only when it filters to public, and refuses an unfiltered list', async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDocs(query(collection(anon, 'forumPosts'), where('visibility', '==', 'public'), orderBy('createdAt', 'desc'), limit(50))));
    await assertFails(getDocs(collection(anon, 'forumPosts')));
    await assertFails(getDocs(query(collection(anon, 'forumPosts'), orderBy('createdAt', 'desc'), limit(50))));
    await assertFails(getDocs(query(collection(anon, 'forumPosts'), where('visibility', '==', 'followers'))));
  });

  it('lets an author list their own posts including private ones, nobody else', async () => {
    await assertSucceeds(getDocs(query(collection(asUser(B), 'forumPosts'), where('authorId', '==', B), orderBy('createdAt', 'desc'), limit(50))));
    await assertFails(getDocs(query(collection(asUser(C), 'forumPosts'), where('authorId', '==', B), orderBy('createdAt', 'desc'), limit(50))));
  });

  it('keeps a post without the field closed until it is backfilled', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'forumPosts', 'legacy')));
  });
});

describe('newsArticles - publishing is a recorded decision', () => {
  const article = (overrides: Record<string, unknown> = {}) => ({
    title: 'T', summary: 'S', content: 'C', category: 'Lajme', published: false, ...overrides,
  });
  const editor = { newsadmin: true };

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'newsArticles', 'n-live'), article({ published: true }));
      await setDoc(doc(ctx.firestore(), 'newsArticles', 'n-draft'), article());
    });
  });

  it('lets an editor create a draft but not a published article', async () => {
    await assertSucceeds(setDoc(doc(withClaims(C, editor), 'newsArticles', 'n-new'), article()));
    await assertFails(setDoc(doc(withClaims(C, editor), 'newsArticles', 'n-new2'), article({ published: true })));
  });

  it('lets an editor change the text but not publish or withdraw', async () => {
    await assertSucceeds(updateDoc(doc(withClaims(C, editor), 'newsArticles', 'n-live'), { title: 'T2' }));
    await assertFails(updateDoc(doc(withClaims(C, editor), 'newsArticles', 'n-draft'), { published: true }));
    await assertFails(updateDoc(doc(withClaims(C, { superadmin: true }), 'newsArticles', 'n-live'), { published: false }));
  });
});

describe('reports — a client cannot write pipeline state on create', () => {
  const report = (overrides: Record<string, unknown> = {}) => ({
    title: 'Grope',
    description: 'Nje grope',
    category: 'Rruge',
    location: { municipality: 'Prishtine' },
    authorId: A,
    status: 'Pending Review',
    createdAt: serverTimestamp(),
    ...overrides,
  });

  it('allows a normal report', async () => {
    await assertSucceeds(addDoc(collection(asUser(A), 'reports'), report()));
  });

  it('rejects forged history, assignments and counters', async () => {
    await assertFails(addDoc(collection(asUser(A), 'reports'), report({ timeline: [{ status: 'Resolved' }] })));
    await assertFails(addDoc(collection(asUser(A), 'reports'), report({ assignedTo: 'Komuna' })));
    await assertFails(addDoc(collection(asUser(A), 'reports'), report({ resolvedAt: '2026-01-01' })));
    await assertFails(addDoc(collection(asUser(A), 'reports'), report({ upvotes: 500 })));
  });

  it('still refuses to create an already-approved report', async () => {
    await assertFails(addDoc(collection(asUser(A), 'reports'), report({ status: 'Approved' })));
  });

  it('rejects an oversized or non-string tracking id', async () => {
    await assertFails(addDoc(collection(asUser(A), 'reports'), report({ trackingId: 'X'.repeat(41) })));
    await assertFails(addDoc(collection(asUser(A), 'reports'), report({ trackingId: 12345 })));
    await assertSucceeds(addDoc(collection(asUser(A), 'reports'), report({ trackingId: 'ZQ-20261011-ABC' })));
  });
});

describe('auditLogs — server-written only', () => {
  it('lets staff read but not forge an entry', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'auditLogs', 'l1'), { action: 'x', actorUid: A });
    });
    const staff = withClaims(C, { agent: true });
    await assertSucceeds(getDoc(doc(staff, 'auditLogs', 'l1')));
    await assertFails(addDoc(collection(staff, 'auditLogs'), { action: 'forged', actorUid: A }));
    await assertFails(addDoc(collection(withClaims(C, { admin: true }), 'auditLogs'), { action: 'forged', actorUid: A }));
    await assertFails(updateDoc(doc(withClaims(C, { admin: true }), 'auditLogs', 'l1'), { action: 'edited' }));
  });
});

describe('users — an administrator cannot escalate privilege by writing profiles', () => {
  const admin = { admin: true };
  const superadmin = { admin: true, superadmin: true };

  it.each([
    ['role', 'superadmin'],
    ['permissions', ['users', 'settings']],
    ['isBanned', true],
    ['isVerified', true],
    ['points', 99999],
    ['municipality', 'Prishtinë'],
    ['municipalityPlan', 'pro'],
    ['banReason', 'x'],
    ['bannedBy', 'someone'],
  ])('denies an admin writing %s on another user (the server owns it)', async (field, value) => {
    await assertFails(updateDoc(doc(withClaims(C, admin), 'users', A), { [field]: value }));
    await assertFails(updateDoc(doc(withClaims(C, superadmin), 'users', A), { [field]: value }));
  });

  it('still lets an admin edit harmless profile fields', async () => {
    await assertSucceeds(updateDoc(doc(withClaims(C, admin), 'users', A), { name: 'Corrected Name', phone: '044' }));
  });

  it('still lets a citizen edit their own harmless fields', async () => {
    await assertSucceeds(updateDoc(doc(asUser(A), 'users', A), { name: 'Me' }));
  });
});

describe('users — profiles are not readable by every kind of staff', () => {
  it('lets a person read their own profile', async () => {
    await assertSucceeds(getDoc(doc(asUser(A), 'users', A)));
  });

  it.each([
    ['admin', { admin: true }],
    ['superadmin', { admin: true, superadmin: true }],
    ['an account granted the users section', { agent: true, perm_users: true }],
    ['an account granted the agents section', { agent: true, perm_agents: true }],
  ])('lets %s read another profile', async (_label, claims) => {
    await assertSucceeds(getDoc(doc(withClaims(C, claims), 'users', A)));
  });

  it.each([
    ['a frontline agent', { agent: true }],
    ['an approver', { approver: true }],
    ['an ads admin', { adsadmin: true }],
    ['a news admin', { newsadmin: true }],
    ['a municipal account', { municipality_account: true, municipality: 'Prizren' }],
    ['another citizen', {}],
  ])('keeps %s from reading another person\'s profile', async (_label, claims) => {
    await assertFails(getDoc(doc(withClaims(C, claims), 'users', A)));
  });

  it('keeps unauthenticated visitors out', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'users', A)));
  });
});

describe('categories — only people who manage them may change them', () => {
  it.each([
    ['admin', { admin: true }],
    ['an approver', { approver: true }],
    ['an account granted the categories section', { agent: true, perm_categories: true }],
  ])('lets %s write', async (_label, claims) => {
    await assertSucceeds(setDoc(doc(withClaims(C, claims), 'categories', 'c1'), { id: 'c1', name: 'Rrugë' }));
  });

  it.each([
    ['a frontline agent', { agent: true }],
    ['an ads admin', { adsadmin: true }],
    ['a news admin', { newsadmin: true }],
    ['a citizen', {}],
  ])('keeps %s out', async (_label, claims) => {
    await assertFails(setDoc(doc(withClaims(C, claims), 'categories', 'c1'), { id: 'c1', name: 'Rrugë' }));
  });

  it('stays publicly readable', async () => {
    await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'categories', 'c1')));
  });
});


describe('monitor — read-only oversight', () => {
  const monitor = { monitor: true };

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'auditLogs', 'l1'), { action: 'x', createdAt: new Date() });
      await setDoc(doc(db, 'report_events', 'e1'), { isPublic: false, reportId: 'r1' });
      await setDoc(doc(db, 'reports', 'r1'), { title: 't', status: 'Pending Review', authorId: A, location: { municipality: 'Prizren' } });
    });
  });

  it('reads the audit trail and the full event history', async () => {
    await assertSucceeds(getDoc(doc(withClaims(C, monitor), 'auditLogs', 'l1')));
    await assertSucceeds(getDoc(doc(withClaims(C, monitor), 'report_events', 'e1')));
  });

  it('writes nothing: not reports, users, categories, audit logs or notifications', async () => {
    const db = withClaims(C, monitor);
    await assertFails(updateDoc(doc(db, 'reports', 'r1'), { status: 'Resolved' }));
    await assertFails(updateDoc(doc(db, 'users', A), { name: 'x' }));
    await assertFails(setDoc(doc(db, 'categories', 'c1'), { id: 'c1', name: 'x' }));
    await assertFails(setDoc(doc(db, 'auditLogs', 'forged'), { action: 'x' }));
    await assertFails(setDoc(doc(db, 'notifications', 'n1'), { title: 'x', audience: 'all' }));
  });

  it('does not get user profiles or other private data', async () => {
    const db = withClaims(C, monitor);
    await assertFails(getDoc(doc(db, 'users', A)));
  });

  it('reads staff and municipal profiles (to watch their work) but never one of a citizen', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const admin = ctx.firestore();
      await setDoc(doc(admin, 'users', 'staff-1'), { id: 'staff-1', role: 'agent', name: 'Agjent' });
      await setDoc(doc(admin, 'users', 'muni-1'), { id: 'muni-1', role: 'municipality', name: 'Komuna' });
      await setDoc(doc(admin, 'users', 'citizen-1'), { id: 'citizen-1', role: 'citizen', name: 'Qytetar' });
    });
    const db = withClaims(C, monitor);
    await assertSucceeds(getDoc(doc(db, 'users', 'staff-1')));
    await assertSucceeds(getDoc(doc(db, 'users', 'muni-1')));
    await assertFails(getDoc(doc(db, 'users', 'citizen-1')));
  });

  it('a plain citizen still cannot read the audit trail', async () => {
    await assertFails(getDoc(doc(asUser(C), 'auditLogs', 'l1')));
  });
});
