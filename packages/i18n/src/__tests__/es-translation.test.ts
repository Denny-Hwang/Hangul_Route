import { describe, expect, it } from 'vitest';
import { en } from '../messages/en';
import ledger from '../messages/review-ledger.json';
import { fallbackPaths, getMessages, isEnglishAuthoritative } from '../resolve';
import { leafPaths, lookup } from '../tree';
import { SAMPLES } from './samples';

/**
 * F-I18N-001 PR 15 (Spanish): every UI key has a Spanish value, the review ledger records the review
 * of each namespace, and the literal rows the spec names read as written (§3.4, §3.10, §10).
 */
describe('Spanish dictionary (F-I18N-001 PR 15)', () => {
  const es = getMessages('es');

  it('has no English fallback: every key outside the English-authoritative legal text is translated', () => {
    expect(fallbackPaths('es')).toEqual([]);
  });

  it('keeps the Privacy Policy and Terms English (decision L10)', () => {
    const legal = leafPaths(en).filter(isEnglishAuthoritative);
    expect(legal.length).toBeGreaterThan(10);
    for (const path of legal) expect(lookup(es, path)).toBe(lookup(en, path));
  });

  it('translates the legal notice around the English text', () => {
    expect(es.landing.legal.draft).not.toBe(en.landing.legal.draft);
  });

  it('differs from English wherever English is not a shared word (brand names, codes, symbols)', () => {
    // Values that read the same in both languages; each is a name, a symbol or a word Spanish borrows.
    const SAME_IN_BOTH = new Set(
      leafPaths(en).filter((path) => {
        const value = lookup(en, path);
        return typeof value === 'string' && /^(?:[A-Z0-9 .:·,+/&()–-]*|Hangul Route|Hoya|PIN|OK|Stripe|Email|Plan|Hangul)$/.test(value);
      }),
    );
    const untouched = leafPaths(en).filter((path) => {
      if (isEnglishAuthoritative(path) || SAME_IN_BOTH.has(path)) return false;
      const own = lookup(es, path);
      const source = lookup(en, path);
      if (typeof own === 'string') return own === source;
      if (typeof own === 'function' && typeof source === 'function') {
        const rows = SAMPLES[path] ?? [];
        return rows.length > 0 && rows.every((args) => (own as (...a: unknown[]) => string)(...args) === (source as (...a: unknown[]) => string)(...args));
      }
      return false;
    });
    expect(untouched).toEqual(LITERALLY_SHARED);
  });

  it('reads the spec examples (§3.1, §3.4)', () => {
    expect(es.learner.home.streak.pill(1)).toBe('Racha de 1 día');
    expect(es.learner.home.streak.pill(5)).toBe('Racha de 5 días');
  });

  it('has a review-ledger entry for every namespace (§3.10 step 3)', () => {
    const entries = (ledger as Record<string, Record<string, { enSha: string; reviewedBy: string; reviewedAt: string }>>).es ?? {};
    expect(Object.keys(entries).sort()).toEqual(Object.keys(en).sort());
    for (const entry of Object.values(entries)) {
      expect(entry.enSha).toMatch(/^[0-9a-f]{64}$/);
      expect(entry.reviewedBy).toMatch(/^[A-Z]{2,4}$/);
      expect(entry.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

/**
 * Paths whose Spanish text is, on purpose, identical to the English: a proper name, a code word or a word
 * Spanish uses as is. Listed so a new untranslated key cannot hide among them.
 */
const LITERALLY_SHARED: readonly string[] = [];
