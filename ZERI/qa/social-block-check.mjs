export default async function run(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(page.url().replace(/#.*$/, '') + '#/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  await page.evaluate("(function(){var b=Array.from(document.querySelectorAll('button'));var a=b.find(function(x){return /Prano t\\u00eb gjitha/i.test(x.textContent||'')});if(a)a.click();return !!a;})()");
  await page.waitForTimeout(6000);

  await page.evaluate("(function(){var b=Array.from(document.querySelectorAll('button'));var s=b.find(function(x){return /Kosov\\u00eb/i.test(x.textContent||'')&&!/Prano/i.test(x.textContent||'')});if(s)s.click();return !!s;})()");
  await page.waitForTimeout(4000);

  return await page.evaluate(`
    (function () {
      var heading = document.getElementById('social-follow-heading');
      if (!heading) return { found: false, bodyLen: document.body.innerText.length };
      var section = heading.closest('section');
      var links = Array.from(section.querySelectorAll('a[rel*="me"]'));

      var items = links.map(function (a) {
        var svg = a.querySelector('svg');
        var path = svg ? svg.querySelector('path') : null;
        var box = a.getBoundingClientRect();
        return {
          label: a.getAttribute('aria-label'),
          href: a.getAttribute('href'),
          target: a.getAttribute('target'),
          rel: a.getAttribute('rel'),
          pathLen: path ? (path.getAttribute('d') || '').length : 0,
          w: Math.round(box.width),
          h: Math.round(box.height)
        };
      });

      var rect = section.getBoundingClientRect();

      return {
        found: true,
        heading: (heading.textContent || '').trim(),
        linkCount: items.length,
        labels: items.map(function (i) { return i.label; }),
        allValidPaths: items.every(function (i) { return i.pathLen > 40; }),
        allBlankSafe: items.every(function (i) { return i.target === '_blank' && /noopener/.test(i.rel || ''); }),
        allSized: items.every(function (i) { return i.w > 0 && i.h > 0; }),
        y: Math.round(rect.y + window.scrollY),
        height: Math.round(rect.height),
        items: items
      };
    })()
  `);
}