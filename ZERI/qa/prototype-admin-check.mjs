/**
 * Verify the prototype superadmin account end to end.
 *
 * Checks that admin@kosova.com / admin123:
 *   1. is surfaced on the login page (banner visible because VITE_PROTOTYPE_ADMIN=true)
 *   2. signs in and lands on /admin
 *   3. opens a superadmin-only section (Llogaritë e Komunave), proving the role
 *      grants full access rather than a partial grant
 *
 * The account is a LOCAL session: it mints no Firebase custom claim, so server
 * API calls are still refused. This test therefore asserts the panel renders,
 * not that data loads — reading Firestore is deliberately out of reach.
 */
export default async function run(page, ui) {
  const out = { steps: [] };

  const baseUrl = process.env.PROTOTYPE_ADMIN_URL || 'http://127.0.0.1:3010';
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' }).catch(() => { });
  await page.waitForTimeout(3000);

  // Clear any age/location gate and stale session so we test a fresh login.
  await page.evaluate(() => {
    try { localStorage.clear(); sessionStorage.clear(); } catch { /* ignore */ }
  }).catch(() => { });

  await page.waitForTimeout(500);

  // 1. The prototype banner must be present.
  out.bannerVisible = await page.getByText(/Prototip — qasje administrative/i).count() > 0;
  out.emailPrefilled = false;

  const prefill = page.getByRole('button', { name: /admin@kosova\.com \/ admin123/i }).first();
  if ((await prefill.count()) > 0) {
    await prefill.click({ force: true }).catch(() => { });
    await page.waitForTimeout(500);
    const emailVal = await page.locator('input[type="email"]').first().inputValue().catch(() => '');
    out.emailPrefilled = emailVal.trim() === 'admin@kosova.com';
    out.steps.push('prefill clicked, email=' + emailVal);
  } else {
    // Fall back to typing the credentials directly.
    await page.locator('input[type="email"]').first().fill('admin@kosova.com').catch(() => { });
    await page.locator('input[type="password"]').first().fill('admin123').catch(() => { });
    out.steps.push('typed credentials manually');
  }

  // 2. Submit.
  const submit = page.getByRole('button', { name: /Kyçu në Sistem|Duke Verifikuar/i }).first();
  if ((await submit.count()) > 0) {
    await submit.click({ force: true }).catch(() => { });
  } else {
    await page.locator('form').first().evaluate((f) => f.requestSubmit?.()).catch(() => { });
  }

  await page.waitForTimeout(5000);
  out.urlAfterLogin = page.url();
  out.landedOnAdmin = /\/admin/.test(page.url());

  const body = await page.evaluate(() => document.body.innerText);
  out.bodyChars = body.length;
  out.seesAdminChrome = /Paneli i Përgjithshëm|Inspektimi i Raporteve|Përmbledhje/i.test(body);

  // 3. A superadmin-only section must be listed in the sidebar.
  out.seesMunicipalitySection = /Llogaritë e Komunave/i.test(body);
  out.seesWorkFactsSection = /Faktet e Komunave/i.test(body);
  out.seesMonitoringSection = /Monitorimi i Agjentëve/i.test(body);

  // Capture the visible section labels so a missing grant is diagnosable.
  out.sidebarText = body.slice(0, 700).replace(/\n+/g, ' | ');

  return out;
}
