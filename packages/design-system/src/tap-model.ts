import { motion, spacing } from './tokens';

/**
 * The forgiving tap (docs/specs/AMENDMENTS-TOUCH.md section 3, KT-D1 to KT-D7; design/components/TapBoard/spec.md):
 * the pure model a `TapBoard` runs for every learner answer. An answer commits when the finger lifts, decided here and
 * not by the browser's `click`: a finger that slid a little still counts, a touch in the gap between tiles goes to the
 * nearest tile, a bounce never counts twice, the latest finger on an answer wins over a resting thumb, a drag on a
 * board that can scroll turns into a scroll the board drives, and a touch that does not count never looks chosen.
 *
 * No React and no react-native: `TapBoard` feeds it touch events with the targets' rectangles read at that moment, and
 * paints what `pressedTargets` returns. Points and rectangles share one space (page pixels on the web, window points
 * on native).
 */

/** A release still counts after the finger travelled this far; past it along the scroller's axis the touch scrolls (`spacing.xxl`, 32). */
export const TAP_TRAVEL = spacing.xxl;
/** A release still counts this far outside the target the finger went down on (`spacing.xl`, 24). */
export const RELEASE_REACH = spacing.xl;
/** A touch in a gap goes to the nearest target within this distance (`spacing.lg`, 16). */
export const GAP_REACH = spacing.lg;
/** After a commit, taps in the lock's scope are swallowed: a child's bounce is 60 to 300 ms. An input timing, not a style. */
export const TAP_LOCK_MS = 400;
/** The browser's `click` after a release the board already handled is dropped within this. An input timing. */
export const CLICK_ECHO_MS = 700;
/** Keyboard: a repeat on the same key (letter, Delete, Space) within this is a bounce (`motion.duration.fast`, 120). */
export const KEY_BOUNCE_MS = motion.duration.fast;
/** A board-driven fling keeps this much of its velocity every `FLING_FRAME_MS` (rule 5). An input timing. */
export const FLING_DECAY = 0.95;
/** One fling frame. */
export const FLING_FRAME_MS = 16;
/** A fling stops under this speed, in px/ms. */
export const FLING_MIN_VELOCITY = 0.05;
/** The release velocity is measured over the last this many ms of the touch. */
export const FLING_WINDOW_MS = 100;
/** Two gap distances closer than this are a tie, and a tie is nobody's (rule 2). */
const TIE_PX = 1;

export interface TapPoint {
  x: number;
  y: number;
}

export interface TapRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One target as the board sees it at an event. */
export interface TapTargetSnapshot {
  id: string;
  rect: TapRect;
  /** Claimed, never pressed, never committed (a locked wrong tile). */
  disabled?: boolean;
  /**
   * The target lock after this target commits, on a `target` board (default `TAP_LOCK_MS`). The keyboard's keys pass
   * `KEY_BOUNCE_MS`. A `board` board always locks for `TAP_LOCK_MS`.
   */
  lockMs?: number;
  /** `false` for a take-back target (a filled slot or zone): only a touch inside its own rectangle reaches it. */
  gapFill?: boolean;
}

/** What the host found under the finger before any rectangle test: another control (the DOM's roles on the web). */
export type TapHit = { kind: 'control' };

export type TapLockScope = 'board' | 'target';
export type TapMultiTouch = 'latest' | 'each';
export type TapScroll = 'auto' | 'none';
export type TapAxis = 'x' | 'y';

/** The scroller a board may drive (section 5), as it stands at an event. */
export interface TapScrollState {
  axis: TapAxis;
  canScroll: boolean;
}

export interface TapBoardConfig {
  lock: TapLockScope;
  multiTouch: TapMultiTouch;
  disabled: boolean;
  /** The scroller the board drives, or null (no scroller, `scroll="none"`, or the keyboard). */
  scroller?: TapScrollState | null;
}

