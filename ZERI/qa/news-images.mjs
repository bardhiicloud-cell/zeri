/**
 * Measure the news card image geometry.
 *
 * The complaint was that some articles looked wrong — the suspected cause was a
 * fixed `h-48` crop on the archive cards, which sliced every photo to the same
 * band regardless of shape. This records the actual rendered width/height and
 * ratio of every card image so the fix can be confirmed rather than assumed.
 */
export default async function run(page, ui) {
  const out = { steps: [] };

  // Age gate.
  const ageInput = page.locator('#age-verification-input');
  if ((await ageInput.count()) > 0) {
    await ageInput.fill('30').catch(() => { });
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /^Vazhdo$/i }).first().click({ force: true }).catch(() => { });
    out.steps.push('age gate passed');
    await page.waitForTimeout(1800);
  }

  // Location dialog.
  const city = page.getByRole('button', { name: /^Prishtinë$/i }).first();
  if ((await city.count()) > 0) {
    await city.click({ force: true }).catch(() => { });
    out.steps.push('location set');
    await page.waitForTimeout(2000);
  }

  try {
    await page.getByRole('heading', { name: /Lajmet kryesore/i }).first()
      .waitFor({ state: 'visible', timeout: 30000 });
  } catch {
    out.error = 'news heading never appeared';
    out.bodyChars = await page.evaluate(() => document.body.innerText.length);
    return out;
  }

  await page.waitForTimeout(2000);
  out.bodyChars = await page.evaluate(() => document.body.innerText.length);

  // Every image inside an article or the side rail, with its real geometry.
  out.images = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('img')]
      .filter((i) => i.closest('article') || i.closest('aside'));
    return nodes.slice(0, 12).map((i) => {
      const r = i.getBoundingClientRect();
      return {
        w: Math.round(r.width),
        h: Math.round(r.height),
        ratio: r.height ? Number((r.width / r.height).toFixed(2)) : 0,
        cls: (i.className || '').slice(0, 60),
      };
    });
  });

  // Distinct ratios: a single value means every thumbnail is now consistent.
  out.distinctRatios = [...new Set(out.images.map((i) => i.ratio))];

  // Grid column count, to confirm the card width actually changed.
  out.articleCount = await page.locator('article').count();
  out.firstArticleWidth = await page.evaluate(() => {
    const a = document.querySelector('article');
    return a ? Math.round(a.getBoundingClientRect().width) : 0;
  });

  return out;
}