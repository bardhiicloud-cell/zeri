/**
 * Measure the app shell geometry at desktop width.
 *
 * "The centre is blank but the sidebar and footer show" can only be diagnosed
 * from real boxes: which element has zero height or width, where the grid places
 * it, and whether the routed page is actually in the DOM. Reading the class
 * names is not enough — a `col-start-2` that lands in a second implicit row
 * looks correct in source and renders off-screen.
 */
export default async function run(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(page.url().replace(/#.*$/, '') + '#/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  return await page.evaluate(() => {
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        tag: el.tagName.toLowerCase(),
        cls: (el.className || '').toString().slice(0, 90),
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
        display: cs.display,
        gridColumn: cs.gridColumnStart + ' / ' + cs.gridColumnEnd,
        gridRow: cs.gridRowStart + ' / ' + cs.gridRowEnd,
        visibility: cs.visibility,
        opacity: cs.opacity,
        overflow: cs.overflow,
      };
    };

    const shell = document.querySelector('#root > div');
    const sidebar = document.querySelector('aside');
    const main = document.querySelector('main');
    const outletChild = main?.querySelector(':scope > div > *');
    const footer = document.querySelector('footer');

    // The routed page itself, skipping the ad banner and announcement strip.
    const inner = main?.firstElementChild;
    const kids = inner ? Array.from(inner.children).map((el) => ({
      tag: el.tagName.toLowerCase(),
      cls: (el.className || '').toString().slice(0, 70),
      h: Math.round(el.getBoundingClientRect().height),
      text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
    })) : [];

    return {
      shell: box(shell),
      shellGridTemplateColumns: shell ? getComputedStyle(shell).gridTemplateColumns : null,
      shellGridTemplateRows: shell ? getComputedStyle(shell).gridTemplateRows : null,
      sidebar: box(sidebar),
      main: box(main),
      outletChild: box(outletChild),
      footer: box(footer),
      mainChildren: kids,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      bodyScrollHeight: document.body.scrollHeight,
    };
  });
}