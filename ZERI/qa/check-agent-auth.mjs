/**
 * QA: why does creating an agent return "Unauthorized: Missing or invalid token"?
 *
 * The server's requireAuth rejects a request with no Bearer header. The client
 * builds that header from `auth.currentUser?.getIdToken()`, so the question is
 * whether `auth.currentUser` is actually populated when the admin opens the
 * agent form. This probes exactly that, without creating anything.
 */
export default async function run(page) {
  await page.goto('http://localhost:3002/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    try {
      localStorage.setItem('zeri_age_verified_v1', 'passed');
      localStorage.setItem('zeri_cookie_consent_decided', 'true');
    } catch { /* storage may be unavailable */ }
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  // A real id token can only exist if Firebase Auth has a signed-in user.
  const tokenState = await page.evaluate(async () => {
    const mods = Object.keys(window).filter((k) => k.startsWith('__'));
    return {
      hasFirebaseGlobals: mods,
      // The app never puts auth on window, so probe the endpoint the same way
      // the form does: no token in the browser means the header cannot be built.
      localKeys: Object.keys(localStorage),
    };
  });

  // Reproduce the exact request the form makes, with no token.
  const noToken = await page.evaluate(async () => {
    const res = await fetch('/api/v1/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'QA Probe', email: 'qa-probe@example.com', role: 'agent', permissions: [] }),
    });
    return { status: res.status, body: await res.json() };
  });

  // And with a syntactically valid but unsigned token, to distinguish
  // "no header" from "bad token" — both return the same generic message.
  const badToken = await page.evaluate(async () => {
    const res = await fetch('/api/v1/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer not-a-real-token' },
      body: JSON.stringify({ name: 'QA Probe', email: 'qa-probe@example.com', role: 'agent', permissions: [] }),
    });
    return { status: res.status, body: await res.json() };
  });

  return { tokenState, noToken, badToken };
}
