/**
 * Report the rendered geometry of every visible image on the news page.
 *
 * The redesign's goal is a uniform card ratio, so this returns width, height
 * and the aspect ratio for each image instead of a pass/fail, which makes an
 * outlier obvious at a glance.
 */
export default async function run(page) {
  await page.waitForTimeout(7000);
  const imgs = await page.evaluate(() =>
    [...document.querySelectorAll('img')]
      .filter((i) => i.getBoundingClientRect().width > 40)
      .map((i) => {
        const b = i.getBoundingClientRect();
        return {
          src: (i.currentSrc || i.src || '').split('/').pop().slice(0, 30),
          w: Math.round(b.width),
          h: Math.round(b.height),
          r: Math.round((b.width / b.height) * 100) / 100,
          fit: getComputedStyle(i).objectFit,
        };
      })
  );

  const ratios = [...new Set(imgs.map((i) => i.r))];
  const distinct = ratios.length;

  return {
    imageCount: imgs.length,
    distinctRatios: distinct,
    ratios,
    uniform: distinct <= 3,
    perImage: imgs.slice(0, 12),
    cardRatios: imgs.filter((i) => i.w < 400).map((i) => i.r),
  };
}
