import {
  BROWSE_PASS_SESSION_KEY,
  CONSOLE_SESSION_KEY,
  GROWN_UP_LOCK_CHANNEL,
  UNLOCK_SESSION_KEY,
  type GrownUpLockMessage,
} from '@hangul-route/content-schema';

/**
 * This tab's grown-up state on the web (F-APP-001 section 3.9): the per-tab `sessionStorage` keys the grown-up
 * hand-off writes, and ([OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 7.6, OA-D5) the `hr-grownup` lock message
 * that tells the console tabs of this origin to drop their unlock. No store imports, so the profile store can end
 * a grown-up session without loading the hand-off. Every access is guarded: a missing or refusing API is a no-op.
 * The native build uses `grown-up-tab.ts`.
 */
export interface SessionArea {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

/** This tab's `sessionStorage`, or null where it is missing or the browser refuses it. */
export function sessionArea(): SessionArea | null {
  try {
    return (globalThis as { sessionStorage?: SessionArea }).sessionStorage ?? null;
  } catch {
    // Blocked site data: the getter itself throws.
    return null;
  }
}

/**
 * Removes the grown-up unlock, the console session and the All lessons pass of this tab
 * (section 3.9; the pass is F-BROWSE-001 section 4.3's `hr:browse:pass`): every boot of a learner
 * root and a learner page restored from the back/forward cache. A device handed back to a child
 * after [ Close ] or Back therefore cannot reopen All lessons from this tab by typing `/browse` or
 * pressing Forward (BR-6 review). The gate hand-off writes its pass after this boot, just before it
 * leaves, so it is unaffected. Nothing else in `sessionStorage` is touched; blocked or missing
 * storage is a no-op.
 */
export function clearGrownUpTab(area: SessionArea | null = sessionArea()): void {
  for (const key of [UNLOCK_SESSION_KEY, CONSOLE_SESSION_KEY, BROWSE_PASS_SESSION_KEY]) {
    try {
      area?.removeItem(key);
    } catch {
      // A storage that refuses keeps nothing we could remove.
    }
  }
}

interface ChannelLike {
  postMessage: (message: unknown) => void;
}

type ChannelCtor = new (name: string) => ChannelLike;

/** The one message `hr-grownup` ever carries (`GrownUpLockMessageSchema`). */
export const GROWN_UP_LOCK_MESSAGE: GrownUpLockMessage = { v: 1, kind: 'lock' };

let tabChannel: ChannelLike | null | undefined;

function browserChannel(): ChannelLike | null {
  if (tabChannel !== undefined) return tabChannel;
  try {
    const Ctor = (globalThis as { BroadcastChannel?: ChannelCtor }).BroadcastChannel;
    tabChannel = typeof Ctor === 'function' ? new Ctor(GROWN_UP_LOCK_CHANNEL) : null;
  } catch {
    tabChannel = null;
  }
  return tabChannel;
}

/**
 * Posts `{ v: 1, kind: 'lock' }` on `hr-grownup`: every console tab of this origin that hears it drops its unlock
 * and shows the lock (OA-3 listens). One channel per tab, kept open, so a post is never cut short by a close.
 * Browsers without BroadcastChannel keep the console's own 15-minute and 5-minute rules.
 */
export function postGrownUpLock(open: () => ChannelLike | null = browserChannel): void {
  try {
    open()?.postMessage(GROWN_UP_LOCK_MESSAGE);
  } catch {
    // A closed context only loses the live lock; the console's own rules still apply.
  }
}

/** [OA] `closeGrownUpSession` on the web: clear this tab's grown-up keys and tell the other tabs to lock. */
export function endGrownUpTab(area: SessionArea | null = sessionArea(), open: () => ChannelLike | null = browserChannel): void {
  clearGrownUpTab(area);
  postGrownUpLock(open);
}
