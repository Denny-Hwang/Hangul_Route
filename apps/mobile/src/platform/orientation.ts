import type { FormFactor } from '@hangul-route/design-system';

/**
 * Orientation wrapper (F-LAYOUT-001 §3.4) — native stub. Native builds keep
 * `app.json` orientation `portrait` (§3.10, decision #28), so there is nothing
 * to lock or unlock; the pointer is always touch. The web variant
 * (`orientation.web.ts`) reads `matchMedia` and the Screen Orientation API.
 */

/** Touch input (`pointer: coarse`). */
export function coarsePointer(): boolean {
  return true;
}

/** Best-effort lock to portrait for an installed phone app; no-op here. */
export function tryLockPortrait(_form: FormFactor): Promise<void> {
  return Promise.resolve();
}

/** Release any lock (tablets, "Keep sideways"); no-op here. */
export function unlock(): void {}

/** The page path (for the guard's exempt routes); native has none. */
export function currentPath(): string | null {
  return null;
}
