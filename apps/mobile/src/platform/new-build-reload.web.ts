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

/**
 * A lesson or story chunk bundle of this host (`/_expo/static/js/web/lessons-<name>-<md5>.js`, `story-<slug>-<md5>.js`, row CM-8),
 * a locale chunk (`locale-es-<md5>.js`, the UI messages and content text of one locale) or a grown-up root's own code
 * (`PresenterApp-<md5>.js`, `BrowseApp-<md5>.js`).
 */
const CHUNK_PATH = /^\/_expo\/static\/js\/web\/(?:(?:lessons|story)-[a-z0-9-]+|locale-[a-z]{2}|PresenterApp|BrowseApp)-[0-9a-f]{32}\.js$/;

interface ProbeAnswer {
  status: number;
  headers: { get: (name: string) => string | null };
}

export interface ProbeEnv {
  onLine: () => boolean;
  origin: () => string | undefined;
  fetch: (url: string) => Promise<ProbeAnswer>;
}

function webProbeEnv(): ProbeEnv {
  const g = globalThis as unknown as {
    navigator?: { onLine?: boolean };
    location?: { origin?: string };
    fetch?: (url: string, init: { cache: 'no-store'; credentials: 'same-origin' }) => Promise<ProbeAnswer>;
  };
  return {
    onLine: () => g.navigator?.onLine !== false,
    origin: () => g.location?.origin,
    fetch: (url) => (g.fetch === undefined ? Promise.reject(new Error('no fetch')) : g.fetch(url, { cache: 'no-store', credentials: 'same-origin' })),
  };
}

/** The chunk URL a failed script load names (Metro's `AsyncRequireError.request`), when it is a lesson or story chunk of this host. */
export function failedChunkUrl(error: unknown, origin: string | undefined): string | undefined {
  if (!(error instanceof Error) || error.name !== 'AsyncRequireError') return undefined;
  const request = (error as Error & { request?: unknown }).request;
  if (typeof request !== 'string' || origin === undefined) return undefined;
  try {
    const url = new URL(request, origin);
    return url.origin === origin && CHUNK_PATH.test(url.pathname) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/**
 * True when a lesson (or story) chunk's script failed to load because the host has a newer build (F-CURR-002 §10):
 * asked again, its URL answers 404 or with an HTML page (the single-page fallback). The script tag cannot
 * tell this from a network failure when the HTML is refused as a script (an `X-Content-Type-Options:
 * nosniff` rule, a platform default), so the URL is asked once, online only, past every cache. A failed or
 * offline request is a network failure, never a newer build: the screen shows its Try again.
 */
export async function isNewBuildAnswer(error: unknown, env: ProbeEnv = webProbeEnv()): Promise<boolean> {
  if (!env.onLine()) return false;
  const url = failedChunkUrl(error, env.origin());
  if (url === undefined) return false;
  try {
    const answer = await env.fetch(url);
    if (answer.status === 404 || answer.status === 410) return true;
    return answer.status >= 200 && answer.status < 300 && /\btext\/html\b/i.test(answer.headers.get('content-type') ?? '');
  } catch {
    return false;
  }
}
