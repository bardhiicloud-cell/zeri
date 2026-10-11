/**
 * QA: do the role panels render their real content for an authorized user?
 *
 * The guest run only proves the guard works — every route says "Akses i
 * kufizuar". This run forges the persisted session the app itself reads, so the
 * panels render their actual content and any crash inside them surfaces.
 */
export default async function run(page) {
  const users = {
    agent: {
      id: 'qa-agent-1',
      name: 'Agim Selimi',
      email: 'agim@ks.com',
      role: 'agent',
      municipality: 'Prishtinë',
      points: 0,
      badges: [],
    },
    municipality: {
      id: 'qa-muni-1',
      name: 'Zyra e Prishtinës',
      email: 'zyra@prishtina.ks',
      role: 'municipality',
      municipality: 'Prishtinë',
      municipalityPlan: 'pro',
      points: 0,
      badges: [],
    },
    superadmin: {
      id: 'qa-super-1',
      name: 'Super Admin',
      email: 'super@ks.com',
      role: 'superadmin',
      points: 0,
      badges: [],
    },
  };

  const results = {};

  for (const [label, user] of Object.entries(users)) {
    const route = label === 'agent' ? '/agent' : label === 'municipality' ? '/komuna' : '/moderim';

    await page.goto('http://localhost:3002/', { waitUntil: 'domcontentloaded' });
    await page.evaluate((u) => {
      // The app's own keys: the age gate reads AGE_VERIFICATION_KEY ('passed')
      // and zustand/persist stores the session under its own name.
      localStorage.setItem('zeri_age_verified_v1', 'passed');
      localStorage.setItem('zeri_cookie_consent_decided', 'true');
      const KEY = 'civic-platform-storage-v3';
      const existing = JSON.parse(localStorage.getItem(KEY) || '{}');
      existing.state = { ...(existing.state || {}), currentUser: u, userMunicipality: u.municipality || 'Të gjitha Komunat' };
      existing.version = existing.version ?? 0;
      localStorage.setItem(KEY, JSON.stringify(existing));
    }, user);

    await page.goto(`http://localhost:3002${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Belt and braces: if the cookie banner still mounted, remove the overlay
    // rather than let it mask what the panel rendered underneath.
    await page.evaluate(() => {
      document.querySelectorAll('[aria-modal="true"]').forEach((el) => { el.style.display = 'none'; });
    });

    results[`${label} → ${route}`] = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        h1: document.querySelector('h1')?.innerText ?? null,
        chars: text.length,
        gated: text.includes('Akses i kufizuar') || text.includes('Vetëm Super Admin'),
        sample: text.replace(/\s+/g, ' ').slice(0, 220),
      };
    });
  }

  return results;
}
