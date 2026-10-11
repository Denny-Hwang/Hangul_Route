/**
 * Presenter controls (F-TCH-004 §3.5): a pure reducer over the slide index,
 * the reveal (build) inside a slide and the one open overlay. The screen
 * turns keys, taps and buttons into `PresenterEvent`s and performs the
 * returned `effect` (play a sound, replay the stroke guide, start the class
 * timer), so this module never touches audio, timers or the DOM.
 *
 * - `next` reveals the slide's next build before it advances; at the last
 *   slide it does nothing (the End slide says how to exit: no accidental exit).
 * - `prev` steps back through builds, then lands on the previous slide at its
 *   last build, so going back shows the complete slide.
 * - Slides skipped in the grid (this session only) are jumped over.
 * - Overlays: `blank` and `pause` swallow the first navigation (it only clears
 *   them); the timer in the corner lets slides move, full screen swallows;
 *   `grid`, `help`, `exit` and the helper `picker` swallow too, except that a
 *   `goto` from the grid jumps and closes it. `escape` / `close` close the
 *   open overlay; `escape` with nothing open asks to exit.
 */

export type Overlay = null | 'timer' | 'picker' | 'blank' | 'pause' | 'grid' | 'help' | 'exit';
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
  overlay: Overlay;
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
  | { goto: number }
  | { overlay: Overlay }
  | { timerMode: TimerMode }
  | { toggleSkip: string }
  /** An activity slide's [ Start timer ]: open the timer and start it with this many ms. */
  | { startTimer: number };

export type PresenterEffect =
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

export function initialPresenterState(deck: ControlDeck, startKey?: string): PresenterState {
  const found = startKey === undefined ? -1 : deck.slides.findIndex((s) => s.key === startKey);
  const slideIdx = Math.max(0, found);
  return {
    slideIdx,
    reveal: 0,
    overlay: null,
    timerMode: 'corner',
    skipped: new Set<string>(),
    ended: deck.slides.length > 0 && slideIdx === deck.slides.length - 1,
  };
}

type Navigation = 'next' | 'prev' | 'first' | 'last' | { goto: number };

function isNavigation(event: PresenterEvent): event is Navigation {
  return event === 'next' || event === 'prev' || event === 'first' || event === 'last' || (typeof event === 'object' && 'goto' in event);
}

/** The slide is on screen (not covered), so a replay makes sense. */
function slideVisible(state: PresenterState): boolean {
  return state.overlay === null || (state.overlay === 'timer' && state.timerMode === 'corner');
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
    const passes =
      overlay === null ||
      (overlay === 'timer' && state.timerMode === 'corner') ||
      (overlay === 'grid' && typeof event === 'object');
    return { state: passes ? navigate(state, event, deck) : state };
  }

  if (event === 'close' || event === 'escape') {
    if (state.overlay !== null) return { state: { ...state, overlay: null } };
    return { state: event === 'escape' ? { ...state, overlay: 'exit' } : state };
  }

  if (event === 'replay-sound' || event === 'replay-stroke') {
    if (!slideVisible(state)) return { state };
    const slideKey = deck.slides[state.slideIdx]!.key;
    return { state, effect: { type: event === 'replay-sound' ? 'play-sound' : 'play-stroke', slideKey } };
  }

  if ('overlay' in event) {
    const overlay = event.overlay === state.overlay ? null : event.overlay;
    return { state: { ...state, overlay } };
  }

  if ('timerMode' in event) {
    return { state: { ...state, overlay: 'timer', timerMode: event.timerMode } };
  }

  if ('startTimer' in event) {
    return { state: { ...state, overlay: 'timer' }, effect: { type: 'start-timer', ms: event.startTimer } };
  }

  // toggleSkip: a known slide other than the last (the End slide always stays).
  const idx = deck.slides.findIndex((s) => s.key === event.toggleSkip);
  if (idx === -1 || idx === deck.slides.length - 1) return { state };
  const skipped = new Set(state.skipped);
  if (skipped.has(event.toggleSkip)) skipped.delete(event.toggleSkip);
  else skipped.add(event.toggleSkip);
  return { state: { ...state, skipped } };
}
