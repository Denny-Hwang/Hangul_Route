import { useEffect, useRef } from 'react';
import { browserMove, mergeEntry, navDepth, readEntry, reconcile, type EntryState, type NavStateLike } from '../logic/navigation/history-sync';

/**
 * The web history bridge (AMENDMENTS-DISPLAY-NAV section 7.2, row DN-4; amends F-LEARN-001
 * §3.15.4): the learner app and All lessons have no linking config and their address never
 * changes (F-LAYOUT-001 LD7), yet the browser's and the phone's back must do what the visible Back
 * does. The bridge keeps the tab's history entries in step with the navigator, whoever changed it:
 *
 * - **The app changed the stack** (a push, the visible Back, `replace`, `reset`, a sheet): one
 *   `pushState` per new level, or `history.go` back past the levels it left (its own popstate is
 *   ignored). The same depth changes nothing: an entry stands for a depth, not a route.
 * - **The browser changed the history** (back, a long-press jump): the app pops that many levels,
 *   one at a time, through each screen's `beforeRemove` guard; when a guard holds the screen (a
 *   quest's leave sheet), the entries the browser took are pushed back. Forward (or an iOS swipe
 *   forward) is never replayed: the bridge goes straight back, so a gated screen the person left
 *   (the Grown-up area) never comes back without the gate.
 * - **Sheets** (the Display sheet, a ConfirmSheet) are one level while open: the browser back
 *   closes them as Cancel does.
 * - **Boot**: a reload deep in the app (the navigator restarts at its root) first rewinds to the
 *   app's first entry, so no dead entry is left and one back leaves the app.
 *
 * Every browser call is guarded; with no `history` the bridge does nothing. The rules are pure in
 * `logic/navigation/history-sync.ts`.
 */

/** What the bridge needs from the navigation container ref. */
export interface BridgeNavigation {
  getRootState(): NavStateLike | undefined;
  goBack(): void;
  addListener(type: 'state', listener: () => void): () => void;
}

interface HistoryLike {
  readonly state: unknown;
  pushState(state: unknown, unused: string): void;
  replaceState(state: unknown, unused: string, url?: string): void;
  go(delta: number): void;
}

interface WindowLike {
  history?: HistoryLike;
  document?: { visibilityState?: string };
  addEventListener?: (type: string, listener: (event?: unknown) => void) => void;
  removeEventListener?: (type: string, listener: (event?: unknown) => void) => void;
}

interface Sheet {
  dismiss: () => void;
}

interface Bridge {
  navigation: BridgeNavigation | null;
  /** The `hrNav` of the entry the tab is on, as far as the bridge knows. */
  own: number;
  /** Its `hrBrowseDepth` (All lessons; 0 in the learner app). */
  browseDepth: number;
  /** Popstates that the bridge's own `history.go` calls will still cause. */
  expected: number;
  /** Open sheets, the last on top. */
  sheets: Sheet[];
  /** True while the bridge pops the app for a browser back (its own state changes wait). */
  popping: boolean;
  /**
   * True once the page started to leave for another document (a hand-off to the grown-up pages,
   * All lessons, billing): the app may still step back under it (so a return through the
   * back/forward cache lands on the screen below), but the history is left alone, since a
   * traversal now would cancel the navigation that is leaving.
   */
  leaving: boolean;
  /** When it started to leave (`Date.now()`). */
  leftAt: number;
}

const bridge: Bridge = { navigation: null, own: 0, browseDepth: 0, expected: 0, sheets: [], popping: false, leaving: false, leftAt: 0 };

/**
 * How long after the page started to leave the person's own input (a tap, a key) counts as staying:
 * the navigation did not happen (stopped, or it was not a page). No timer resumes the bridge by
 * itself, because a slow page on a phone network is still leaving after any fixed wait, and a
 * traversal then would cancel it; only the person using the page again, or the page shown again
 * (`pageshow`), does.
 */
const LEAVING_GRACE_MS = 10_000;

function browser(): WindowLike {
  return globalThis as WindowLike;
}

function history(): HistoryLike | undefined {
  try {
    return browser().history;
  } catch {
    return undefined;
  }
}

