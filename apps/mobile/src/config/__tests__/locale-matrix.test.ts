import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getMessages, pseudoText } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import {
  allowedSmall,
  BROWSER_LOCALE,
  fixedButListed,
  matrixLocales,
  MATRIX_SCREENS,
  MATRIX_VIEWPORTS,
  messagesFor,
  nameIn,
  prefixIn,
  toleratedKeys,
  type MatrixAllowlist,
} from '../../../e2e/web/locale-matrix';
import type { TouchTargetAllowlist } from '../../../e2e/web/target-audit';

/**
 * F-I18N-001 §3.11 / PR 14: the pure half of the locale layout matrix
 * (`e2e/web/locale.spec.ts`). The spec walks Welcome, CreateProfile, Results,
 * Home, Profile and PinEntry in each locale at 320 / 375 / 768 and finds its
 * controls by dictionary message, never by English text, so the same walk runs
 * in en, es, ko and the pseudo-locale. These tests pin which locales a build
 * runs, how names are matched and which small controls the matrix tolerates.
 */
const ROOT = join(__dirname, '..', '..', '..');
const allowlist = JSON.parse(
  readFileSync(join(ROOT, 'e2e', 'web', 'fixtures', 'touch-target-allowlist.json'), 'utf8'),
) as TouchTargetAllowlist;
const matrixList = JSON.parse(
  readFileSync(join(ROOT, 'e2e', 'web', 'fixtures', 'locale-matrix-allowlist.json'), 'utf8'),
) as MatrixAllowlist;
const keys = toleratedKeys(allowlist, matrixList);

describe('matrix shape (§3.11)', () => {
  it('runs the three widths of the landing layout spec on the six named screens', () => {
    expect(MATRIX_VIEWPORTS.map((vp) => vp.width)).toEqual([320, 375, 768]);
    expect([...MATRIX_SCREENS].sort()).toEqual(['CreateProfile', 'Home', 'PinEntry', 'Profile', 'Results', 'Welcome']);
  });

  it('pins each locale to a browser language the app detects', () => {
    expect(BROWSER_LOCALE).toEqual({ en: 'en-US', 'en-XA': 'en-US', es: 'es-ES', ko: 'ko-KR' });
  });
});

describe('matrixLocales', () => {
  it('a default build runs English only', () => {
    expect(matrixLocales({})).toEqual(['en']);
  });

  it('a build with every language shown adds es and ko', () => {
    expect(matrixLocales({ E2E_ALL_LOCALES: '1' })).toEqual(['en', 'es', 'ko']);
  });

  it('a pseudo build draws English as en-XA, so it runs en-XA in its place', () => {
    expect(matrixLocales({ E2E_PSEUDO_LOCALE: '1' })).toEqual(['en-XA']);
    expect(matrixLocales({ E2E_PSEUDO_LOCALE: '1', E2E_ALL_LOCALES: '1' })).toEqual(['en-XA', 'es', 'ko']);
  });

  it('only the value 1 turns a flag on', () => {
    expect(matrixLocales({ E2E_ALL_LOCALES: 'true', E2E_PSEUDO_LOCALE: '0' })).toEqual(['en']);
  });
});

describe('messagesFor', () => {
  it('en, es and ko are the app dictionaries; en-XA is English pseudo-localised', () => {
    expect(messagesFor('en')).toBe(getMessages('en'));
    expect(messagesFor('es').learner.welcome.cta).toBe(getMessages('es').learner.welcome.cta);
    expect(messagesFor('ko').learner.welcome.cta).toBe(getMessages('ko').learner.welcome.cta);
    expect(messagesFor('en-XA').learner.welcome.cta).toBe(pseudoText("Let's start"));
    expect(messagesFor('en-XA').learner.home.greeting('Dani')).toBe(pseudoText('Hi, Dani!'));
  });
});

describe('nameIn', () => {
  it('English matches only the whole English message', () => {
    const re = nameIn('en', (m) => m.learner.welcome.cta);
    expect(re.test("Let's start")).toBe(true);
    expect(re.test("Let's start now")).toBe(false);
    expect(re.test("Let's")).toBe(false);
  });

  it("another locale matches its own message, or English while that surface still reads English", () => {
    const re = nameIn('en-XA', (m) => m.caregiver.pin.entry.verifySubtitle);
    expect(re.test(pseudoText('Enter your 4-digit PIN to continue.'))).toBe(true);
    expect(re.test('Enter your 4-digit PIN to continue.')).toBe(true);
    expect(re.test('Enter your PIN')).toBe(false);
  });

  it('takes function messages and escapes regex characters', () => {
    const re = nameIn('en', (m) => m.caregiver.audience.gated(m.caregiver.audience.family.zoneLabel, true));
    expect(re.source).toContain('\\(PIN required\\)');
    expect(re.test('Grown-up zone (PIN required)')).toBe(true);
    expect(re.test('Grown-up zone PIN required')).toBe(false);
  });
});

