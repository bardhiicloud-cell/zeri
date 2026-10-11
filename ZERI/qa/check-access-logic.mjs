// QA: does the access logic actually grant each role the right panels?
//
// Testing this through a browser requires a real Firebase session, and the
// headless browser has no network path to identitytoolkit - so a forged
// localStorage session is overwritten and every route correctly shows "no
// access". That proves the guard works but says nothing about the grants.
//
// So this exercises the guard logic directly, in the page, against the real
// modules. It is the same code the components run; only the rendering is
// skipped.

export default async function run(page) {
  await page.goto('http://localhost:3002/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  return await page.evaluate(async function () {
    // Load the real modules the panels import, through Vite's dev server.
    const perms = await import('/src/lib/adminPermissions.ts');
    const modCenter = await import('/src/lib/moderationCenter.ts');

    const cases = [
      { label: 'guest', user: { id: 'g', name: 'Guest', email: 'g@x.com', role: 'guest' } },
      { label: 'citizen', user: { id: 'c', name: 'Citizen', email: 'c@x.com', role: 'citizen' } },
      { label: 'agent (no grants)', user: { id: 'a', name: 'Agent', email: 'a@x.com', role: 'agent' } },
      {
        label: 'agent + monitorim grant',
        user: { id: 'a2', name: 'Agent2', email: 'a2@x.com', role: 'agent', permissions: ['monitorim'] },
      },
      {
        label: 'agent + agents grant',
        user: { id: 'a3', name: 'Agent3', email: 'a3@x.com', role: 'agent', permissions: ['agents'] },
      },
      {
        label: 'agent + municipalities grant',
        user: { id: 'a4', name: 'Agent4', email: 'a4@x.com', role: 'agent', permissions: ['municipalities'] },
      },
      { label: 'admin', user: { id: 'ad', name: 'Admin', email: 'ad@x.com', role: 'admin' } },
      { label: 'superadmin', user: { id: 'sa', name: 'Super', email: 'sa@x.com', role: 'superadmin' } },
    ];

    const results = {};

    for (const c of cases) {
      const u = c.user;
      const hasGrant = function (name) {
        return (u.permissions || []).indexOf(name) !== -1;
      };

      results[c.label] = {
        // /monitorim guard: the exact expression MonitoringPage.tsx uses.
        monitorim:
          modCenter.isModerationCenterUser(u) ||
          hasGrant('monitorim') ||
          hasGrant('monitoring'),
        // /agent guard.
        agent:
          ['agent', 'responder', 'dispatcher', 'moderator', 'admin', 'superadmin'].indexOf(u.role) !== -1 ||
          hasGrant('agents'),
        // /komuna guard (role-based arm; municipality needs its own scope too).
        komuna:
          u.role === 'municipality' ||
          u.role === 'admin' ||
          u.role === 'superadmin' ||
          hasGrant('municipalities'),
        // Admin sidebar visibility for the three new sections.
        navMonitorim: perms.canAccessSection(u, 'monitorim'),
        navAgentPanel: perms.canAccessSection(u, 'agentpanel'),
        navKomunaPanel: perms.canAccessSection(u, 'komunapanel'),
        navModeration: perms.canAccessSection(u, 'monitoring'),
      };
    }

    return results;
  });
}
