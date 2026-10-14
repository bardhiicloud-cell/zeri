import { describe, expect, it } from 'vitest';
import { KOSOVO_MUNICIPALITIES } from '../../src/lib/constants';
import { REPORT_TOPICS } from '../../src/lib/reportTopics';
import { CENTRAL_BODIES, MUNICIPAL_CONTACTS, isSendable } from '../../src/data/institutionContacts';
import { TOPIC_ROUTES, groupByRecipient, resolveResponsible } from '../../src/lib/responsibility';

describe('contact registry', () => {
  it('has an entry for every one of the 38 municipalities and no stray ones', () => {
    expect(Object.keys(MUNICIPAL_CONTACTS).sort()).toEqual([...KOSOVO_MUNICIPALITIES].sort());
  });

  it('never stores an address that is a template value', () => {
    for (const [name, contact] of Object.entries(MUNICIPAL_CONTACTS)) {
      expect(contact.email ?? '', name).not.toMatch(/email@email\.com|kontakto@kontakto/i);
    }
  });

  it('only marks a general or role address on an institutional domain as sendable', () => {
    for (const [name, contact] of Object.entries(MUNICIPAL_CONTACTS)) {
      if (contact.email && isSendable(contact.status)) expect(contact.email, name).toMatch(/@rks-gov\.net$/i);
      if (!contact.email) expect(contact.status, name).toMatch(/missing|placeholder/);
    }
  });

  it('keeps a personal or free-mail address out of automatic sends', () => {
    expect(isSendable('personal')).toBe(false);
    expect(isSendable('external')).toBe(false);
    expect(isSendable('placeholder')).toBe(false);
    expect(isSendable('missing')).toBe(false);
  });
});

describe('topic routing', () => {
  it('routes every report topic and points each at a known central body', () => {
    expect(Object.keys(TOPIC_ROUTES).sort()).toEqual(REPORT_TOPICS.map(topic => topic.id).sort());
    for (const route of Object.values(TOPIC_ROUTES)) expect(CENTRAL_BODIES[route.central]).toBeDefined();
  });
});

describe('resolveResponsible', () => {
  it('sends an urban infrastructure report to the municipality', () => {
    const result = resolveResponsible({ topicId: 'infrastrukture', municipality: 'Prishtinë', zone: 'urban' });
    expect(result.primary.level).toBe('municipal');
    expect(result.primary.name).toBe('Komuna Prishtinë');
    expect(result.primary.office).toBe('Drejtoria e Infrastrukturës');
    expect(result.primary.email).toBe('komunaprishtine@rks-gov.net');
    expect(result.primary.sendable).toBe(true);
    expect(result.needsZone).toBe(false);
    expect(result.secondary.level).toBe('central');
  });

  it('sends the same report to the state when it is outside the urban area', () => {
    const result = resolveResponsible({ topicId: 'rruge', municipality: 'Prishtinë', zone: 'rural' });
    expect(result.primary.level).toBe('central');
    expect(result.primary.name).toMatch(/Infrastrukturës/);
    expect(result.secondary.level).toBe('municipal');
  });

  it('asks for the zone when a zone topic has none, and falls back to the municipality', () => {
    const result = resolveResponsible({ topicId: 'mjedis', municipality: 'Pejë' });
    expect(result.needsZone).toBe(true);
    expect(result.primary.level).toBe('municipal');
  });

  it('ignores the zone for topics that are always municipal or always central', () => {
    expect(resolveResponsible({ topicId: 'arsim', municipality: 'Gjilan', zone: 'rural' }).primary.level).toBe('municipal');
    expect(resolveResponsible({ topicId: 'tatime-dogana', municipality: 'Gjilan', zone: 'urban' }).primary.level).toBe('central');
    expect(resolveResponsible({ topicId: 'arsim', municipality: 'Gjilan' }).needsZone).toBe(false);
  });

  it('does not offer a send address for a municipality whose site printed none', () => {
    const result = resolveResponsible({ topicId: 'arsim', municipality: 'Prizren' });
    expect(result.primary.email).toBeNull();
    expect(result.primary.sendable).toBe(false);
  });

  it('does not offer a personal address as sendable', () => {
    const result = resolveResponsible({ topicId: 'arsim', municipality: 'Kaçanik' });
    expect(result.primary.email).toBeTruthy();
    expect(result.primary.sendable).toBe(false);
  });

  it('routes an unknown or legacy category to the municipality', () => {
    const result = resolveResponsible({ topicId: 'legacy:Të tjera', municipality: 'Ferizaj' });
    expect(result.primary.level).toBe('municipal');
    expect(result.needsZone).toBe(false);
  });
});

describe('groupByRecipient', () => {
  it('makes one group per recipient, largest first, and counts the reports that still need a zone', () => {
    const reports = [
      { id: 'a', topicId: 'rruge', municipality: 'Prishtinë', zone: 'urban' as const },
      { id: 'b', topicId: 'rruge', municipality: 'Prishtinë', zone: 'urban' as const },
      { id: 'c', topicId: 'rruge', municipality: 'Prishtinë', zone: 'rural' as const },
      { id: 'd', topicId: 'mjedis', municipality: 'Prishtinë' },
    ];
    const groups = groupByRecipient(reports, report => resolveResponsible(report));
    expect(groups.map(group => group.items.length)).toEqual([2, 1, 1]);
    expect(groups[0].recipient.level).toBe('municipal');
    expect(groups.some(group => group.recipient.level === 'central' && group.items[0].id === 'c')).toBe(true);
    expect(groups.reduce((sum, group) => sum + group.needsZone, 0)).toBe(1);
  });
});
