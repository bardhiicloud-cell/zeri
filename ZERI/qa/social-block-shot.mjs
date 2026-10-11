export default async function run(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(page.url().replace(/#.*$/, '') + '#/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  await page.evaluate("(function(){var b=Array.from(document.querySelectorAll('button'));var a=b.find(function(x){return /Prano t\\u00eb gjitha/i.test(x.textContent||'')});if(a)a.click();return !!a;})()");
  await page.waitForTimeout(6000);
  await page.evaluate("(function(){var b=Array.from(document.querySelectorAll('button'));var s=b.find(function(x){return /Kosov\\u00eb/i.test(x.textContent||'')&&!/Prano/i.test(x.textContent||'')});if(s)s.click();return !!s;})()");
  await page.waitForTimeout(4000);

  const box = await page.evaluate(`
    (function () {
      var h = document.getElementById('social-follow-heading');
      if (!h) return null;
      var s = h.closest('section');
      var r = s.getBoundingClientRect();
      s.scrollIntoView({ block: 'center' });
      return { ok: true };
    })()
  `);
  await page.waitForTimeout(1200);

  const clip = await page.evaluate(`
    (function () {
      var h = document.getElementById('social-follow-heading');
      if (!h) return null;
      var s = h.closest('section');
      var r = s.getBoundingClientRect();
      return { x: Math.max(0, r.x - 8), y: Math.max(0, r.y - 8), width: r.width + 16, height: r.height + 16 };
    })()
  `);

  if (clip) await page.screenshot({ path: 'qa/social-block.png', clip });
  return { scrolled: box, clip };
}