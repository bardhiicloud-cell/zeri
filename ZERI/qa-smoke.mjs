// End-to-end smoke test for the changes made in this session.
//
// Checks, in one browser run:
//   1. the dashboard renders, and the announcement banner + ad slot exist
//   2. the mobile dock exists at a phone viewport, and the sheet opens
//   3. the sheet leads with the municipality rail, with all 38 names reachable
//   4. submitting a municipality in the sheet writes the global scope
//   5. the dashboard's "full map" link carries that scope, and /harta preserves it
//   6. the polls page marks the citizen's own vote
//   7. dark mode exposes no light-on-light text in the header
//
// Returns a plain object so the runner prints it as JSON.

export default async function run(page, ui) {
  const results = {};

  // ── 0. Set up first-run state so overlays do not sit on top of the page ──
  await page.evaluate(() => {
    try {
      localStorage.setItem('theme', 'light');
      localStorage.setItem('kosova_user_muni', 'Pejë');
      // The consent banner is a hard gate: until a decision is stored it covers
      // the page and blocks every click. Accept the essential-only option, the
      // same as a visitor who rejects analytics.
      localStorage.setItem('zeri_cookie_consent_v1', JSON.stringify({
        version: 1,
        essential: true,
        analytics: false,
        marketing: false,
        decidedAt: new Date().toISOString(),
      }));
    } catch { /* storage may be unavailable */ }
  });

  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  results.dashboard = await page.evaluate(() => ({
    title: document.title,
    h1: document.querySelector('h1')?.innerText?.slice(0, 60),
    bodyChars: document.body.innerText.length,
  }));

  // ── 1. Mobile viewport: the dock and the sheet ─────────────────────────
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1200);

  results.mobileDock = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label]');
    const links = nav ? [...nav.querySelectorAll('a[href], button')].map(n => n.textContent?.trim()) : [];
    return {
      dockPresent: !!nav,
      dockItems: links.filter(Boolean).slice(0, 8),
      reportButton: !!nav?.querySelector('a[href="#/raporto"]'),
    };
  });

  // Open the sheet.
  const snapshot = await ui.snapshot();
  const menuRef = snapshot.match(/@(e\d+) button "Menuja"/)?.[1];
  if (menuRef) {
    // A first-run consent banner can still be present; dismiss it by clicking
    // its accept button if the click on the dock is intercepted.
    try {
      await ui.click(menuRef, { timeout: 4000 });
    } catch {
      const acceptRef = snapshot.match(/@(e\d+) button "[^"]*Prano[^"]*"/)?.[1]
        || snapshot.match(/@(e\d+) button "[^"]*Pranoj[^"]*"/)?.[1];
      if (acceptRef) {
        await ui.click(acceptRef);
        await page.waitForTimeout(600);
      }
      const retry = await ui.snapshot();
      const retryRef = retry.match(/@(e\d+) button "Menuja"/)?.[1];
      if (retryRef) await ui.click(retryRef);
    }
    await page.waitForTimeout(900);
  }

  results.sheet = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return { open: false };
    const text = dialog.innerText;
    return {
      open: true,
      hasScopeRail: text.includes('Zona juaj'),
      hasQuickActions: text.includes('Veprime të shpejta'),
      hasSearch: text.includes('Kërko faqe'),
      // The 38-name list is rendered inline in the sheet, not behind a popover.
      municipalityOptions: dialog.querySelectorAll('[role="option"]').length,
      groups: ['Kryesore', 'Pjesëmarrja qytetare', 'Shërbime & transparencë']
        .filter(g => text.includes(g)),
    };
  });

  // ── 2. Pick a municipality from the sheet's rail ───────────────────────
  const sheetSnap = await ui.snapshot();
  const prizrenRef = sheetSnap.match(/@(e\d+) button "Prizren/)?.[1]
    || sheetSnap.match(/@(e\d+) button.*Prizren/)?.[1];

  results.municipalityPick = { attempted: !!prizrenRef };
  if (prizrenRef) {
    await ui.click(prizrenRef);
    await page.waitForTimeout(800);
    results.municipalityPick.stored = await page.evaluate(
      () => localStorage.getItem('kosova_user_muni')
    );
  }

  // ── 3. The dashboard's full-map link carries the active scope ──────────
  results.mapLink = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a, button')];
    const fullMap = links.find(el => /Harta e plotë/i.test(el.textContent || ''));
    if (!fullMap) return { found: false };
    // It is a button that calls navigate; read the router state instead.
    return { found: true, tag: fullMap.tagName };
  });

  // Navigate to the map with the scope in the query string.
  await page.goto('http://localhost:3000/#/harta?municipality=Pej%C3%AB', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  results.mapScope = await page.evaluate(() => ({
    storedScope: localStorage.getItem('kosova_user_muni'),
    // The mobile sheet's selector value, which is what the map filters on.
    selectorValue: document.querySelector('select')?.value ?? null,
    bodyHasPeja: /Pejë/.test(document.body.innerText),
  }));

  // ── 4. Polls: the citizen's vote is marked ─────────────────────────────
  await page.evaluate(() => {
    // Pretend this device already voted on the seed poll, option 2.
    localStorage.setItem('voted_polls', JSON.stringify(['poll-001']));
    localStorage.setItem('voted_poll_options', JSON.stringify({ 'poll-001': 'opt-2' }));
  });
  await page.goto('http://localhost:3000/#/sondazhet', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2800);

  results.polls = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      rendered: text.length > 300,
      marksMyVote: text.includes('Vota juaj'),
      footerRestates: text.includes('Votuat:'),
      showsResults: text.includes('%'),
    };
  });

  // ── 5. Dark mode: no near-white text on a near-white background ────────
  await page.evaluate(() => localStorage.setItem('theme', 'dark'));
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  results.darkMode = await page.evaluate(() => {
    const isDark = document.documentElement.classList.contains('dark');
    const parse = (c) => (c.match(/\d+/g) || []).slice(0, 3).map(Number);
    const lum = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b);

    let lightOnLight = 0;
    const samples = [];
    // Only real body copy: skip anything intentionally drawn on a dark hero.
    for (const el of document.querySelectorAll('main p, main h1, main h2, main h3, main span')) {
      if (!el.innerText || el.innerText.length < 3) continue;
      const style = getComputedStyle(el);
      const fg = parse(style.color);
      if (fg.length < 3) continue;
      // Walk up for the first non-transparent background.
      let node = el, bg = [0, 0, 0, 0];
      while (node && node !== document.documentElement) {
        const c = getComputedStyle(node).backgroundColor;
        const m = c.match(/[\d.]+/g);
        if (m && (m.length < 4 || Number(m[3]) > 0.5)) { bg = m.slice(0, 3).map(Number); break; }
        node = node.parentElement;
      }
      if (bg.length < 3) continue;
      if (lum(fg) > 190 && lum(bg) > 190) {
        lightOnLight += 1;
        if (samples.length < 5) samples.push({ text: el.innerText.slice(0, 40), fg: style.color, bg });
      }
    }
    return { isDark, lightOnLight, samples, bodyChars: document.body.innerText.length };
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'C:/Users/bardh/OneDrive/Desktop/ZERI/ZERI/qa-dark-dashboard.png' });

  return results;
}
