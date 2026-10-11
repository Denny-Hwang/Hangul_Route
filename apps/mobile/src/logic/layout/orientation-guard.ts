import type { FormFactor, LayoutClass, WidthClass } from '@hangul-route/design-system';

/**
 * The soft portrait guard for phones (F-LAYOUT-001 §3.4, LD5; wireframe
 * `design/wireframes/layout/wide.md` E). Pure, so the whole truth table is
 * unit-tested; `components/PortraitGuard.tsx` only renders what this decides.
 */

/**
 * What the device itself says, read by `platform/orientation`. The window shape is not enough on
 * the web: a soft keyboard shrinks the visual viewport (react-native-web's window size) of an
 * upright phone until it is wider than tall, and a zoomed or windowed tablet has a phone-sized
 * window. Each field is null when unknown, and the window then decides.
 */
export interface DeviceSignals {
  /**
   * The form of the physical screen (`layoutClassFor(screen.width x height).form`, the same
   * `phoneShortSide` / `phoneMaxLongSide` rule as the window); page zoom and app windows do not change it.
   */
  screenForm: FormFactor | null;
  /** The device's orientation (`screen.orientation.type`, `window.orientation`, the orientation media query). */
  orientation: 'portrait' | 'landscape' | null;
}

type GuardLayout = Pick<LayoutClass, 'form' | 'orientation'>;

/** A phone by its physical screen when known, else by the window. */
export function isPhoneDevice(layout: GuardLayout, screenForm: DeviceSignals['screenForm']): boolean {
  return (screenForm ?? layout.form) === 'phone';
}

/** On its side by the device's own orientation when known, else by the window shape. */
export function isDeviceLandscape(layout: GuardLayout, orientation: DeviceSignals['orientation']): boolean {
  return orientation === null ? layout.orientation === 'landscape' : orientation === 'landscape';
}

export interface GuardInput {
  layout: GuardLayout;
  device: DeviceSignals;
  /** `matchMedia('(pointer: coarse)')`: touch input. False when unknown (a failed query never shows the guard). */
  coarsePointer: boolean;
  /** The page path on the web (`location.pathname`); null on native. */
  route: string | null;
  /** "Keep sideways" was chosen on this device (`device:layout`). */
  allowedSideways: boolean;
  /** The learner already turned the phone upright once this session: the guard asks once. */
  dismissedThisSession: boolean;
  /** A text field has focus: the learner is typing (and a keyboard may be up), so the guard never covers it. */
  editingText: boolean;
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

/**
 * True iff a touch phone is on its side, the learner has not said "Keep sideways" or turned it
 * upright yet, is not typing, and the route is not exempt.
 */
export function shouldShowPortraitGuard(i: GuardInput): boolean {
  return (
    isPhoneDevice(i.layout, i.device.screenForm) &&
    isDeviceLandscape(i.layout, i.device.orientation) &&
    i.coarsePointer &&
    !i.editingText &&
    !i.allowedSideways &&
    !i.dismissedThisSession &&
    !isGuardExempt(i.route)
  );
}

export type GuardDismissedVia = 'rotated' | 'keep_sideways';

export interface GuardTransition {
  /** `shown`: report `layout.guard_shown`; `rotated`: report `layout.guard_dismissed { via: 'rotated' }`. */
  emit: 'shown' | 'rotated' | null;
  /** The learner turned the phone upright: the guard does not ask again this session. */
  dismissedThisSession: boolean;
}

/**
 * What a change of `show` means. `shown` each time the guard appears. `rotated` only when a
 * showing guard goes away because the phone itself is now upright: not after "Keep sideways"
 * (its button reports that), not while a text field has focus (a keyboard closing is not a
 * turn), and not when the window stops being a phone (a resized desktop window).
 */
export function guardTransition(i: { wasShowing: boolean; show: boolean; input: GuardInput }): GuardTransition {
  if (i.show) return { emit: i.wasShowing ? null : 'shown', dismissedThisSession: false };
  const { input } = i;
  const rotated =
    i.wasShowing &&
    !input.allowedSideways &&
    !input.editingText &&
    isPhoneDevice(input.layout, input.device.screenForm) &&
    !isDeviceLandscape(input.layout, input.device.orientation);
  return rotated ? { emit: 'rotated', dismissedThisSession: true } : { emit: null, dismissedThisSession: false };
}

/** The best-effort runtime lock: a phone that did not choose "Keep sideways" locks; anything else unlocks; nothing before the inputs are known. */
export function guardLockAction(i: { hydrated: boolean; knownSize: boolean; phone: boolean; allowedSideways: boolean }): 'lock' | 'unlock' | null {
  if (!i.hydrated || !i.knownSize) return null;
  return i.phone && !i.allowedSideways ? 'lock' : 'unlock';
}

/** `layout.observed` goes once a session, as soon as the window size is known (the first web frame can be 0 x 0). */
export function shouldEmitObserved(alreadySent: boolean, l: Pick<LayoutClass, 'windowWidth' | 'windowHeight'>): boolean {
  return !alreadySent && l.windowWidth > 0 && l.windowHeight > 0;
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
