import { PREFS_CHANNEL, PrefsMessageSchema, prefsMessage, type DeviceSettings } from '@hangul-route/content-schema';

/**
 * Cross-tab display record changes on the web (owner items 6 and 7): the learner app, All
 * lessons, the presenter and the grown-up pages share one origin and one device record, so a
 * language or text size chosen in one tab reaches every open tab through
 * `BroadcastChannel('hr-prefs')`. A page also re-reads the record when it comes back to the
 * front (`visibilitychange` to visible) and when it is restored from the back/forward cache
 * (`pageshow`), which covers a browser without BroadcastChannel and a message sent while the page
 * was frozen. Every call is total: a missing or throwing API is no channel.
 */

interface ChannelLike {
  postMessage: (message: unknown) => void;
  close: () => void;
  onmessage: ((event: { data: unknown }) => void) | null;
}

type ChannelCtor = new (name: string) => ChannelLike;

type Target = { addEventListener: (t: string, f: () => void) => void; removeEventListener: (t: string, f: () => void) => void };

interface PrefsEnv {
  /** This tab's one channel (`createPrefsHub`): posting on the instance that listens means a tab never receives its own writes. */
  hub: PrefsHub;
  win: Target | null;
  doc: (Target & { visibilityState?: string }) | null;
}

/** One `hr-prefs` channel per tab, used to post and to listen; opened on first use and kept for the page's life. */
export interface PrefsHub {
  post: (message: unknown) => void;
  listen: (onData: (data: unknown) => void) => () => void;
}

/**
 * A BroadcastChannel never delivers a message to the instance that posted it, so a tab that posts
 * on the same instance it listens on never receives its own writes (an older write echoing back
 * would briefly undo a newer one).
 */
export function createPrefsHub(open: () => ChannelLike | null): PrefsHub {
  let channel: ChannelLike | null | undefined;
  const listeners = new Set<(data: unknown) => void>();
  const ensure = (): ChannelLike | null => {
    if (channel !== undefined) return channel;
    try {
      channel = open();
    } catch {
      channel = null;
    }
    if (channel) {
      channel.onmessage = (event) => {
        for (const onData of [...listeners]) onData(event.data);
      };
    }
    return channel;
  };
  return {
    post: (message) => {
      const c = ensure();
      if (!c) return;
      try {
        c.postMessage(message);
      } catch {
        // A channel that refuses (a closed context) only loses the live update; the re-read covers it.
      }
    },
    listen: (onData) => {
      ensure();
      listeners.add(onData);
      return () => {
        listeners.delete(onData);
      };
    },
  };
}

const browserChannel = (): ChannelLike | null => {
  const Ctor = (globalThis as { BroadcastChannel?: ChannelCtor }).BroadcastChannel;
  if (typeof Ctor !== 'function') return null;
  return new Ctor(PREFS_CHANNEL);
};

let tabHub: PrefsHub | null = null;

function browserEnv(): PrefsEnv {
  const g = globalThis as { addEventListener?: unknown; removeEventListener?: unknown; document?: PrefsEnv['doc'] };
  tabHub ??= createPrefsHub(browserChannel);
  return {
    hub: tabHub,
    win: typeof g.addEventListener === 'function' && typeof g.removeEventListener === 'function' ? (globalThis as unknown as Target) : null,
    doc: g.document ?? null,
  };
}

/** Posts the record this tab just wrote, on this tab's channel: the other tabs receive it, this one does not. */
export function postDeviceSettings(value: DeviceSettings, env: PrefsEnv = browserEnv()): void {
  try {
    env.hub.post(prefsMessage(value));
  } catch {
    // Nothing to tell.
  }
}

export function subscribeDeviceSettings(onRecord: (value: DeviceSettings) => void, onReturn: () => void, env: PrefsEnv = browserEnv()): () => void {
  const stopListening = env.hub.listen((data) => {
    const parsed = PrefsMessageSchema.safeParse(data);
    if (parsed.success) onRecord(parsed.data.settings);
  });
  const { win, doc } = env;
  const onVisibility = (): void => {
    if (doc?.visibilityState !== 'hidden') onReturn();
  };
  const onShow = (): void => onReturn();
  try {
    doc?.addEventListener('visibilitychange', onVisibility);
    win?.addEventListener('pageshow', onShow);
  } catch {
    // No events: the channel (if any) still works.
  }
  return () => {
    stopListening();
    try {
      doc?.removeEventListener('visibilitychange', onVisibility);
      win?.removeEventListener('pageshow', onShow);
    } catch {
      // Already gone.
    }
  };
}
