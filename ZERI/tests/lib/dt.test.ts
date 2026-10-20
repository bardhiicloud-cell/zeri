import { describe, expect, it } from 'vitest';
import { dt, ensureTranslationTables, translationTablesReady } from '../../src/lib/dt';

describe('dt() with per-language tables', () => {
  it('returns the Albanian text untouched, with no table to load', async () => {
    expect(translationTablesReady('sq')).toBe(true);
    await ensureTranslationTables('sq');
    expect(dt('Raporto problem', 'sq')).toBe('Raporto problem');
  });

  it('falls back to the Albanian original until a language is loaded', () => {
    expect(dt('Raporto problem', 'ja')).toBe('Raporto problem');
  });

  it('translates once the language table is loaded, and keeps unknown text as it is', async () => {
    await ensureTranslationTables('en');
    expect(translationTablesReady('en')).toBe(true);
    expect(dt('Raporto problem', 'en')).toBe('Report a problem');
    expect(dt('një tekst që nuk ekziston askund', 'en')).toBe('një tekst që nuk ekziston askund');
    expect(dt('', 'en')).toBe('');
  });

  it('serves the regional variants from the English table', async () => {
    await ensureTranslationTables('ca');
    expect(dt('Raporto problem', 'ca')).toBe('Report a problem');
    expect(dt('Raporto problem', 'au')).toBe('Report a problem');
  });

  it('keeps the deliberate Albanian rewording', () => {
    expect(dt('Mbi 24 ide të pranuara këtë muaj', 'sq')).toBe('Ide që e përmirësojnë komunën');
  });

  it('loads each table once and ignores unsupported codes', async () => {
    await Promise.all([ensureTranslationTables('de'), ensureTranslationTables('de')]);
    expect(dt('Raporto problem', 'de')).not.toBe('Raporto problem');
    await expect(ensureTranslationTables('xx')).resolves.toBeUndefined();
    expect(translationTablesReady('xx')).toBe(true);
  });
});
