/**
 * Verify the prototype superadmin on the dev server at port 3001.
 *
 * The prototype account (admin@kosova.com / admin123) is a LOCAL session: it is
 * checked in LoginPage before Firebase is consulted, and it mints no custom
 * claim. So the assertion is that the admin panel OPENS — not that data loads,
 * which would require Firestore and is deliberately out of reach for it.
 *
 * The run also records what the panel actually rendered, so a section that is
 * missing from the sidebar is visible in the output rather than guessed at.
 */
export default async function run(page) {
  const out = { steps: [] };
  const BASE = process.env.PROTOTYPE_ADMIN_URL || 'http://127.0.0.1:3010';

  // Start from a clean slate so a stale session cannot mask a broken login.
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => { });
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    try { localStorage.clear(); sessionStorage.clear(); } catch { /* ignore */ }
  }).catch(() => { });

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => { });
  await page.waitForTimeout(4000);

  out.urlAtStart = page.url();
  out.title = await page.title();

  const bodyAtLogin = await page.evaluate(() => document.body.innerText);

  // 1. Is the feature switched on? The banner only renders when the flag is true.
  out.bannerVisible = /Prototip — qasje administrative/i.test(bodyAtLogin);
  out.credentialsShown = /admin@kosova\.com\s*\/\s*admin123/i.test(bodyAtLogin);
  out.steps.push(`banner=${out.bannerVisible} credsShown=${out.credentialsShown}`);

  // 2. Fill the form. Prefer the prefill button so we exercise that path too.
  const prefill = page.getByRole('button', { name: /admin@kosova\.com\s*\/\s*admin123/i }).first();
  if ((await prefill.count()) > 0) {
    await prefill.click({ force: true }).catch(() => { });
    out.steps.push('clicked prefill button');
  } else {
    out.steps.push('prefill button not found; typing manually');
  }

  await page.waitForTimeout(600);

  const emailInput = page.locator('input[type="email"]').first();
  const pwInput = page.locator('input[type="password"]').first();

  out.emailAfterPrefill = await emailInput.inputValue().catch(() => '(unreadable)');

  // Fill explicitly regardless, so the test does not depend on the prefill path.
  await emailInput.fill('admin@kosova.com').catch((e) => out.steps.push('email fill failed: ' + e.message));
  await pwInput.fill('admin123').catch((e) => out.steps.push('pw fill failed: ' + e.message));
  await page.waitForTimeout(300);

  out.emailFilled = await emailInput.inputValue().catch(() => '');
  out.passwordLength = (await pwInput.inputValue().catch(() => '')).length;

  // 3. Submit.
  const submit = page.getByRole('button', { name: /Kyçu në Sistem|Duke Verifikuar/i }).first();
  if ((await submit.count()) > 0) {
    await submit.click({ force: true }).catch((e) => out.steps.push('submit click failed: ' + e.message));
  } else {
    await page.locator('form').first().evaluate((f) => f.requestSubmit?.()).catch(() => { });
    out.steps.push('form.requestSubmit fallback used');
  }

  // The prototype path returns synchronously, so this is generous rather than tight.
  await page.waitForTimeout(6000);

  out.urlAfterLogin = page.url();
  out.landedOnAdmin = /\/admin/.test(page.url());

  const body = await page.evaluate(() => document.body.innerText);
  out.bodyChars = body.length;
  out.seesAdminChrome = /Paneli i Përgjithshëm|Inspektimi i Raporteve|Përmbledhje/i.test(body);

  // 4. Sections that only a superadmin sees, plus the two new ones.
  out.seesMunicipalitySection = /Llogaritë e Komunave/i.test(body);
  out.seesWorkFactsSection = /Faktet e Komunave/i.test(body);
  out.seesMonitoringSection = /Monitorimi i Agjentëve/i.test(body);
  out.seesAgentsSection = /Menaxhimi i Stafit/i.test(body);

  // 5. Did an error banner appear instead?
  out.showsLoginError = /Kredencialet janë të pasakta|identifikohuni/i.test(body);

  out.sidebarText = body.slice(0, 900).replace(/\n+/g, ' | ');
  return out;
}
