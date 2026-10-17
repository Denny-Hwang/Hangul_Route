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
  nameInAny,
  prefixIn,
  smallControlKeys,
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
const keys = toleratedKeys(allowlist, matrixList, { width: 375, height: 667 });

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
  it('a default build runs en, es and ko (es and ko shipped, F-I18N-001 rows 15b / 16b)', () => {
    expect(matrixLocales({})).toEqual(['en', 'es', 'ko']);
  });

  it('a pseudo build draws English as en-XA, so it runs en-XA in its place', () => {
    expect(matrixLocales({ E2E_PSEUDO_LOCALE: '1' })).toEqual(['en-XA', 'es', 'ko']);
  });

  it('only the value 1 turns the pseudo flag on', () => {
    expect(matrixLocales({ E2E_PSEUDO_LOCALE: 'true' })).toEqual(['en', 'es', 'ko']);
    expect(matrixLocales({ E2E_PSEUDO_LOCALE: '0' })).toEqual(['en', 'es', 'ko']);
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
    const listed = ['Profile | button | Go back'];
    expect(allowedSmall('Profile', 'en', listed)).toEqual(new Set(['button | Go back']));
    expect(allowedSmall('Profile', 'en-XA', listed)).toEqual(new Set(['button | Go back', `button | ${pseudoText('Go back')}`]));
    expect(allowedSmall('Profile', 'es', listed).has('button | Go back')).toBe(true);
  });

  it("tolerates the matrix list's controls on screens the ratchet does not walk", () => {
    const listed = ['PinEntry | button | Close'];
    expect(allowedSmall('PinEntry', 'en', listed)).toEqual(new Set(['button | Close']));
    expect(allowedSmall('PinEntry', 'en-XA', listed)).toEqual(new Set(['button | Close', `button | ${pseudoText('Close')}`]));
  });

  it("the real lists: Profile's chevron and PinEntry's close are gone, now the ScreenHeader's 64 x 64 controls (DN-4)", () => {
    expect(allowedSmall('Profile', 'en', keys)).toEqual(new Set());
    expect(allowedSmall('PinEntry', 'en', keys)).toEqual(new Set());
  });

  it('a screen neither list names tolerates nothing', () => {
    for (const screen of ['Welcome', 'CreateProfile', 'Results'] as const) {
      expect(allowedSmall(screen, 'en', keys)).toEqual(new Set());
    }
  });

  it("a numbered line (`... #2`) is tolerated as that occurrence only, in the locale's words", () => {
    expect(allowedSmall('Profile', 'en-XA', ['Profile | button | Go back #2'])).toEqual(
      new Set(['button | Go back #2', `button | ${pseudoText('Go back')} #2`]),
    );
    expect(allowedSmall('PinEntry', 'en', ['PinEntry | button | Close']).has('button | Close #2')).toBe(false);
  });

  it('a label under several keys is tolerated in each of its translations', () => {
    expect(allowedSmall('Home', 'en', ['Home | button | Close', 'Home | link | Close'])).toEqual(new Set(['button | Close', 'link | Close']));
    expect(allowedSmall('Home', 'en', ['broken line'])).toEqual(new Set());
  });
});

describe('toleratedKeys', () => {
  const ratchet: TouchTargetAllowlist = {
    note: '',
    offenders: {
      '1180x820': ['Library | button | Wide'],
      '375x667': ['Home | button | A', 'Profile | button | B'],
      '768x1024': ['Home | button | A'],
    },
  };
  const matrix: MatrixAllowlist = { note: '', offenders: ['PinEntry | button | C', 'Home | button | A'] };

  it('joins the ratchet list of the same window and the matrix list, once each', () => {
    expect(toleratedKeys(ratchet, matrix, { width: 375, height: 667 })).toEqual(['Home | button | A', 'Profile | button | B', 'PinEntry | button | C']);
  });

  it("never borrows another window's lines: 768 does not get what only 375 or 1180 lists", () => {
    expect(toleratedKeys(ratchet, matrix, { width: 768, height: 1024 })).toEqual(['Home | button | A', 'PinEntry | button | C']);
  });

  it('a window narrower than any the ratchet measures takes its narrowest wider window (320 -> 375)', () => {
    expect(toleratedKeys(ratchet, matrix, { width: 320, height: 568 })).toEqual(['Home | button | A', 'Profile | button | B', 'PinEntry | button | C']);
  });

  it('a window wider than every ratchet window takes the matrix list only', () => {
    expect(toleratedKeys(ratchet, matrix, { width: 1400, height: 900 })).toEqual(['PinEntry | button | C', 'Home | button | A']);
  });

  it('the matrix widths each find a ratchet window in the real list', () => {
    for (const vp of MATRIX_VIEWPORTS) expect(toleratedKeys(allowlist, matrixList, vp)).toContain('Library | button | All');
  });
});

describe('smallControlKeys', () => {
  const box = (name: string, width: number, height: number) => ({ role: 'button' as const, name, width, height });

  it('keeps the controls under the floor as role | name with their size', () => {
    expect(smallControlKeys([box('Close', 28, 30), box('Unlock', 300, 64)])).toEqual([{ key: 'button | Close', size: '28x30' }]);
  });

  it('numbers repeats in document order, so a second small control never hides behind a listed one', () => {
    const small = smallControlKeys([box('Close', 28, 30), box('Close', 40, 40)]);
    expect(small.map((t) => t.key)).toEqual(['button | Close', 'button | Close #2']);
    const allowed = allowedSmall('PinEntry', 'en', ['PinEntry | button | Close']);
    expect(small.filter((t) => !allowed.has(t.key)).map((t) => t.key)).toEqual(['button | Close #2']);
  });
});

describe('nameInAny', () => {
  it('matches the whole message in any locale the matrix runs, so one handler serves every walk', () => {
    const notNow = nameInAny((m) => m.caregiver.install.notNow.cta);
    expect(notNow.test(getMessages('en').caregiver.install.notNow.cta)).toBe(true);
    expect(notNow.test(getMessages('ko').caregiver.install.notNow.cta)).toBe(true);
    expect(notNow.test(getMessages('es').caregiver.install.notNow.cta)).toBe(true);
    expect(notNow.test(pseudoText(getMessages('en').caregiver.install.notNow.cta))).toBe(true);
    expect(notNow.test(`${getMessages('en').caregiver.install.notNow.cta} please`)).toBe(false);
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

  it('a numbered line is still listed while that occurrence is small, and fixed once it is not', () => {
    const numbered: MatrixAllowlist = { note: '', offenders: ['PinEntry | button | Close #2'] };
    expect(fixedButListed('PinEntry', 'en', numbered, ['button | Close', 'button | Close #2'])).toEqual([]);
    expect(fixedButListed('PinEntry', 'en', numbered, ['button | Close'])).toEqual(['PinEntry | button | Close #2']);
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
