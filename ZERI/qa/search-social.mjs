/**
 * Verify the social icons flank the search field, two either side.
 *
 * The order and side are the whole point of the change, so this reads the DOM
 * order relative to the input rather than just counting links: a row of four
 * icons that all ended up on one side would still "have four links".
 *
 * `compareDocumentPosition` is used because the input is a sibling, not a parent,
 * so an ancestor walk cannot answer "is this before or after the field".
 */
export default async function run(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(page.url().replace(/#.*$/, '') + '#/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  // Answer both first-visit gates so nothing covers the palette.
  await page.evaluate("(function(){var b=Array.from(document.querySelectorAll('button'));var a=b.find(function(x){return /Prano t\\u00eb gjitha/i.test(x.textContent||'')});if(a)a.click();return !!a;})()");
  await page.waitForTimeout(6000);
  await page.evaluate("(function(){var b=Array.from(document.querySelectorAll('button'));var s=b.find(function(x){return /Kosov\\u00eb/i.test(x.textContent||'')&&!/Prano/i.test(x.textContent||'')});if(s)s.click();return !!s;})()");
  await page.waitForTimeout(3500);

  // Open the palette with the keyboard shortcut the app registers.
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(1500);

  const result = await page.evaluate(`
    (function () {
      var input = document.querySelector('input[role="combobox"]');
      if (!input) return { error: 'palette did not open' };

      var row = input.parentElement;
      var links = Array.from(row.querySelectorAll('a[rel*="me"]'));

      var sides = links.map(function (a) {
        var before = a.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING;
        var box = a.getBoundingClientRect();
        return {
          label: a.getAttribute('aria-label'),
          href: a.getAttribute('href'),
          side: before ? 'left' : 'right',
          x: Math.round(box.x),
          visible: box.width > 0 && box.height > 0,
          pathLen: (function () { var p = a.querySelector('path'); return p ? (p.getAttribute('d') || '').length : 0; })()
        };
      });

      var inputBox = input.getBoundingClientRect();

      return {
        total: links.length,
        left: sides.filter(function (s) { return s.side === 'left'; }).map(function (s) { return s.label; }),
        right: sides.filter(function (s) { return s.side === 'right'; }).map(function (s) { return s.label; }),
        allVisible: sides.every(function (s) { return s.visible; }),
        pathsValid: sides.every(function (s) { return s.pathLen > 40; }),
        inputCentre: Math.round(inputBox.x + inputBox.width / 2),
        sides: sides
      };
    })()
  `);

  const box = await page.evaluate(`
    (function () {
      var input = document.querySelector('input[role="combobox"]');
      if (!input) return null;
      var r = input.parentElement.getBoundingClientRect();
      return { x: Math.max(0, r.x - 6), y: Math.max(0, r.y - 6), width: r.width + 12, height: r.height + 12 };
    })()
  `);
  if (box) await page.screenshot({ path: 'qa/search-social.png', clip: box });

  return result;
}