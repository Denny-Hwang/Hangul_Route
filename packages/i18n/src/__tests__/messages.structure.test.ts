import { describe, expect, it } from 'vitest';
import { en } from '../messages/en';
import { es } from '../messages/es';
import { ko } from '../messages/ko';
import bannedWords from '../banned-words.json';
import { findBannedWord } from '../banned';
import { LOCALES, type UiLocale } from '../locales';
import { getMessages } from '../resolve';
import { isPlainObject, leafPaths, lookup } from '../tree';
import type { DeepPartial, Messages } from '../types';

/** Sample arguments for every function message, keyed by dotted path. Add a row with each new function message. */
const SAMPLES: Record<string, readonly unknown[]> = {
  'a11y.tile': ['x'],
  'a11y.stars': [2],
  'a11y.hoya': ['waving'],
  'a11y.cardArt': ['Book'],
  'a11y.koreanItem': [{ ko: 'x', romanization: 'g', gloss: 'dog' }, { ko: 'x', romanization: 'g' }],
};

const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;

function stringsOf(messages: Messages): string[] {
  const out: string[] = [];
  for (const path of leafPaths(messages)) {
    const value = lookup(messages, path);
    if (typeof value === 'string') out.push(value);
    else if (Array.isArray(value)) out.push(...value.map(String));
    else if (typeof value === 'function') {
      const samples = SAMPLES[path];
      expect(samples, `function message ${path} needs a row in SAMPLES`).toBeDefined();
      for (const args of samples ?? []) out.push((value as (a: unknown) => string)(args));
    }
  }
  return out;
}

describe('overlay structure', () => {
  it('every es/ko path exists in en, with the same kind of value', () => {
    const enPaths = new Set(leafPaths(en));
    for (const [name, overlay] of [['es', es], ['ko', ko]] as const) {
      for (const path of leafPaths(overlay)) {
        expect(enPaths.has(path), `${name}.${path} is not in en`).toBe(true);
        expect(typeof lookup(overlay, path)).toBe(typeof lookup(en, path));
      }
    }
  });

  it('function messages keep English arity', () => {
    for (const overlay of [es, ko]) {
      for (const path of leafPaths(overlay)) {
        const own = lookup(overlay, path);
        const source = lookup(en, path);
        if (typeof own === 'function' && typeof source === 'function') {
          expect(own.length).toBe(source.length);
        }
      }
    }
  });

  it('Messages is the widened English type: overlays may differ in text', () => {
    const copy: Messages = getMessages('en');
    expect(typeof copy.common.buttons.ok).toBe('string');
    const overlay = { common: { buttons: { ok: 'Vale' } } } satisfies DeepPartial<Messages>;
    expect(overlay.common.buttons.ok).toBe('Vale');
  });

  it('the dictionary is plain data: objects, strings, arrays of strings and functions', () => {
    const walk = (node: unknown): void => {
      if (isPlainObject(node)) Object.values(node).forEach(walk);
      else if (Array.isArray(node)) node.forEach((x) => expect(typeof x).toBe('string'));
      else expect(['string', 'function']).toContain(typeof node);
    };
    walk(en);
  });
});

describe('content rules for every locale', () => {
  for (const locale of LOCALES as readonly UiLocale[]) {
    const strings = stringsOf(getMessages(locale));

    it(`${locale}: no empty strings`, () => {
      for (const s of strings) expect(s.trim().length).toBeGreaterThan(0);
    });

    if (locale !== 'ko') {
      it(`${locale}: no Hangul in any message, functions included`, () => {
        for (const s of strings) expect(HANGUL.test(s), s).toBe(false);
      });
    }

    it(`${locale}: no banned word on the learner or caregiver surface`, () => {
      for (const s of strings) {
        expect(findBannedWord(s, locale, 'caregiver'), s).toBeNull();
      }
    });

    it(`${locale}: no emoji in rendered output`, () => {
      for (const s of strings) expect(/[\u{1F000}-\u{1FFFF}☀-➿]/u.test(s), s).toBe(false);
    });
  }

  it('the banned lists are consulted per locale (smoke)', () => {
    expect(bannedWords.es.learner).toContain('fallaste');
  });
});