function depthNow(): number {
  let depth = 0;
  try {
    depth = bridge.navigation ? navDepth(bridge.navigation.getRootState()) : 0;
  } catch {
    depth = 0;
  }
  return depth + bridge.sheets.length;
}

function write(kind: 'push' | 'replace', patch: { hrNav?: number; hrBrowseDepth?: number }): void {
  const h = history();
  if (!h) return;
  try {
    const next = mergeEntry(h.state, patch);
    if (kind === 'push') h.pushState(next, '');
    else h.replaceState(next, '');
  } catch {
    // A sandboxed frame may refuse; the visible Back still works.
  }
}

/** `history.go` that the bridge itself causes: its popstate is not a browser move. */
function go(by: number): void {
  const h = history();
  if (!h || by === 0) return;
  bridge.expected += 1;
  try {
    h.go(by);
  } catch {
    bridge.expected -= 1;
  }
}

/** Brings the history in step with the app's depth now (after any navigation or sheet change). */
export function syncHistory(): void {
  if (bridge.navigation === null || bridge.expected > 0 || bridge.popping || bridge.leaving) return;
  const step = reconcile(bridge.own, depthNow());
  if (step.kind === 'push') {
    for (const nav of step.navs) write('push', { hrNav: nav });
    bridge.own = step.navs[step.navs.length - 1]!;
  } else if (step.kind === 'back') {
    bridge.own -= step.by;
    go(-step.by);
  }
}

/** Pops the app `levels` levels for a browser back, one at a time, each through the screen's guard. */
function popLevels(levels: number): void {
  bridge.popping = true;
  try {
    for (let i = 0; i < levels; i += 1) {
      const sheet = bridge.sheets.pop();
      if (sheet) {
        // The browser back closes a sheet as Cancel does; it is already out of the count.
        sheet.dismiss();
        continue;
      }
      const before = depthNow();
      bridge.navigation?.goBack();
      // A guard held the screen (a quest's leave sheet asks first): stop here.
      if (depthNow() >= before) break;
    }
  } finally {
    bridge.popping = false;
  }
  // When a guard held the screen, the entries the browser took away are pushed back.
  syncHistory();
}

function onPopState(event?: unknown): void {
  const h = history();
  const entry: EntryState = readEntry((event as { state?: unknown } | undefined)?.state ?? h?.state);
  if (bridge.expected > 0) {
    bridge.expected -= 1;
    if (entry.nav !== null) {
      bridge.own = entry.nav;
      bridge.browseDepth = entry.browseDepth;
    }
    syncHistory();
    return;
  }
  // An entry the app does not own: All lessons' later link (its hashchange claims it).
  if (entry.nav === null || bridge.navigation === null) return;
  if (entry.browseDepth !== bridge.browseDepth) {
    // The browser moved across All lessons' links: the screen shows the newer link, the entries count from here.
    bridge.own = entry.nav;
    bridge.browseDepth = entry.browseDepth;
    return;
  }
  if (bridge.leaving) return;
  bridge.own = entry.nav;
  const move = browserMove(entry.nav, depthNow());
  if (move.kind === 'refuse-forward') {
    bridge.own = entry.nav - move.by;
    go(-move.by);
  } else if (move.kind === 'pop') {
    popLevels(move.levels);
  }
}

/**
 * The page is leaving for another document (a hand-off's `location.assign`, All lessons' way back
 * to the page that opened it): from now on the bridge writes no history, since a traversal now
 * would cancel the navigation that is leaving. Every hand-off calls it itself right before it
 * leaves, because iOS Safari and an installed iOS app do not fire `beforeunload` reliably;
 * `beforeunload` and `pagehide` call it too.
 */
export function markLeaving(): void {
  bridge.leaving = true;
  bridge.leftAt = Date.now();
}

/**
 * [OA] Whether the page is leaving for another document (`markLeaving`), and has not come back into use since. Row
 * OA-4a: the chooser a hand-off went back to as it left keeps the unlock or pass that hand-off wrote.
 */
export function pageLeaving(): boolean {
  return bridge.leaving;
}

/**
 * Starts the bridge for one root (`App`, `BrowseApp`) once its navigation container is ready;
 * returns the stop. The entry the app opens on becomes `hrNav: 0`; a reload deep in the app rewinds
 * first.
 */
