import { NATIVE_CLIENT_HEADER, NATIVE_CLIENT_VALUE } from '@hangul-route/content-schema';

/**
 * F-AUTH-004 sections 8.1, 8.8 and 11 (row NS-2; CS-N8): the one client the native grown-up homes call the Worker
 * through. Pure: the fetch and the Clerk token come in, so every rule has a test.
 *
 * - The base is `EXPO_PUBLIC_API_BASE_URL`, refused unless it is `https:` (a development build may use
 *   `http://localhost`); a base with a user, a query or a fragment is refused too. A refused base sends nothing.
 * - Every call asks Clerk for a fresh token (`getToken`); no token (signed out mid-flight) answers `unauthorized`
 *   and no request leaves, as the console's `createConsoleApi` does. A token call that fails for the network (Clerk
 *   throws `network_error`, `rethrowOfflineNetworkErrors` in `platform/clerk.native.tsx`) answers `offline`, never
 *   `unauthorized`, so a dropped connection never deletes the records (section 8.8).
 * - Every request carries `Authorization: Bearer`, `X-HR-Client: native` and asks for no cache (`Cache-Control:
 *   no-store`, and `cache: 'no-store'`, which React Native's fetch turns into a `_=<time>` query on a GET).
 * - An allow list of paths on the base's own origin, read after the URL is normalised (`%2e%2e` and `%2F` included):
 *   `/api/spaces` and its sub-paths (with no query but `period`), and `/api/billing/summary?view=status`. So the
 *   account token never rides on the learner's sync or restore paths, on a money route or anywhere else, and no
 *   device secret is sent on an account route (section 11; the Worker refuses them too, section 9.4).
 * - `redirect: 'manual'` asks for no redirect to be followed with the bearer. React Native's fetch ignores it (its
 *   request follows a redirect, and the platform decides whether `Authorization` goes along); an answer that came from
 *   another URL reads as `error`. The Worker never redirects these routes; device check D11 covers the rest.
 *
 * The Worker's envelope is `{ data }` on success and `{ error: { code } }` otherwise. `data` comes back as `unknown`:
 * each screen parses what it reads (row NS-5).
 */

export type AccountApiError = 'refused' | 'unauthorized' | 'native_off' | 'forbidden' | 'not_found' | 'offline' | 'error';

export type AccountApiResult = { ok: true; data: unknown } | { ok: false; error: AccountApiError; status: number };

export type FetchLike = (url: string, init: RequestInit) => Promise<Pick<Response, 'status' | 'json' | 'url' | 'type'>>;

export interface AccountApiOptions {
  /** `EXPO_PUBLIC_API_BASE_URL` as built. */
  baseUrl: string | undefined;
  /** A development build (`__DEV__`): `http://localhost` is allowed. */
  dev: boolean;
  /** Clerk's `getToken()`: a fresh session token, or null when signed out. */
  getToken: () => Promise<string | null>;
  fetch: FetchLike;
}

const LOCAL_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1']);

/** The base origin the client may call, or null when it is refused. */
export function accountApiBase(raw: string | undefined, dev: boolean): string | null {
  if (raw === undefined || raw.trim() !== raw || raw === '') return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '') return null;
  if (url.pathname !== '/' && url.pathname !== '') return null;
  const secure = url.protocol === 'https:';
  const local = dev && url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname);
  return secure || local ? url.origin : null;
}

/** The account paths (section 8.1), as normalised and decoded: the spaces routes, and the plan status view. */
const SPACES_PATH = /^\/api\/spaces(\/[^/;]+)*$/;
const STATUS_PATH = '/api/billing/summary';
const PERIOD_QUERY = /^\?period=(day|week|month|all)$/;

/** The full URL of `path` on `base`, or null when the path is not one of the account paths of that origin. */
export function accountUrl(base: string, path: string): string | null {
  if (!path.startsWith('/api/') || path.includes('\\') || path.includes('#')) return null;
  // `base` is an origin `accountApiBase` parsed and `path` starts with `/`, so this cannot throw.
  const url = new URL(path, base);
  if (url.origin !== base) return null;
  // An encoded slash or dot (`%2F`, `%2e`) is not a segment to the URL but may be one to the Worker's router: read the
  // path decoded and with its dot segments resolved too, and require both readings to be the same account path.
  let decoded: string;
  try {
    decoded = new URL(decodeURIComponent(url.pathname), base).pathname;
  } catch {
    return null;
  }
  const spaces = SPACES_PATH.test(url.pathname) && SPACES_PATH.test(decoded) && (url.search === '' || PERIOD_QUERY.test(url.search));
  const status = url.pathname === STATUS_PATH && decoded === STATUS_PATH && url.search === '?view=status';
  return spaces || status ? url.toString() : null;
}

