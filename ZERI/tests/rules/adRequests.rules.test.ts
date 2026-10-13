import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { addDoc, collection, doc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';

/**
 * `adRequests` and `ads` rules, using the exact payload shapes the app sends
 * (AdRequestModal.tsx, AdBanner.tsx, AdminAds.tsx). Run with: npm run test:rules
 *
 * The create rule needs the caller's uid, a `phone` string and a server
 * timestamp. Earlier client code sent `contactPhone` with an ISO date, and the
 * homepage inquiry sent no uid, so every advertiser request was rejected.
 */
let env: RulesTestEnvironment;

const USER = 'uidUSER';
const OTHER = 'uidOTHER';

const citizen = (uid: string) =>
  env.authenticatedContext(uid, { firebase: { sign_in_provider: 'password' } }).firestore();
const adsAdmin = (uid: string) =>
  env.authenticatedContext(uid, { firebase: { sign_in_provider: 'password' }, adsadmin: true }).firestore();
const superAdmin = (uid: string) =>
  env.authenticatedContext(uid, { firebase: { sign_in_provider: 'password' }, superadmin: true }).firestore();

/** Mirrors the write in src/components/AdRequestModal.tsx. */
const partnerRequest = (uid: string) => ({
  userId: uid,
  businessName: 'Banka Test',
  phone: '+383 44 123 456',
  contactPhone: '+383 44 123 456',
  contactEmail: 'info@banka.test',
  targetMunicipality: 'Të gjitha Komunat',
  packageId: '1_week',
  packageName: '1 Javë',
  packagePrice: '',
  destinationUrl: 'https://banka.test',
  adNotes: '',
  postId: null,
  status: 'pending',
  paymentStatus: 'awaiting_confirmation',
  createdAt: serverTimestamp(),
});

/** Mirrors the write in src/components/AdBanner.tsx. */
const slotInquiry = (uid: string) => ({
  userId: uid,
  name: 'Agron',
  businessName: '',
  phone: '+383 44 123 456',
  contactPhone: '+383 44 123 456',
  contactEmail: '',
  userEmail: '',
  targetMunicipality: 'Të gjitha Komunat',
  postId: 'Pozicioni: top | Komuna: Nacionale',
  adNotes: '',
  notes: '',
  status: 'pending',
  createdAt: serverTimestamp(),
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-zeri-adrequests',
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
    for (const uid of [USER, OTHER]) await setDoc(doc(db, 'users', uid), { id: uid, name: uid, role: 'citizen' });
    await setDoc(doc(db, 'adRequests', 'r1'), { ...partnerRequest(USER), createdAt: new Date('2026-10-01T10:00:00Z') });
  });
});

describe('adRequests create', () => {
  it('accepts the partner form payload from a signed-in user', async () => {
    await assertSucceeds(addDoc(collection(citizen(USER), 'adRequests'), partnerRequest(USER)));
  });

  it('accepts the ad-slot inquiry payload from a signed-in user', async () => {
    await assertSucceeds(addDoc(collection(citizen(USER), 'adRequests'), slotInquiry(USER)));
  });

  it('rejects the old payload shape (no phone, ISO date)', async () => {
    const legacy = { ...partnerRequest(USER), createdAt: new Date().toISOString() } as Record<string, unknown>;
    delete legacy.phone;
    await assertFails(addDoc(collection(citizen(USER), 'adRequests'), legacy));
  });

  it('rejects a request written under someone else\'s uid', async () => {
    await assertFails(addDoc(collection(citizen(USER), 'adRequests'), partnerRequest(OTHER)));
  });

  it('rejects an unauthenticated request', async () => {
    await assertFails(addDoc(collection(env.unauthenticatedContext().firestore(), 'adRequests'), partnerRequest(USER)));
  });
});

describe('adRequests moderation', () => {
  it('lets the owner read their own request but not another user\'s', async () => {
    const { getDoc } = await import('firebase/firestore');
    await assertSucceeds(getDoc(doc(citizen(USER), 'adRequests', 'r1')));
    await assertFails(getDoc(doc(citizen(OTHER), 'adRequests', 'r1')));
  });

  it('does not let the advertiser approve their own request', async () => {
    await assertFails(updateDoc(doc(citizen(USER), 'adRequests', 'r1'), { status: 'approved' }));
  });
});

describe('ads campaigns', () => {
  const campaign = {
    id: 'AD-TEST01',
    title: 'Banka Test',
    section: 'ballina',
    target: 'Nacionale',
    position: 'top',
    mediaType: 'image',
    mediaUrl: 'https://example.test/a.png',
    targetUrl: 'https://banka.test',
    budget: '€100.00 / €500.00',
    status: 'active',
    isPartner: true,
    partnerDescription: 'Bankë lokale.',
    views: 0,
    clicks: 0,
  };

  it('lets an ads admin and a superadmin publish a partner campaign', async () => {
    await assertSucceeds(setDoc(doc(adsAdmin('uidADS'), 'ads', 'AD-TEST01'), campaign));
    await assertSucceeds(setDoc(doc(superAdmin('uidSUP'), 'ads', 'AD-TEST02'), { ...campaign, id: 'AD-TEST02' }));
  });

  it('keeps campaign writes closed to ordinary users', async () => {
    await assertFails(setDoc(doc(citizen(USER), 'ads', 'AD-TEST01'), campaign));
  });
});
