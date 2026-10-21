/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D19, CS-16: the tabs of this origin tell each other when the PIN (or
 * Rescue Code) attempt state changed, on `BroadcastChannel('hr-pin-attempts')`, so a pause another tab just started
 * shows in every open PIN screen at once, not only on the next try or the next return to the front. The message
 * carries no state and nothing about the PIN: a tab that hears it re-reads the shared state under the lock. Every
 * call is total: a missing or throwing API is no channel (the PIN screen still re-reads when it comes back in
 * front). The native build uses `pin-attempts-channel.ts`.
 */
export const PIN_ATTEMPTS_CHANNEL = 'hr-pin-attempts';

/** The one message the channel ever carries. */
export const PIN_ATTEMPTS_MESSAGE = { v: 1, kind: 'attempts' } as const;

interface ChannelLike {
  postMessage: (message: unknown) => void;
  onmessage: ((event: { data: unknown }) => void) | null;
}

type ChannelCtor = new (name: string) => ChannelLike;

export interface AttemptsHub {
  announce: () => void;
  listen: (listener: () => void) => () => void;
}

const isAttemptsMessage = (data: unknown): boolean =>
  typeof data === 'object' && data !== null && (data as { v?: unknown }).v === 1 && (data as { kind?: unknown }).kind === 'attempts';

/**
 * One channel per tab, used to post and to listen: a BroadcastChannel never delivers a message to the instance that
 * posted it, so a tab never re-reads for its own write.
 */
export function createAttemptsHub(open: () => ChannelLike | null): AttemptsHub {
  let channel: ChannelLike | null | undefined;
  const listeners = new Set<() => void>();
  const ensure = (): ChannelLike | null => {
    if (channel !== undefined) return channel;
    try {
      channel = open();
    } catch {
      channel = null;
    }
    if (channel) {
      channel.onmessage = (event) => {
        if (!isAttemptsMessage(event.data)) return;
        for (const listener of [...listeners]) listener();
      };
    }
    return channel;
  };
  return {
    announce: () => {
      try {
        ensure()?.postMessage(PIN_ATTEMPTS_MESSAGE);
      } catch {
        // A closed context only loses the live update; the re-read on return covers it.
      }
    },
    listen: (listener) => {
      ensure();
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const browserChannel = (): ChannelLike | null => {
  const Ctor = (globalThis as { BroadcastChannel?: ChannelCtor }).BroadcastChannel;
  return typeof Ctor === 'function' ? new Ctor(PIN_ATTEMPTS_CHANNEL) : null;
};

let tabHub: AttemptsHub | null = null;
const hub = (): AttemptsHub => (tabHub ??= createAttemptsHub(browserChannel));

/** Tells the other tabs that the attempt state changed. */
export function announcePinAttempts(): void {
  hub().announce();
}

/** Calls `listener` when another tab changed the attempt state. Returns the unsubscribe. */
export function onPinAttemptsChanged(listener: () => void): () => void {
  return hub().listen(listener);
}