export function installHistoryBridge(navigation: BridgeNavigation): () => void {
  const w = browser();
  const h = history();
  if (!h || typeof w.addEventListener !== 'function') return () => undefined;
  bridge.navigation = navigation;
  bridge.sheets = [];
  bridge.expected = 0;
  bridge.popping = false;
  bridge.leaving = false;
  const entry = readEntry(h.state);
  bridge.browseDepth = entry.browseDepth;
  bridge.own = 0;
  const onLeaving = (): void => markLeaving();
  const onShow = (): void => resume();
  // The person uses the page again long after it started to leave: the navigation did not happen.
  const onInput = (): void => {
    if (!bridge.leaving || Date.now() - bridge.leftAt < LEAVING_GRACE_MS) return;
    let visible = true;
    try {
      visible = (w.document?.visibilityState ?? 'visible') === 'visible';
    } catch {
      visible = true;
    }
    if (visible) resume();
  };
  w.addEventListener('popstate', onPopState);
  w.addEventListener('beforeunload', onLeaving);
  w.addEventListener('pagehide', onLeaving);
  w.addEventListener('pageshow', onShow);
  w.addEventListener('pointerdown', onInput);
  w.addEventListener('keydown', onInput);
  const offState = navigation.addListener('state', syncHistory);
  if (entry.nav !== null && entry.nav > 0) {
    // A reload deep in the app: the navigator restarted at its root, so go back to the first entry.
    go(-entry.nav);
  } else {
    write('replace', { hrNav: 0 });
    syncHistory();
  }
  return () => {
    w.removeEventListener?.('popstate', onPopState);
    w.removeEventListener?.('beforeunload', onLeaving);
    w.removeEventListener?.('pagehide', onLeaving);
    w.removeEventListener?.('pageshow', onShow);
    w.removeEventListener?.('pointerdown', onInput);
    w.removeEventListener?.('keydown', onInput);
    offState();
    bridge.navigation = null;
    bridge.sheets = [];
    bridge.expected = 0;
    bridge.leaving = false;
  };
}

/**
 * The page is shown again (restored from the back/forward cache) or did not leave after all (the
 * person uses it again after the grace): the entry it is on is read again and the history brought
 * in step with the app (a hand-off that stepped the app back under it leaves its entry ahead of the
 * app's depth).
 */
function resume(): void {
  if (!bridge.leaving) return;
  bridge.leaving = false;
  bridge.expected = 0;
  const entry = readEntry(history()?.state);
  if (entry.nav !== null) {
    bridge.own = entry.nav;
    bridge.browseDepth = entry.browseDepth;
  }
  syncHistory();
}

/**
 * Holds one history level while a sheet is open (the Display sheet, a ConfirmSheet); returns the
 * release, which a sheet closed by its own buttons calls to give the entry back. The browser or
 * phone back calls `dismiss` instead (as Cancel), and the release is then a no-op.
 */
export function registerHistorySheet(dismiss: () => void): () => void {
  if (bridge.navigation === null) return () => undefined;
  const sheet: Sheet = { dismiss };
  bridge.sheets.push(sheet);
  syncHistory();
  return () => {
    const at = bridge.sheets.indexOf(sheet);
    if (at < 0) return;
    bridge.sheets.splice(at, 1);
    syncHistory();
  };
}

/** `registerHistorySheet` for a sheet component: one level while `open`. */
export function useHistorySheet(open: boolean, dismiss: () => void): void {
  const latest = useRef(dismiss);
  latest.current = dismiss;
  useEffect(() => (open ? registerHistorySheet(() => latest.current()) : undefined), [open]);
}

/** The entry the tab is on, as the bridge knows it (its depth and All lessons' link depth); null before the bridge runs. */
export function currentEntry(): EntryState | null {
  return bridge.navigation === null ? null : { nav: bridge.own, browseDepth: bridge.browseDepth };
}

/** All lessons took a later link's entry: it starts at depth 0 with this link depth. */
export function adoptLinkEntry(browseDepth: number): void {
  bridge.own = 0;
  bridge.browseDepth = browseDepth;
}
