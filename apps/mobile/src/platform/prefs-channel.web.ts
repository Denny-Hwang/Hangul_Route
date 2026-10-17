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

interface PrefsEnv {
  channel: () => ChannelLike | null;
  win: { addEventListener: (t: string, f: () => void) => void; removeEventListener: (t: string, f: () => void) => void } | null;
  doc: { visibilityState?: string; addEventListener: (t: string, f: () => void) => void; removeEventListener: (t: string, f: () => void) => void } | null;
}

function browserEnv(): PrefsEnv {
  const g = globalThis as { BroadcastChannel?: ChannelCtor; addEventListener?: unknown; removeEventListener?: unknown; document?: PrefsEnv['doc'] };
  const Ctor = g.BroadcastChannel;
  return {
    channel: () => {
      if (typeof Ctor !== 'function') return null;
      try {
        return new Ctor(PREFS_CHANNEL);
      } catch {
        return null;
      }
    },
    win: typeof g.addEventListener === 'function' && typeof g.removeEventListener === 'function' ? (globalThis as unknown as PrefsEnv['win']) : null,
    doc: g.document ?? null,
  };
}

/** Posts the record this tab just wrote; the sender does not receive its own message. */
export function postDeviceSettings(value: DeviceSettings, env: PrefsEnv = browserEnv()): void {
  const channel = env.channel();
  if (channel === null) return;
  try {
    channel.postMessage(prefsMessage(value));
  } catch {
    // A channel that refuses (a closed context) only loses the live update; the re-read covers it.
  } finally {
    try {
      channel.close();
    } catch {
      // Nothing to release.
    }
  }
}

export function subscribeDeviceSettings(onRecord: (value: DeviceSettings) => void, onReturn: () => void, env: PrefsEnv = browserEnv()): () => void {
  const channel = env.channel();
  if (channel !== null) {
    channel.onmessage = (event) => {
      const parsed = PrefsMessageSchema.safeParse(event.data);
      if (parsed.success) onRecord(parsed.data.value);
    };
  }
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
    try {
      if (channel !== null) {
        channel.onmessage = null;
        channel.close();
      }
      doc?.removeEventListener('visibilitychange', onVisibility);
      win?.removeEventListener('pageshow', onShow);
    } catch {
      // Already gone.
    }
  };
}
