/**
 * The locale layout matrix (F-I18N-001 §3.11, PR 14). Pure helpers shared by
 * `locale.spec.ts` and its unit test (`src/config/__tests__/locale-matrix.test.ts`);
 * no Playwright runtime import, so vitest can load this file.
 *
 * The matrix walks the same screens in every locale, so it never finds a control
 * by its English text: it picks the message from the dictionary (`nameIn`,
 * `prefixIn`) and accepts the locale's words or English. English stays accepted
 * because a surface that still reads English in that locale is exactly what the
 * pseudo-locale shows up, and the walk must still reach the next screen.
 */
import { getMessages, pseudoLocalize, pseudoText, type Messages } from '@hangul-route/i18n';
import { isOffender, occurrenceKeys, viewportKey, type MeasuredTarget, type TouchTargetAllowlist } from './target-audit';

export type MatrixLocale = 'en' | 'es' | 'ko' | 'en-XA';

/**
 * The phone and small-tablet widths of `apps/web/e2e/landing-layout.spec.ts` (`WIDTHS`), each at the
 * height `layout.spec.ts` gives it (iPhone SE 1st gen, iPhone 8, iPad portrait).
 */
export const MATRIX_VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 768, height: 1024 },
] as const;

export type MatrixScreen = 'Welcome' | 'CreateProfile' | 'Results' | 'Home' | 'Profile' | 'PinEntry';

/** The screens §3.11 names, in the order one fresh learner meets them. */
export const MATRIX_SCREENS: readonly MatrixScreen[] = ['Welcome', 'CreateProfile', 'Results', 'Home', 'Profile', 'PinEntry'];

/** The browser language of each run: the app detects es and ko from it; en-XA is English drawn by a pseudo build. */
export const BROWSER_LOCALE: Record<MatrixLocale, string> = { en: 'en-US', 'en-XA': 'en-US', es: 'es-ES', ko: 'ko-KR' };

/**
 * Which locales a build shows. Every build shows en, es and ko since es and ko shipped (F-I18N-001 rows 15b /
 * 16b), so the default build (CI) runs all three. `E2E_PSEUDO_LOCALE=1` marks a build made with
 * `EXPO_PUBLIC_PSEUDO_LOCALE=1`, which draws English as en-XA (`dictionaryLocale`), so en-XA takes its place.
 */
export function matrixLocales(env: Record<string, string | undefined>): MatrixLocale[] {
  const first: MatrixLocale = env.E2E_PSEUDO_LOCALE === '1' ? 'en-XA' : 'en';
  return [first, 'es', 'ko'];
}

const pseudoMessages = pseudoLocalize(getMessages('en'));

