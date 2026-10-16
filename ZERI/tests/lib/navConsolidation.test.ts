import { describe, expect, it } from 'vitest';
import { NAV_SECTIONS, groupVisible, moduleTabs, sidebarSections } from '../../src/components/admin/nav/navConfig';
import { canAccessSection } from '../../src/lib/adminPermissions';

const visibleFor = (role: string) => NAV_SECTIONS.filter(section => canAccessSection({ role }, section.id));

describe('superadmin navigation', () => {
  const visible = visibleFor('superadmin');
  const sidebar = sidebarSections(visible);
  const groups = groupVisible(sidebar);

  it('is organised in the five groups of the brief, in order', () => {
    expect(groups.map(group => group.label)).toEqual([
      'Përmbledhje', 'Shërbimet për qytetarët', 'Përmbajtja & komunikimi', 'Organizimi & operacionet', 'Sistemi & siguria',
    ]);
    expect(groups[0].items[0].id).toBe('dashboard');
    expect(groups[1].items.map(item => item.id)).toEqual(['health', 'debate']);
    expect(groups[2].items.map(item => item.id)).toEqual(['news', 'heritage', 'ads']);
    expect(groups[4].items.map(item => item.id)).toEqual(['security', 'settings']);
  });

  it('no longer lists the duplicate modules on their own line', () => {
    const ids = sidebar.map(section => section.id);
    for (const folded of ['users', 'forum', 'videos', 'monitorim', 'agentpanel', 'komunapanel', 'moderim', 'work', 'support', 'donations', 'polls', 'notifications', 'roles', 'workfacts', 'updates', 'categories']) expect(ids).not.toContain(folded);
  });

  it('keeps every folded module reachable from its parent tab strip (nothing orphaned)', () => {
    const reachable = new Set(sidebar.flatMap(section => [section.id, ...moduleTabs(section.id, visible).map(tab => tab.id)]));
    for (const section of visible) expect(reachable.has(section.id)).toBe(true);
    expect(moduleTabs('debate', visible).map(tab => tab.id)).toEqual(['debate', 'polls', 'forum', 'users', 'moderim']);
    expect(moduleTabs('forum', visible)[0].id).toBe('debate');
    expect(moduleTabs('reports', visible)).toEqual([]);
  });
});

describe('roles that cannot open the parent keep the module in their own sidebar', () => {
  it('a monitor still sees Monitorim i Plotë (no access to the operational parent)', () => {
    expect(sidebarSections(visibleFor('monitor')).map(section => section.id)).toContain('monitorim');
  });

  it('an agent still sees the debate moderation and its own panel', () => {
    const ids = sidebarSections(visibleFor('agent')).map(section => section.id);
    expect(ids).toContain('forum');
    expect(ids).toContain('agentpanel');
  });

  it('a news editor still sees videos only if the newsroom is not open to them, else as a newsroom tab', () => {
    const visible = visibleFor('newsadmin');
    const ids = sidebarSections(visible).map(section => section.id);
    expect(ids).toContain('news');
    expect(ids).not.toContain('videos');
    expect(moduleTabs('news', visible).map(tab => tab.id)).toEqual(['news', 'notifications', 'videos']);
  });
});
