import { APP_ROUTES, type AdultPersona } from '@hangul-route/content-schema';
import type { AccessSource } from './pass';

/**
 * The Access screen's line and actions (F-BROWSE-001 section 4.3, OD-3;
 * wireframe `browse/access.md`; mock `design/screens/browse/access.md`). Pure:
 * the screen draws what this returns. It shows no lesson, title or card, and
 * every account target is a grown-up page behind sign-in and F-APP-001's
 * grown-up lock, so a child on a shared device reaches nothing through it.
 */

/**
 * Whether the learner app reads the `gate=browse` boot intent (PIN, then a
 * fresh gate pass). F-BROWSE-001 BR-12b added the intent (`logic/shell/boot-intent.ts`)
 * and turned this on, so the gate and unknown sources lead to `/?gate=browse`.
 * With it off, no action may lead there and both lead back to the app instead
 * (section 4.3, design README decision 4: the form before BR-12b).
 */
export const GATE_BROWSE_INTENT_SHIPPED = true;

/** `/?gate=browse`: the learner app's boot intent that opens the PIN for All lessons (BR-12b). */
export function gateBrowseUrl(): string {
  return `${APP_ROUTES.learn}?gate=browse`;
}

/** Keys of `caregiver.browse.access.line`. */
export type AccessLine = 'gate' | 'gateUntilIntent' | 'account' | 'unknown';
/** Keys of the `caregiver.browse.access` button labels. */
export type AccessActionLabel = 'backToGrownUp' | 'backToApp' | 'openFromAccount' | 'signIn';

export interface AccessAction {
  label: AccessActionLabel;
  href: string;
}

export interface AccessView {
  line: AccessLine;
  primary: AccessAction;
  secondary: AccessAction | null;
  /** "Grown-up pages need the internet." under the buttons: offline, for the account and unknown sources. */
  offlineLine: boolean;
}

const personaHome = (persona: AdultPersona): string => (persona === 'teacher' ? APP_ROUTES.teacherHome : APP_ROUTES.parentHome);

export function accessView(i: { source: AccessSource; lastPersona: AdultPersona | null; online: boolean; gateIntent?: boolean }): AccessView {
  const gateIntent = i.gateIntent ?? GATE_BROWSE_INTENT_SHIPPED;
  const backToApp: AccessAction = { label: 'backToApp', href: APP_ROUTES.learn };
  const backToGrownUp: AccessAction = { label: 'backToGrownUp', href: gateBrowseUrl() };
  const signIn: AccessAction = { label: 'signIn', href: APP_ROUTES.signIn };
  const offlineLine = i.source !== 'gate' && !i.online;
  switch (i.source) {
    case 'gate':
      return gateIntent
        ? { line: 'gate', primary: backToGrownUp, secondary: backToApp, offlineLine }
        : { line: 'gateUntilIntent', primary: backToApp, secondary: null, offlineLine };
    case 'account':
      // No remembered persona: the account's way back is sign-in itself, one button (never two to one page).
      return i.lastPersona === null
        ? { line: 'account', primary: signIn, secondary: null, offlineLine }
        : { line: 'account', primary: { label: 'openFromAccount', href: personaHome(i.lastPersona) }, secondary: signIn, offlineLine };
    case 'unknown':
      return { line: 'unknown', primary: gateIntent ? backToGrownUp : backToApp, secondary: signIn, offlineLine };
  }
}
