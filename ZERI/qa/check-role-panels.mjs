/**
 * QA: does /agent and /komuna actually mount and render the panel?
 *
 * The app is gated behind a 16+ age check stored in localStorage, so the route
 * is only reachable once that flag is present. This script sets it, opens the
 * route, and reports what the panel actually says — not whether a chunk loaded.
 */
export default async function run(page, ui) {
  const results = {};

  for (const route of ['/agent', '/komuna', '/moderim']) {
    await page.goto(`http://localhost:3002${route}`, { waitUntil: 'domcontentloaded' });

    // The age gate writes nothing until submitted; setting the same key it would
    // set is enough to get past it, and it is the app's own key, not a mock.
    await page.evaluate(() => {
      try {
        localStorage.setItem('kosova_age_verified', 'true');
        localStorage.setItem('ageVerified', 'true');
      } catch { /* storage may be unavailable */ }
    });

    await page.goto(`http://localhost:3002${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    results[route] = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        h1: document.querySelector('h1')?.innerText ?? null,
        chars: text.length,
        // Match strings that can only come from the panel under test.
        hasAgentPanel: text.includes('Paneli i Agjentit'),
        hasKomunaPanel: text.includes('zgjerimi i punëve'),
        hasModerim: text.includes('Qendra e Moderimit'),
        hasGated: text.includes('Akses i kufizuar') || text.includes('Vetëm Super Admin'),
        sample: text.slice(0, 180),
      };
    });
  }

  return results;
}
