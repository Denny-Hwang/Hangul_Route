/**
 * The presenter's browser history plan (F-TCH-004 section 3.5 "History and the way back", rows
 * LV-M1 and LV-3), pure: `platform/presenter.web.ts` reads and writes `history.state` with it and
 * ignores the popstates its own `go()` calls cause.
 *
 * One entry per phase, above the presenter home: `home` (index 0), the start screen `ready`
 * (index 1) and the lesson `running` (index 2). The `ready` and `running` entries hold the open
 * deck's encoded fragment (ids, a seed and options; never a name), so a reload reopens it. The
 * browser or phone back then steps back one phase instead of leaving `/present`:
 *
 * 1. Boot: no deck, the entry is `home`; a deck link becomes `home` with a `ready` entry pushed
 *    over it, so the first back from a link opened in a new tab lands on the presenter home. A
 *    reload on `ready` reopens the start screen; on `running` it first steps back to its `ready`
 *    entry, so the entries stay `[home, ready]`. A `ready` entry at index 0 (the stale-presenter
 *    Reload, or an entry from a build before this plan) is a link.
 * 2. Forward: the home's choices push `ready`; Start pushes `running`. Overlays push nothing.
 * 3. Back from `ready`: the home, nothing saved or sent.
 * 4. Back from `running`: a covering overlay closes first, else the Exit confirm opens; `running`
 *    is pushed again only at the next user activation in the lesson (`popPlan` says so). A pop
 *    that lands on `home` while the lesson runs runs Exit.
 * 5. Back from `home` is the browser's own; the home's visible Back is decided once at boot
 *    (`homeBack`, kept in every entry for a reload).
 * 6. An invalid link replaces its entry with `home` and pushes nothing.
 * 7. Arriving on `home` from a deck clears the entries ahead (a `home` placeholder at index 1 is
 *    pushed and stepped back from), so no entry behind or ahead keeps a deck; a Forward onto the
 *    placeholder shows the home and steps back again.
 * 8. Only the presenter's own entries are touched: no step crosses the `home` entry.
 */

export type HistoryStep = 'home' | 'ready' | 'running';

export interface HistoryEntry {
  step: HistoryStep;
  /** The entry's place above the home entry: 0 for the home (1 for its placeholder), 1 for `ready`, 2 for `running`. */
  index: number;
  /** The open deck's encoded fragment, on `ready` and `running` only. */
  fragment?: string;
  /** Start over held this deck: a reload before Start opens it at its first slide (`ready` only). */
  fresh?: true;
  /** The home's Back may go back to the page before `/present` (rule 5). */
  homeBack?: boolean;
}

/** The `history.state` keys (section 3.5): `hrPresenter`, `hrIndex`, `hrLectureFragment`, plus the fresh mark and the home's Back. */
export const HISTORY_KEYS = {
  step: 'hrPresenter',
  index: 'hrIndex',
  fragment: 'hrLectureFragment',
  fresh: 'hrLectureFresh',
  homeBack: 'hrHomeBack',
} as const;

const STEPS: readonly HistoryStep[] = ['home', 'ready', 'running'];
/** Each step's index when the state does not give a usable one. */
const DEFAULT_INDEX: Record<HistoryStep, number> = { home: 0, ready: 1, running: 2 };
const MAX_INDEX = 2;

const isStep = (value: unknown): value is HistoryStep => typeof value === 'string' && (STEPS as readonly string[]).includes(value);

/**
 * The presenter entry a `history.state` holds, or null when it holds nothing of the presenter's. A
 * state with only a deck fragment (a build before this plan) is a `ready` entry at index 0, which
 * boot treats as a link. A `ready` or `running` entry may have no fragment (a deck too long for a
 * link still runs); boot then opens the home.
 */
