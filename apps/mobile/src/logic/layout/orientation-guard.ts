import type { FormFactor, LayoutClass, WidthClass } from '@hangul-route/design-system';

/**
 * The soft portrait guard for phones (F-LAYOUT-001 §3.4, LD5; wireframe
 * `design/wireframes/layout/wide.md` E). Pure, so the whole truth table is
 * unit-tested; `components/PortraitGuard.tsx` only renders what this decides.
 */

export interface GuardInput {
  layout: Pick<LayoutClass, 'form' | 'orientation'>;
  /** `matchMedia('(pointer: coarse)')`: touch input. False when unknown (a failed query never shows the guard). */
  coarsePointer: boolean;
  /** The page path on the web (`location.pathname`); null on native. */
  route: string | null;
  /** "Keep sideways" was chosen on this device (`device:layout`). */
  allowedSideways: boolean;
  /** The learner already turned the phone upright once this session: the guard asks once. */
  dismissedThisSession: boolean;
}

/**
 * The presenter (F-TCH-004) owns its own full-bleed layout. Defensive only: it is a separate root
 * that never mounts `App`, so it never mounts the guard (F-TCH-004 TD1). Prefix match on the path.
 */
export const GUARD_EXEMPT_ROUTES = ['/present'] as const;

export function isGuardExempt(route: string | null): boolean {
  if (route === null) return false;
  return GUARD_EXEMPT_ROUTES.some((prefix) => route === prefix || route.startsWith(`${prefix}/`));
}

/** True iff a touch phone is on its side, the learner has not said "Keep sideways" or turned it upright yet, and the route is not exempt. */
export function shouldShowPortraitGuard(i: GuardInput): boolean {
  return (
    i.layout.form === 'phone' &&
    i.layout.orientation === 'landscape' &&
    i.coarsePointer &&
    !i.allowedSideways &&
    !i.dismissedThisSession &&
    !isGuardExempt(i.route)
  );
}

export type GuardDismissedVia = 'rotated' | 'keep_sideways';

/**
 * `rotated` when a guard that was showing goes away because the phone is now upright. A window
 * that stops being a phone (a resized desktop window) is not the learner turning the phone: nothing.
 * "Keep sideways" is reported by its button, not here.
 */
export function guardDismissal(i: { wasShowing: boolean; layout: Pick<LayoutClass, 'form' | 'orientation'> }): GuardDismissedVia | null {
  return i.wasShowing && i.layout.form === 'phone' && i.layout.orientation === 'portrait' ? 'rotated' : null;
}

export interface LayoutObservedPayload {
  width: WidthClass;
  form: FormFactor;
  orientation: 'portrait' | 'landscape';
  panes: 1 | 2;
  standalone: boolean;
}

/** `layout.observed` (§3.13), once a session, to learn real tablet use: classes only, no sizes in px, no profile data. */
export function layoutObservedPayload(l: Pick<LayoutClass, 'width' | 'form' | 'orientation' | 'panes'>, standalone: boolean): LayoutObservedPayload {
  return { width: l.width, form: l.form, orientation: l.orientation, panes: l.panes, standalone };
}
