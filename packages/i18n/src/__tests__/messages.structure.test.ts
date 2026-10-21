import { describe, expect, it } from 'vitest';
import { en } from '../messages/en';
import { es } from '../messages/es';
import { ko } from '../messages/ko';
import bannedWords from '../banned-words.json';
import { findBannedWord } from '../banned';
import { LOCALES, type UiLocale } from '../locales';
import { ENGLISH_AUTHORITATIVE_PREFIXES, fallbackPaths, getMessages, isEnglishAuthoritative } from '../resolve';
import { isPlainObject, leafPaths, lookup } from '../tree';
import type { DeepPartial, Messages } from '../types';
import { landingBannedWord } from './landing-banned';
import { SAMPLES } from './samples';

const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;

/** Every rendered string with its dotted path; function messages render their SAMPLES rows. */
function entriesOf(messages: Messages): Array<[path: string, text: string]> {
  const out: Array<[string, string]> = [];
  for (const path of leafPaths(messages)) {
    const value = lookup(messages, path);
    if (typeof value === 'string') out.push([path, value]);
    else if (Array.isArray(value)) out.push(...value.map((v): [string, string] => [path, String(v)]));
    else if (typeof value === 'function') {
      const samples = SAMPLES[path];
      expect(samples, `function message ${path} needs a row in SAMPLES`).toBeDefined();
      for (const args of samples ?? []) out.push([path, (value as (...a: unknown[]) => string)(...args)]);
    }
  }
  return out;
}

const stringsOf = (messages: Messages): string[] => entriesOf(messages).map(([, text]) => text);

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

    // Every namespace, the public site included, gets the caregiver list (learner words plus "behind",
    // "lazy" and the es / ko equivalents). The one exemption is the English spatial "behind" on four
    // landing paths (landing-banned.ts).
    it(`${locale}: no banned word on the learner, caregiver or public-site surface`, () => {
      const entries = entriesOf(getMessages(locale));
      expect(entries.some(([path]) => path.startsWith('landing.'))).toBe(true);
      for (const [path, s] of entries) expect(landingBannedWord(s, locale, path), `${path}: ${s}`).toBeNull();
    });

    // U+2605 (the black star in the Home "stars" pill) is a plain text symbol, not an emoji.
    it(`${locale}: no emoji in rendered output`, () => {
      for (const s of strings) expect(/[\u{1F000}-\u{1FFFF}\u2600-\u2604\u2606-\u27BF]/u.test(s), s).toBe(false);
    });
  }

  it('the banned lists are consulted per locale (smoke)', () => {
    expect(bannedWords.es.learner).toContain('fallaste');
  });

  it('the landing exemption is narrow: only the English spatial "behind" on the listed paths (self-check)', () => {
    const gate = 'landing.legal.terms.sections.accounts.paragraphs.p1';
    expect(landingBannedWord('Purchases sit behind a parent-gate.', 'en', gate)).toBeNull();
    expect(landingBannedWord('Hoya never calls you lazy.', 'en', gate)).toBe('lazy');
    expect(landingBannedWord('Never fall behind.', 'en', 'landing.home.hero.lead')).toBe('behind');
    expect(landingBannedWord('Nadie es vago aquí.', 'es', gate)).toBe('vago');
    expect(landingBannedWord('Nadie es vago aquí.', 'es', 'landing.home.who.items.learners.body')).toBe('vago');
    expect(landingBannedWord('게으른 사람은 없어요.', 'ko', 'landing.home.who.items.learners.body')).not.toBeNull();
    expect(findBannedWord('behind', 'en', 'caregiver')).toBe('behind');
  });
});

describe('English-authoritative legal text (decision L10)', () => {
  it('names the Privacy Policy and Terms subtrees, which exist in en', () => {
    expect([...ENGLISH_AUTHORITATIVE_PREFIXES]).toEqual(['landing.legal.privacy.', 'landing.legal.terms.']);
    for (const prefix of ENGLISH_AUTHORITATIVE_PREFIXES) {
      expect(leafPaths(en).filter((path) => path.startsWith(prefix)).length).toBeGreaterThan(10);
    }
    expect(isEnglishAuthoritative('landing.legal.draft')).toBe(false);
    expect(isEnglishAuthoritative('landing.legal.backHome')).toBe(false);
  });

  it('no es / ko overlay sets a leaf in an English-authoritative subtree', () => {
    for (const [name, overlay] of [['es', es], ['ko', ko]] as const) {
      expect(leafPaths(overlay).filter(isEnglishAuthoritative), `${name} overlays English-authoritative legal text`).toEqual([]);
    }
  });

  it('the legal text never counts as a fallback (key coverage, §3.10)', () => {
    for (const locale of ['es', 'ko'] as const) expect(fallbackPaths(locale).filter(isEnglishAuthoritative)).toEqual([]);
    // es (PR 15) and ko (PR 16) translate the notice around the English text.
    expect(fallbackPaths('ko')).not.toContain('landing.legal.draft');
    expect(fallbackPaths('es')).not.toContain('landing.legal.draft');
  });
});
