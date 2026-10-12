import { APP_ROUTES, GROWN_UP_PREFIXES, isGrownUpPath, type GrownUpPrefix } from '@hangul-route/content-schema';

/**
 * The bounce rule (F-APP-001 section 3.4, A-6). The learner bundle boots on a grown-up path only
 * when the host's single-page fallback answered a URL that has no file (an unknown or mistyped
 * console URL): the tab then goes to the persona entry of the prefix, `/parent*` to `/parent`,
 * `/teach*` to `/teach`, anything else to `/signin`, and `shell.path_bounced` names the prefix.
 * The query keys the entries read (`persona`, its alias `as`, and the `lang` hand-off) go along;
 * every other key, and the fragment, stays behind.
 *
 * A path that already is its entry never bounces (it mounts the learner app instead). On a host
 * that serves the entries as console pages (A-3 onwards) the learner bundle never boots there;
 * on one that does not (production before A-3, a learner-only build) bouncing to itself would
 * reload the tab forever.
 */
export type BouncePrefix = GrownUpPrefix extends `/${infer Name}` ? Name : never;

export interface Bounce {
  /** The `shell.path_bounced` payload code: the prefix without its slash. */
  prefix: BouncePrefix;
  /** The persona entry to replace the address with. */
  target: string;
}

const ENTRY: Readonly<Record<GrownUpPrefix, string>> = {
  '/parent': APP_ROUTES.parentHome,
  '/teach': APP_ROUTES.teacherIndex,
  '/signin': APP_ROUTES.signIn,
  '/start': APP_ROUTES.signIn,
  '/account': APP_ROUTES.signIn,
};

/** Query keys an entry page reads (sections 3.7 and 3.11). */
const KEPT_KEYS = ['persona', 'as', 'lang'] as const;

/** `/teach/` is the entry `/teach` itself (only grown-up paths, never `/`, reach this). */
function withoutTrailingSlash(pathname: string): string {
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

function keptQuery(search: string): string {
  const from = new URLSearchParams(search);
  const kept = new URLSearchParams();
  for (const key of KEPT_KEYS) {
    const value = from.get(key);
    if (value !== null) kept.set(key, value);
  }
  const query = kept.toString();
  return query === '' ? '' : `?${query}`;
}

export function bounceFor(pathname: string, search = ''): Bounce | null {
  // `isGrownUpPath` is the one implementation of the prefix rule (R-1). No prefix starts another
  // one, so the prefix a grown-up path starts with is the one it matched.
  const prefix = GROWN_UP_PREFIXES.find((p) => pathname.startsWith(p));
  if (prefix === undefined || !isGrownUpPath(pathname)) return null;
  const entry = ENTRY[prefix];
  if (withoutTrailingSlash(pathname) === entry) return null;
  return { prefix: prefix.slice(1) as BouncePrefix, target: `${entry}${keptQuery(search)}` };
}
