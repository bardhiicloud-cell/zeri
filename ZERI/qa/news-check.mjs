/**
 * Verify the news page redesign.
 * Checks the three specific changes requested:
 *   - the duplicated top links are gone
 *   - the topic dropdown row is gone, replaced by one category rail
 *   - the prototype notice is now an unemphasised line
 */
export default async function run(page, ui) {
  await page.waitForTimeout(9000);
  const out = {};

  const body = await page.evaluate(() => document.body.innerText);
  out.bodyChars = body.length;

  // 1. Redundant shortcuts removed from the brand row.
  out.hasTefunditHeaderLink = /^\s*Të fundit\s*$/m.test(body);
  out.hasLajmeLokaleHeaderLink = /Lajme lokale/.test(body);

  // 2. Old topic dropdown removed.
  out.hasTopicDropdownLabel = /FILTRO SIPAS TEMËS|Filtro sipas temës/i.test(body);
  out.hasTopicSelectElement = (await page.locator('#news-topic-filter').count()) > 0;

  // 3. New rail present with the requested entries, as one-click pills.
  const pills = await page.locator('button[aria-pressed]').evaluateAll((els) =>
    els.map((e) => e.innerText.replace(/\n/g, ' ').trim())
  );
  out.pillCount = pills.length;
  out.pills = pills.slice(0, 16);

  const required = ['Të gjitha', 'Lajmet', 'Njoftimet', 'Lokale'];
  out.pillsPresent = required.filter((r) => pills.some((p) => p.startsWith(r)));
  out.pillsMissing = required.filter((r) => !pills.some((p) => p.startsWith(r)));

  // 4. Prototype notice is now a quiet status line, not an amber panel.
  const noticeEl = page.getByText(/Pamje prototipi/i).first();
  out.noticePresent = (await noticeEl.count()) > 0;
  if (out.noticePresent) {
    out.noticeClass = await noticeEl.evaluate((el) => {
      const parent = el.closest('[role="status"]') || el.parentElement;
      return parent ? parent.className : '(none)';
    });
    out.noticeIsAmber = /amber/.test(out.noticeClass || '');
  }

  // 5. Search field lives in the same row as the rail.
  out.searchInHeader = (await page.locator('input[type="search"]').count()) > 0;

  return out;
}
