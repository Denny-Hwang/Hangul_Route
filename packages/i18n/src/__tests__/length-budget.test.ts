import { describe, expect, it } from 'vitest';
import { LOCALES } from '../locales';
import { getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';

/** Strings allowed to exceed 1.5x the English length, each with a reason. */
const ES_LENGTH_ALLOW_LIST: Readonly<Record<string, string>> = {};

const BUDGETS: Readonly<Record<string, number>> = { tab: 12, pill: 24, cta: 28 };

describe('length budgets (F-I18N-001 §3.11)', () => {
  for (const locale of LOCALES) {
    const messages = getMessages(locale);
    const en = getMessages('en');
    for (const path of leafPaths(messages)) {
      const value = lookup(messages, path);
      if (typeof value !== 'string') continue;
      const last = path.split('.').pop() ?? '';
      const budget = BUDGETS[last];
      if (budget !== undefined) {
        it(`${locale}:${path} fits ${budget} characters`, () => {
          expect(value.length).toBeLessThanOrEqual(budget);
        });
      }
      if (locale === 'es' && ES_LENGTH_ALLOW_LIST[path] === undefined) {
        it(`es:${path} is at most 1.5x the English length`, () => {
          const source = lookup(en, path);
          expect(typeof source).toBe('string');
          expect(value.length).toBeLessThanOrEqual(Math.max(8, Math.ceil(String(source).length * 1.5)));
        });
      }
    }
  }

  it('the allow-list names only real paths and gives a reason', () => {
    const en = getMessages('en');
    for (const [path, reason] of Object.entries(ES_LENGTH_ALLOW_LIST)) {
      expect(lookup(en, path)).toBeDefined();
      expect(reason.length).toBeGreaterThan(0);
    }
  });
});
