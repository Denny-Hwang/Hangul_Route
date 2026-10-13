import { BROWSE_PASS_SESSION_KEY, buildBrowseUrl, type BrowsePass, type BrowseSource, type BrowseTarget } from '@hangul-route/content-schema';
import type { UiLocale } from '@hangul-route/i18n';
import { browserStorage, writeItem, type KeyValueStorage } from '../i18n/safe-storage';
import type { ApiResult } from './api';
import { browseEntryShown, buildEnv, type ConsoleEnv } from './config';

/**
 * The console half of the account hand-off to All lessons (F-BROWSE-001 section 4.3 "Account hand-off", 4.11;
 * wireframe design/wireframes/browse/entry-points.md). Same origin, same tab: the console reads the account's
 * scope once per page, writes the tab's pass to `sessionStorage[BROWSE_PASS_SESSION_KEY]`, then
 * `location.assign`s `/browse#t=…&s=…`. A failed check or blocked storage never navigates. The pass holds the
 * scope, the source, two timestamps and the locale only (`BrowsePassSchema` is strict), and a link holds content
 * ids only (BD7).
 */

export type PassScope = BrowsePass['scope'];

/** What one open did: navigated, or the inline line the control shows instead (section 4.3 steps 3 and 4). */
export type OpenBrowseResult = 'opened' | 'check_failed' | 'storage_blocked';

export type BrowseScopeRead = () => Promise<ApiResult<{ scope: PassScope }>>;

export interface BrowseLinkDeps {
  /** The page's origin (the app origin: the entries render only there). */
  origin: string;
  now: () => number;
  /** The tab's `sessionStorage` behind the guarded wrapper; null where the browser blocks it. */
  storage: KeyValueStorage | null;
  /** The console's UI locale, carried so All lessons opens in the same language. */
  locale: UiLocale;
  assign: (url: string) => void;
  readScope: BrowseScopeRead;
}

/** An account pass; a fallback pass is always `sampler` (fail closed to the free set, never to `full`). */
export function accountPass(scope: PassScope, now: number, uiLocale: UiLocale, fallback = false): BrowsePass {
  return fallback
    ? { v: 1, scope: 'sampler', source: 'account', issuedAt: now, seen: now, fallback: true, uiLocale }
    : { v: 1, scope, source: 'account', issuedAt: now, seen: now, uiLocale };
}

/** True when the pass was stored; false with no storage or a storage that refuses. */
export function writeBrowsePass(storage: KeyValueStorage | null, pass: BrowsePass): boolean {
  return writeItem(storage, BROWSE_PASS_SESSION_KEY, JSON.stringify(pass));
}

/** `${origin}/browse#…` for an entry: home without a target; a target that is not a content id is left out. */
export function browseUrl(origin: string, target: BrowseTarget | undefined, source: BrowseSource): string {
  return buildBrowseUrl(origin, target === undefined ? { source } : { target, source });
}

function writeAndGo(pass: BrowsePass, target: BrowseTarget | undefined, source: BrowseSource, deps: BrowseLinkDeps): OpenBrowseResult {
  if (!writeBrowsePass(deps.storage, pass)) return 'storage_blocked';
  deps.assign(browseUrl(deps.origin, target, source));
  return 'opened';
}

/** Section 4.3 steps 1-4: check the scope, write the pass, go. */
export async function openBrowse(target: BrowseTarget | undefined, source: BrowseSource, deps: BrowseLinkDeps): Promise<OpenBrowseResult> {
  if (!deps.storage) return 'storage_blocked';
  let scope: PassScope;
  try {
    const read = await deps.readScope();
    if (!read.ok) return 'check_failed';
    scope = read.data.scope;
  } catch {
    return 'check_failed';
  }
  return writeAndGo(accountPass(scope, deps.now(), deps.locale), target, source, deps);
}

/** [ Open free lessons ] after a failed check: a 1-hour sampler pass with `fallback: true`, no scope read. */
export function openFreeLessons(target: BrowseTarget | undefined, source: BrowseSource, deps: BrowseLinkDeps): OpenBrowseResult {
  return writeAndGo(accountPass('sampler', deps.now(), deps.locale, true), target, source, deps);
}

interface ScopeSource {
  browseScope: BrowseScopeRead;
}

/** The successful scope read of this page, per API client (a new sign-in makes a new client). */
let cache = new WeakMap<ScopeSource, Promise<ApiResult<{ scope: PassScope }>>>();

/** Test hook: forget the page's scope reads. */
export function resetBrowseScopeCache(): void {
  cache = new WeakMap();
}

/**
 * The account scope, cached for the page (section 4.3 step 2). Only a successful read is kept, so
 * [ Try again ] asks the Worker again. With no API client (no API address on this build) the check fails.
 */
export function scopeReader(api: ScopeSource | null): BrowseScopeRead {
  return async () => {
    if (!api) return { ok: false, error: 'unknown', status: -1 };
    const held = cache.get(api);
    if (held) return held;
    const pending = api.browseScope();
    cache.set(api, pending);
    const result = await pending.catch((): ApiResult<{ scope: PassScope }> => ({ ok: false, error: 'network', status: -1 }));
    if (!result.ok) cache.delete(api);
    return result;
  };
}

/** Whether the console's All lessons entries render: `browseEnabled()` and the app origin (section 4.11). */
export function browseLinksShown(origin: string, env: ConsoleEnv = buildEnv()): boolean {
  return browseEntryShown(origin, env);
}

export interface ClickLike {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
}

/**
 * A plain primary click opens through `openBrowse`. A modifier click, a middle click (and a long-press, which
 * fires no click) is left to the browser: the new tab carries no pass, so All lessons shows its Access screen
 * there and removes the unlock and the console session at boot (BR-6, `canGoBack()` false).
 */
export function isPlainClick(event: ClickLike): boolean {
  return !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/** The browser's dependencies for `openBrowse`. */
export function browserBrowseDeps(locale: UiLocale, readScope: BrowseScopeRead): BrowseLinkDeps {
  const win = typeof window === 'undefined' ? null : window;
  return {
    origin: win?.location.origin ?? '',
    now: () => Date.now(),
    storage: browserStorage('session'),
    locale,
    assign: (url) => win?.location.assign(url),
    readScope,
  };
}
