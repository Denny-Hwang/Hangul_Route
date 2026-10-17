import type { UiLocale } from '@hangul-route/i18n';
import { personaChosen, personaSignInPath, type PersonaChoice } from '../logic/shell/entry-points';
import { handoffUrl } from '../logic/shell/handoff-rules';
import { activeLocale, useLocaleStore } from '../store/locale-store';
import { trackThenLeave } from './grown-up-handoff.web';
import { markLeaving } from './history-bridge.web';
import { track as sendEvent, type TelemetryEvent } from './telemetry';

/**
 * The Welcome persona row (F-APP-001 section 3.6, A-7; wireframe onboarding/welcome-personas.md):
 * a button of Panel A opens `/signin?persona=parent|teacher`, Continue (Panel B) opens `/signin`
 * (the router sends a signed-in grown-up home), both **in the same tab**, after
 * `shell.persona_chosen { persona, from }` is sent (or a short wait). Sign-in only: creating an
 * account is behind the adult step on that page. No unlock is written (Welcome shows only on a
 * device without a learner profile, where the console has no lock). `?lang=` always carries the UI
 * locale, English included (F-I18N-001 hand-off).
 */
export interface PersonaSignInEnv {
  track: (event: TelemetryEvent) => Promise<boolean>;
  assign: (url: string) => void;
  wait?: (ms: number) => Promise<void>;
  locale: () => UiLocale;
}

function browserEnv(): PersonaSignInEnv {
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

export async function openPersonaSignIn(choice: PersonaChoice, env: PersonaSignInEnv = browserEnv()): Promise<void> {
  const path = personaSignInPath(choice.from === 'welcome' ? choice.persona : null);
  const url = handoffUrl(path, env.locale());
  await trackThenLeave(personaChosen(choice.persona, choice.from), () => env.assign(url), env);
}