/** The dictionary the app draws `locale` with. */
export function messagesFor(locale: MatrixLocale): Messages {
  return locale === 'en-XA' ? pseudoMessages : getMessages(locale);
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function alternatives(forms: readonly string[]): string {
  return [...new Set(forms)].map(escapeRegExp).join('|');
}

/** A whole accessible name or text: the message picked from the locale's dictionary, or the English one. */
export function nameIn(locale: MatrixLocale, pick: (m: Messages) => string): RegExp {
  return new RegExp(`^(?:${alternatives([pick(getMessages('en')), pick(messagesFor(locale))])})$`);
}

/** A whole accessible name or text in any locale the matrix runs (an overlay that can show up mid-walk in any of them). */
export function nameInAny(pick: (m: Messages) => string): RegExp {
  const locales: readonly MatrixLocale[] = ['en', 'es', 'ko', 'en-XA'];
  return new RegExp(`^(?:${alternatives(locales.map((locale) => pick(messagesFor(locale))))})$`);
}

/**
 * The start of a function message, whatever its argument (an answer card's "Right answer: <label>"). The
 * message is called with a marker and cut there, so a pseudo-localised message keeps its opening bracket.
 */
export function prefixIn(locale: MatrixLocale, pick: (m: Messages) => (label: string) => string): RegExp {
  const MARK = '\u0000';
  const head = (m: Messages): string => pick(m)(MARK).split(MARK)[0] ?? '';
  return new RegExp(`^(?:${alternatives([head(getMessages('en')), head(messagesFor(locale))])})`);
}

/** Every dictionary string whose English is `english`, in `locale` (a label can live under several keys). */
function translations(english: string, locale: MatrixLocale): string[] {
  const out: string[] = [];
  const walk = (en: unknown, there: unknown): void => {
    if (typeof en === 'string') {
      if (en === english && typeof there === 'string') out.push(there);
      return;
    }
    if (typeof en !== 'object' || en === null || Array.isArray(en)) return;
    for (const [key, value] of Object.entries(en)) {
      walk(value, typeof there === 'object' && there !== null ? (there as Record<string, unknown>)[key] : undefined);
    }
  };
  walk(getMessages('en'), messagesFor(locale));
  return out;
}

/**
 * Controls on the matrix screens that are under `touchTarget.min` today and that the touch-target ratchet
 * does not walk (`fixtures/locale-matrix-allowlist.json`): `Screen | role | English name`, at every width.
 * Like the ratchet's list it only shrinks: a listed control that is no longer small fails the matrix.
 * A repeat of the same control is numbered (`... #2`, `occurrenceKeys`), so it needs its own line.
 */
export interface MatrixAllowlist {
  note: string;
  offenders: string[];
}

/**
 * The ratchet lines a matrix window is held to: those of the same window; for a phone narrower than every
 * window the ratchet measures (320), those of its narrowest one (375), since a narrower screen keeps the same
 * small controls; otherwise none. Another window's lines never leak in.
 */
function ratchetLines(ratchet: TouchTargetAllowlist, vp: { width: number; height: number }): string[] {
  const exact = ratchet.offenders[viewportKey(vp)];
  if (exact) return exact;
  const windows = Object.keys(ratchet.offenders)
    .map((key) => ({ key, width: Number(key.split('x')[0]) }))
    .sort((a, b) => a.width - b.width);
  const narrowest = windows[0];
  return narrowest && narrowest.width > vp.width ? (ratchet.offenders[narrowest.key] ?? []) : [];
}

/** Every `Screen | role | English name` the matrix tolerates at `vp`: the ratchet's list for that window, then its own. */
export function toleratedKeys(ratchet: TouchTargetAllowlist, matrix: MatrixAllowlist, vp: { width: number; height: number }): string[] {
  return [...new Set([...ratchetLines(ratchet, vp), ...matrix.offenders])];
}

/**
 * The controls under `touchTarget.min` on one read of a screen, as `role | name` keys with their size, in
 * document order; a repeat of a key is numbered (`... #2`), so it never hides behind the first one's line.
 */
export function smallControlKeys(measured: readonly MeasuredTarget[]): Array<{ key: string; size: string }> {
  const small = measured.filter((t) => isOffender(t));
  const keys = occurrenceKeys(small.map((t) => `${t.role} | ${t.name}`));
  return small.map((t, i) => ({ key: keys[i] ?? '', size: `${Math.round(t.width)}x${Math.round(t.height)}` }));
}

const OCCURRENCE = / #\d+$/;

/** `role | name` forms of one `Screen | role | English name[ #n]` key on `screen`, in English and in the locale's words. */
function localizedForms(key: string, screen: MatrixScreen, locale: MatrixLocale): string[] {
  const [where, role, numbered] = key.split(' | ');
  if (where !== screen || role === undefined || numbered === undefined) return [];
  const suffix = OCCURRENCE.exec(numbered)?.[0] ?? '';
  const name = numbered.slice(0, numbered.length - suffix.length);
  const names = new Set([name, ...(locale === 'en-XA' ? [pseudoText(name)] : []), ...translations(name, locale)]);
  return [...names].map((form) => `${role} | ${form}${suffix}`);
}

/**
 * The small controls (`role | name`, repeats numbered) the matrix tolerates on `screen`: the listed ones
 * (`toleratedKeys`), in English and in the locale's words. Every other control on a matrix screen must be at
 * least `touchTarget.min` in every locale.
 */
export function allowedSmall(screen: MatrixScreen, locale: MatrixLocale, keys: readonly string[]): Set<string> {
  return new Set(keys.flatMap((key) => localizedForms(key, screen, locale)));
}

/** The matrix list's lines for `screen` whose control was not found small (`role | name`): fixed, so remove the line. */
export function fixedButListed(screen: MatrixScreen, locale: MatrixLocale, matrix: MatrixAllowlist, small: readonly string[]): string[] {
  const found = new Set(small);
  return matrix.offenders.filter((key) => {
    const forms = localizedForms(key, screen, locale);
    return forms.length > 0 && !forms.some((form) => found.has(form));
  });
}