/** One finger that holds the board. */
export interface TapPress {
  touchId: string;
  /** The target the finger holds (`null`: none, such as a tie or a keyboard finger off every key). */
  targetId: string | null;
  down: TapPoint;
  /** Within reach or travel and not over a neighbour (rule 4): the press look shows and a release commits. */
  inside: boolean;
  /** The target was enabled and unlocked when the finger took it (rule 3). */
  live: boolean;
  /** The finger went down inside the target's own rectangle (not in the gap band): only such a touch drives a scroll. */
  onTarget: boolean;
  /** The touch turned into a board-driven scroll (rule 5): never commits. */
  scrolling: boolean;
  /** The finger's coordinate along the scroller's axis that the content last followed. */
  scrollFrom: number;
  /** Recent finger positions along the axis, for the fling (the last `FLING_WINDOW_MS`). */
  samples: ReadonlyArray<{ at: number; coord: number }>;
}

export interface TapModelState {
  presses: readonly TapPress[];
  /** Every finger down on the board, in order; a finger with no press is ignored or resting. */
  touches: readonly string[];
  /** Every target is locked until this time (a `board` commit, or `lock(ms)`; the app clock is folded in by the host). */
  boardLockedUntil: number;
  /** Per target, locked until this time (a `target` commit). */
  targetLockedUntil: Readonly<Record<string, number>>;
  /** When the board last handled a release (committed or not), for the click echo (rule 9). */
  lastReleaseAt: number | null;
}

export const INITIAL_TAP_STATE: TapModelState = {
  presses: [],
  touches: [],
  boardLockedUntil: 0,
  targetLockedUntil: {},
  lastReleaseAt: null,
};

export type TapEvent =
  | { type: 'down'; touchId: string; point: TapPoint; at: number; targets: readonly TapTargetSnapshot[]; controls?: readonly TapRect[]; hit?: TapHit }
  | { type: 'move'; touchId: string; point: TapPoint; at: number; targets: readonly TapTargetSnapshot[] }
  | { type: 'up'; touchId: string; point: TapPoint; at: number; targets: readonly TapTargetSnapshot[] }
  /** The responder was terminated, or a scroll the board did not drive moved the content: rule 7. */
  | { type: 'cancel'; at: number }
  /** A click with no touch the board handled: keyboard Enter or Space, a screen reader, switch access (rule 9). */
  | { type: 'click'; targetId: string; at: number; targets: readonly TapTargetSnapshot[] }
  /** Extend the board lock (a slide-back or a reset animation): rule 10. */
  | { type: 'lock'; ms: number; at: number };

export interface TapStepResult {
  state: TapModelState;
  /** Target ids to commit, in order. */
  commits: string[];
  /** How far to move the scroller's offset now (rule 5): the content follows the finger. 0 when nothing scrolls. */
  scrollBy: number;
  /** A release that ends a board-driven scroll: the offset velocity in px/ms to fling with, or null. */
  fling: number | null;
}

/** The straight distance from a point to a rectangle: 0 inside or on the edge. */
export function rectDistance(point: TapPoint, rect: TapRect): number {
  const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width));
  const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height));
  return Math.hypot(dx, dy);
}

interface Claim {
  /** The board takes the touch, so nothing under it fires and its browser click is the board's echo. */
  claimed: boolean;
  /** The target it goes to; `null` for a tie (a claimed touch that is nobody's). */
  id: string | null;
}

function claim(point: TapPoint, targets: readonly TapTargetSnapshot[], hit?: TapHit, controls: readonly TapRect[] = []): Claim {
  // Controls first (rule 2): a speaker or a hint inside the board is never claimed.
  if (hit?.kind === 'control' || controls.some((rect) => rectDistance(point, rect) === 0)) return { claimed: false, id: null };
  const near: Array<{ id: string; distance: number }> = [];
  for (const target of targets) {
    const distance = rectDistance(point, target.rect);
    if (distance === 0) return { claimed: true, id: target.id };
    // A take-back target is reached only from inside its own rectangle.
    if (distance <= GAP_REACH && target.gapFill !== false) near.push({ id: target.id, distance });
  }
  if (near.length === 0) return { claimed: false, id: null };
  const nearest = Math.min(...near.map((n) => n.distance));
  const closest = near.filter((n) => n.distance - nearest <= TIE_PX);
  return { claimed: true, id: closest.length === 1 ? closest[0]!.id : null };
}

