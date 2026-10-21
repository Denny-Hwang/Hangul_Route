/**
 * Reload the page for a newer build (F-CURR-002 §10, the lesson chunks). A lesson chunk that answers
 * with the app's HTML page, or with another build's chunk, means this page runs an older build than
 * the server: another tab applied an update and its worker dropped the old chunks, or a deploy landed
 * while no worker controlled the page (the iOS 14 home-screen app, a first visit). Only a fresh page
 * mends that, so the page reloads, at most once a minute (`sessionStorage['hr:lesson-reload-at']`, this
 * module's only key), and only online, where the reload can reach the new build. Without the
 * storage there is no guard, so it never reloads; the screen then shows its Try again.
 */
export const RELOAD_KEY = 'hr:lesson-reload-at';
export const RELOAD_GAP_MS = 60_000;

interface SessionArea {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export interface ReloadEnv {
  onLine: () => boolean;
  now: () => number;
  session: () => SessionArea | null;
  reload: () => void;
}

function webEnv(): ReloadEnv {
  const g = globalThis as unknown as {
    navigator?: { onLine?: boolean };
    location?: { reload?: () => void };
    sessionStorage?: SessionArea;
  };
  return {
    onLine: () => g.navigator?.onLine !== false,
    now: () => Date.now(),
    session: () => {
      try {
        return g.sessionStorage ?? null;
      } catch {
        // Blocked site data: the getter itself throws.
        return null;
      }
    },
    reload: () => g.location?.reload?.(),
  };
}

/** Reloads for a newer build when online and not reloaded for it in the last minute; true when it reloads. */
export function reloadForNewBuild(env: ReloadEnv = webEnv()): boolean {
  if (!env.onLine()) return false;
  const session = env.session();
  if (session === null) return false;
  const now = env.now();
  try {
    const last = Number(session.getItem(RELOAD_KEY));
    if (Number.isFinite(last) && last > 0 && now >= last && now - last < RELOAD_GAP_MS) return false;
    session.setItem(RELOAD_KEY, String(now));
  } catch {
    return false;
  }
  env.reload();
  return true;
}
