/**
 * Screenshot the social block by measuring where it actually is.
 *
 * The previous crop guessed at `y: 700` and landed on the sidebar's empty scroll
 * area, producing a blank image. Clipping to the element's own bounding box is
 * the only reliable way — the sidebar footer sits at the bottom of a
 * viewport-height column, not at a fixed offset.
 */
export default async function run(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(page.url().replace(/#.*$/, '') + '#/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.evaluate("(function(){var b=Array.from(document.querySelectorAll('button'));var a=b.find(function(x){return /Prano t\\u00eb gjitha/i.test(x.textContent||'')});if(a)a.click();return !!a;})()");
  await page.waitForTimeout(7000);

  // Find the social row in the sidebar and clip to it.
  const sidebarBox = await page.evaluate(`
    (function () {
      var aside = document.querySelector('aside');
      if (!aside) return null;
      var links = aside.querySelectorAll('a[rel*="me"]');
      if (!links.length) return null;
      var first = links[0].getBoundingClientRect();
      var last = links[links.length - 1].getBoundingClientRect();
      return {
        x: Math.max(0, first.x - 12),
        y: Math.max(0, first.y - 34),
        width: 240,
        height: (last.bottom - first.top) + 52
      };
    })()
  `);
  if (sidebarBox) {
    await page.screenshot({ path: 'qa/social-sidebar.png', clip: sidebarBox });
  }

  // Page footer: scroll down, then clip the first column containing the icons.
  await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
  await page.waitForTimeout(1500);

  const footerBox = await page.evaluate(`
    (function () {
      var footer = document.querySelector('footer');
      if (!footer) return null;
      var links = footer.querySelectorAll('a[rel*="me"]');
      if (!links.length) return null;
      var first = links[0].getBoundingClientRect();
      var last = links[links.length - 1].getBoundingClientRect();
      return {
        x: Math.max(0, first.x - 12),
        y: Math.max(0, first.y - 40),
        width: 420,
        height: (last.bottom - first.top) + 60
      };
    })()
  `);
  if (footerBox) {
    await page.screenshot({ path: 'qa/social-footer.png', clip: footerBox });
  }

  return { sidebarBox, footerBox };
}