import { describe, expect, it } from 'vitest';
import { REPORT_TOPICS } from '../../src/lib/reportTopics';
import { KOSOVO_MUNICIPALITIES, MUNICIPALITY_COORDINATES } from '../../src/lib/constants';
import { getAccountabilityProfile } from '../../src/lib/accountability';
import { SECTOR_CATALOG, checkLocation, nearestMunicipality, sectorLabel, suggestSectors } from '../../src/lib/sectorCatalog';

describe('sector catalog', () => {
  it('has unique names and every topic has at least one body that answers it', () => {
    expect(new Set(SECTOR_CATALOG.map(e => e.name)).size).toBe(SECTOR_CATALOG.length);
    for (const topic of REPORT_TOPICS) {
      expect(suggestSectors({ topicId: topic.id }).length, topic.id).toBeGreaterThan(0);
    }
  });

  it('names municipal bodies after the chosen municipality and leaves central ones alone', () => {
    const roads = suggestSectors({ topicId: 'rruge', municipality: 'Gjilan' });
    expect(roads[0].label).toContain('Komuna Gjilan - ');
    const tax = suggestSectors({ topicId: 'tatime-dogana', municipality: 'Gjilan' });
    expect(tax[0].entry.level).toBe('Qendrore');
    expect(tax[0].label).not.toContain('Gjilan');
  });

  it('lifts a body whose keywords match the description', () => {
    const hits = suggestSectors({ topicId: 'mjedis', municipality: 'Pejë', text: 'qen endacak sulmon fëmijët' });
    expect(hits[0].entry.name).toContain('Qentë endacakë');
  });

  it('gives each catalog entry its own deadline and body in accountability', () => {
    for (const entry of SECTOR_CATALOG) {
      const profile = getAccountabilityProfile(entry.name);
      expect(profile.level).toBe(entry.level);
      expect(profile.responseHours).toBe(entry.responseHours);
    }
  });

  it('keeps the label plain when no municipality is chosen', () => {
    const entry = SECTOR_CATALOG.find(e => e.level === 'Komunale')!;
    expect(sectorLabel(entry, '')).toBe(entry.name);
  });
});

describe('location check', () => {
  it('accepts a pin inside its municipality', () => {
    const [lat, lng] = MUNICIPALITY_COORDINATES['Prizren'];
    expect(checkLocation(lat, lng, 'Prizren').status).toBe('ok');
  });
  it('refuses a pin outside Kosovo', () => {
    expect(checkLocation(41.3275, 19.8187, 'Prishtinë').status).toBe('outside');
  });
  it('flags a pin far from the chosen municipality and suggests the nearest', () => {
    const [lat, lng] = MUNICIPALITY_COORDINATES['Gjilan'];
    const result = checkLocation(lat, lng, 'Pejë');
    expect(result.status).toBe('mismatch');
    if (result.status === 'mismatch') expect(result.suggested).toBe('Gjilan');
  });
  it('finds a nearest municipality for each of the 38', () => {
    for (const name of KOSOVO_MUNICIPALITIES) {
      const [lat, lng] = MUNICIPALITY_COORDINATES[name];
      expect(nearestMunicipality(lat, lng)!.km).toBeLessThan(1);
    }
  });
});
