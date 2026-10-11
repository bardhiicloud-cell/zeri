/**
 * Smoke test the real admin UI against the isolated emulator launcher.
 * Run with the project's browser QA runner after `npm run dev:admin-prototype`.
 */
export default async function run(page) {
  const baseUrl = process.env.PROTOTYPE_ADMIN_URL || 'http://127.0.0.1:3010';
  const result = { checks: [], failures: [] };
  const check = (name, condition) => {
    result.checks.push({ name, passed: Boolean(condition) });
    if (!condition) result.failures.push(name);
  };

  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  check('local prototype login is shown', await page.getByText(/Prototip — qasje administrative/i).count() > 0);
  check('test email is shown', await page.getByText(/admin@kosova\.com/i).count() > 0);

  await page.locator('input[type="email"]').fill('admin@kosova.com', { timeout: 5000 });
  await page.locator('input[type="password"]').fill('admin123', { timeout: 5000 });
  await page.getByRole('button', { name: /Kyçu në Sistem/i }).click({ timeout: 5000 });
  await page.waitForURL(/\/admin(?:$|[?#])/, { timeout: 20000 });
  await page.waitForSelector('text=Admin.', { timeout: 15000 }).catch(() => undefined);

  let body = await page.locator('body').innerText({ timeout: 5000 });
  check('real admin panel opens', /Paneli i Përgjithshëm|Inspektimi i Raporteve/.test(body));
  check('emulator-only badge is visible', /Sandbox lokal/i.test(body));
  check('agent management navigation exists', /Menaxhimi i Stafit & Agjentëve/i.test(body));
  check('agent monitoring navigation exists', /Monitorimi i Agjentëve/i.test(body));
  check('reports navigation exists', /Inspektimi i Raporteve/i.test(body));

  const groupButton = page.getByRole('button', { name: /Komunikimi/i }).first();
  if (await groupButton.count()) await groupButton.click({ timeout: 5000 });
  await page.getByRole('button', { name: /Monitorimi i Agjentëve/i }).click({ timeout: 5000 });
  await page.waitForSelector('text=Agjentët', { timeout: 15000 });
  body = await page.locator('body').innerText({ timeout: 5000 });
  check('seeded agent monitoring data renders', /Arta Berisha|Ilir Krasniqi|Stafi në regjistër/i.test(body));

  await page.getByRole('button', { name: /Inspektimi i Raporteve/i }).click({ timeout: 5000 });
  await page.waitForSelector('text=Gropa në rrugën kryesore pranë shkollës', { timeout: 15000 });
  body = await page.locator('body').innerText({ timeout: 5000 });
  check('seeded reports render in the existing reports view', /ZQ-P0001|Ndriçimi publik nuk punon/i.test(body));

  await page.screenshot({ path: `${process.env.KOMBAI_BROWSER_TEMP_DIR}/zeri-admin-prototype.png` });
  return result;
}