describe('prefixIn', () => {
  it('matches the start of a function message whatever the label is', () => {
    const en = prefixIn('en', (m) => m.a11y.minigame.option.correct);
    expect(en.test('Right answer: ㄱ')).toBe(true);
    expect(en.test('Not this one: ㄱ')).toBe(false);
    const xa = prefixIn('en-XA', (m) => m.a11y.minigame.option.correct);
    expect(xa.test(pseudoText('Right answer: ㄱ'))).toBe(true);
    expect(xa.test('Right answer: ㄱ')).toBe(true);
    expect(xa.test(pseudoText('Not this one: ㄱ'))).toBe(false);
  });
});

describe('allowedSmall', () => {
  it("tolerates the ratchet allowlist's small controls of that screen, in the locale's words", () => {
    expect(allowedSmall('Profile', 'en', keys)).toEqual(new Set(['button | Go back']));
    expect(allowedSmall('Profile', 'en-XA', keys)).toEqual(new Set(['button | Go back', `button | ${pseudoText('Go back')}`]));
    expect(allowedSmall('Profile', 'es', keys).has('button | Go back')).toBe(true);
  });

  it("tolerates the matrix list's controls on screens the ratchet does not walk", () => {
    expect(allowedSmall('PinEntry', 'en', keys)).toEqual(new Set(['button | Close']));
    expect(allowedSmall('PinEntry', 'en-XA', keys)).toEqual(new Set(['button | Close', `button | ${pseudoText('Close')}`]));
  });

  it('a screen neither list names tolerates nothing', () => {
    for (const screen of ['Welcome', 'CreateProfile', 'Results'] as const) {
      expect(allowedSmall(screen, 'en', keys)).toEqual(new Set());
    }
  });

  it('a label under several keys is tolerated in each of its translations', () => {
    expect(allowedSmall('Home', 'en', ['Home | button | Close', 'Home | link | Close'])).toEqual(new Set(['button | Close', 'link | Close']));
    expect(allowedSmall('Home', 'en', ['broken line'])).toEqual(new Set());
  });
});

describe('toleratedKeys', () => {
  it('joins the ratchet list (every window) and the matrix list, once each', () => {
    const ratchet: TouchTargetAllowlist = { note: '', offenders: { '1x1': ['Home | button | A'], '2x2': ['Home | button | A', 'Profile | button | B'] } };
    expect(toleratedKeys(ratchet, { note: '', offenders: ['PinEntry | button | C', 'Home | button | A'] })).toEqual([
      'Home | button | A',
      'Profile | button | B',
      'PinEntry | button | C',
    ]);
  });
});

describe('fixedButListed', () => {
  const list: MatrixAllowlist = { note: '', offenders: ['PinEntry | button | Close'] };

  it('is empty while the listed control is still small, in English or the locale', () => {
    expect(fixedButListed('PinEntry', 'en', list, ['button | Close'])).toEqual([]);
    expect(fixedButListed('PinEntry', 'en-XA', list, [`button | ${pseudoText('Close')}`])).toEqual([]);
  });

  it('names a listed control that is no longer small, so its line is removed', () => {
    expect(fixedButListed('PinEntry', 'en', list, [])).toEqual(['PinEntry | button | Close']);
  });

  it('ignores lines for other screens', () => {
    expect(fixedButListed('Home', 'en', list, [])).toEqual([]);
  });
});

describe('fixtures/locale-matrix-allowlist.json', () => {
  it('lists only matrix screens the ratchet does not walk, sorted and unique', () => {
    const screens = matrixList.offenders.map((key) => key.split(' | ')[0]);
    for (const screen of screens) expect(['Welcome', 'CreateProfile', 'Results', 'PinEntry']).toContain(screen);
    expect(matrixList.offenders).toEqual([...new Set(matrixList.offenders)].sort());
    expect(matrixList.note).toMatch(/only shrinks/);
  });
});
