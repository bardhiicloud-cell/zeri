/**
 * Identify the exact URLs behind console errors on the home page.
 *
 * "Failed to load resource: 400" does not name the request, and our server has
 * no route that answers 400 on a bare GET. Capturing the response events tells
 * us whether the offender is ours or a third-party dependency before we "fix" a
 * bug that does not exist.
 */
export default async function run(page) {
  const bad = [];

  page.on('response', (res) => {
    if (res.status() >= 400) {
      bad.push({ status: res.status(), url: res.url(), type: res.request().resourceType() });
    }
  });
  page.on('requestfailed', (req) => {
    bad.push({ status: 'FAILED', url: req.url(), error: req.failure()?.errorText });
  });

  await page.goto(page.url().replace(/#.*$/, '') + '#/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);

  const firstParty = bad.filter((b) => b.url.includes('localhost'));
  const thirdParty = bad.filter((b) => !b.url.includes('localhost'));

  return {
    total: bad.length,
    firstParty,
    thirdParty,
    all: bad,
  };
}
