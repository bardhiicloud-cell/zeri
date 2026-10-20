import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { addDoc, collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';

/**
 * What a visitor's browser can store with the *deployed* rules when the /api server is
 * not there (the live site today): the exact payloads of ReportIssue.tsx (direct write),
 * HealthRegistryPage.tsx and src/lib/directSubmissions.ts. Run with: npm run test:rules
 *
 * The prototype emulator (firestore.prototype.rules) lets any signed-in user write
 * anything, so it can not answer this; these tests can.
 */
let env: RulesTestEnvironment;

const GUEST = 'uidGUEST';
const guest = () => env.authenticatedContext(GUEST, { firebase: { sign_in_provider: 'anonymous' } }).firestore();

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-zeri-citizen-submissions',
    firestore: { rules: readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8') },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

/** ReportIssue.tsx, direct path: the shape `setDoc(reportRef, {...reportData, createdAt: serverTimestamp()})` sends. */
const directReport = (id: string) => ({
  title: 'Gropë e madhe në rrugë',
  description: 'Përshkrim i detajuar i problemit me më shumë se njëzet shkronja.',
  category: 'Rrugë & Infrastrukturë',
  topicCategory: 'rruge',
  urgency: 'Mesatare',
  status: 'Pending Review',
  location: { lat: 42.66, lng: 21.16, address: 'Rr. Testi', municipality: 'Prishtinë' },
  images: ['https://firebasestorage.googleapis.com/v0/b/x/o/a.jpg'],
  media: [
    { url: 'https://firebasestorage.googleapis.com/v0/b/x/o/a.jpg', type: 'image', name: 'a.jpg', sizeBytes: 1000, mimeType: 'image/jpeg' },
    { url: 'https://firebasestorage.googleapis.com/v0/b/x/o/v.mp4', type: 'video', name: 'v.mp4', sizeBytes: 900000, mimeType: 'video/mp4' },
  ],
  authorId: GUEST,
  authorName: 'Qytetar Anonim',
  isAnonymous: true,
  responsibleInstitution: 'Komuna',
  responsibleLevel: 'Lokal',
  responsibleOffice: 'Drejtoria',
  responseDueAt: '2026-10-20T10:00:00.000Z',
  accountabilityStatus: 'Në pritje',
  id,
  trackingId: 'ZQ-20261016-ABCDEFGHJKMN',
  createdAt: serverTimestamp(),
});

/** HealthRegistryPage.tsx, anonymous case. */
const healthCase = () => ({
  trackingId: 'HC-MGT3XYZ1-AB12',
  authorId: GUEST,
  expiresAt: '2026-11-15T10:00:00.000Z',
  fullName: '',
  age: 45,
  gender: 'Mashkull',
  municipality: 'Prishtinë',
  neighborhood: '',
  category: 'Kancer / Onkologji',
  diagnosis: 'Diagnozë testuese',
  diagnosedYear: 2026,
  urgency: 'Urgjente',
  needs: [],
  description: 'Përshkrim i rastit.',
  contactPhone: '',
  contactName: '',
  isAnonymous: true,
  contactVisibility: 'admin_only',
  hospitalPrivacyNotice: 'RAST ANONIM',
  supportAmountNeeded: 0,
  supportAmountRaised: 0,
  hospitalNotified: false,
  status: 'pending',
  createdAt: '2026-10-16T10:00:00.000Z',
  consentToProcessing: true,
  healthCondition: 'Diagnozë testuese',
});

describe('a visitor without the /api server', () => {
  it('can not store a report before it has a users/{uid} profile (canAct reads it)', async () => {
    await assertFails(setDoc(doc(guest(), 'reports', 'rep0'), directReport('rep0')));
  });

  it('creates its own minimal profile, then stores a report with photo and video and its Track ID', async () => {
    // src/lib/reportSession.ts ensureOwnProfile: the fields a person may write for themselves.
    await assertSucceeds(setDoc(doc(guest(), 'users', GUEST), { id: GUEST, name: '', avatar: '', createdAt: serverTimestamp() }));
    await assertSucceeds(setDoc(doc(guest(), 'reports', 'rep1'), directReport('rep1')));
  });

  it('can not give itself a role or points through that profile', async () => {
    await assertFails(setDoc(doc(guest(), 'users', GUEST), { id: GUEST, name: '', role: 'admin', createdAt: serverTimestamp() }));
  });

  it('stores an anonymous health case', async () => {
    await assertSucceeds(addDoc(collection(guest(), 'healthRegistry'), healthCase()));
  });

  it('reports a missing medicine, left pending for staff to verify', async () => {
    await setDoc(doc(guest(), 'users', GUEST), { id: GUEST, name: '', avatar: '', createdAt: serverTimestamp() });
    const shortage = { medicineName: 'Insulinë', municipality: 'Prishtinë', reportedDate: '2026-10-20', isAnonymous: true, status: 'pending', authorId: GUEST };
    await assertSucceeds(addDoc(collection(guest(), 'medicineShortages'), shortage));
    await assertFails(addDoc(collection(guest(), 'medicineShortages'), { ...shortage, status: 'verified' }));
  });

  it('works the same for a guest the server signed in (custom token with guest: true)', async () => {
    // server/guestSession.ts: provider is "custom", the guest claim marks the account.
    const SERVER_GUEST = 'guest_0123456789abcdef0123456789abcdef';
    const db = env.authenticatedContext(SERVER_GUEST, { guest: true, firebase: { sign_in_provider: 'custom' } }).firestore();
    await assertSucceeds(setDoc(doc(db, 'users', SERVER_GUEST), { id: SERVER_GUEST, name: '', avatar: '', createdAt: serverTimestamp() }));
    await assertSucceeds(setDoc(doc(db, 'reports', 'repS'), { ...directReport('repS'), authorId: SERVER_GUEST }));
    await assertSucceeds(addDoc(collection(db, 'healthRegistry'), { ...healthCase(), authorId: SERVER_GUEST }));
    await assertSucceeds(addDoc(collection(db, 'medicineShortages'), { medicineName: 'Insulinë', municipality: 'Prishtinë', reportedDate: '2026-10-20', isAnonymous: false, status: 'pending', authorId: SERVER_GUEST }));
  });

  // Opened to the browser by the project owner (2026-10-19) so that "Raporto një lajm"
  // and donation applications work while the /api server is down.
  // directSubmissions.ts runs ensureReportSession first, which creates the guest's profile.
  const withProfile = () => setDoc(doc(guest(), 'users', GUEST), { id: GUEST, name: '', avatar: '', createdAt: serverTimestamp() });

  it('files a news tip directly', async () => {
    await withProfile();
    await assertSucceeds(addDoc(collection(guest(), 'newsTips'), {
      title: 'Titull i lajmit testues', body: 'x'.repeat(50), category: 'korrupsion', municipality: '', place: '',
      anonymous: true, contactName: '', contactEmail: '', contactPhone: '', media: [],
      reference: 'LJ-ABCDEFGH', status: 'submitted', authorId: GUEST, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
  });

  it('can not file a news tip that is already accepted or under someone else\'s name', async () => {
    await withProfile();
    await assertFails(addDoc(collection(guest(), 'newsTips'), {
      title: 'Titull i lajmit testues', body: 'x'.repeat(50), category: 'korrupsion', municipality: '', place: '',
      anonymous: true, contactName: '', contactEmail: '', contactPhone: '', media: [],
      reference: 'LJ-ABCDEFGH', status: 'published', authorId: GUEST, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
    await assertFails(addDoc(collection(guest(), 'newsTips'), {
      title: 'Titull i lajmit testues', body: 'x'.repeat(50), category: 'korrupsion', municipality: '', place: '',
      anonymous: true, contactName: '', contactEmail: '', contactPhone: '', media: [],
      reference: 'LJ-ABCDEFGH', status: 'submitted', authorId: 'someoneElse', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
  });

  it('files a donation application only as pending', async () => {
    await withProfile();
    await assertSucceeds(addDoc(collection(guest(), 'donationCauses'), {
      title: 'Ndihmë', description: 'y'.repeat(30), category: 'shtepi', mediaType: 'image', mediaUrl: 'data:image/png;base64,AAAA',
      donationUrl: '', reference: 'DN-ABCDEFGH', status: 'pending', authorId: GUEST, createdAt: serverTimestamp(),
    }));
    await assertFails(addDoc(collection(guest(), 'donationCauses'), {
      title: 'Ndihmë', description: 'y'.repeat(30), category: 'shtepi', mediaType: 'image', mediaUrl: 'data:image/png;base64,AAAA',
      donationUrl: '', reference: 'DN-ABCDEFGH', status: 'active', authorId: GUEST, createdAt: serverTimestamp(),
    }));
  });
});