/**
 * Rules 1 and 2: the target a touch at `point` goes to, or `null`. Another control (found by the host, or registered
 * through `TapControl`) is never claimed; then a target whose rectangle holds the point; then the nearest target within
 * `GAP_REACH` that fills gaps, unless another is within `TIE_PX` of the same distance (a tie is nobody's).
 */
export function claimTarget(point: TapPoint, targets: readonly TapTargetSnapshot[], hit?: TapHit, controls?: readonly TapRect[]): string | null {
  return claim(point, targets, hit, controls).id;
}

/**
 * Whether the board takes a touch at `point`: every touch that goes to a target, and a tie in a gap, which the board
 * takes so that it commits nothing (the browser would otherwise send its click to whichever target its own touch
 * adjustment picks). A touch near no target, or on another control, falls through to whatever is under it.
 */
export function claimsTouch(point: TapPoint, targets: readonly TapTargetSnapshot[], hit?: TapHit, controls?: readonly TapRect[]): boolean {
  return claim(point, targets, hit, controls).claimed;
}

export function isTargetLocked(state: TapModelState, id: string, at: number): boolean {
  return at < state.boardLockedUntil || at < (state.targetLockedUntil[id] ?? 0);
}

/** How long the board lock still runs at `at` (0 when free). */
export function boardLockRemaining(state: TapModelState, at: number): number {
  return Math.max(0, state.boardLockedUntil - at);
}

/** The targets that show the press look: a live press, inside, not scrolling (rules 3 to 5). */
export function pressedTargets(state: TapModelState): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const press of state.presses) {
    if (press.targetId !== null && press.inside && press.live && !press.scrolling) ids.add(press.targetId);
  }
  return ids;
}

/** Whether a finger holds the board and has not turned into a scroll: a scroll the board did not drive cancels it. */
export function hasLivePress(state: TapModelState): boolean {
  return state.presses.some((p) => !p.scrolling);
}

/** The Button guard (section 4.4, `usePressGuard`): a second press of one control within `TAP_LOCK_MS` is dropped. */
export function pressGuardAllows(lastAt: number | null, at: number): boolean {
  return lastAt === null || at - lastAt >= TAP_LOCK_MS;
}

/** One frame of a fling (rule 5): how far to move now and the next velocity, or null once it is slow enough to stop. */
export function flingStep(velocity: number): { delta: number; next: number } | null {
  if (Math.abs(velocity) < FLING_MIN_VELOCITY) return null;
  return { delta: velocity * FLING_FRAME_MS, next: velocity * FLING_DECAY };
}

/**
 * KT-D3: the web `touch-action` of a board. It pans along its scroller's axis only while the scroller can scroll, so a
 * touch claimed in a gap on a screen that fits is never panned. A browser without `pinch-zoom` (older iOS, assumption
 * U1) drops the keyword: `none`, or the bare pan.
 */
export function boardTouchAction(scroller: TapScrollState | null, supportsPinchZoom: boolean): string {
  const pan = scroller !== null && scroller.canScroll ? `pan-${scroller.axis}` : null;
  if (pan === null) return supportsPinchZoom ? 'pinch-zoom' : 'none';
  return supportsPinchZoom ? `${pan} pinch-zoom` : pan;
}

/** KT-D3: every target is `pinch-zoom` (`none` without it), so a touch that starts on an answer never becomes a browser pan. */
export function targetTouchAction(supportsPinchZoom: boolean): string {
  return supportsPinchZoom ? 'pinch-zoom' : 'none';
}

function find(targets: readonly TapTargetSnapshot[], id: string | null): TapTargetSnapshot | undefined {
  return id === null ? undefined : targets.find((t) => t.id === id);
}

