import { PIN_RESET_TICKET_KEY } from '@hangul-route/content-schema';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../storage', () => ({
  readJson: vi.fn(async () => null),
  readJsonStrict: vi.fn(async () => null),
  writeJson: vi.fn(async () => undefined),
  removeKey: vi.fn(async () => undefined),
}));
vi.mock('../telemetry', () => ({ track: vi.fn(async () => true) }));
vi.mock('../locale', () => ({ deviceLanguages: () => [], takeLangHandoff: () => null, setDocumentLang: () => undefined }));

import type { UiLocale } from '@hangul-route/i18n';
import * as native from '../pin-reset';
import { openPinResetSignIn, takePinResetTicket, type PinResetSignInEnv } from '../pin-reset.web';
import type { SessionArea } from '../grown-up-handoff.web';
import type { TelemetryEvent } from '../telemetry';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 8.5 steps 1 and 5 (row OA-6): Forgot PIN?'s Sign in to the account
 * leaves for `/signin?next=/account/pin-reset` after its event, writing no unlock; the console's ticket is read once.
 */
function area(initial: Record<string, string>, options: { getThrows?: boolean; removeThrows?: boolean } = {}): SessionArea & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => {
      if (options.getThrows) throw new Error('SecurityError');
      return data.get(key) ?? null;
    },
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => {
      if (options.removeThrows) throw new Error('SecurityError');
      data.delete(key);
    },
  };
}

describe('takePinResetTicket (web): read once, removed whatever it holds', () => {
  it('returns the stored ticket and removes it; a second read finds nothing (CS-9)', () => {
    const tab = area({ [PIN_RESET_TICKET_KEY]: '{"v":1,"at":1,"epoch":2}', other: 'x' });
    expect(takePinResetTicket(tab)).toBe('{"v":1,"at":1,"epoch":2}');
    expect(tab.data.has(PIN_RESET_TICKET_KEY)).toBe(false);
    expect(tab.data.get('other')).toBe('x');
    expect(takePinResetTicket(tab)).toBeNull();
  });

  it('junk is removed too, and returned for the parser to refuse', () => {
    const tab = area({ [PIN_RESET_TICKET_KEY]: 'junk' });
    expect(takePinResetTicket(tab)).toBe('junk');
    expect(tab.data.size).toBe(0);
  });

  it('no storage, a refusing read or a refusing remove never throws', () => {
    expect(takePinResetTicket(null)).toBeNull();
    expect(takePinResetTicket(area({ [PIN_RESET_TICKET_KEY]: 'x' }, { getThrows: true }))).toBeNull();
    expect(takePinResetTicket(area({ [PIN_RESET_TICKET_KEY]: 'x' }, { removeThrows: true }))).toBe('x');
  });
});

function harness(locale: UiLocale = 'en'): { env: PinResetSignInEnv; events: TelemetryEvent[]; assigned: string[] } {
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

describe('openPinResetSignIn (web)', () => {
  it('sends pin.reset_requested { method: sign_in }, then /signin?next=/account/pin-reset with the UI language', async () => {
    const h = harness('ko');
    await openPinResetSignIn(h.env);
    expect(h.events).toEqual([{ name: 'pin.reset_requested', payload: { method: 'sign_in' } }]);
    expect(h.assigned).toEqual(['/signin?next=/account/pin-reset&lang=ko']);
  });

  it('leaves even when the event cannot be sent', async () => {
    const h = harness();
    h.env.track = () => Promise.reject(new Error('offline'));
    await openPinResetSignIn(h.env);
    expect(h.assigned).toEqual(['/signin?next=/account/pin-reset&lang=en']);
  });
});

describe('native stub', () => {
  it('has no ticket and refuses the sign-in reset (web only)', async () => {
    expect(native.takePinResetTicket()).toBeNull();
    await expect(native.openPinResetSignIn()).rejects.toThrow(/web only/);
  });
});
