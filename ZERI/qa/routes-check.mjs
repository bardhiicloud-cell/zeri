/**
 * End-to-end route smoke test.
 *
 * The platform is a hash router, so every "page" is a client-side navigation on
 * the same document. Loading each route in a fresh context and waiting for real
 * content is the only way to catch a page that mounts to nothing — a blank pane
 * still returns HTTP 200 and an empty <title>, which is exactly the failure this
 * checks for.
 *
 * Runs against the live dev server and reports console errors per route.
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
  ['#/rreth-projektit', 'Rreth Projektit'],
  ['#/kushtet-e-perdorimit', 'Kushtet'],
  ['#/privatesia', 'Privatësia'],
  ['#/donacion', 'Donacione'],
  ['#/nuk-ekziston-kjo', '404'],
];

export default async function run(page) {
  const base = page.url().replace(/#.*$/, '');
  const results = [];

  for (const [hash, label] of ROUTES) {
    const errors = [];
    const onError = (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    };
    page.on('console', onError);

    await page.goto(base + hash, { waitUntil: 'domcontentloaded' });
    // Give the lazy chunk and its data fetch time to settle.
    await page.waitForTimeout(3500);

    const info = await page.evaluate(() => ({
      rootLen: document.getElementById('root')?.innerHTML.length ?? 0,
      title: document.title,
      textLen: (document.body.innerText || '').trim().length,
      head: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 90),
    }));

    page.off('console', onError);
    results.push({
      route: hash,
      label,
      ok: info.rootLen > 2000 && info.textLen > 60,
      ...info,
      errors,
    });
  }

  const failed = results.filter((r) => !r.ok || r.errors.length > 0);
  return { total: results.length, failed: failed.length, failedRoutes: failed, all: results };
}