/** May `target` take a touch or a click now: the board and the target enabled, and no lock on it. */
function usable(state: TapModelState, config: TapBoardConfig, target: TapTargetSnapshot | undefined, at: number): boolean {
  return target !== undefined && !config.disabled && target.disabled !== true && !isTargetLocked(state, target.id, at);
}

/** Rule 4: within reach of the down target's rectangle, or within travel of the down point, and not over a neighbour. */
function isInside(press: TapPress, point: TapPoint, targets: readonly TapTargetSnapshot[]): boolean {
  const target = find(targets, press.targetId);
  if (target === undefined) return false;
  if (targets.some((t) => t.id !== target.id && t.disabled !== true && rectDistance(point, t.rect) === 0)) return false;
  const travel = Math.hypot(point.x - press.down.x, point.y - press.down.y);
  return travel <= TAP_TRAVEL || rectDistance(point, target.rect) <= RELEASE_REACH;
}

/** Rule 10: lock after a commit, and drop target locks that have run out. */
function locked(state: TapModelState, config: TapBoardConfig, target: TapTargetSnapshot, at: number): TapModelState {
  const kept: Record<string, number> = {};
  for (const [id, until] of Object.entries(state.targetLockedUntil)) {
    if (until > at) kept[id] = until;
  }
  if (config.lock === 'board') {
    return { ...state, targetLockedUntil: kept, boardLockedUntil: Math.max(state.boardLockedUntil, at + TAP_LOCK_MS) };
  }
  kept[target.id] = at + (target.lockMs ?? TAP_LOCK_MS);
  return { ...state, targetLockedUntil: kept };
}

const coordOf = (point: TapPoint, axis: TapAxis): number => (axis === 'x' ? point.x : point.y);
const axisOf = (config: TapBoardConfig): TapAxis => config.scroller?.axis ?? 'y';

function newPress(state: TapModelState, config: TapBoardConfig, touchId: string, point: TapPoint, at: number, targetId: string | null, targets: readonly TapTargetSnapshot[]): TapPress {
  const target = find(targets, targetId);
  const coord = coordOf(point, axisOf(config));
  return {
    touchId,
    targetId,
    down: point,
    inside: targetId !== null,
    live: usable(state, config, target, at),
    onTarget: target !== undefined && rectDistance(point, target.rect) === 0,
    scrolling: false,
    scrollFrom: coord,
    samples: [{ at, coord }],
  };
}

/** The keyboard: the key under the finger at this point (on a move and at the release). */
function moveTo(state: TapModelState, config: TapBoardConfig, press: TapPress, point: TapPoint, at: number, targets: readonly TapTargetSnapshot[]): TapPress {
  const targetId = claimTarget(point, targets);
  if (targetId === press.targetId) return { ...press, inside: targetId !== null };
  return newPress(state, config, press.touchId, press.down, at, targetId, targets);
}

const result = (state: TapModelState, more: Partial<Omit<TapStepResult, 'state'>> = {}): TapStepResult => ({ state, commits: [], scrollBy: 0, fling: null, ...more });

/**
 * Rule 5 on a move: once the travel along the scroller's axis passes `TAP_TRAVEL`, a touch that went down on a target
 * becomes a scroll for good, and the content follows the finger beyond that point.
 */
function scrollMove(press: TapPress, config: TapBoardConfig, point: TapPoint, at: number): { press: TapPress; scrollBy: number } | null {
  const scroller = config.scroller;
  if (scroller === null || scroller === undefined || !press.onTarget || (!press.scrolling && !scroller.canScroll)) return null;
  const coord = coordOf(point, scroller.axis);
  const samples = [...press.samples, { at, coord }].filter((s) => at - s.at <= FLING_WINDOW_MS);
  if (press.scrolling) return { press: { ...press, scrollFrom: coord, samples }, scrollBy: press.scrollFrom - coord };
  const start = coordOf(press.down, scroller.axis);
  const travel = coord - start;
  if (Math.abs(travel) <= TAP_TRAVEL) return null;
  const from = start + Math.sign(travel) * TAP_TRAVEL;
  return { press: { ...press, scrolling: true, inside: false, scrollFrom: coord, samples }, scrollBy: from - coord };
}

