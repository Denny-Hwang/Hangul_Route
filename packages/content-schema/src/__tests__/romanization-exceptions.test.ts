import { describe, expect, it } from 'vitest';
import { ROMANIZATION_EXCEPTIONS, ROMANIZATION_GAPS, checkExceptions, detectGaps, koTokens, normalizeRomanization, romanize } from '../index';

/** AMENDMENTS-ROMANIZER-GAPS §3.4, §3.5 items 4 and 5, §3.7: every shipped entry is well formed. */

const compact = (s: string): string => normalizeRomanization(s).replace(/[- ]/g, '');
const isWord = (ko: string): boolean => !/\s/.test(ko.trim());

describe('every shipped ROMANIZATION_EXCEPTIONS entry', () => {
  it.each(ROMANIZATION_EXCEPTIONS.map((e) => [e.ko, e] as const))('%s names its gap, cites its article and has a value', (_ko, e) => {
    expect(e.reason.trim()).not.toBe('');
    expect([...ROMANIZATION_GAPS, 'proper-noun', 'other']).toContain(e.gap);
    if ((ROMANIZATION_GAPS as readonly string[]).includes(e.gap)) expect(e.reason).toMatch(/제\s*\d+\s*항|표준국어대사전/);
    if (isWord(e.ko)) expect(e.allowed).toHaveLength(1);
    expect(e.allowed.length).toBeGreaterThan(0);
  });

  it.each(ROMANIZATION_EXCEPTIONS.filter((e) => e.gap === 'predicate-h').map((e) => [e.ko, e] as const))(
    '%s: the predicate reading, or the converter reading with a reason that says it is a noun',
    (_ko, e) => {
      const value = compact(e.allowed[0] as string);
      const predicate = compact(romanize(e.ko, { predicateH: true }).text);
      if (value !== predicate) {
        expect(value).toBe(compact(romanize(e.ko).text));
        expect(e.reason).toMatch(/체언|noun/);
      }
    },
  );

  it('the detector flags every word entry whose gap is a detector gap (an entry that flags nothing is a mistake)', () => {
    for (const e of ROMANIZATION_EXCEPTIONS) {
      if ((ROMANIZATION_GAPS as readonly string[]).includes(e.gap)) {
        const flagged = koTokens(e.ko).flatMap((token) => detectGaps(token));
        expect(flagged, e.ko).toContain(e.gap);
      }
    }
  });

  it('the list holds each ko once', () => {
    const kos = ROMANIZATION_EXCEPTIONS.map((e) => e.ko);
    expect(new Set(kos).size).toBe(kos.length);
  });

  it('passes R8 when every entry is seen', () => {
    expect(checkExceptions(ROMANIZATION_EXCEPTIONS, ROMANIZATION_EXCEPTIONS.map((e) => e.ko))).toEqual([]);
  });

  it('the §3.7 entries: the three predicates aspirate, the noun and its particle form keep the ㅎ', () => {
    const value = (ko: string): string | undefined => ROMANIZATION_EXCEPTIONS.find((e) => e.ko === ko)?.allowed[0];
    expect(value('따뜻해요')).toBe('ttatteutaeyo');
    expect(value('딱딱해요')).toBe('ttakttakaeyo');
    expect(value('축하해요')).toBe('chukahaeyo');
    expect(value('북한산')).toBe('bukhansan');
    expect(value('북한산에')).toBe('bukhansane');
  });
});
