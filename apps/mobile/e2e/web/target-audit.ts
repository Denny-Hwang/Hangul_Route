/**
 * Touch-target ratchet audit (F-LAYOUT-001 §3.8, PR 7). Pure helpers shared by
 * `target-size.spec.ts` and its unit test
 * (`src/config/__tests__/touch-target-ratchet.test.ts`); no Playwright runtime
 * import, so vitest can load this file.
 *
 * The floor is `touchTarget.min` (64) in both dimensions on every layout
 * class. Today's offenders are listed in `fixtures/touch-target-allowlist.json`
 * per viewport; a new offender fails the audit, and an offender that was fixed
 * must be removed from the list, so the list can only shrink.
 */
import { touchTarget } from '@hangul-route/design-system/tokens';

export const TARGET_MIN = touchTarget.min;

export type AuditScreen = 'Home' | 'Journey' | 'Library' | 'Profile';
/**
 * §3.8 names `button` / `link` / `checkbox`; ARIA `switch` is a checkbox
 * subclass, and `radio`, `tab` and `menuitem` are the other tappable roles the
 * app renders (Profile's option cards and language chips), so they are held to
 * the same floor.
 */
export const TARGET_ROLES = ['button', 'link', 'checkbox', 'switch', 'radio', 'tab', 'menuitem'] as const;
export type TargetRole = (typeof TARGET_ROLES)[number];

/** §3.8: the windows the audit runs at, in the spec's order. */
export const AUDIT_VIEWPORTS = [
  { width: 768, height: 1024 },
  { width: 1180, height: 820 },
  { width: 375, height: 667 },
] as const;

/** §3.8: the screens it walks, in the order it walks them. */
export const AUDIT_SCREENS: readonly AuditScreen[] = ['Home', 'Journey', 'Library', 'Profile'];

export interface TouchTargetAllowlist {
  /** Why the file exists and how to change it (kept in the JSON for whoever opens it). */
  note: string;
  /** `WIDTHxHEIGHT` -> sorted, unique `offenderKey`s measured under 64 at that window today. */
  offenders: Record<string, string[]>;
}

/** One control on a screen, as the browser lays it out. */
export interface MeasuredTarget {
  role: TargetRole;
  name: string;
  width: number;
  height: number;
}

export function viewportKey(vp: { width: number; height: number }): string {
  return `${vp.width}x${vp.height}`;
}

export function offenderKey(t: { screen: AuditScreen; role: TargetRole; name: string }): string {
  return `${t.screen} | ${t.role} | ${t.name}`;
}

/** Under the floor in either dimension (sub-pixel rounding is not an offence). */
export function isOffender(t: { width: number; height: number }, min: number = TARGET_MIN): boolean {
  return Math.round(t.width) < min || Math.round(t.height) < min;
}

/**
 * Gives every repeat of a key on the same walk its own key (`... #2`, `... #3`,
 * in document order), so a second small control with the same screen, role and
 * name is a new offender instead of hiding behind the first one's line.
 */
export function occurrenceKeys(keys: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return keys.map((k) => {
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    return n === 1 ? k : `${k} #${n}`;
  });
}

/**
 * What one read of a screen looks like: every measured control's role, name
 * and rounded size, not only the offenders. Two equal signatures 300 ms apart
 * mean the layout has settled (a control still growing towards 64 changes it).
 */
export function settleSignature(measured: readonly MeasuredTarget[]): string {
  return JSON.stringify(measured.map((t) => [t.role, t.name, Math.round(t.width), Math.round(t.height)]));
}

/** What changed against the list: `added` must be fixed (or the control enlarged), `gone` must leave the list. */
export function ratchet(found: readonly string[], allowed: readonly string[]): { added: string[]; gone: string[] } {
  const f = new Set(found);
  const a = new Set(allowed);
  return {
    added: [...f].filter((k) => !a.has(k)).sort(),
    gone: [...a].filter((k) => !f.has(k)).sort(),
  };
}

/**
 * Runs in the page (`page.evaluate(measureTargets, null)`), so it must stay
 * self-contained (no imports, no outer variables): every visible control with
 * one of `TARGET_ROLES` (native element or ARIA role), its accessible name
 * (aria-label, else aria-labelledby, else its text, whitespace collapsed) and
 * its box, in document order. Hidden screens kept mounted by the navigator
 * (`display: none`) and `aria-hidden` subtrees are left out. So is the PWA
 * overlay layer (`pwa-banners`, `install-guide`, `portrait-guard`): it appears
 * on its own schedule (service-worker update, install prompt, phone
 * landscape), so whether it is on screen would make the walk flaky; `within`
 * (a `data-testid`) measures only that subtree instead, overlays included,
 * which is how `target-size.spec.ts` audits each overlay once it has been
 * opened on purpose.
 */
export function measureTargets(within: string | null): MeasuredTarget[] {
  const OVERLAYS = '[data-testid="pwa-banners"], [data-testid="install-guide"], [data-testid="portrait-guard"]';
  const roleOf = (el: Element): TargetRole | null => {
    const explicit = el.getAttribute('role');
    if (
      explicit === 'button' ||
      explicit === 'link' ||
      explicit === 'checkbox' ||
      explicit === 'switch' ||
      explicit === 'radio' ||
      explicit === 'tab' ||
      explicit === 'menuitem'
    ) {
      return explicit;
    }
    if (explicit) return null;
    if (el.tagName === 'BUTTON') return 'button';
    if (el.tagName === 'A' && el.hasAttribute('href')) return 'link';
    if (el.tagName === 'INPUT') {
      const type = (el as HTMLInputElement).type;
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
    }
    return null;
  };
  const clean = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();
  const nameOf = (el: Element): string => {
    const label = clean(el.getAttribute('aria-label'));
    if (label) return label;
    const by = el.getAttribute('aria-labelledby');
    if (by) {
      const text = clean(by.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' '));
      if (text) return text;
    }
    return clean((el as HTMLElement).innerText ?? el.textContent) || '(no name)';
  };
  const out: MeasuredTarget[] = [];
  const root: ParentNode | null = within ? document.querySelector(`[data-testid="${within}"]`) : document;
  if (!root) return [];
  const candidates = root.querySelectorAll(
    'button, a[href], input[type="checkbox"], input[type="radio"], [role="button"], [role="link"], [role="checkbox"], [role="switch"], [role="radio"], [role="tab"], [role="menuitem"]',
  );
  for (const el of Array.from(candidates)) {
    const role = roleOf(el);
    if (!role) continue;
    if (el.closest('[aria-hidden="true"]') || (!within && el.closest(OVERLAYS))) continue;
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true })) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    out.push({ role, name: nameOf(el), width: r.width, height: r.height });
  }
  return out;
}
