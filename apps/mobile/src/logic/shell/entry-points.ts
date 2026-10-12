import { APP_ROUTES, type AdultPersona, type Persona, type TelemetryEventName } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import type { DeviceAudience } from '../profiles/learner-type';

/**
 * The learner app's entries to the grown-up area (F-APP-001 A-7, sections 3.6, 3.12 and 3.18;
 * wireframes onboarding/welcome-personas.md and parent/grown-up-home-card.md, mock
 * design/screens/app-shell/learner-entry.md). Pure: the screens read the flag, the platform, the
 * shell store and the network state and render what these return.
 *
 * - Welcome (no learner profile yet): a row under "I already have progress", "Here to support a
 *   learner?" with Parent or caregiver and Teacher (to `/signin?persona=…`), or Continue as the
 *   persona this browser remembers (to `/signin`) and a Someone else link.
 * - Profile: the first row of the grown-up zone, "Grown-up home" ("Account home" on a self-only
 *   device, D9); ParentDashboard: a card at the top. Both call `openGrownUpArea`.
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

export interface PersonaChosenEvent {
  name: Extract<TelemetryEventName, 'shell.persona_chosen'>;
  payload: { persona: Persona; from: PersonaChosenFrom };
}

/** `shell.persona_chosen { persona, from }`: codes only, never a profile id (section 3.18). */
export function personaChosen(persona: Persona, from: PersonaChosenFrom): PersonaChosenEvent {
  return { name: 'shell.persona_chosen', payload: { persona, from } };
}

/** The Profile row's title: "Account home" on a self-only device, whose zone says "Account & backup" (D9). */
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
