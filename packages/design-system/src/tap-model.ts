import { motion, spacing } from './tokens';

/**
 * The forgiving tap (docs/specs/AMENDMENTS-TOUCH.md section 3, KT-D1 to KT-D7; design/components/TapBoard/spec.md):
 * the pure model a `TapBoard` runs for every learner answer. An answer commits when the finger lifts, decided here and
 * not by the browser's `click`: a finger that slid a little still counts, a touch in the gap between tiles goes to the
 * nearest tile, a second finger and a bounce never count twice, and a touch that does not count never looks chosen.
 *
 * No React and no react-native: `TapBoard` feeds it touch events with the targets' rectangles read at that moment, and
 * paints what `pressedTargets` returns. Points and rectangles share one space (page pixels on the web, window points
 * on native).
 */

/** A release still counts after the finger travelled this far from where it went down (`spacing.xxl`, 32). */
export const TAP_TRAVEL = spacing.xxl;
/** A release still counts this far outside the target the finger went down on (`spacing.xl`, 24). */
export const RELEASE_REACH = spacing.xl;
/** A touch in a gap goes to the nearest target within this distance (`spacing.lg`, 16). */
export const GAP_REACH = spacing.lg;
/** After a commit, taps in the lock's scope are swallowed: a child's bounce is 60 to 300 ms. An input timing, not a style. */
export const TAP_LOCK_MS = 400;
/** The browser's `click` after a release the board already handled is dropped within this. An input timing. */
export const CLICK_ECHO_MS = 700;
/** Keyboard: a repeat on the same letter key within this is a bounce (`motion.duration.fast`, 120). */
export const KEY_BOUNCE_MS = motion.duration.fast;
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
   * The target lock after this target commits, on a `target` board (default `TAP_LOCK_MS`). The keyboard's letter keys
   * pass `KEY_BOUNCE_MS`. A `board` board always locks for `TAP_LOCK_MS`.
   */
  lockMs?: number;
}

/** What the host found under the finger before any rectangle test (the DOM on the web), if it knows. */
export type TapHit = { kind: 'target'; id: string } | { kind: 'control' };

export type TapLockScope = 'board' | 'target';
export type TapMultiTouch = 'first' | 'each';
export type TapScroll = 'auto' | 'x' | 'none';

export interface TapBoardConfig {
  lock: TapLockScope;
  multiTouch: TapMultiTouch;
  disabled: boolean;
}

/** One finger that holds a target. */
export interface TapPress {
  touchId: string;
  /** The target the finger holds (`null`: none, such as a keyboard finger off every key). */
  targetId: string | null;
  down: TapPoint;
  /** Within reach or travel (rule 4): the press look shows and a release commits. */
  inside: boolean;
  /** The target was enabled and unlocked when the finger took it (rule 3). */
  live: boolean;
}

