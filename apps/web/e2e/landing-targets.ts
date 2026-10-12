/**
 * The landing half of the locale layout matrix (F-I18N-001 §3.11, PR 14). Pure helpers shared by
 * `landing-locales.spec.ts` and its unit test (`src/app/__tests__/landing-targets.test.ts`); no
 * Playwright runtime import, so vitest can load this file.
 *
 * The site's links and buttons predate the `touchTarget.min` floor, so they are held to a ratchet
 * like the learner app's (`apps/mobile/e2e/web/target-audit.ts`): the controls under 64 today are
 * listed in `fixtures/landing-touch-allowlist.json`, a new small control fails, and a listed one
 * that is no longer small must leave the list. A key names what a control is and where it goes,
 * never its words or the page's locale prefix, so `/es` and `/ko` are held to the English list.
 */
import { touchTarget } from '@hangul-route/design-system/tokens';

export const TARGET_MIN = touchTarget.min;

/** The three phone / small-tablet widths the owner named: the one list `landing-layout.spec.ts` and `landing-locales.spec.ts` use. */
export const LANDING_WIDTHS = [320, 375, 768] as const;

export interface LandingTouchAllowlist {
  /** Why the file exists and how to change it (kept in the JSON for whoever opens it). */
  note: string;
  /** English page -> sorted keys of the controls under 64 at any of the three widths today. */
  pages: Record<string, string[]>;
  /** Page -> the locale switcher's links, which only a build that shows every locale draws. */
  shownLocales: Record<string, string[]>;
}

/** What `measureControls` reads of one control. */
export interface ControlFacts {
  tag: string;
  href: string | null;
  hreflang: string | null;
  type: string | null;
}

export interface MeasuredControl extends ControlFacts {
  width: number;
  height: number;
}

const LOCALE_PREFIX = /^\/(?:es|ko)(?=\/|$|[?#])/;

/** A site path without its locale prefix (`/es/about` -> `/about`, `/ko` -> `/`), and no `?lang=` hand-off. */
export function normalizeHref(href: string): string {
  const [withoutHash, hash] = href.split('#', 2) as [string, string | undefined];
  const [path, query] = withoutHash.split('?', 2) as [string, string | undefined];
  const unprefixed = path.replace(LOCALE_PREFIX, '');
  const bare = path.startsWith('/') && (unprefixed === '' || unprefixed === '/') ? '/' : unprefixed;
  const params = new URLSearchParams(query ?? '');
  params.delete('lang');
  const rest = params.toString();
  return `${bare}${rest ? `?${rest}` : ''}${hash === undefined ? '' : `#${hash}`}`;
}

/** Whether `href` is on `origin` (the same scheme, host and port, not a look-alike host). */
function onOrigin(href: string, origin: string): boolean {
  try {
    return new URL(href).origin === new URL(origin).origin;
  } catch {
    return false;
  }
}

/**
 * `tag` plus the locale switcher's language, else where the link goes, else the control's type. A link to
 * the learner app (`appOrigin`, which `NEXT_PUBLIC_APP_URL` sets at build time) is keyed `<app>` plus its
 * path, so an export built for another app origin keeps the same list.
 */
export function controlKey(c: ControlFacts, appOrigin?: string | null): string {
  if (c.hreflang) return `${c.tag} hreflang=${c.hreflang}`;
  if (c.href !== null && appOrigin && onOrigin(c.href, appOrigin)) {
    const url = new URL(c.href);
    const rest = normalizeHref(`${url.pathname === '/' ? '' : url.pathname}${url.search}${url.hash}`);
    return `${c.tag} <app>${rest}`;
  }
  if (c.href !== null) return `${c.tag} ${normalizeHref(c.href)}`;
  return c.type ? `${c.tag} ${c.type}` : c.tag;
}

/** Under the floor in either dimension (sub-pixel rounding is not an offence). */
export function isSmall(c: { width: number; height: number }, min: number = TARGET_MIN): boolean {
  return Math.round(c.width) < min || Math.round(c.height) < min;
}

/** Repeats of a key get `#2`, `#3` in document order, so a second small control cannot hide behind the first one's line. */
export function occurrenceKeys(keys: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return keys.map((k) => {
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    return n === 1 ? k : `${k} #${n}`;
  });
}

/** The English page a path is held to (`/es` -> `/`, `/ko/about` -> `/about`). */
export function baselinePage(path: string): string {
  return normalizeHref(path);
}

/** The keys allowed on an English page: its own, plus the locale switcher's when the build shows every locale. */
export function allowedFor(list: LandingTouchAllowlist, page: string, showAllLocales: boolean): string[] {
  return [...(list.pages[page] ?? []), ...(showAllLocales ? (list.shownLocales[page] ?? []) : [])];
}

/** What changed against the list: `added` must be enlarged, `gone` must leave the list. */
export function ratchet(found: readonly string[], allowed: readonly string[]): { added: string[]; gone: string[] } {
  const f = new Set(found);
  const a = new Set(allowed);
  return {
    added: [...f].filter((k) => !a.has(k)).sort(),
    gone: [...a].filter((k) => !f.has(k)).sort(),
  };
}

/**
 * Runs in the page (`page.evaluate(measureControls)`), so it stays self-contained: every rendered
 * link, button, form field and disclosure summary, in document order, with its box.
 */
export function measureControls(): MeasuredControl[] {
  const out: MeasuredControl[] = [];
  const selector = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"]';
  for (const el of Array.from(document.querySelectorAll(selector))) {
    if (el.closest('[aria-hidden="true"]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    out.push({
      tag: el.tagName.toLowerCase(),
      href: el.getAttribute('href'),
      hreflang: el.getAttribute('hreflang'),
      type: el.getAttribute('type'),
      width: r.width,
      height: r.height,
    });
  }
  return out;
}
