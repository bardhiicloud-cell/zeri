/**
 * Live check of the public Transparency Center numbers against data whose answer is
 * known in advance. Local emulator sandbox only (see qa/user-moderation-api-check.ts).
 * Reports are isolated with a category no other data uses.
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID ?? '';
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3010';
if (!projectId.startsWith('demo-') || !process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('Refused: needs a demo- project and the Firestore emulator host.');
  process.exit(2);
}
initializeApp({ projectId });
const db = getFirestore();

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = '') {
  if (ok) passed += 1; else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`${ok ? '  ok ' : ' FAIL'}  ${name}${ok || !detail ? '' : `  [${detail}]`}`);
}

const get = async (query: string) => {
  const response = await fetch(`${BASE}/api/v1/public/transparency${query ? `?${query}` : ''}`);
  const text = await response.text();
  let body: any = {};
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  return { status: response.status, body, text };
};

const CATEGORY = 'QA-Transparenca-Kategoria';
const H = 3_600_000;
const jan = (day: number) => new Date(Date.UTC(2026, 0, day, 12));

async function main() {
  const ids: string[] = [];
  let n = 0;
  const add = async (status: string, extra: Record<string, unknown> = {}, created: Date | string = jan(10)) => {
    const id = `tp-r${String(n++).padStart(2, '0')}`;
    ids.push(id);
    await db.collection('reports').doc(id).set({
      title: `Titull ${id}`, description: 'PERSHKRIM-PRIVAT', category: CATEGORY, status, timeline: [],
      authorId: 'tp-secret-author', authorName: 'Emri Sekret', isAnonymous: n % 2 === 0,
      location: { municipality: 'Pejë', address: 'ADRESA-PRIVATE' },
      createdAt: typeof created === 'string' ? created : Timestamp.fromDate(created), ...extra,
    });
  };
  const resolvedAfter = (hours: number) => ({ resolvedAt: Timestamp.fromDate(new Date(jan(10).getTime() + hours * H)) });

  for (let i = 0; i < 3; i += 1) await add('Pending Review');
  for (let i = 0; i < 2; i += 1) await add('Approved');
  for (let i = 0; i < 2; i += 1) await add('In Progress');
  await add('Overdue');
  await add('Resolved', resolvedAfter(10));
  await add('Resolved', resolvedAfter(10));
  await add('Resolved', resolvedAfter(30), jan(10));
  await add('Resolved', { ...resolvedAfter(30), timeline: [{ source: 'municipality', comment: 'U mbulua gropa me asfalt.' }] });
  await add('Closed', resolvedAfter(20));
  await add('Rejected');
  await add('Rejected');
  await add('Draft');
  // A report from before dates were stored as timestamps: stored as text, still counted once.
  await add('Approved', {}, jan(15).toISOString());

  const q = `category=${encodeURIComponent(CATEGORY)}`;

  console.log('1. The totals, from the database, over every report');
  const all = await get(q);
  check('the public endpoint answers without a sign-in', all.status === 200, `status ${all.status}`);
  const s = all.body.summary ?? {};
  check('received counts every report except drafts, both date formats', s.received === 16, `got ${s.received}`);
  check('awaiting review, accepted, resolved, rejected, overdue are exact',
    s.awaitingReview === 3 && s.published === 11 && s.resolved === 5 && s.rejected === 2 && s.overdue === 1 && s.inProgress === 2, JSON.stringify(s));
  check('the acceptance rate is accepted ÷ decided (11 ÷ 13), not ÷ everything', s.rates?.acceptanceRate === 84.6, String(s.rates?.acceptanceRate));
  check('the resolution rate is resolved ÷ accepted (5 ÷ 11)', s.rates?.resolutionRate === 45.5, String(s.rates?.resolutionRate));
  check('the overdue share is overdue ÷ accepted-and-unresolved (1 ÷ 6)', s.rates?.overdueShare === 16.7, String(s.rates?.overdueShare));
  check('the time to resolve is measured on the five resolved reports', all.body.resolutionTime?.sampleSize === 5 && all.body.resolutionTime?.averageHours === 20 && all.body.resolutionTime?.medianHours === 20, JSON.stringify(all.body.resolutionTime));
  check('every figure comes with the definition of what it is', typeof all.body.definitions?.resolutionRate === 'string' && typeof all.body.generatedAt === 'string');

  console.log('\n2. Filters');
  const inJan = await get(`${q}&from=2026-01-01&to=2026-01-31`);
  check('a period that contains the reports counts them', inJan.body.summary?.received === 16, String(inJan.body.summary?.received));
  const feb = await get(`${q}&from=2026-02-01&to=2026-02-28`);
  check('a period with no reports counts zero', feb.body.summary?.received === 0);
  check('...and every rate is "no data" (null), never 0 and never invented',
    feb.body.summary?.rates?.acceptanceRate === null && feb.body.summary?.rates?.resolutionRate === null && feb.body.summary?.rates?.overdueShare === null && feb.body.resolutionTime?.averageHours === null);
  const day = await get(`${q}&from=2026-01-15&to=2026-01-15`);
  check('the end date is inclusive (one day, one report)', day.body.summary?.received === 1, String(day.body.summary?.received));
  const gjilan = await get(`${q}&municipality=Gjilan`);
  check('another municipality sees none of them', gjilan.body.summary?.received === 0);
  const peja = await get(`${q}&municipality=${encodeURIComponent('Pejë')}`);
  check('the right municipality sees all of them', peja.body.summary?.received === 16);
  const monthly: Array<{ month: string; received: number }> = inJan.body.monthly ?? [];
  check('the monthly trend puts them in January', monthly.length === 1 && monthly[0].month === '2026-01' && monthly[0].received === 16, JSON.stringify(monthly));

  console.log('\n3. Bad requests are refused, not ignored');
  for (const bad of ['from=01/02/2026', 'to=2026-13-40', 'from=2026-05-01&to=2026-04-01', 'to=2031-01-01', `category=${'x'.repeat(81)}`]) {
    check(`"${bad.slice(0, 40)}" -> 400`, (await get(bad)).status === 400);
  }

  console.log('\n4. What is published, and what is not');
  const outcomes: any[] = all.body.recentOutcomes ?? [];
  check('the latest finished cases carry the municipality\'s own public response', outcomes.some(o => o.officialResponse === 'U mbulua gropa me asfalt.'));
  check('no reporter, address, description or id appears anywhere in the response',
    !all.text.includes('Emri Sekret') && !all.text.includes('tp-secret-author') && !all.text.includes('ADRESA-PRIVATE') && !all.text.includes('PERSHKRIM-PRIVAT'));
  const again = await get(q);
  check('asking again gives the same time stamp (served from the cache)', again.body.generatedAt === all.body.generatedAt);

  for (const id of ids) await db.collection('reports').doc(id).delete();
  console.log(`\n${passed} passed, ${failures.length} failed.`);
  if (failures.length) { console.log('Failures:\n - ' + failures.join('\n - ')); process.exit(1); }
}

main().catch(error => { console.error('Check aborted:', error); process.exit(1); });