/** The offset velocity (px/ms) at the release of a scrolling press, over its last `FLING_WINDOW_MS`, or null. */
function releaseVelocity(press: TapPress, at: number): number | null {
  const samples = press.samples.filter((s) => at - s.at <= FLING_WINDOW_MS);
  const first = samples[0];
  const last = samples[samples.length - 1];
  if (first === undefined || last === undefined || last.at <= first.at) return null;
  const velocity = -(last.coord - first.coord) / (last.at - first.at);
  return Math.abs(velocity) < FLING_MIN_VELOCITY ? null : velocity;
}

/** One event through the model (rules 1 to 10). Pure: the same state and event give the same result. */
export function tapStep(state: TapModelState, event: TapEvent, config: TapBoardConfig): TapStepResult {
  switch (event.type) {
    case 'down': {
      if (state.touches.includes(event.touchId)) return result(state);
      const touches = [...state.touches, event.touchId];
      const c = claim(event.point, event.targets, event.hit, event.controls);
      const press = newPress(state, config, event.touchId, event.point, event.at, c.id, event.targets);
      if (config.multiTouch === 'each' || state.touches.length === 0) return result({ ...state, touches, presses: [...state.presses, press] });
      // Rule 8: a later finger on a target takes the board and the earlier touch rests (its lift does nothing); a
      // later finger on nothing claimable is ignored and cancels nothing.
      if (c.id === null) return result({ ...state, touches });
      return result({ ...state, touches, presses: [press] });
    }
    case 'move': {
      const press = state.presses.find((p) => p.touchId === event.touchId);
      if (press === undefined) return result(state);
      const replace = (next: TapPress): TapModelState => ({ ...state, presses: state.presses.map((p) => (p === press ? next : p)) });
      if (config.multiTouch === 'each') return result(replace(moveTo(state, config, press, event.point, event.at, event.targets)));
      const scrolled = scrollMove(press, config, event.point, event.at);
      if (scrolled !== null) return result(replace(scrolled.press), { scrollBy: scrolled.scrollBy });
      return result(replace({ ...press, inside: isInside(press, event.point, event.targets) }));
    }
    case 'up': {
      if (!state.touches.includes(event.touchId)) return result(state);
      const touches = state.touches.filter((t) => t !== event.touchId);
      const press = state.presses.find((p) => p.touchId === event.touchId);
      // A resting or ignored finger: its lift does nothing.
      if (press === undefined) return result({ ...state, touches });
      const released: TapModelState = { ...state, touches, presses: state.presses.filter((p) => p !== press), lastReleaseAt: event.at };
      if (config.multiTouch !== 'each') {
        const scrolled = scrollMove(press, config, event.point, event.at);
        if (scrolled !== null) return result(released, { scrollBy: scrolled.scrollBy, fling: releaseVelocity(scrolled.press, event.at) });
      }
      const final = config.multiTouch === 'each' ? moveTo(state, config, press, event.point, event.at, event.targets) : { ...press, inside: isInside(press, event.point, event.targets) };
      const target = find(event.targets, final.targetId);
      // Rule 6: commit once, inside, on a target that took the finger and is still free now.
      if (target === undefined || !final.inside || !final.live || !usable(state, config, target, event.at)) return result(released);
      return result(locked(released, config, target, event.at), { commits: [target.id] });
    }
    case 'cancel':
      // Rule 7: the press look goes; nothing else changes.
      return result({ ...state, presses: [], touches: [] });
    case 'click': {
      // Rule 9: the browser's click right after a release the board handled is that same tap.
      if (state.lastReleaseAt !== null && event.at - state.lastReleaseAt < CLICK_ECHO_MS) return result(state);
      const target = find(event.targets, event.targetId);
      if (target === undefined || !usable(state, config, target, event.at)) return result(state);
      return result(locked(state, config, target, event.at), { commits: [target.id] });
    }
    case 'lock':
      return result({ ...state, boardLockedUntil: Math.max(state.boardLockedUntil, event.at + event.ms) });
  }
}
