import { PIN_RESET_TICKET_KEY } from '@hangul-route/content-schema';
import type { UiLocale } from '@hangul-route/i18n';
import { pinResetRequested } from '../logic/onboarding/onboarding-events';
import { handoffUrl } from '../logic/shell/handoff-rules';
import { PIN_RESET_SIGN_IN_PATH } from '../logic/shell/pin-reset-ticket';
import { activeLocale, useLocaleStore } from '../store/locale-store';
import { sessionArea, trackThenLeave, type SessionArea } from './grown-up-handoff.web';
import { markLeaving } from './history-bridge.web';
import { track as sendEvent, type TelemetryEvent } from './telemetry';

/**
 * [OA] Reset the grown-up PIN by signing in, on the web (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 8.5, row OA-6).
 *
 * - `takePinResetTicket`: the console's ticket `hr:shell:pinReset` (`sessionStorage`), read once and removed whatever it
 *   holds, so it is never read twice (CS-9). The app root calls it at every learner boot, before anything mounts.
 * - `openPinResetSignIn`: Forgot PIN?'s **Sign in to the account**: `pin.reset_requested { method: 'sign_in' }`, then
 *   `/signin?next=/account/pin-reset&lang=<locale>` in this tab. No unlock is written: the console's lock asks for the
 *   sign-in, which is the point.
 * Every storage access is guarded; native builds use `pin-reset.ts`.
 */
export function takePinResetTicket(area: SessionArea | null = sessionArea()): string | null {
  if (area === null) return null;
  let raw: string | null;
  try {
    raw = area.getItem(PIN_RESET_TICKET_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    area.removeItem(PIN_RESET_TICKET_KEY);
  } catch {
    // A storage that refuses keeps the ticket; it is good for 2 minutes only, and this boot already read it.
  }
  return raw;
}

export interface PinResetSignInEnv {
  track: (event: TelemetryEvent) => Promise<boolean>;
  assign: (url: string) => void;
  wait?: (ms: number) => Promise<void>;
  locale: () => UiLocale;
}

function browserEnv(): PinResetSignInEnv {
  return {
    track: (event) => sendEvent(event),
    assign: (url) => {
      // The history bridge writes nothing from here on: a traversal would cancel this navigation (AMENDMENTS-DISPLAY-NAV 7.2).
      markLeaving();
      (globalThis as { location?: { assign: (to: string) => void } }).location?.assign(url);
    },
    locale: () => activeLocale(useLocaleStore.getState()),
  };
}

export async function openPinResetSignIn(env: PinResetSignInEnv = browserEnv()): Promise<void> {
  const url = handoffUrl(PIN_RESET_SIGN_IN_PATH, env.locale());
  await trackThenLeave(pinResetRequested('sign_in'), () => env.assign(url), env);
}
