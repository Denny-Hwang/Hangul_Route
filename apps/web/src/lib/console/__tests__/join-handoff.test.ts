import { JOIN_HANDOFF_KEY, JoinHandoffSchema, UNLOCK_SESSION_KEY, CONSOLE_SESSION_KEY } from '@hangul-route/content-schema';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { KeyValueStorage } from '../../i18n/safe-storage';
import { openAppWithJoinCode, writeJoinHandoff } from '../join-handoff';

/**
 * F-APP-001 A-5b, section 3.8: "Open the app on this device" hands the family join code to the learner
 * app in this tab (`hr:shell:joinCode` = `{ v: 1, code, at }`, no name, no space id), clears the unlock
 * and the console session like Back to learning, and opens the learner app.
 */
function memory(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

const throwing: KeyValueStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

describe('writeJoinHandoff', () => {
  it('writes the code and the time only, in the shape the learner app reads', () => {
    const store = memory();
    expect(writeJoinHandoff('K7MPQ4', 1_000, store)).toBe(true);
    const raw = store.data.get(JOIN_HANDOFF_KEY);
    expect(JSON.parse(raw ?? 'null')).toEqual({ v: 1, code: 'K7MPQ4', at: 1_000 });
    expect(JoinHandoffSchema.safeParse(JSON.parse(raw ?? 'null')).success).toBe(true);
  });

  it('refuses a value that is not a join code, and survives blocked storage', () => {
    const store = memory();
    expect(writeJoinHandoff('Kim family', 1, store)).toBe(false);
    expect(store.data.size).toBe(0);
    expect(writeJoinHandoff('K7MPQ4', 1, throwing)).toBe(false);
    expect(writeJoinHandoff('K7MPQ4', 1, null)).toBe(false);
  });
});

describe('openAppWithJoinCode', () => {
  it('writes the hand-off, clears the unlock and the console session, then opens the learner app', () => {
    const store = memory();
    store.data.set(UNLOCK_SESSION_KEY, '{}');
    store.data.set(CONSOLE_SESSION_KEY, '{}');
    const opened: string[] = [];
    openAppWithJoinCode({ code: 'K7MPQ4', now: 5, locale: 'ko', origin: 'https://app.hangulroute.com', storage: store, assign: (url) => opened.push(url) });
    expect(JSON.parse(store.data.get(JOIN_HANDOFF_KEY) ?? 'null')).toEqual({ v: 1, code: 'K7MPQ4', at: 5 });
    expect(store.data.has(UNLOCK_SESSION_KEY)).toBe(false);
    expect(store.data.has(CONSOLE_SESSION_KEY)).toBe(false);
    expect(opened).toEqual(['/?lang=ko']);
  });

  it('from the site origin (before F-SITE-002 S-10) writes no hand-off (sessionStorage is per origin, the app host could not read it) and opens the app host', () => {
    const opened: string[] = [];
    const store = memory();
    store.data.set(UNLOCK_SESSION_KEY, '{}');
    openAppWithJoinCode({ code: 'K7MPQ4', now: 5, locale: 'en', origin: 'https://hangulroute.com', storage: store, assign: (url) => opened.push(url) });
    expect(store.data.has(JOIN_HANDOFF_KEY)).toBe(false);
    expect(store.data.has(UNLOCK_SESSION_KEY)).toBe(false);
    // [OA] No code reaches the app, so it opens the chooser (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 7.3).
    expect(opened).toEqual(['https://app.hangulroute.com/?lang=en&who=1']);
    const www = memory();
    openAppWithJoinCode({ code: 'K7MPQ4', now: 5, locale: 'en', origin: 'https://www.hangulroute.com', storage: www, assign: () => undefined });
    expect(www.data.has(JOIN_HANDOFF_KEY)).toBe(false);
  });

  it('[OA] without a hand-off (a refused write or a code that is not one) opens the chooser with who=1; with one it lands on Join', () => {
    const opened: string[] = [];
    openAppWithJoinCode({ code: 'K7MPQ4', now: 5, locale: 'es', origin: 'https://app.hangulroute.com', storage: null, assign: (url) => opened.push(url) });
    openAppWithJoinCode({ code: 'nope', now: 5, locale: 'en', origin: 'https://app.hangulroute.com', storage: memory(), assign: (url) => opened.push(url) });
    openAppWithJoinCode({ code: 'K7MPQ4', now: 5, locale: 'en', origin: 'https://app.hangulroute.com', storage: memory(), assign: (url) => opened.push(url) });
    expect(opened).toEqual(['/?lang=es&who=1', '/?lang=en&who=1', '/?lang=en']);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('in the browser, reads this origin and leaves the tab for the learner app by itself', () => {
    const opened: string[] = [];
    const store = memory();
    vi.stubGlobal('window', { location: { origin: 'https://app.hangulroute.com', assign: (url: string) => opened.push(url) }, sessionStorage: store });
    openAppWithJoinCode({ code: 'K7MPQ4', now: 9, locale: 'en' });
    expect(opened).toEqual(['/?lang=en']);
    expect(JSON.parse(store.data.get(JOIN_HANDOFF_KEY) ?? 'null')).toEqual({ v: 1, code: 'K7MPQ4', at: 9 });
  });
});
