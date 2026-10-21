/**
 * Presenter controls (F-TCH-004 §3.5): a pure reducer over the slide index,
 * the reveal (build) inside a slide, the one open covering overlay and the
 * class timer. The screen turns keys, taps and buttons into `PresenterEvent`s
 * and performs the returned `effect` (play a newly revealed build, replay a
 * sound or the stroke guide, start the class timer), so this module never
 * touches audio, timers or the DOM.
 *
 * - `next` reveals the slide's next build before it advances; at the last
 *   slide it does nothing (the End slide says how to exit: no accidental exit).
 * - `prev` steps back through builds, then lands on the previous slide at its
 *   last build, so going back shows the complete slide.
 * - Slides skipped in the grid (this session only) are jumped over.
 * - Overlays: `blank` and `pause` swallow the first navigation (it only clears
 *   them); `grid`, `help` and `exit` swallow too, except that a `goto` from
 *   the grid jumps and closes it.
 * - The class timer is not one of those overlays (`timerOpen`): a running
 *   corner timer stays on screen while blank, grid, help or exit
 *   covers the slide and is still there when that overlay closes. In the
 *   corner it lets slides move; full screen swallows navigation.
 * - `escape` / `close` close the covering overlay first, then a full-screen
 *   timer; `close` also closes a corner timer, while `escape` with only a
 *   corner timer open asks to exit, like with nothing open. `close-timer` (the
 *   timer card's own Close) closes the timer and nothing else.
 * - A forward step (`next`, `first`, `last`, `goto`) that moves returns a
 *   `revealed` effect naming the build now showing; the screen plays it when
 *   it is a sound or stroke build. `prev` never returns one, so going back to
 *   a complete slide is silent.
 */

/** Overlays that cover the slide; at most one is open. */
export type CoveringOverlay = null | 'blank' | 'pause' | 'grid' | 'help' | 'exit';
/** The covering overlays the reducer opens; any other name (the removed helper `picker`, LV-H) opens nothing. */
const COVERING_OVERLAYS: ReadonlySet<string> = new Set<NonNullable<CoveringOverlay>>(['blank', 'pause', 'grid', 'help', 'exit']);
/** What `{ overlay }` can ask for: a covering overlay, or `timer` (T) which toggles the class timer. */
export type Overlay = CoveringOverlay | 'timer';
export type TimerMode = 'corner' | 'full';

/** What the reducer needs from a slide; the deck builder's `Slide` (PR 5) is wider. */
export interface ControlSlide {
  /** Stable `<blockKey>/<path>` key (F-TCH-004 §3.3). */
  readonly key: string;
  /** Ordered reveal builds; the slide starts on build 0. */
  readonly builds: readonly unknown[];
}

export interface ControlDeck {
  readonly slides: readonly ControlSlide[];
}

export interface PresenterState {
  slideIdx: number;
  reveal: number;
  overlay: CoveringOverlay;
  /** The class timer is on screen (corner or full), independent of the covering overlay. */
  timerOpen: boolean;
  timerMode: TimerMode;
  /** Slide keys hidden from the run for this session (grid); memory only, never saved in the deck. */
  skipped: ReadonlySet<string>;
  /** The last slide has been reached at least once (`lecture.complete` reads it). */
  ended: boolean;
}

export type PresenterEvent =
  | 'next'
  | 'prev'
  | 'first'
  | 'last'
  | 'close'
  | 'escape'
  | 'replay-sound'
  | 'replay-stroke'
  /** The timer card's own Close: closes the class timer and leaves any covering overlay open (PR 9). */
  | 'close-timer'
  | { goto: number }
  | { overlay: Overlay }
  | { timerMode: TimerMode }
  | { toggleSkip: string }
  /** An activity slide's [ Start timer ]: open the timer and start it with this many ms. */
  | { startTimer: number };

export type PresenterEffect =
  /** A forward step now shows `build` of `slideKey`; the screen plays it if it is a sound or stroke build. */
  | { type: 'revealed'; slideKey: string; build: number }
  | { type: 'play-sound'; slideKey: string }
  | { type: 'play-stroke'; slideKey: string }
  | { type: 'start-timer'; ms: number };

export interface ReduceResult {
  state: PresenterState;
  effect?: PresenterEffect;
}

/** Reveals after build 0 (`builds.length - 1`, never negative). */
export function revealsOf(slide: ControlSlide): number {
  return Math.max(0, slide.builds.length - 1);
}

/**
 * Where a saved slide key resumes: that slide, or, when this build no longer makes it (LV-2 shows
 * one card per word, so a saved repeat card is gone), the first slide of its nearest step or block
 * (`<block>/<quest>/<step>/...`, the key cut back one segment at a time); else -1.
 */
export function resumeIndex(slides: readonly { key: string }[], key: string): number {
  const exact = slides.findIndex((s) => s.key === key);
  if (exact !== -1) return exact;
  const parts = key.split('/');
  for (let n = parts.length - 1; n >= 1; n -= 1) {
    const prefix = `${parts.slice(0, n).join('/')}/`;
    const at = slides.findIndex((s) => s.key.startsWith(prefix));
    if (at !== -1) return at;
  }
  return -1;
}

export function initialPresenterState(deck: ControlDeck, startKey?: string): PresenterState {
  const found = startKey === undefined ? -1 : resumeIndex(deck.slides, startKey);
  const slideIdx = Math.max(0, found);
  return {
    slideIdx,
    reveal: 0,
    overlay: null,
    timerOpen: false,
    timerMode: 'corner',
    skipped: new Set<string>(),
    ended: deck.slides.length > 0 && slideIdx === deck.slides.length - 1,
  };
}