export function readEntry(state: unknown): HistoryEntry | null {
  if (state === null || typeof state !== 'object') return null;
  const record = state as Record<string, unknown>;
  const rawStep = record[HISTORY_KEYS.step];
  const rawFragment = record[HISTORY_KEYS.fragment];
  const fragment = typeof rawFragment === 'string' ? rawFragment : undefined;
  const homeBack = typeof record[HISTORY_KEYS.homeBack] === 'boolean' ? (record[HISTORY_KEYS.homeBack] as boolean) : undefined;
  let step: HistoryStep;
  if (isStep(rawStep)) step = rawStep;
  else if (fragment !== undefined) step = 'ready';
  else if (homeBack !== undefined) step = 'home';
  else return null;
  const rawIndex = record[HISTORY_KEYS.index];
  const index =
    typeof rawIndex === 'number' && Number.isInteger(rawIndex) && rawIndex >= 0 && rawIndex <= MAX_INDEX
      ? rawIndex
      : isStep(rawStep)
        ? DEFAULT_INDEX[step]
        : 0;
  const out: HistoryEntry = { step, index };
  if (step !== 'home' && fragment !== undefined) out.fragment = fragment;
  if (step === 'ready' && record[HISTORY_KEYS.fresh] === true) out.fresh = true;
  if (homeBack !== undefined) out.homeBack = homeBack;
  return out;
}

/** The `history.state` of an entry (the inverse of `readEntry`). */
export function entryState(entry: HistoryEntry): Record<string, unknown> {
  const out: Record<string, unknown> = { [HISTORY_KEYS.step]: entry.step, [HISTORY_KEYS.index]: entry.index };
  if (entry.step !== 'home' && entry.fragment !== undefined) out[HISTORY_KEYS.fragment] = entry.fragment;
  if (entry.step === 'ready' && entry.fresh === true) out[HISTORY_KEYS.fresh] = true;
  if (entry.homeBack !== undefined) out[HISTORY_KEYS.homeBack] = entry.homeBack;
  return out;
}

/** The deck boot opens: `reloaded` when it came back from this tab's history (it may resume at its slide). */
export interface BootDeck {
  raw: string;
  reloaded: boolean;
  fresh?: true;
}

export interface BootPlan {
  /** The entry to write over the current one (`replaceState`); null: keep it. */
  replace: HistoryEntry | null;
  /** The entry to push after it; null: none. */
  push: HistoryEntry | null;
  /** Step back one entry (ignored by the pop handler): a reload on `running`, or on the home placeholder. */
  back: boolean;
  deck: BootDeck | null;
}

const home = (homeBack: boolean): HistoryEntry => ({ step: 'home', index: 0, homeBack });

/**
 * Rules 1 and 6 at boot. `link`: the `#d=` value of the address, if any; `entry`: what this tab's
 * history entry already holds; `accepts`: whether a fragment is a deck this presenter can open (an
 * invalid link pushes nothing); `homeBack`: the home's Back as this tab's history says now (rule 5),
 * used when no entry kept it.
 */
export function bootPlan(input: { link: string | null; entry: HistoryEntry | null; accepts: (raw: string) => boolean; homeBack: boolean }): BootPlan {
  const { link, entry, accepts } = input;
  const back = entry?.homeBack ?? input.homeBack;
  const asLink = (raw: string, reloaded: boolean, fresh?: true): BootPlan => {
    const deck: BootDeck = { raw, reloaded, ...(fresh ? { fresh } : {}) };
    if (!accepts(raw)) return { replace: home(back), push: null, back: false, deck };
    return { replace: home(back), push: { step: 'ready', index: 1, fragment: raw, homeBack: back, ...(fresh ? { fresh } : {}) }, back: false, deck };
  };
  if (link !== null) return asLink(link, false);
  if (entry === null) return { replace: home(back), push: null, back: false, deck: null };
  // The home, its placeholder (rule 7), or a deck step that holds no deck: the home, stepping back to it.
  if (entry.step === 'home' || entry.fragment === undefined) return { replace: { ...home(back), index: entry.index }, push: null, back: entry.index > 0, deck: null };
  const raw = entry.fragment;
  if (entry.step === 'ready' && entry.index === 0) return asLink(raw, true, entry.fresh);
  if (entry.step === 'ready') {
    return { replace: { ...entry, homeBack: back }, push: null, back: false, deck: { raw, reloaded: true, ...(entry.fresh ? { fresh: entry.fresh } : {}) } };
  }
  // A reload on the lesson: back to its start screen's entry, which holds the same deck.
  return { replace: null, push: null, back: true, deck: { raw, reloaded: true } };
}