export interface TapModelState {
  presses: readonly TapPress[];
  /** Every finger down on the board, in order; on a `first` board only the first one has a press. */
  touches: readonly string[];
  /** Every target is locked until this time (a `board` commit, or `lock(ms)`). */
  boardLockedUntil: number;
  /** Per target, locked until this time (a `target` commit). */
  targetLockedUntil: Readonly<Record<string, number>>;
  /** When the board last handled a release (committed or not), for the click echo (rule 8). */
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
  | { type: 'down'; touchId: string; point: TapPoint; at: number; targets: readonly TapTargetSnapshot[]; hit?: TapHit }
  | { type: 'move'; touchId: string; point: TapPoint; at: number; targets: readonly TapTargetSnapshot[] }
  | { type: 'up'; touchId: string; point: TapPoint; at: number; targets: readonly TapTargetSnapshot[] }
  /** The responder was terminated (a browser pan, a native scroll, a pinch, the app hidden): rule 6. */
  | { type: 'cancel'; at: number }
  /** A click with no touch the board handled: keyboard Enter or Space, a screen reader, switch access (rule 8). */
  | { type: 'click'; targetId: string; at: number; targets: readonly TapTargetSnapshot[] }
  /** Extend the board lock (a slide-back or a reset animation): rule 9. */
  | { type: 'lock'; ms: number; at: number };

export interface TapStepResult {
  state: TapModelState;
  /** Target ids to commit, in order. */
  commits: string[];
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

function claim(point: TapPoint, targets: readonly TapTargetSnapshot[], hit?: TapHit): Claim {
  if (hit?.kind === 'control') return { claimed: false, id: null };
  if (hit?.kind === 'target' && targets.some((t) => t.id === hit.id)) return { claimed: true, id: hit.id };
  const near: Array<{ id: string; distance: number }> = [];
  for (const target of targets) {
    const distance = rectDistance(point, target.rect);
    if (distance === 0) return { claimed: true, id: target.id };
    if (distance <= GAP_REACH) near.push({ id: target.id, distance });
  }
  if (near.length === 0) return { claimed: false, id: null };
  const nearest = Math.min(...near.map((n) => n.distance));
  const closest = near.filter((n) => n.distance - nearest <= TIE_PX);
  return { claimed: true, id: closest.length === 1 ? closest[0]!.id : null };
}

/**
 * Rules 1 and 2: the target a touch at `point` goes to, or `null`. A target the host found under the finger wins;
 * another control is never claimed; then a target whose rectangle holds the point; then the nearest target within
 * `GAP_REACH`, unless another is within `TIE_PX` of the same distance (a tie is nobody's).
 */
export function claimTarget(point: TapPoint, targets: readonly TapTargetSnapshot[], hit?: TapHit): string | null {
  return claim(point, targets, hit).id;
}

/**
 * Whether the board takes a touch at `point`: every touch that goes to a target, and a tie in a gap, which the board
 * takes so that it commits nothing (the browser would otherwise send its click to whichever target its own touch
 * adjustment picks). A touch near no target, or on another control, falls through to whatever is under it.
 */
export function claimsTouch(point: TapPoint, targets: readonly TapTargetSnapshot[], hit?: TapHit): boolean {
  return claim(point, targets, hit).claimed;
}

export function isTargetLocked(state: TapModelState, id: string, at: number): boolean {
  return at < state.boardLockedUntil || at < (state.targetLockedUntil[id] ?? 0);
}

/** How long the board lock still runs at `at` (0 when free). */
export function boardLockRemaining(state: TapModelState, at: number): number {
  return Math.max(0, state.boardLockedUntil - at);
}

/** The targets that show the press look: a live press, inside (rules 3 and 4). */
export function pressedTargets(state: TapModelState): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const press of state.presses) {
    if (press.targetId !== null && press.inside && press.live) ids.add(press.targetId);
  }
  return ids;
}

/** The Button guard (section 4.4, `usePressGuard`): a second press within `TAP_LOCK_MS` of the last one is dropped. */
export function pressGuardAllows(lastAt: number | null, at: number): boolean {
  return lastAt === null || at - lastAt >= TAP_LOCK_MS;
}

/**
 * KT-D3: the web `touch-action` of a board. `auto` reads the `Screen` fit: a board that fits stops the browser from
 * panning (a graze is never cancelled) and keeps pinch zoom; one that scrolls keeps the vertical pan. `x` is a board
 * in its own horizontal ScrollView; `none` one outside any ScrollView. A browser without `pinch-zoom` (older iOS,
 * assumption U1) gets `none` on a board that must not pan, and the bare pan elsewhere.
 */
export function boardTouchAction(scroll: TapScroll, fits: boolean, supportsPinchZoom: boolean): string {
  const pan = scroll === 'x' ? 'pan-x' : scroll === 'auto' && !fits ? 'pan-y' : null;
  if (pan === null) return supportsPinchZoom ? 'pinch-zoom' : 'none';
  return supportsPinchZoom ? `${pan} pinch-zoom` : pan;
}

function find(targets: readonly TapTargetSnapshot[], id: string | null): TapTargetSnapshot | undefined {
  return id === null ? undefined : targets.find((t) => t.id === id);
}

/** May `target` take a touch or a click now: the board and the target enabled, and no lock on it. */
function usable(state: TapModelState, config: TapBoardConfig, target: TapTargetSnapshot | undefined, at: number): boolean {
  return target !== undefined && !config.disabled && target.disabled !== true && !isTargetLocked(state, target.id, at);
}