type Navigation = 'next' | 'prev' | 'first' | 'last' | { goto: number };

function isNavigation(event: PresenterEvent): event is Navigation {
  return event === 'next' || event === 'prev' || event === 'first' || event === 'last' || (typeof event === 'object' && 'goto' in event);
}

function fullTimer(state: PresenterState): boolean {
  return state.timerOpen && state.timerMode === 'full';
}

/** The slide is on screen (not covered), so a replay makes sense. */
function slideVisible(state: PresenterState): boolean {
  return state.overlay === null && !fullTimer(state);
}

function land(state: PresenterState, deck: ControlDeck, slideIdx: number, reveal: number): PresenterState {
  return { ...state, slideIdx, reveal, ended: state.ended || slideIdx === deck.slides.length - 1 };
}

function findFrom(deck: ControlDeck, skipped: ReadonlySet<string>, from: number, step: 1 | -1): number {
  for (let i = from; i >= 0 && i < deck.slides.length; i += step) {
    if (!skipped.has(deck.slides[i]!.key)) return i;
  }
  return -1;
}

function navigate(state: PresenterState, event: Navigation, deck: ControlDeck): PresenterState {
  const slides = deck.slides;
  const current = slides[state.slideIdx]!;
  const reveal = Math.min(state.reveal, revealsOf(current));
  if (event === 'next') {
    if (reveal < revealsOf(current)) return { ...state, reveal: reveal + 1 };
    const to = findFrom(deck, state.skipped, state.slideIdx + 1, 1);
    return to === -1 ? state : land(state, deck, to, 0);
  }
  if (event === 'prev') {
    if (reveal > 0) return { ...state, reveal: reveal - 1 };
    const to = findFrom(deck, state.skipped, state.slideIdx - 1, -1);
    return to === -1 ? state : land(state, deck, to, revealsOf(slides[to]!));
  }
  if (event === 'first' || event === 'last') {
    const to =
      event === 'first' ? findFrom(deck, state.skipped, 0, 1) : findFrom(deck, state.skipped, slides.length - 1, -1);
    return to === -1 ? state : land(state, deck, to, 0);
  }
  const target = Number.isFinite(event.goto) ? Math.trunc(event.goto) : 0;
  const to = Math.min(slides.length - 1, Math.max(0, target));
  const landed = land(state, deck, to, 0);
  return state.overlay === 'grid' ? { ...landed, overlay: null } : landed;
}

export function reduce(state: PresenterState, event: PresenterEvent, deck: ControlDeck): ReduceResult {
  if (deck.slides.length === 0) return { state };

  if (isNavigation(event)) {
    const overlay = state.overlay;
    if (overlay === 'blank' || overlay === 'pause') return { state: { ...state, overlay: null } };
    const passes = (overlay === null && !fullTimer(state)) || (overlay === 'grid' && typeof event === 'object');
    if (!passes) return { state };
    const next = navigate(state, event, deck);
    const moved = next.slideIdx !== state.slideIdx || next.reveal !== state.reveal;
    if (!moved || event === 'prev') return { state: next };
    return { state: next, effect: { type: 'revealed', slideKey: deck.slides[next.slideIdx]!.key, build: next.reveal } };
  }

  if (event === 'close' || event === 'escape') {
    if (state.overlay !== null) return { state: { ...state, overlay: null } };
    if (fullTimer(state) || (state.timerOpen && event === 'close')) return { state: { ...state, timerOpen: false } };
    return { state: event === 'escape' ? { ...state, overlay: 'exit' } : state };
  }

  if (event === 'close-timer') {
    return { state: state.timerOpen ? { ...state, timerOpen: false } : state };
  }

  if (event === 'replay-sound' || event === 'replay-stroke') {
    if (!slideVisible(state)) return { state };
    const slideKey = deck.slides[state.slideIdx]!.key;
    return { state, effect: { type: event === 'replay-sound' ? 'play-sound' : 'play-stroke', slideKey } };
  }

  if ('overlay' in event) {
    if (event.overlay === 'timer') {
      // T with a covering overlay open brings the timer forward; otherwise it toggles the timer.
      if (state.overlay !== null) return { state: { ...state, overlay: null, timerOpen: true } };
      return { state: { ...state, timerOpen: !state.timerOpen } };
    }
    if (event.overlay !== null && !COVERING_OVERLAYS.has(event.overlay)) return { state };
    const overlay = event.overlay === state.overlay ? null : event.overlay;
    return { state: { ...state, overlay } };
  }

  if ('timerMode' in event) {
    // Opening a closed timer (an empty one opens full screen) brings it forward over a covering overlay, like T.
    const overlay = state.timerOpen ? state.overlay : null;
    return { state: { ...state, overlay, timerOpen: true, timerMode: event.timerMode } };
  }

  if ('startTimer' in event) {
    return { state: { ...state, timerOpen: true }, effect: { type: 'start-timer', ms: event.startTimer } };
  }

  // toggleSkip: a known slide other than the last (the End slide always stays).
  const idx = deck.slides.findIndex((s) => s.key === event.toggleSkip);
  if (idx === -1 || idx === deck.slides.length - 1) return { state };
  const skipped = new Set(state.skipped);
  if (skipped.has(event.toggleSkip)) skipped.delete(event.toggleSkip);
  else skipped.add(event.toggleSkip);
  return { state: { ...state, skipped } };
}
