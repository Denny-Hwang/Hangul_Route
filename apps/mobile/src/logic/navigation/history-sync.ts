/**
 * The web history bridge's rules (AMENDMENTS-DISPLAY-NAV section 7.2, row DN-4), pure so each one
 * is unit-tested; `platform/history-bridge.web.ts` applies them to `window.history`.
 *
 * The bridge is a reconciler: it keeps the tab's history entries in step with the navigator, so
 * the browser's and the phone's back do what the visible Back does. An entry stands for a depth,
 * not a route: each entry the app owns carries its depth as `hrNav` on `history.state`, beside any
 * other key of the same entry (All lessons keeps `hrBrowseDepth` there).
 */

/** The parts of a navigation state the depth is read from (React Navigation's state, nested). */
export interface NavStateLike {
  type?: string;
  index?: number;
  routes: readonly { state?: NavStateLike }[];
}

/**
 * The app's depth: the number of routes above the root along the focused path of the nested
 * stacks. A tab navigator adds nothing (switching tabs is not a step deeper). A nested state that
 * has not been built yet (no `index`) counts its last route as focused.
 */
export function navDepth(state: NavStateLike | undefined): number {
  let depth = 0;
  let at: NavStateLike | undefined = state;
  while (at !== undefined && at.routes.length > 0) {
    const index = typeof at.index === 'number' ? at.index : at.routes.length - 1;
    if (at.type !== 'tab') depth += Math.max(0, index);
    at = at.routes[Math.min(Math.max(0, index), at.routes.length - 1)]?.state;
  }
  return depth;
}

/** What the bridge reads from one history entry: its depth (absent on an entry the app does not own) and All lessons' link depth. */
export interface EntryState {
  nav: number | null;
  browseDepth: number;
}

const wholeNumber = (value: unknown): number | null => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null);

export function readEntry(state: unknown): EntryState {
  const record = state !== null && typeof state === 'object' ? (state as Record<string, unknown>) : {};
  return { nav: wholeNumber(record.hrNav), browseDepth: wholeNumber(record.hrBrowseDepth) ?? 0 };
}

/** The entry's state object with `patch` written over it, every other key kept (one object for both keys). */
export function mergeEntry(state: unknown, patch: { hrNav?: number; hrBrowseDepth?: number }): Record<string, unknown> {
  const base = state !== null && typeof state === 'object' && !Array.isArray(state) ? (state as Record<string, unknown>) : {};
  return { ...base, ...patch };
}

/** How the history moves when the app's depth changed: push one entry per new level, or go back past the levels it left. */
export type Reconcile = { kind: 'none' } | { kind: 'push'; navs: number[] } | { kind: 'back'; by: number };

export function reconcile(entryNav: number, depth: number): Reconcile {
  if (depth > entryNav) return { kind: 'push', navs: Array.from({ length: depth - entryNav }, (_, i) => entryNav + i + 1) };
  if (depth < entryNav) return { kind: 'back', by: entryNav - depth };
  return { kind: 'none' };
}

/**
 * The browser moved the history (a back, a long-press jump, a Forward or an iOS swipe forward) to
 * an entry of depth `target` while the app shows `depth`: below, pop the app that many levels
 * (each through its `beforeRemove` guard); above, never replay it: go straight back down.
 */
export type BrowserMove = { kind: 'none' } | { kind: 'pop'; levels: number } | { kind: 'refuse-forward'; by: number };

export function browserMove(target: number, depth: number): BrowserMove {
  if (target < depth) return { kind: 'pop', levels: depth - target };
  if (target > depth) return { kind: 'refuse-forward', by: target - depth };
  return { kind: 'none' };
}

/**
 * All lessons: a later link (a `hashchange`) is a new entry on top of the one the tab was on. Its
 * `hrBrowseDepth` counts every entry this page added under it (the earlier link entries and the
 * depth entries above them), so Close goes back `1 + hrBrowseDepth + hrNav` and lands on the page
 * that opened All lessons.
 */
export function linkEntryDepth(left: EntryState): number {
  return left.browseDepth + (left.nav ?? 0) + 1;
}

/** How far Close goes back from an entry: past the depth entries, the link entries and the page's first entry. */
export function closeDistance(entry: EntryState): number {
  return 1 + entry.browseDepth + (entry.nav ?? 0);
}
