/**
 * Verify the forum sidebar fixes.
 *
 * The complaint was that the rail "leviz" (moves) and feels weak. The cause was
 * `sticky top-6 h-fit` on a column taller than the viewport, which pins the top
 * and makes the rest unreachable, plus a profile card whose second statistic was
 * a hardcoded 0.
 */
export default async function run(page, ui) {
  const out = {};

  try {
    await page.getByRole('heading', { name: /Debat|Forum|Diskutime/i }).first()
      .waitFor({ state: 'visible', timeout: 70000 });
  } catch {
    out.note = 'no heading matched; continuing anyway';
  }
  await page.waitForTimeout(2500);

  out.bodyChars = await page.evaluate(() => document.body.innerText.length);

  // 1. No rail should be position:sticky any more.
  out.stickyRails = await page.evaluate(() => {
    const rails = [...document.querySelectorAll('div')].filter(
      (d) => d.className && typeof d.className === 'string' &&
        d.className.includes('shrink-0') && d.className.includes('flex-col')
    );
    return rails.map((r) => getComputedStyle(r).position);
  });

  // 2. The always-zero "Ndikimi" stat is gone.
  const body = await page.evaluate(() => document.body.innerText);
  out.hasFakeInfluenceStat = /\bNdikimi\b/.test(body);

  // 3. Rail widths.
  out.railWidths = await page.evaluate(() => {
    const rails = [...document.querySelectorAll('div')].filter(
      (d) => d.className && typeof d.className === 'string' &&
        d.className.includes('shrink-0') && d.className.includes('flex-col')
    );
    return rails.map((r) => Math.round(r.getBoundingClientRect().width));
  });

  // 4. Feed controls: filters carry aria-pressed, sort is a group.
  out.filterPills = await page.locator('button[aria-pressed]').count();
  out.sortGroup = await page.locator('[role="group"][aria-label="Renditja"], [role="group"][aria-label="Sort"]').count();

  // 5. Nothing overflows horizontally (a pinned rail can cause this).
  out.horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );

  return out;
}