/** Where a push for `step` goes from the entry the tab is on: pushed above it, or written over it when the tab is already there. */
export function pushPlan(current: HistoryEntry | null, step: 'ready' | 'running', entry: Omit<HistoryEntry, 'step' | 'index'>): { mode: 'push' | 'replace'; entry: HistoryEntry } {
  const here = current ?? { step: 'home', index: 0 };
  const homeBack = entry.homeBack ?? here.homeBack;
  const index = step === 'ready' ? 1 : here.step === 'ready' ? here.index + 1 : DEFAULT_INDEX.running;
  const next: HistoryEntry = { ...entry, step, index, ...(homeBack !== undefined ? { homeBack } : {}) };
  if (step === 'running') delete next.fresh;
  const mode = here.step === step || here.index >= index ? 'replace' : 'push';
  return { mode, entry: next };
}

/** What the presenter is showing when a popstate arrives. */
export interface PopContext {
  phase: 'boot' | 'invalid' | 'home' | 'ready' | 'running';
  /** The lesson's first slide was shown (a Start the window could not show has not begun). */
  begun: boolean;
  /** A covering overlay (blank, pause, grid, help, the full timer, the phone's More sheet) or the Exit confirm. */
  overlay: 'none' | 'covering' | 'exit';
}

export type PopAction =
  /** Nothing to do (the screen is already where the entry is). */
  | { kind: 'none' }
  /** The presenter home, nothing saved or sent; then clear the entries ahead (rule 7). */
  | { kind: 'home' }
  /** Run Exit (rule 4: the second back is the answer); Exit clears the entries ahead. */
  | { kind: 'exit' }
  /** Close the covering overlay, as Esc does; push `running` again at the next user activation. */
  | { kind: 'close-overlay' }
  /** Open the Exit confirm; push `running` again at the next user activation. */
  | { kind: 'confirm' }
  /** A lesson not yet begun: back to its start screen (nothing was counted or stored). */
  | { kind: 'ready' }
  /** Back on the lesson's own entry (a Forward after a back): close the confirm; no push is owed. */
  | { kind: 'resume' }
  /** A Forward onto an entry the screen is not on (the home placeholder, a lesson left): step back again. */
  | { kind: 'step-back' };

/** Rules 3, 4 and 7 for a popstate: `landed` is the entry the browser landed on (null: a home). */
export function popPlan(landed: HistoryEntry | null, ctx: PopContext): PopAction {
  const at: HistoryEntry = landed ?? { step: 'home', index: 0 };
  if (ctx.phase === 'running') {
    if (at.step === 'home') return { kind: 'exit' };
    if (at.step === 'running') return { kind: 'resume' };
    if (!ctx.begun) return { kind: 'ready' };
    return ctx.overlay === 'covering' ? { kind: 'close-overlay' } : { kind: 'confirm' };
  }
  if (ctx.phase === 'ready') {
    if (at.step === 'home') return { kind: 'home' };
    return at.step === 'running' ? { kind: 'step-back' } : { kind: 'none' };
  }
  if (ctx.phase === 'home') return at.step === 'home' && at.index === 0 ? { kind: 'none' } : { kind: 'step-back' };
  return { kind: 'none' };
}

/** How far back the home entry is from `entry` (`history.go(-hrIndex)`, rule 4); 0 on the home. */
export function stepsToHome(entry: HistoryEntry | null): number {
  return entry === null ? 0 : entry.index;
}
