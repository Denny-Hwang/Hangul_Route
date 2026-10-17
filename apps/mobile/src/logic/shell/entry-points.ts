import { APP_ROUTES, type AdultPersona, type Persona, type TelemetryEventName } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import type { DeviceAudience } from '../profiles/learner-type';
import type { GrownUpHandoffRequest } from './handoff-rules';

/**
 * The learner app's entries to the grown-up area (F-APP-001 A-7, sections 3.6, 3.12 and 3.18;
 * wireframes onboarding/welcome-personas.md and parent/grown-up-home-card.md, mock
 * design/screens/app-shell/learner-entry.md). Pure: the screens read the flag, the platform, the
 * shell store and the network state and render what these return.
 *
 * - Welcome (no learner profile yet): a row under "I already have progress", "Here to support a
 *   learner?" with Parent or caregiver and Teacher (to `/signin?persona=…`), or Continue as the
 *   persona this browser remembers (to `/signin`) and a Someone else link.
 * - Profile: the row "Account pages" in the For grown-ups group (Account & more on a self-only device, D9;
 *   one grown-up name, AMENDMENTS-DISPLAY-NAV 9.4); ParentDashboard: the sign-in row at the top. Both call
 *   `openGrownUpArea`.
 * - Offline: the buttons stay, disabled, with "Needs the internet".
 */

/** The entries exist on the web with `flags.grownUpHomeEnabled` on, never in a native build (OD-6). */
export function grownUpEntriesOn(flag: boolean, os: string | undefined): boolean {
  return flag && os === 'web';
}

export type WelcomeRow = { kind: 'choose' } | { kind: 'continue'; persona: AdultPersona };

/** Panel A without a remembered persona or after Someone else; Panel B with one. */
export function welcomeRow(lastPersona: AdultPersona | null, someoneElse: boolean): WelcomeRow {
  if (lastPersona === null || someoneElse) return { kind: 'choose' };
  return { kind: 'continue', persona: lastPersona };
}

/**
 * Where a Welcome button goes: sign-in with the persona hint (Panel A), or the plain sign-in
 * router for Continue (Panel B), which sends a signed-in grown-up home. Sign-in only: creating an
 * account is behind the adult step on that page (section 3.7).
 */
export function personaSignInPath(persona: AdultPersona | null): string {
  return persona === null ? APP_ROUTES.signIn : `${APP_ROUTES.signIn}?persona=${persona}`;
}

export type PersonaChosenFrom = 'welcome' | 'welcome-continue';

/** A Welcome persona button: the persona it names (or Continue remembers) and which panel it is on. */
export interface PersonaChoice {
  persona: AdultPersona;
  from: PersonaChosenFrom;
}

export interface PersonaChosenEvent {
  name: Extract<TelemetryEventName, 'shell.persona_chosen'>;
  payload: { persona: Persona; from: PersonaChosenFrom };
}

/** `shell.persona_chosen { persona, from }`: codes only, never a profile id (section 3.18). */
export function personaChosen(persona: Persona, from: PersonaChosenFrom): PersonaChosenEvent {
  return { name: 'shell.persona_chosen', payload: { persona, from } };
}

/** The Profile row's title: `selfTitle` on a self-only device (D9), `title` elsewhere; both read "Account pages" (DN 9.4). */
export function grownUpRowTitle(audience: DeviceAudience, m: Messages['learner']['profile']['grownUpHome']): string {
  return audience === 'self' ? m.selfTitle : m.title;
}

/** The row's accessible name before the gate hint: its title and its line (learner-entry.md). */
export function grownUpRowLabel(title: string, line: string): string {
  return `${title}, ${line}`;
}

/** The line under an entry: its own line online, "Needs the internet" offline (section 3.12). */
export function entryLine(online: boolean, line: string, needsInternet: string): string {
  return online ? line : needsInternet;
}

/** "Let's start": `shell.persona_chosen { persona: 'learner', from: 'welcome' }` only when the grown-ups' row shows. */
export function startEvent(grownUps: boolean): PersonaChosenEvent | null {
  return grownUps ? personaChosen('learner', 'welcome') : null;
}

/** The entries that hand off from inside the learner app: the Profile row and the dashboard Open. */
export type GrownUpEntryVia = Extract<GrownUpHandoffRequest['via'], 'profile' | 'dashboard'>;

/**
 * One tap of Account pages (Profile) or the sign-in row (dashboard), section 3.6 and behaviour 22: the hand-off
 * goes on when the PIN is fresh (or the device has none) and otherwise asks for the grown-up area's
 * PIN with the same `via`. `busy` is a ref, checked and set before the first await, so two taps in one
 * render run it once. A hand-off that throws settles quietly and frees the entry for another tap.
 */
export async function runGrownUpHandoff(
  via: GrownUpEntryVia,
  busy: { current: boolean },
  open: (request: { via: GrownUpEntryVia }) => Promise<'opened' | 'pin'>,
  askPin: (via: GrownUpEntryVia) => void,
): Promise<void> {
  if (busy.current) return;
  busy.current = true;
  try {
    if ((await open({ via })) === 'pin') askPin(via);
  } catch {
    // Nothing opened; the entry stays usable.
  } finally {
    busy.current = false;
  }
}

/**
 * The Plan screen's Open billing (sections 3.6, 3.12 and the 3.19 learner entry buttons row): with
 * the entries on (web, flag on) and the browser offline it is disabled with "Needs the internet" as
 * its description; it re-enables on `online`. The hand-off itself is F-BILL-002 B-9b.
 */
export function planOpenBlocked(entriesOn: boolean, online: boolean): boolean {
  return entriesOn && !online;
}

/**
 * The dashboard's sign-in row (owner request 2026-10-16, item 8; was the "Grown-up home" card): what it opens, in
 * one line, for the device's audience (a self-only device never says "family", D9).
 */
export function dashboardSignInLabel(audience: DeviceAudience, m: Messages): string {
  return audience === 'self' ? m.caregiver.grownUpHome.signIn.self : m.caregiver.grownUpHome.signIn.family;
}
