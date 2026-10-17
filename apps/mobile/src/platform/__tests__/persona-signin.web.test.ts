import { describe, expect, it, vi } from 'vitest';

vi.mock('../storage', () => ({
  readJson: vi.fn(async () => null),
  readJsonStrict: vi.fn(async () => null),
  writeJson: vi.fn(async () => undefined),
  removeKey: vi.fn(async () => undefined),
}));
vi.mock('../locale', () => ({ deviceLanguages: () => [], takeLangHandoff: () => null, setDocumentLang: () => undefined }));

import type { UiLocale } from '@hangul-route/i18n';
import * as native from '../persona-signin';
import { openPersonaSignIn, type PersonaSignInEnv } from '../persona-signin.web';
import type { TelemetryEvent } from '../telemetry';

/**
 * F-APP-001 section 3.6 (A-7), behaviours 1 and 2: a Welcome persona button sends
 * `shell.persona_chosen` and opens sign-in in the same tab, with the persona hint for a button of
 * Panel A and none for Continue (Panel B); `?lang=` always follows the UI locale, English included.
 */
function harness(locale: UiLocale = 'en'): { env: PersonaSignInEnv; events: TelemetryEvent[]; assigned: string[] } {
  const events: TelemetryEvent[] = [];
  const assigned: string[] = [];
  return {
    events,
    assigned,
    env: {
      track: async (event) => {
        events.push(event);
        return true;
      },
      assign: (url) => assigned.push(url),
      wait: async () => undefined,
      locale: () => locale,
    },
  };
}

describe('openPersonaSignIn (web)', () => {
  it('Teacher on Welcome: the event, then /signin?persona=teacher', async () => {
    const h = harness();
    await openPersonaSignIn({ persona: 'teacher', from: 'welcome' }, h.env);
    expect(h.events).toEqual([{ name: 'shell.persona_chosen', payload: { persona: 'teacher', from: 'welcome' } }]);
    expect(h.assigned).toEqual(['/signin?persona=teacher&lang=en']);
  });

  it('Parent or caregiver on Welcome: /signin?persona=parent', async () => {
    const h = harness();
    await openPersonaSignIn({ persona: 'parent', from: 'welcome' }, h.env);
    expect(h.assigned).toEqual(['/signin?persona=parent&lang=en']);
  });

  it('Continue as family: the remembered persona in the event, the plain router in the address', async () => {
    const h = harness();
    await openPersonaSignIn({ persona: 'parent', from: 'welcome-continue' }, h.env);
    expect(h.events[0]?.payload).toEqual({ persona: 'parent', from: 'welcome-continue' });
    expect(h.assigned).toEqual(['/signin?lang=en']);
  });

  it('carries a UI locale that is not the default', async () => {
    const h = harness('ko');
    await openPersonaSignIn({ persona: 'teacher', from: 'welcome' }, h.env);
    expect(h.assigned).toEqual(['/signin?persona=teacher&lang=ko']);
    const c = harness('es');
    await openPersonaSignIn({ persona: 'teacher', from: 'welcome-continue' }, c.env);
    expect(c.assigned).toEqual(['/signin?lang=es']);
  });

  it('still leaves when the event cannot be sent', async () => {
    const h = harness();
    h.env.track = async () => {
      throw new Error('offline');
    };
    await openPersonaSignIn({ persona: 'parent', from: 'welcome' }, h.env);
    expect(h.assigned).toEqual(['/signin?persona=parent&lang=en']);
  });

  it('reads the browser by default: the locale store and location.assign', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    vi.stubGlobal('setTimeout', (fn: () => void) => {
      fn();
      return 0;
    });
    await openPersonaSignIn({ persona: 'teacher', from: 'welcome' });
    expect(assign).toHaveBeenCalledWith('/signin?persona=teacher&lang=en');
    vi.unstubAllGlobals();
  });
});

describe('native stub', () => {
  it('throws: native builds show no persona row (OD-6)', async () => {
    await expect(native.openPersonaSignIn({ persona: 'parent', from: 'welcome' })).rejects.toThrow(/web only/);
  });
});
