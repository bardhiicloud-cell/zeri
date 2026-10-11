export default async function run(page, ui) {
  const out = {};
  await page.goto('http://localhost:3000/');
  await page.waitForTimeout(2800);
  await page.getByRole('button', { name: /Refuzo jo-esencialet/i }).click().catch(() => {});
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /Shiko gjithë Kosovën/i }).click().catch(() => {});
  await page.waitForTimeout(2200);

  await page.screenshot({ path: 'C:/Users/Admin/Desktop/ZERI/qa-final.png' });

  const boxes = await page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { y: Math.round(r.y), h: Math.round(r.height), w: Math.round(r.width) };
    };
    const header = document.querySelector('header');
    const first = document.querySelector('main h1, main form, main header');
    return {
      header: pick('header'),
      sidebar: pick('aside'),
      main: pick('main'),
      // The gap is the distance from the bottom of the bar to the first content.
      gapBelowBar: first ? Math.round(first.getBoundingClientRect().top - (header?.getBoundingClientRect().bottom ?? 0)) : null,
      // Every nav link must be fully inside the bar, not clipped by overflow.
      headerScroll: header ? header.scrollWidth : null,
      headerClient: header ? header.clientWidth : null,
      navLinksClipped: [...document.querySelectorAll('header nav li')].filter((li) => {
        const a = li.querySelector('a,button');
        return a && a.scrollWidth > a.clientWidth + 1;
      }).map((li) => li.innerText.trim()),
    };
  });

  out.searchInputs = await page.locator('input[type=search]').count();
  out.searchTriggers = await page.getByRole('button', { name: /Kërko në platformë/ }).count();
  out.boxes = boxes;
  return out;
}
