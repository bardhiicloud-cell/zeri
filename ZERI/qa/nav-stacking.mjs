/**
 * Check sticky/fixed navigation behaviour against real geometry.
 *
 * Two questions that source cannot answer:
 *   1. Does the header actually stay pinned while the page scrolls?
 *   2. Does the mobile dock overlap page content, and by how much?
 *
 * Stacking is measured by walking the ancestors of each nav surface, because a
 * `z-40` on an element whose parent creates a stacking context loses to a `z-30`
 * in a higher context — the numbers in the class list do not decide the winner.
 */

const PROBE = `
(function (sel) {
  var el = document.querySelector(sel);
  if (!el) return null;
  var r = el.getBoundingClientRect();
  var cs = getComputedStyle(el);
  var contexts = [];
  var n = el.parentElement;
  while (n && n !== document.documentElement) {
    var s = getComputedStyle(n);
    var transformed = s.transform !== 'none' || s.filter !== 'none' || s.perspective !== 'none';
    var faded = s.opacity !== '1' && s.opacity !== '';
    if (transformed || faded) {
      contexts.push({
        tag: n.tagName.toLowerCase(),
        cls: (n.className || '').toString().slice(0, 60),
        transform: s.transform,
        opacity: s.opacity,
        zIndex: s.zIndex
      });
    }
    n = n.parentElement;
  }
  return {
    y: Math.round(r.y),
    h: Math.round(r.height),
    position: cs.position,
    top: cs.top,
    zIndex: cs.zIndex,
    ancestorContexts: contexts
  };
})
`;

export default async function run(page) {
  const probe = async (selector) => page.evaluate(PROBE + '(' + JSON.stringify(selector) + ')');

  const results = {};

  // --- Desktop: header must be sticky at top 0 ---
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(page.url().replace(/#.*$/, '') + '#/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);

  results.desktopTopNavAtRest = await probe('header');
  await page.evaluate('window.scrollTo(0, 1200)');
  await page.waitForTimeout(700);
  results.desktopTopNavAfterScroll = await probe('header');
  results.desktopScrollY = await page.evaluate('window.scrollY');

  // --- Mobile: dock must be pinned to the bottom, and content must clear it ---
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(page.url().replace(/#.*$/, '') + '#/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  results.mobileDock = await probe('nav[aria-label="Navigimi kryesor"]');
  results.mobileShellPaddingBottom = await page.evaluate(
    "getComputedStyle(document.querySelector('#root > div')).paddingBottom"
  );

  await page.evaluate('window.scrollTo(0, 2000)');
  await page.waitForTimeout(700);

  results.mobileDockAfterScroll = await probe('nav[aria-label="Navigimi kryesor"]');
  results.mobileScrollY = await page.evaluate('window.scrollY');

  // Is any page content sitting under the dock's band?
  results.contentUnderDock = await page.evaluate(`
    (function () {
      var dock = document.querySelector('nav[aria-label="Navigimi kryesor"]');
      if (!dock) return null;
      var d = dock.getBoundingClientRect();
      var hit = document.elementFromPoint(window.innerWidth / 2, d.top + 8);
      return {
        dockTop: Math.round(d.top),
        dockHeight: Math.round(d.height),
        elementAtDockTop: hit ? hit.tagName.toLowerCase() + '.' + (hit.className || '').toString().slice(0, 50) : null
      };
    })()
  `);

  return results;
}