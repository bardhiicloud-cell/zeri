// Verifies the left sidebar stays pinned to the viewport while the page scrolls,
// on every page that renders it — and that the debate page still does not have
// one (it owns a fixed-height shell of its own).
export default async function run(page, ui) {
  const out = {};

  const prep = async () => {
    await page.evaluate(() => {
      try {
        localStorage.setItem('theme', 'light');
        localStorage.setItem('zeri_cookie_consent_v1', JSON.stringify({
          version: 1, essential: true, analytics: false, marketing: false,
          decidedAt: new Date().toISOString(),
        }));
      } catch { /* storage unavailable */ }
    });
  };

  // A desktop viewport, where the sidebar is actually rendered.
  await page.setViewportSize({ width: 1440, height: 900 });

  const measureOn = async (hash, label) => {
    await page.goto(`http://localhost:3001/${hash}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3200);

    const before = await page.evaluate(() => {
      const aside = document.querySelector('aside');
      const doc = document.documentElement;
      return {
        sidebarPresent: !!aside,
        ifPresentRect: aside ? Math.round(aside.getBoundingClientRect().top) : null,
        scrollHeight: doc.scrollHeight,
        clientHeight: doc.clientHeight,
      };
    });

    // Scroll a long way down, then measure again.
    await page.evaluate(() => window.scrollTo(0, 1400));
    await page.waitForTimeout(900);

    const after = await page.evaluate(() => {
      const aside = document.querySelector('aside');
      return {
        rectTop: aside ? Math.round(aside.getBoundingClientRect().top) : null,
        rectBottom: aside ? Math.round(aside.getBoundingClientRect().bottom) : null,
        scrollY: Math.round(window.scrollY),
        position: aside ? getComputedStyle(aside).position : null,
        alignSelf: aside ? getComputedStyle(aside).alignSelf : null,
      };
    });

    return { label, ...before, afterScroll: after, stayedPinned: before.ifPresentRect !== null && after.rectTop !== null && Math.abs(after.rectTop - before.ifPresentRect) < 40 };
  };

  await prep();

  // Pages that DO render the sidebar.
  out.dashboard = await measureOn('', 'dashboard');
  out.statistics = await measureOn('#/statistikat', 'statistikat');
  out.registry = await measureOn('#/detailed-registry', 'regjistri');
  out.news = await measureOn('#/lajme', 'lajmet');

  // The debate page must NOT have the sidebar.
  out.forum = await measureOn('#/forum', 'forum');

  return out;
}
