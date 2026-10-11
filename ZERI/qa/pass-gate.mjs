/**
 * Pass the age gate, then screenshot the forum so the layout can actually be
 * seen. Without this the screenshot is always the gate.
 */
export default async function run(page, ui) {
  const input = page.locator('#age-verification-input');
  if ((await input.count()) > 0) {
    await input.fill('30').catch(() => { });
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /^Vazhdo$/i }).first()
      .click({ force: true }).catch(() => { });
    await page.waitForTimeout(2000);
  }
  // Dismiss the location dialog too if it appears.
  const city = page.getByRole('button', { name: /^Prishtinë$/i }).first();
  if ((await city.count()) > 0) {
    await city.click({ force: true }).catch(() => { });
    await page.waitForTimeout(2500);
  }
  await page.waitForTimeout(2000);
  return { bodyChars: await page.evaluate(() => document.body.innerText.length) };
}