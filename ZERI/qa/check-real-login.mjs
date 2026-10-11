// QA probe: with a REAL login as an owner account, does the admin API call
// carry a token -- or does the app fall back to a guest session?
//
// Run with:  $env:QA_PASSWORD="..."; node browser.mjs <url> --script ./qa/check-real-login.mjs
//
// It signs in through the actual login form, then reports:
//   - what role the UI believes it has (from persisted state)
//   - what /api/v1/admin/users returns for the same call the form makes
//
// The decisive signal is the HTTP status:
//   401 -> the request never carried a valid token (the reported bug)
//   403 -> a valid token arrived, the account simply lacks the role
//   201 -> the agent was created

export default async function run(page) {
  const EMAIL = process.env.QA_EMAIL || 'bardhiicloud@gmail.com';
  const PASSWORD = process.env.QA_PASSWORD || '';

  await page.goto('http://localhost:3002/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    try {
      localStorage.setItem('zeri_age_verified_v1', 'passed');
      localStorage.setItem('zeri_cookie_consent_decided', 'true');
    } catch { /* storage may be unavailable */ }
  });

  if (!PASSWORD) {
    return { skipped: 'Set QA_PASSWORD to run the real sign-in probe.' };
  }

  await page.goto('http://localhost:3002/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const inputs = page.locator('form input');
  const count = await inputs.count();
  if (count < 2) return { error: 'Login form not found', inputCount: count };

  await inputs.nth(0).fill(EMAIL);
  await inputs.nth(1).fill(PASSWORD);
  await page.locator('form button[type=submit]').first().click().catch(() => page.keyboard.press('Enter'));
  await page.waitForTimeout(7000);

  const probe = await page.evaluate(async () => {
    let persistedRole = null;
    let persistedEmail = null;
    try {
      const raw = localStorage.getItem('civic-platform-storage-v3');
      const parsed = raw ? JSON.parse(raw) : null;
      persistedRole = parsed && parsed.state && parsed.state.currentUser ? parsed.state.currentUser.role : null;
      persistedEmail = parsed && parsed.state && parsed.state.currentUser ? parsed.state.currentUser.email : null;
    } catch { /* ignore */ }

    // Does the Firebase session actually exist? The app keeps auth off window,
    // so the only honest check is to make the call and read the status.
    const res = await fetch('/api/v1/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'QA Probe', email: 'qa-probe@example.com', role: 'agent', permissions: [] }),
    });
    const body = await res.json().catch(function () { return {}; });

    return {
      persistedRole: persistedRole,
      persistedEmail: persistedEmail,
      status: res.status,
      error: body && body.error ? body.error : null,
      reachedAuthorization: res.status !== 401,
      url: location.pathname,
    };
  });

  return { email: EMAIL, ...probe };
}
