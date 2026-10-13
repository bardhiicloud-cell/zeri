import { describe, expect, it } from 'vitest';
import { MAX_TRANSLATE_CHARS, translationCacheKey } from '../../server/translate';

describe('translationCacheKey', () => {
  it('distinguishes texts that share a long common prefix', () => {
    const prefix = 'A'.repeat(200);
    expect(translationCacheKey('sq', 'en', `${prefix} first ending`)).not.toBe(
      translationCacheKey('sq', 'en', `${prefix} totally different ending`)
    );
  });

  it('is stable for identical input and varies by language pair', () => {
    expect(translationCacheKey('sq', 'en', 'Përshëndetje')).toBe(translationCacheKey('sq', 'en', 'Përshëndetje'));
    expect(translationCacheKey('sq', 'en', 'x')).not.toBe(translationCacheKey('sq', 'de', 'x'));
  });

  it('keeps keys short regardless of input length', () => {
    expect(translationCacheKey('sq', 'en', 'b'.repeat(MAX_TRANSLATE_CHARS)).length).toBeLessThan(80);
  });
});