/** A Clerk error for a request that failed for the network (`ClerkRuntimeError` with code `network_error`). */
function networkError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'network_error';
}

/** Whether an answer came from somewhere other than the URL asked (a redirect React Native's fetch followed). */
function redirected(asked: string, answered: string): boolean {
  if (answered === '') return false;
  try {
    const a = new URL(asked);
    const b = new URL(answered);
    return a.origin !== b.origin || a.pathname !== b.pathname;
  } catch {
    return true;
  }
}

function errorFor(status: number, code: unknown): AccountApiError {
  if (status === 401) return 'unauthorized';
  if (status === 403) return code === 'native_off' ? 'native_off' : 'forbidden';
  if (status === 404) return 'not_found';
  return 'error';
}

/** One path segment from an id: encoded, and never `.` or `..` (which the URL would resolve). */
function segment(id: string): string | null {
  if (id === '' || id === '.' || id === '..') return null;
  return encodeURIComponent(id);
}

export type ReportPeriod = 'day' | 'week' | 'month' | 'all';

export interface AccountApi {
  /** Any account path (tests and rows to come); `get` and the named calls below go through it. */
  request: (method: 'GET' | 'POST', path: string) => Promise<AccountApiResult>;
  spaces: () => Promise<AccountApiResult>;
  roster: (spaceId: string) => Promise<AccountApiResult>;
  makeCode: (spaceId: string) => Promise<AccountApiResult>;
  learnerReport: (spaceId: string, learnerId: string, period: ReportPeriod) => Promise<AccountApiResult>;
  classReport: (spaceId: string, period: ReportPeriod) => Promise<AccountApiResult>;
  school: (spaceId: string) => Promise<AccountApiResult>;
  /** Section 8.5: always the status view (the Worker sends it to a native request whatever the query says). */
  planStatus: () => Promise<AccountApiResult>;
}

const REFUSED: AccountApiResult = { ok: false, error: 'refused', status: 0 };

export function createAccountApi(opts: AccountApiOptions): AccountApi {
  const base = accountApiBase(opts.baseUrl, opts.dev);

  const request = async (method: 'GET' | 'POST', path: string): Promise<AccountApiResult> => {
    if (base === null) return REFUSED;
    const url = accountUrl(base, path);
    if (url === null) return REFUSED;
    let token: string | null;
    try {
      token = await opts.getToken();
    } catch (error) {
      return networkError(error) ? { ok: false, error: 'offline', status: -1 } : { ok: false, error: 'error', status: 0 };
    }
    if (!token) return { ok: false, error: 'unauthorized', status: 401 };
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await opts.fetch(url, {
        method,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-store',
          [NATIVE_CLIENT_HEADER]: NATIVE_CLIENT_VALUE,
        },
        cache: 'no-store',
        redirect: 'manual',
        credentials: 'omit',
      });
    } catch {
      return { ok: false, error: 'offline', status: -1 };
    }
    if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400)) return { ok: false, error: 'error', status: res.status };
    if (typeof res.url === 'string' && redirected(url, res.url)) return { ok: false, error: 'error', status: res.status };
    const body = (await res.json().catch(() => null)) as { data?: unknown; error?: { code?: unknown } } | null;
    if (res.status >= 200 && res.status < 300 && body !== null && typeof body === 'object' && body.data !== undefined) return { ok: true, data: body.data };
    return { ok: false, error: errorFor(res.status, body?.error?.code), status: res.status };
  };

  const withId = (ids: string[], build: (s: string[]) => string, method: 'GET' | 'POST' = 'GET'): Promise<AccountApiResult> => {
    const parts = ids.map(segment);
    if (parts.some((p) => p === null)) return Promise.resolve(REFUSED);
    return request(method, build(parts as string[]));
  };

  return {
    request,
    spaces: () => request('GET', '/api/spaces'),
    roster: (spaceId) => withId([spaceId], ([s]) => `/api/spaces/${s}/roster`),
    makeCode: (spaceId) => withId([spaceId], ([s]) => `/api/spaces/${s}/code`, 'POST'),
    learnerReport: (spaceId, learnerId, period) => withId([spaceId, learnerId], ([s, l]) => `/api/spaces/${s}/learners/${l}/report?period=${period}`),
    classReport: (spaceId, period) => withId([spaceId], ([s]) => `/api/spaces/${s}/class-report?period=${period}`),
    school: (spaceId) => withId([spaceId], ([s]) => `/api/spaces/${s}/school`),
    planStatus: () => request('GET', '/api/billing/summary?view=status'),
  };
}
