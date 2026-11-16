import { createPrefsHub, type PrefsHub } from './prefs-channel.web';

/**
 * [AU] Cross-tab progress writes on the web (AMENDMENTS-AUDIT-2026-11 row AU-11, audit FUNC-1), after the profile
 * list's channel (`profiles-channel.web.ts`): a tab that stored a learner's snapshot posts `{ v: 1, kind: 'changed' }`
 * (no id, no name, no progress) on `BroadcastChannel('hr-progress')`, and every other tab of the app reads the
 * snapshots it holds again. A page also reads them again when it comes back to the front (`visibilitychange` to
 * visible, `pageshow`), which covers a browser without BroadcastChannel and a message sent while the page was
 * frozen. One channel per tab (`createPrefsHub`), so a tab never hears its own post. Every call is total: a missing
 * or throwing API is no channel.
 */

/** The channel's name. */
export const PROGRESS_CHANNEL = 'hr-progress';

/** The one message `hr-progress` ever carries. */
export const PROGRESS_CHANGED_MESSAGE = { v: 1, kind: 'changed' } as const;

interface ChannelLike {
  postMessage: (message: unknown) => void;
  close: () => void;
  onmessage: ((event: { data: unknown }) => void) | null;
}

type ChannelCtor = new (name: string) => ChannelLike;
type Target = { addEventListener: (t: string, f: () => void) => void; removeEventListener: (t: string, f: () => void) => void };

export interface ProgressChannelEnv {
  hub: PrefsHub;
  win: Target | null;
  doc: (Target & { visibilityState?: string }) | null;
}

/** Exactly the one message: anything else on the channel (another build's, or junk) is not acted on. */
function isChanged(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false;
  const message = data as Record<string, unknown>;
  return message.v === PROGRESS_CHANGED_MESSAGE.v && message.kind === PROGRESS_CHANGED_MESSAGE.kind && Object.keys(message).length === 2;
}

const browserChannel = (): ChannelLike | null => {
  const Ctor = (globalThis as { BroadcastChannel?: ChannelCtor }).BroadcastChannel;
  return typeof Ctor === 'function' ? new Ctor(PROGRESS_CHANNEL) : null;
};

let tabHub: PrefsHub | null = null;

function browserEnv(): ProgressChannelEnv {
  const g = globalThis as { addEventListener?: unknown; removeEventListener?: unknown; document?: ProgressChannelEnv['doc'] };
  tabHub ??= createPrefsHub(browserChannel);
  return {
    hub: tabHub,
    win: typeof g.addEventListener === 'function' && typeof g.removeEventListener === 'function' ? (globalThis as unknown as Target) : null,
    doc: g.document ?? null,
  };
}

/** Tells the other tabs that this tab stored a snapshot. */
export function postProgressChanged(env: ProgressChannelEnv = browserEnv()): void {
  try {
    env.hub.post(PROGRESS_CHANGED_MESSAGE);
  } catch {
    // Nothing to tell: the other tabs read again when they come back to the front, and merge at their next write.
  }
}

/** Calls `onChange` when another tab stored a snapshot or this page is back in front. Returns the unsubscribe. */
export function subscribeProgressChanged(onChange: () => void, env: ProgressChannelEnv = browserEnv()): () => void {
  const stopListening = env.hub.listen((data) => {
    if (isChanged(data)) onChange();
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
