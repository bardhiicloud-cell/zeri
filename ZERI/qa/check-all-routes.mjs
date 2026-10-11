// QA: do all six routes mount and render in a real browser on port 3002?
//
// HTTP 200 only proves the SPA shell was served. A client-rendered route can
// 200 and still render nothing, so this waits for content and reports what each
// panel actually says - including whether the age gate is what is showing.

export default async function run(page) {
  const routes = ['/', '/monitorim', '/komuna', '/agent', '/moderim', '/admin'];
  const results = {};

  for (const route of routes) {
    await page.goto('http://localhost:3002' + route, { waitUntil: 'domcontentloaded' });
    await page.evaluate(function () {
      try {
        localStorage.setItem('zeri_age_verified_v1', 'passed');
        localStorage.setItem('zeri_cookie_consent_decided', 'true');
      } catch (e) { /* storage may be unavailable */ }
    });
    await page.goto('http://localhost:3002' + route, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    results[route] = await page.evaluate(function () {
      const text = document.body.innerText;
      const heading = document.querySelector('h1');
      return {
        h1: heading ? heading.innerText : null,
        chars: text.length,
        mounted: text.length > 60,
        showsAgeGate: text.indexOf('PARA VAZHDIMIT') !== -1,
        showsGuard:
          text.indexOf('Akses i kufizuar') !== -1 ||
          text.indexOf('Vetem Super Admin') !== -1 ||
          text.indexOf('Vet\u00ebm Super Admin') !== -1 ||
          text.indexOf('roli administrator') !== -1,
        sample: text.replace(/\s+/g, ' ').slice(0, 100),
      };
    });
  }

  return results;
}