/** Rule 4: within reach of the down target's rectangle, or within travel of the down point. */
function isInside(press: TapPress, point: TapPoint, target: TapTargetSnapshot | undefined): boolean {
  if (target === undefined) return false;
  const travel = Math.hypot(point.x - press.down.x, point.y - press.down.y);
  return travel <= TAP_TRAVEL || rectDistance(point, target.rect) <= RELEASE_REACH;
}

/** Rule 9: lock after a commit, and drop target locks that have run out. */
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

function pressFor(state: TapModelState, config: TapBoardConfig, touchId: string, point: TapPoint, at: number, targetId: string | null, targets: readonly TapTargetSnapshot[]): TapPress {
  return { touchId, targetId, down: point, inside: targetId !== null, live: usable(state, config, find(targets, targetId), at) };
}

/** One event through the model (rules 1 to 9). Pure: the same state and event give the same result. */
export function tapStep(state: TapModelState, event: TapEvent, config: TapBoardConfig): TapStepResult {
  switch (event.type) {
    case 'down': {
      if (state.touches.includes(event.touchId)) return { state, commits: [] };
      const touches = [...state.touches, event.touchId];
      // Rule 7: on a first-finger board, a finger that comes while any other is down is ignored until it lifts.
      if (config.multiTouch === 'first' && state.touches.length > 0) return { state: { ...state, touches }, commits: [] };
      const targetId = claimTarget(event.point, event.targets, event.hit);
      const press = pressFor(state, config, event.touchId, event.point, event.at, targetId, event.targets);
      return { state: { ...state, touches, presses: [...state.presses, press] }, commits: [] };
    }
    case 'move': {
      const press = state.presses.find((p) => p.touchId === event.touchId);
      if (press === undefined) return { state, commits: [] };
      // The keyboard follows the finger (the press look moves with it); every other board keeps the down target.
      const next = config.multiTouch === 'each' ? moveTo(state, config, press, event) : { ...press, inside: isInside(press, event.point, find(event.targets, press.targetId)) };
      return { state: { ...state, presses: state.presses.map((p) => (p === press ? next : p)) }, commits: [] };
    }
    case 'up': {
      if (!state.touches.includes(event.touchId)) return { state, commits: [] };
      const touches = state.touches.filter((t) => t !== event.touchId);
      const press = state.presses.find((p) => p.touchId === event.touchId);
      if (press === undefined) return { state: { ...state, touches }, commits: [] };
      const presses = state.presses.filter((p) => p !== press);
      const released: TapModelState = { ...state, touches, presses, lastReleaseAt: event.at };
      const final = config.multiTouch === 'each' ? moveTo(state, config, press, event) : { ...press, inside: isInside(press, event.point, find(event.targets, press.targetId)) };
      const target = find(event.targets, final.targetId);
      // Rule 5: commit once, inside, on a target that took the finger and is still free now.
      if (target === undefined || !final.inside || !final.live || !usable(state, config, target, event.at)) {
        return { state: released, commits: [] };
      }
      return { state: locked(released, config, target, event.at), commits: [target.id] };
    }
    case 'cancel':
      // Rule 6: the press look goes; nothing else changes.
      return { state: { ...state, presses: [], touches: [] }, commits: [] };
    case 'click': {
      // Rule 8: the browser's click right after a release the board handled is that same tap.
      if (state.lastReleaseAt !== null && event.at - state.lastReleaseAt < CLICK_ECHO_MS) return { state, commits: [] };
      const target = find(event.targets, event.targetId);
      if (target === undefined || !usable(state, config, target, event.at)) return { state, commits: [] };
      return { state: locked(state, config, target, event.at), commits: [target.id] };
    }
    case 'lock':
      return { state: { ...state, boardLockedUntil: Math.max(state.boardLockedUntil, event.at + event.ms) }, commits: [] };
  }
}

/** The keyboard: the key under the finger at this point (on a move and at the release). */
function moveTo(state: TapModelState, config: TapBoardConfig, press: TapPress, event: { point: TapPoint; at: number; targets: readonly TapTargetSnapshot[] }): TapPress {
  const targetId = claimTarget(event.point, event.targets);
  if (targetId === press.targetId) return { ...press, inside: targetId !== null };
  return pressFor(state, config, press.touchId, press.down, event.at, targetId, event.targets);
}
