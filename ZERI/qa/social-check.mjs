/**
 * Verify the social links are present, correct and reachable.
 *
 * Three separate things can go wrong and only one of them is visible:
 *   1. the icon renders but the href is wrong or missing;
 *   2. the link exists in the footer but not in the surfaces a phone can reach;
 *   3. the SVG paths are broken, so the "icon" is an empty box.
 *
 * The path length is checked because a malformed `d` attribute still produces an
 * <svg> element — it just draws nothing.
 */
export default async function run(page) {
  const read = () => page.evaluate(`
    (function () {
      var links = Array.from(document.querySelectorAll('a[rel*="me"]'));
      return links.map(function (a) {
        var svg = a.querySelector('svg');
        var path = svg ? svg.querySelector('path') : null;
        var box = a.getBoundingClientRect();
        return {
          label: a.getAttribute('aria-label'),
          href: a.getAttribute('href'),
          target: a.getAttribute('target'),
          rel: a.getAttribute('rel'),
          hasSvg: !!svg,
          pathLen: path ? (path.getAttribute('d') || '').length : 0,
          visible: box.width > 0 && box.height > 0
        };
      });
    })()
  `);

  const out = {};

  // --- Desktop: sidebar + footer ---
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(page.url().replace(/#.*$/, '') + '#/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.evaluate("(function(){var b=Array.from(document.querySelectorAll('button'));var a=b.find(function(x){return /Prano t\\u00eb gjitha/i.test(x.textContent||'')});if(a)a.click();return !!a;})()");
  await page.waitForTimeout(7000);
  out.desktop = await read();

  // --- Mobile sheet ---
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(page.url().replace(/#.*$/, '') + '#/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
  await page.evaluate("(function(){var b=Array.from(document.querySelectorAll('button'));var a=b.find(function(x){return /Prano t\\u00eb gjitha/i.test(x.textContent||'')});if(a)a.click();return !!a;})()");
  await page.waitForTimeout(5000);

  // Open the menu sheet: its trigger is the dock's last button.
  await page.evaluate("(function(){var b=Array.from(document.querySelectorAll('button')).find(function(x){return x.getAttribute('aria-label')==='Menuja'});if(b)b.click();return !!b;})()");
  await page.waitForTimeout(1800);
  out.mobileSheet = await read();

  return out;
}