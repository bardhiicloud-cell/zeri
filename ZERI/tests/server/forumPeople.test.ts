import { describe, expect, it } from 'vitest';
import { buildPeople, listAllowed, toUserLite, type UserLite } from '../../server/forumPeople';
import { DEFAULT_FORUM_PREFS } from '../../src/lib/forumPrefs';

const u = (id: string, following: string[] = [], extra: Partial<UserLite> = {}): UserLite => ({
  id, name: `Qytetar ${id}`, avatar: '', role: 'citizen', isBanned: false, followingIds: following, forumPrefs: DEFAULT_FORUM_PREFS, ...extra,
});

describe('toUserLite', () => {
  it('keeps only public, safe fields and normalises the rest', () => {
    const lite = toUserLite('a', { name: ' Arta  ', avatar: 'javascript:1', email: 'a@x.org', phone: '+383', followingIds: ['b', 7, 'c'], role: 'citizen' })!;
    expect(lite).toMatchObject({ id: 'a', name: 'Arta', avatar: '', followingIds: ['b', 'c'] });
    expect(JSON.stringify(lite)).not.toContain('a@x.org');
    expect(JSON.stringify(lite)).not.toContain('+383');
  });

  it('falls back for malformed documents', () => {
    expect(toUserLite('x', undefined)).toBeNull();
    expect(toUserLite('x', {})).toMatchObject({ name: 'Qytetar', followingIds: [], isBanned: false });
  });
});

describe('buildPeople', () => {
  const users = [u('me', ['a', 'b']), u('a', ['me']), u('b'), u('c', ['a', 'b']), u('d', ['a'])];

  it('counts followers per person from everyone\'s follow lists', () => {
    const { people } = buildPeople(users, 'me');
    const byId = Object.fromEntries(people.map((p) => [p.id, p]));
    expect(byId.a.followers).toBe(3); // me, c, d
    expect(byId.b.followers).toBe(2); // me, c
    expect(byId.me.followers).toBe(1); // a
  });

  it('reports my own numbers', () => {
    expect(buildPeople(users, 'me').me).toEqual({ followers: 1, following: 2 });
  });

  it('exposes only whether someone follows ME, never their real follow list', () => {
    const { people } = buildPeople(users, 'me');
    const byId = Object.fromEntries(people.map((p) => [p.id, p]));
    expect(byId.a.followingIds).toEqual(['me']);
    expect(byId.c.followingIds).toEqual([]); // c follows a and b, which must not leak
    expect(JSON.stringify(people)).not.toContain('"followingIds":["a"');
  });

  it('always includes me, the people I follow and those who follow me, even beyond the limit', () => {
    const many = [u('me', ['z1']), u('f1', ['me']), u('z1'), ...Array.from({ length: 30 }, (_, i) => u(`n${i}`, ['n0']))];
    const ids = buildPeople(many, 'me', { limit: 3 }).people.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['me', 'f1', 'z1']));
  });

  it('searches by name without accents and with a leading @, and drops banned, guests and blocked accounts', () => {
    const list = [u('me'), u('x1', [], { name: 'Çlirim Krasniqi' }), u('x2', [], { isBanned: true, name: 'Çlirim Banned' }), u('x3', [], { role: 'guest', name: 'Çlirim Guest' }), u('x4', [], { name: 'Çlirim Blocked' })];
    const found = buildPeople(list, 'me', { query: '@clirim', limit: 1, blocked: new Set(['x4']) }).people.map((p) => p.id);
    expect(found).toContain('x1');
    expect(found).not.toContain('x2');
    expect(found).not.toContain('x3');
    expect(found).not.toContain('x4');
  });

  it('ignores self-follows and duplicate entries when counting', () => {
    const { people } = buildPeople([u('me', ['me', 'a', 'a']), u('a')], 'me');
    expect(people.find((p) => p.id === 'me')!.followers).toBe(0);
    expect(people.find((p) => p.id === 'a')!.followers).toBe(1);
  });

  it('orders the rest by popularity', () => {
    const list = [u('me'), u('p1', ['p3']), u('p2', ['p3']), u('p3'), u('p4', ['p2'])];
    const ids = buildPeople(list, 'me', { limit: 2 }).people.map((p) => p.id);
    expect(ids.slice(0, 3)).toEqual(['me', 'p3', 'p2']);
  });
});

describe('listAllowed', () => {
  it('lets the owner always, others only when the lists are public', () => {
    const open = u('o');
    const closed = u('c', [], { forumPrefs: { ...DEFAULT_FORUM_PREFS, showFollowLists: false } });
    expect(listAllowed(open, 'viewer')).toBe(true);
    expect(listAllowed(closed, 'viewer')).toBe(false);
    expect(listAllowed(closed, 'c')).toBe(true);
    expect(listAllowed(undefined, 'viewer')).toBe(false);
  });
});
