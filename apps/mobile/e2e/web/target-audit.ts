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
export type TargetRole = 'button' | 'link' | 'checkbox';

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
 * Runs in the page (`page.evaluate(measureTargets)`): every visible button,
 * link and checkbox (native or ARIA role), its accessible name (aria-label,
 * else aria-labelledby, else its text, whitespace collapsed) and its box.
 * Hidden screens kept mounted by the navigator (`display: none`) and
 * `aria-hidden` subtrees are left out, as is the transient PWA overlay layer
 * (`pwa-banners`, `install-guide`, `portrait-guard`), which shows on its own
 * schedule and is audited by its own specs.
 */
export function measureTargets(): MeasuredTarget[] {
  const OVERLAYS = '[data-testid="pwa-banners"], [data-testid="install-guide"], [data-testid="portrait-guard"]';
  const roleOf = (el: Element): TargetRole | null => {
    const explicit = el.getAttribute('role');
    if (explicit === 'button' || explicit === 'link' || explicit === 'checkbox') return explicit;
    if (explicit) return null;
    if (el.tagName === 'BUTTON') return 'button';
    if (el.tagName === 'A' && el.hasAttribute('href')) return 'link';
    if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'checkbox') return 'checkbox';
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
  const candidates = document.querySelectorAll('button, a[href], input[type="checkbox"], [role="button"], [role="link"], [role="checkbox"]');
  for (const el of Array.from(candidates)) {
    const role = roleOf(el);
    if (!role) continue;
    if (el.closest('[aria-hidden="true"]') || el.closest(OVERLAYS)) continue;
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true })) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    out.push({ role, name: nameOf(el), width: r.width, height: r.height });
  }
  return out;
}
