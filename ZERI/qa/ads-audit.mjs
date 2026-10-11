/**
 * Audit every page for ad slots and count what actually renders.
 *
 * The question "how many ads are on all the pages together" cannot be answered
 * from the source: `AdBanner` returns `null` for five of its positions
 * (`floating`, `modal`, `auth`, `map`, `banner`), so a page can contain four
 * `<AdBanner>` tags and paint zero ads. Only the rendered DOM tells the truth.
 *
 * Each page is visited in turn and the ad containers are counted by their
 * `data-ad-slot` marker, together with the position each one occupies. A page
 * that renders nothing is reported as such rather than silently skipped.
 */

const ROUTES = [
  ['#/', 'Ballina'],
  ['#/regjistri', 'Regjistri'],
  ['#/harta', 'Harta'],
  ['#/statistikat', 'Statistikat'],
  ['#/sondazhet', 'Sondazhet'],
  ['#/komunat', 'Komunat'],
  ['#/sherbimet', 'Shërbimet'],
  ['#/lajme', 'Lajmet'],
  ['#/kontakt', 'Kontakt'],
  ['#/ndihma', 'Qendra e Ndihmës'],
  ['#/raporto', 'Raporto'],
  ['#/trackid', 'Track ID'],
  ['#/Idea', 'Idetë'],
  ['#/projektet', 'Projektet'],
  ['#/donacion', 'Donacionet'],
  ['#/shendetesia', 'Shëndetësia'],
  ['#/forum', 'Debati'],
  ['#/rreth-projektit', 'Rreth Projektit'],
  ['#/kushtet-e-perdorimit', 'Kushtet'],
  ['#/privatesia', 'Privatësia'],
  ['#/kontakt-numrat', 'Numrat'],
  ['#/buxheti', 'Buxheti'],
];

const COUNT_ADS = `
  (function () {
    // An ad is identified by its own "Sponzorizuar" disclosure badge — the label
    // every rendered ad carries and no other element does. Counting containers by
    // class alone over-counts, because the empty-slot placeholder uses the same
    // card styling.
    var badges = Array.from(document.querySelectorAll('main span')).filter(function (s) {
      return (s.textContent || '').trim() === 'Sponzorizuar';
    });

    return badges.map(function (badge) {
      var root = badge.closest('div[class*="rounded-xl"], div[class*="rounded-2xl"]') || badge.parentElement;
      var img = root.querySelector('img, video');
      var text = (root.textContent || '').replace(/\\s+/g, ' ').trim();
      var box = root.getBoundingClientRect();
      return {
        title: text.slice(0, 100),
        hasMedia: !!img,
        media: img ? (img.getAttribute('src') || '').slice(0, 70) : null,
        height: Math.round(box.height),
        width: Math.round(box.width),
        visible: box.height > 0 && box.width > 0
      };
    });
  })()
`;

export default async function run(page) {
  const base = page.url().replace(/#.*$/, '');
  const results = [];

  // Answer both first-visit gates once; they are stored in localStorage and
  // persist for the rest of the run.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '#/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.evaluate("(function(){var b=Array.from(document.querySelectorAll('button'));var a=b.find(function(x){return /Prano t\\u00eb gjitha/i.test(x.textContent||'')});if(a)a.click();return !!a;})()");
  await page.waitForTimeout(6000);
  await page.evaluate("(function(){var b=Array.from(document.querySelectorAll('button'));var s=b.find(function(x){return /Kosov\\u00eb/i.test(x.textContent||'')&&!/Prano/i.test(x.textContent||'')});if(s)s.click();return !!s;})()");
  await page.waitForTimeout(3000);

  for (const [hash, label] of ROUTES) {
    await page.goto(base + hash, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3200);

    // Some pages have their own gate or a modal; press Escape to clear it.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    const ads = await page.evaluate(COUNT_ADS);
    const rendered = await page.evaluate("document.getElementById('root').innerHTML.length");

    results.push({
      route: hash,
      label,
      rendered: rendered > 3000,
      adSlots: ads.length,
      ads: ads.map((a) => a.text),
    });
  }

  const total = results.reduce((sum, r) => sum + r.adSlots, 0);
  const withAds = results.filter((r) => r.adSlots > 0).length;

  return {
    pagesChecked: results.length,
    pagesRendered: results.filter((r) => r.rendered).length,
    totalAdSlots: total,
    pagesWithAds: withAds,
    pagesWithoutAds: results.filter((r) => r.adSlots === 0).map((r) => r.label),
    perPage: results.map((r) => ({ label: r.label, route: r.route, ads: r.adSlots, rendered: r.rendered })),
  };
}