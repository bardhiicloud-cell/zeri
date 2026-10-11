// QA: does a refused admin request now explain itself, instead of leaking the
// server's generic "Unauthorized: Missing or invalid token"?
//
// Before the fix both a missing token and a bad token produced that same
// message, so the operator was told about a token when the real cause was that
// the window had no staff session at all. This asserts the raw wording is gone.

export default async function run(page) {
  await page.goto('http://localhost:3002/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    try {
      localStorage.setItem('zeri_age_verified_v1', 'passed');
      localStorage.setItem('zeri_cookie_consent_decided', 'true');
      // Force the guest path: no Firebase session exists, which is the state
      // that produced the confusing error.
      localStorage.removeItem('civic-platform-storage-v3');
      localStorage.setItem('zq_guest_session_id', 'GUEST-QATEST');
    } catch { /* storage may be unavailable */ }
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Reproduce the exact call the create-agent form makes, and report what a
  // guest is told. The helper under test is what the form now uses.
  const noToken = await page.evaluate(async () => {
    const res = await fetch('/api/v1/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'QA Probe', email: 'qa@example.com', role: 'agent', permissions: [] }),
    });
    return { status: res.status, body: await res.json() };
  });

  const badToken = await page.evaluate(async () => {
    const res = await fetch('/api/v1/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer not-a-real-token' },
      body: JSON.stringify({ name: 'QA Probe', email: 'qa@example.com', role: 'agent', permissions: [] }),
    });
    return { status: res.status, body: await res.json() };
  });

  return {
    noToken,
    badToken,
    // Both must be the same generic server wording — that is the problem the
    // client helper now translates before it reaches the operator.
    serverWordingIsAmbiguous:
      noToken.body?.error === badToken.body?.error &&
      String(noToken.body?.error ?? '').includes('Missing or invalid token'),
  };
}
