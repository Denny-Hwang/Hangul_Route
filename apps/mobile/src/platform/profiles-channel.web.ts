import { PROFILES_CHANNEL, ProfilesChangedMessageSchema, type ProfilesChangedMessage } from '@hangul-route/content-schema';
import { createPrefsHub, type PrefsHub } from './prefs-channel.web';

/**
 * [OA] Cross-tab profile list changes on the web (AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D19, CS-16; row OA-4a): a tab
 * that wrote `hr:profiles` posts `{ v: 1, kind: 'changed' }` (no id, no name) on `BroadcastChannel('hr-profiles')`,
 * and every other learner tab reads the list again. A page also reads it again when it comes back to the front
 * (`visibilitychange` to visible, `pageshow`), which covers a browser without BroadcastChannel and a message sent
 * while the page was frozen. One channel per tab (`createPrefsHub`), so a tab never hears its own post. Every call is
 * total: a missing or throwing API is no channel.
 */

interface ChannelLike {
  postMessage: (message: unknown) => void;
  close: () => void;
  onmessage: ((event: { data: unknown }) => void) | null;
}

type ChannelCtor = new (name: string) => ChannelLike;
type Target = { addEventListener: (t: string, f: () => void) => void; removeEventListener: (t: string, f: () => void) => void };

export interface ProfilesChannelEnv {
  hub: PrefsHub;
  win: Target | null;
  doc: (Target & { visibilityState?: string }) | null;
}

/** The one message `hr-profiles` ever carries. */
export const PROFILES_CHANGED_MESSAGE: ProfilesChangedMessage = { v: 1, kind: 'changed' };

const browserChannel = (): ChannelLike | null => {
  const Ctor = (globalThis as { BroadcastChannel?: ChannelCtor }).BroadcastChannel;
  return typeof Ctor === 'function' ? new Ctor(PROFILES_CHANNEL) : null;
};

let tabHub: PrefsHub | null = null;

function browserEnv(): ProfilesChannelEnv {
  const g = globalThis as { addEventListener?: unknown; removeEventListener?: unknown; document?: ProfilesChannelEnv['doc'] };
  tabHub ??= createPrefsHub(browserChannel);
  return {
    hub: tabHub,
    win: typeof g.addEventListener === 'function' && typeof g.removeEventListener === 'function' ? (globalThis as unknown as Target) : null,
    doc: g.document ?? null,
  };
}

export function postProfilesChanged(env: ProfilesChannelEnv = browserEnv()): void {
  try {
    env.hub.post(PROFILES_CHANGED_MESSAGE);
  } catch {
    // Nothing to tell: the other tabs read the list again when they come back to the front.
  }
}

export function subscribeProfilesChanged(onChange: () => void, env: ProfilesChannelEnv = browserEnv()): () => void {
  const stopListening = env.hub.listen((data) => {
    if (ProfilesChangedMessageSchema.safeParse(data).success) onChange();
  });
  const { win, doc } = env;
  const onVisibility = (): void => {
    if (doc?.visibilityState !== 'hidden') onChange();
  };
  try {
    doc?.addEventListener('visibilitychange', onVisibility);
    win?.addEventListener('pageshow', onChange);
  } catch {
    // No events: the channel (if any) still works.
  }
  return () => {
    stopListening();
    try {
      doc?.removeEventListener('visibilitychange', onVisibility);
      win?.removeEventListener('pageshow', onChange);
    } catch {
      // Already gone.
    }
  };
}
