import type { GrownUpUnlock } from '@hangul-route/content-schema';
import type { DeviceGateRead } from '@/lib/console/grown-up-lock';
import type { GrownUpLockEnvironment } from '../GrownUpLock';

/**
 * Shared by the grown-up lock tests (F-APP-001 A-4a): an injectable lock environment over real
 * EventTargets (node has no DOM), with the device, the unlock and the trusted epoch as values a
 * test can change between checks, and every call recorded.
 */
export const NOW = 1_800_000_000_000;
export const EPOCH = 1_790_000_000_000;

export const SIGNED_IN: GrownUpUnlock = { v: 1, at: NOW - 1000, seen: NOW - 1000, src: 'signin' };
/** Last seen 16 minutes ago: past the 15 idle minutes. */
export const EXPIRED: GrownUpUnlock = { v: 1, at: NOW - 20 * 60_000, seen: NOW - 16 * 60_000, src: 'signin' };

export class FakeDocument extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible';
}

export function pageEvent(type: 'pageshow' | 'pagehide', persisted: boolean): Event {
  return Object.assign(new Event(type), { persisted });
}

export function inputEvent(type: 'pointerdown' | 'keydown' | 'click' | 'wheel'): Event {
  return new Event(type, { cancelable: true });
}

export interface Harness {
  env: GrownUpLockEnvironment;
  win: EventTarget;
  doc: FakeDocument;
  device: { value: DeviceGateRead };
  unlock: { value: GrownUpUnlock | null };
  trusted: { value: number | null };
  calls: string[];
  assigned: string[];
}

/** A family tablet: marker `pin` with a trusted epoch, learner profiles, no unlock yet. */
export function harness(): Harness {
  const win = new EventTarget();
  const doc = new FakeDocument();
  const device = { value: { readable: true, marker: { v: 1, gate: 'pin', pinEpoch: EPOCH }, hasProfiles: true } as DeviceGateRead };
  const unlock = { value: null as GrownUpUnlock | null };
  const trusted = { value: EPOCH as number | null };
  const calls: string[] = [];
  const assigned: string[] = [];
  const env: GrownUpLockEnvironment = {
    now: () => NOW,
    readDevice: async () => {
      calls.push('readDevice');
      return device.value;
    },
    readTrustedEpoch: async () => {
      calls.push('readTrustedEpoch');
      return trusted.value;
    },
    readUnlock: () => {
      calls.push('readUnlock');
      return unlock.value;
    },
    touchUnlock: () => {
      calls.push('touchUnlock');
    },
    clearConsoleSession: () => {
      calls.push('clearConsoleSession');
    },
    clearGrownUpTab: () => {
      calls.push('clearGrownUpTab');
    },
    origin: () => 'https://app.hangulroute.com',
    assign: (url) => {
      assigned.push(url);
    },
    window: win,
    document: doc,
  };
  return { env, win, doc, device, unlock, trusted, calls, assigned };
}

/** Lets the lock's reads (resolved promises) and its decision run. */
export const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};
