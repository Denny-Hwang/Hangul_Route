import { afterEach, describe, expect, it, vi } from 'vitest';
import { PIN_ATTEMPTS_CHANNEL, PIN_ATTEMPTS_MESSAGE, announcePinAttempts, createAttemptsHub, onPinAttemptsChanged } from '../pin-attempts-channel.web';
import * as native from '../pin-attempts-channel';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D19, CS-16: tabs tell each other that the PIN attempt state changed, so
 * a pause another tab started shows at once. The message carries no state and nothing about the PIN.
 */
interface FakeChannel {
  name: string;
  posted: unknown[];
  onmessage: ((event: { data: unknown }) => void) | null;
  postMessage: (message: unknown) => void;
}

function fakeChannel(name = PIN_ATTEMPTS_CHANNEL): FakeChannel {
  const channel: FakeChannel = {
    name,
    posted: [],
    onmessage: null,
    postMessage: (message) => {
      channel.posted.push(message);
    },
  };
  return channel;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createAttemptsHub', () => {
  it('posts the one message and calls listeners for that message only, until unsubscribed', () => {
    const channel = fakeChannel();
    const hub = createAttemptsHub(() => channel);
    const heard = vi.fn();
    const off = hub.listen(heard);
    hub.announce();
    expect(channel.posted).toEqual([{ v: 1, kind: 'attempts' }]);
    expect(PIN_ATTEMPTS_MESSAGE).toEqual({ v: 1, kind: 'attempts' });
    channel.onmessage?.({ data: { v: 1, kind: 'attempts' } });
    channel.onmessage?.({ data: { v: 1, kind: 'lock' } });
    channel.onmessage?.({ data: null });
    channel.onmessage?.({ data: 'attempts' });
    expect(heard).toHaveBeenCalledTimes(1);
    off();
    channel.onmessage?.({ data: { v: 1, kind: 'attempts' } });
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('is total: no channel, a channel that cannot open and one that refuses a post are no channel', () => {
    expect(() => createAttemptsHub(() => null).announce()).not.toThrow();
    const failing = createAttemptsHub(() => {
      throw new Error('blocked');
    });
    expect(() => failing.announce()).not.toThrow();
    expect(() => failing.listen(() => undefined)()).not.toThrow();
    const refusing = fakeChannel();
    refusing.postMessage = () => {
      throw new Error('closed');
    };
    expect(() => createAttemptsHub(() => refusing).announce()).not.toThrow();
  });
});

describe('the tab hub on BroadcastChannel hr-pin-attempts', () => {
  it('opens one channel by name, posts on it and hears the other tabs on it', () => {
    const opened: FakeChannel[] = [];
    vi.stubGlobal(
      'BroadcastChannel',
      class {
        constructor(name: string) {
          const channel = fakeChannel(name);
          opened.push(channel);
          return channel as unknown as object;
        }
      },
    );
    const heard = vi.fn();
    const off = onPinAttemptsChanged(heard);
    announcePinAttempts();
    expect(opened).toHaveLength(1);
    expect(opened[0]?.name).toBe('hr-pin-attempts');
    expect(opened[0]?.posted).toEqual([{ v: 1, kind: 'attempts' }]);
    opened[0]?.onmessage?.({ data: { v: 1, kind: 'attempts' } });
    expect(heard).toHaveBeenCalledTimes(1);
    off();
  });

  it('the native stub tells nobody and hears nothing', () => {
    expect(() => native.announcePinAttempts()).not.toThrow();
    const off = native.onPinAttemptsChanged(() => undefined);
    expect(() => off()).not.toThrow();
  });
});
