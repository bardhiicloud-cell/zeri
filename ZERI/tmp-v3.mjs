export default async function run(page, ui) {
  const out = {};
  await page.goto('http://localhost:3000/');
  await page.waitForTimeout(2800);
  await page.getByRole('button', { name: /Refuzo jo-esencialet/i }).click().catch(() => { });
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /Shiko gjithë Kosovën/i }).click().catch(() => { });
  await page.waitForTimeout(2200);

  await page.screenshot({ path: 'C:/Users/Admin/Desktop/ZERI/qa3.png' });

  const boxes = await page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    const nav = document.querySelector('header nav');
    return {
      header: pick('header'),
      nav: pick('header nav'),
      navUl: nav ? Math.round(nav.querySelector('ul').getBoundingClientRect().width) : 0,
      navUlScroll: nav ? nav.scrollWidth : 0,
      search: pick('header nav + div'),
      sidebar: pick('aside'),
      main: pick('main'),
      docWidth: document.documentElement.scrollWidth,
      winWidth: window.innerWidth,
    };
  });
  return { ...out, boxes };
}
