/**
 * Visual confirmation of the desktop shell after the layout fix.
 *
 * The geometry probes prove the boxes are right; a screenshot proves they are
 * *visible* — that the centre column is not merely present in the DOM but painted
 * at the top of the viewport with the sidebar beside it and the bar above.
 *
 * The consent gate is answered first, otherwise the capture is just the banner.
 */
export default async function run(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(page.url().replace(/#.*$/, '') + '#/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  await page.evaluate(`
    (function () {
      var b = Array.from(document.querySelectorAll('button'));
      var a = b.find(function (x) { return /Prano t\u00eb gjitha/i.test(x.textContent || ''); });
      if (a) a.click();
      return !!a;
    })()
  `);
  await page.waitForTimeout(7000);

  // The location prompt is a first-visit gate. Answer it with the national scope
  // so the shot shows the shell rather than the modal.
  await page.evaluate(`
    (function () {
      var b = Array.from(document.querySelectorAll('button'));
      var all = b.find(function (x) { return /Shiko t\u00eb gjitha Kosov\u00ebn|Shiko gjith\u00eb Kosov\u00ebn|Kosov\u00ebn/i.test(x.textContent || ''); });
      if (all) { all.click(); return 'scope'; }
      var skip = b.find(function (x) { return /M\u00eb von\u00eb|Anulo|Skip/i.test(x.textContent || ''); });
      if (skip) { skip.click(); return 'skip'; }
      return 'none';
    })()
  `);
  await page.waitForTimeout(3500);

  await page.screenshot({ path: 'qa/desktop-shell.png' });

  const state = await page.evaluate(`
    (function () {
      var m = document.querySelector('main');
      var a = document.querySelector('aside');
      var h = document.querySelector('header');
      var r = function (el) { var b = el ? el.getBoundingClientRect() : null; return b ? { y: Math.round(b.y), x: Math.round(b.x), h: Math.round(b.height), w: Math.round(b.width) } : null; };
      return {
        header: r(h), sidebar: r(a), main: r(m),
        firstHeading: (document.querySelector('main h1, main h2') || {}).textContent || null,
        bodyText: document.body.innerText.replace(/\\s+/g, ' ').slice(0, 160)
      };
    })()
  `);

  return state;
}