import { describe, expect, it } from 'vitest';
import { CONSOLES, consoleFor, consolePathsFor, homeForRole, viewerFor } from '../../src/lib/roleHome';

describe('homeForRole', () => {
  it('sends each kind of account to its own place', () => {
    expect(homeForRole('superadmin')).toBe('/admin');
    expect(homeForRole('admin')).toBe('/admin');
    expect(homeForRole('municipality')).toBe('/komuna');
    expect(homeForRole('monitor')).toBe('/menagjer');
  });

  it('sends everyone who works through grants to /agent', () => {
    for (const role of ['agent', 'responder', 'dispatcher', 'moderator', 'approver', 'newsadmin', 'adsadmin']) {
      expect(homeForRole(role), role).toBe('/agent');
    }
  });

  it('keeps citizens, guests and unknown roles on the public site', () => {
    for (const role of ['citizen', 'guest', '', null, undefined, 'hacker']) {
      expect(homeForRole(role as string), String(role)).toBe('/');
    }
  });
});

describe('consolePathsFor', () => {
  it('lets the owner open every console, including a municipality', () => {
    for (const role of ['superadmin', 'admin']) {
      expect(consolePathsFor(role), role).toEqual(['/admin', '/agent', '/menagjer', '/komuna', '/debatwp']);
    }
  });

  it('keeps everyone else on their own home only', () => {
    expect(consolePathsFor('agent')).toEqual(['/agent']);
    expect(consolePathsFor('monitor')).toEqual(['/menagjer']);
    expect(consolePathsFor('municipality')).toEqual(['/komuna']);
  });

  it('opens nothing for citizens and guests', () => {
    expect(consolePathsFor('citizen')).toEqual([]);
    expect(consolePathsFor(undefined)).toEqual([]);
  });
});

describe('consoleFor', () => {
  it('maps a role to the console shell it uses', () => {
    expect(consoleFor('superadmin')).toBe('admin');
    expect(consoleFor('agent')).toBe('agent');
    expect(consoleFor('monitor')).toBe('manager');
  });

  it('has no shell for a municipality (its own page) or a citizen', () => {
    expect(consoleFor('municipality')).toBeNull();
    expect(consoleFor('citizen')).toBeNull();
  });

  it('gives every console a landing section', () => {
    expect(CONSOLES.admin.landing).toBe('dashboard');
    expect(CONSOLES.agent.landing).toBe('inbox');
    expect(CONSOLES.manager.landing).toBe('monitorim');
  });
});

describe('viewerFor', () => {
  const owner = { role: 'superadmin', email: 'o@z.test', permissions: ['users'] };

  it('shows an owner the menu of a plain agent or manager when they open that place', () => {
    expect(viewerFor('agent', owner)).toEqual({ viewer: { role: 'agent', permissions: [] }, previewing: true });
    expect(viewerFor('manager', owner)).toEqual({ viewer: { role: 'monitor', permissions: [] }, previewing: true });
  });

  it('leaves the owner as themselves in their own place', () => {
    expect(viewerFor('admin', owner)).toEqual({ viewer: owner, previewing: false });
  });

  it('never changes anyone else\'s menu, whatever the address', () => {
    const agent = { role: 'agent', permissions: ['donations'] };
    expect(viewerFor('admin', agent)).toEqual({ viewer: agent, previewing: false });
    expect(viewerFor('manager', agent)).toEqual({ viewer: agent, previewing: false });
  });
});
