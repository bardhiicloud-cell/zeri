/**
 * Verify the news page changes: right rail, one-click category pills, no
 * redundant header links, no topic dropdown, quiet prototype notice.
 */
export default async function run(page, ui) {
  const out = {};

  // The header is what we are checking, so wait for the news heading rather than
  // the language button — the latter is `hidden sm:block` and is not rendered at
  // the narrow default viewport.
  try {
    await page.getByRole('heading', { name: /Lajmet kryesore/i }).first()
      .waitFor({ state: 'visible', timeout: 70000 });
  } catch {
    out.error = 'news page did not render';
    out.bodyChars = await page.evaluate(() => document.body.innerText.length);
    return out;
  }

  await page.waitForTimeout(1500);
  const body = await page.evaluate(() => document.body.innerText);
  out.bodyChars = body.length;

  // Removed elements.
  out.hasTefunditLink = /^\s*Të fundit\s*$/m.test(body);
  out.hasLajmeLokaleLink = /\bLajme lokale\b/.test(body);
  out.hasTopicDropdown = /Filtro sipas temës|FILTRO SIPAS TEMËS/i.test(body);
  out.hasTopicSelect = (await page.locator('#news-topic-filter').count()) > 0;

  // Category rail.
  out.pills = await page.locator('button[aria-pressed]').count();

  // Right rail.
  out.hasLiveRail = body.includes('Njoftime Live');
  out.hasMostRead = body.includes('Më të lexuarat');
  const rail = page.locator('aside[aria-label="Njoftime dhe lajme të shpejta"]');
  out.railExists = (await rail.count()) > 0;
  if (out.railExists) {
    out.railVisible = await rail.first().isVisible();
    out.railBox = await rail.first().boundingBox();
  }

  // Prototype notice should no longer be an amber panel.
  const notice = page.getByText(/Pamje prototipi/i).first();
  if ((await notice.count()) > 0) {
    out.noticeClass = await notice.evaluate((el) => {
      const holder = el.closest('[role="status"]') || el.parentElement;
      return holder ? holder.className : '';
    });
    out.noticeIsAmber = /amber/.test(out.noticeClass);
  }

  return out;
}
