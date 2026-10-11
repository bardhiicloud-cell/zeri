/**
 * Diagnose the desktop sticky header and the mobile dock precisely.
 *
 * The cookie consent sheet covers the whole viewport on first visit, which made
 * every mobile measurement read zero. It is accepted first so the dock is
 * actually on screen when measured.
 *
 * The header question is specifically: how tall is the element `position: sticky`
 * is resolved against? Sticky travels only inside its containing block, so a
 * parent exactly as tall as the header can never pin.
 */

const PROBE = `
(function (sel) {
  var el = document.querySelector(sel);
  if (!el) return null;
  var r = el.getBoundingClientRect();
  var cs = getComputedStyle(el);
  var p = el.parentElement;
  var pr = p ? p.getBoundingClientRect() : null;
  return {
    y: Math.round(r.y),
    h: Math.round(r.height),
    position: cs.position,
    zIndex: cs.zIndex,
    parentCls: p ? (p.className || '').toString().slice(0, 80) : null,
    parentH: pr ? Math.round(pr.height) : null,
    parentY: pr ? Math.round(pr.y) : null,
    parentDisplay: p ? getComputedStyle(p).display : null,
    parentAlignSelf: p ? getComputedStyle(p).alignSelf : null,
    parentGridRow: p ? getComputedStyle(p).gridRowStart + '/' + getComputedStyle(p).gridRowEnd : null
  };
})
`;

export default async function run(page) {
  const probe = async (selector) => page.evaluate(PROBE + '(' + JSON.stringify(selector) + ')');
  const out = {};

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(page.url().replace(/#.*$/, '') + '#/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  // Accept the cookie banner so it stops covering the page.
  await page.evaluate(`
    (function () {
      var btns = Array.from(document.querySelectorAll('button'));
      var accept = btns.find(function (b) { return /prano|accept|pranoji|të gjitha/i.test(b.textContent || ''); });
      if (accept) accept.click();
      return !!accept;
    })()
  `);
  await page.waitForTimeout(1200);

  const shellRows = await page.evaluate(
    "getComputedStyle(document.querySelector('#root > div')).gridTemplateRows"
  );
  out.shellGridRows = shellRows;

  out.headerAtRest = await probe('header');
  await page.evaluate('window.scrollTo(0, 1400)');
  await page.waitForTimeout(800);
  out.headerAfterScroll = await probe('header');
  out.scrollY = await page.evaluate('window.scrollY');

  out.mainAtRest = await probe('main');
  out.sidebarAtRest = await probe('aside');

  // --- Mobile, with the consent sheet dismissed ---
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(page.url().replace(/#.*$/, '') + '#/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);
  await page.evaluate(`
    (function () {
      var btns = Array.from(document.querySelectorAll('button'));
      var accept = btns.find(function (b) { return /prano|accept|pranoji|të gjitha/i.test(b.textContent || ''); });
      if (accept) accept.click();
      return !!accept;
    })()
  `);
  await page.waitForTimeout(1500);

  // Close any open modal/sheet so the dock is measured unobstructed. An open
  // overlay covers the dock and every geometry read comes back as zero.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  await page.evaluate(`
    (function () {
      var close = Array.from(document.querySelectorAll('button'))
        .find(function (b) { return /mbyll|close/i.test(b.getAttribute('aria-label') || ''); });
      if (close) close.click();
      return !!close;
    })()
  `);
  await page.waitForTimeout(900);

  out.mobileDock = await probe('nav[aria-label="Navigimi kryesor"]');
  out.mobileShellPaddingBottom = await page.evaluate(
    "getComputedStyle(document.querySelector('#root > div')).paddingBottom"
  );

  await page.evaluate('window.scrollTo(0, 2200)');
  await page.waitForTimeout(800);
  out.mobileDockAfterScroll = await probe('nav[aria-label="Navigimi kryesor"]');
  out.mobileScrollY = await page.evaluate('window.scrollY');

  out.contentUnderDock = await page.evaluate(`
    (function () {
      var dock = document.querySelector('nav[aria-label="Navigimi kryesor"]');
      if (!dock) return null;
      var d = dock.getBoundingClientRect();
      var hit = document.elementFromPoint(window.innerWidth / 2, d.top + 6);
      return {
        dockTop: Math.round(d.top),
        dockBottom: Math.round(d.bottom),
        dockHeight: Math.round(d.height),
        viewportH: window.innerHeight,
        elementAtDockTop: hit ? hit.tagName.toLowerCase() + '.' + (hit.className || '').toString().slice(0, 45) : null
      };
    })()
  `);

  return out;
}