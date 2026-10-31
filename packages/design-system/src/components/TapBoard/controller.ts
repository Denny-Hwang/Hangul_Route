import {
  INITIAL_TAP_STATE,
  boardLockRemaining,
  claimsTouch,
  pressedTargets,
  tapStep,
  type TapBoardConfig,
  type TapEvent,
  type TapHit,
  type TapModelState,
  type TapPoint,
  type TapRect,
  type TapTargetSnapshot,
} from '../../tap-model';

/**
 * The responder half of `TapBoard` (docs/specs/AMENDMENTS-TOUCH.md section 4.1): it turns the responder events of
 * react-native and react-native-web into the events of the pure model (`tap-model.ts`), reads the targets' rectangles
 * at each event through its host, calls a target's commit, and tells the board what to paint (the pressed targets, the
 * board lock). No React here, so the rules are tested without a renderer.
 *
 * - It owns the responder by capture, and only for a touch the model claims (rules 1 and 2, `claimsTouch`): every
 *   other touch falls through to whatever is under it, and the `Pressable` inside a target never gets the touch.
 * - It commits on `onResponderEnd` for the owning finger (`onResponderRelease` waits for every finger).
 * - It refuses a termination request while a finger is down, except a scroll's; a termination is a cancel (rule 6).
 */

/** A touch as both platforms put it on a responder event (`changedTouches`, or the event itself for a web mouse). */
export interface TapResponderTouch {
  identifier?: number | string;
  pageX?: number;
  pageY?: number;
  target?: unknown;
}

export interface TapResponderEvent {
  /** When the input happened (the web: the DOM event's `timeStamp`, on the clock of `performance.now()`). */
  timeStamp?: number;
  nativeEvent: TapResponderTouch & {
    changedTouches?: readonly TapResponderTouch[];
    /** The web DOM event type (`touchstart`, `scroll`, ...). */
    type?: string;
    /** A native scroll event's offset: a scroll asking for the responder. */
    contentOffset?: unknown;
  };
}

/** What the board knows of one `TapTarget`. Getters, so a re-render never needs to re-register. */
export interface TapTargetEntry {
  /** The target's host node (a DOM element on the web, a host instance on native), or null while unmounted. */
  node: () => unknown;
  disabled: () => boolean;
  /** The target lock after a commit on a `target` board (the keyboard's letter keys: `KEY_BOUNCE_MS`). */
  lockMs?: number;
  commit: () => void;
}

/** The platform side: the clock, rectangles, the hit test and timers, and where the paint goes. */
export interface TapBoardHost {
  now(): number;
  /**
   * The time of an input event on the `now()` clock: its own time stamp where the platform gives one on that clock (the
   * web), so a click the browser sent right after a release still reads as its echo when the page was too busy to
   * handle it at once; otherwise `now()`.
   */
  timeOf(stamp: unknown): number;
  /** The node's rectangle now, in the space of the touches' `pageX` and `pageY`; null when it cannot be read. */
  rectOf(node: unknown, id: string): TapRect | null;
  /** What is under the finger before any rectangle test (the DOM on the web); undefined when the host cannot tell. */
  hitAt(eventTarget: unknown, nodes: ReadonlyMap<unknown, string>): TapHit | undefined;
  onPressedChange(pressed: ReadonlySet<string>): void;
  onLockChange(locked: boolean): void;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
}

export interface TapBoardHandlers {
  onStartShouldSetResponderCapture(event: TapResponderEvent): boolean;
  onStartShouldSetResponder(): boolean;
  onResponderGrant(event: TapResponderEvent): void;
  onResponderStart(event: TapResponderEvent): void;
  onResponderMove(event: TapResponderEvent): void;
  onResponderEnd(event: TapResponderEvent): void;
  onResponderRelease(event: TapResponderEvent): void;
  onResponderTerminate(): void;
  onResponderTerminationRequest(event: TapResponderEvent): boolean;
}

export interface TapBoardController {
  readonly handlers: TapBoardHandlers;
  configure(config: TapBoardConfig): void;
  /** Adds (or replaces) a target; returns its unregister. */
  register(id: string, entry: TapTargetEntry): () => void;
  /** A click that reached a target's `Pressable` (rule 8), with its event's time stamp when it has one. */
  click(id: string, stamp?: unknown): void;
  /** Extends the board lock by `ms` from now (rule 9). */
  lock(ms: number): void;
  isLocked(): boolean;
  dispose(): void;
}

const NO_RECT: TapRect = { x: 0, y: 0, width: 0, height: 0 };

function touchesOf(event: TapResponderEvent): readonly TapResponderTouch[] {
  const changed = event.nativeEvent.changedTouches;
  return changed !== undefined && changed.length > 0 ? changed : [event.nativeEvent];
}

const touchKey = (touch: TapResponderTouch): string => String(touch.identifier ?? 0);
const pointOf = (touch: TapResponderTouch): TapPoint => ({ x: touch.pageX ?? 0, y: touch.pageY ?? 0 });

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

export function createTapBoardController(host: TapBoardHost, initial: TapBoardConfig): TapBoardController {
  let config = initial;
  let state: TapModelState = INITIAL_TAP_STATE;
  let pressed: ReadonlySet<string> = new Set();
  let lockedNow = false;
  let lockTimer: unknown = null;
  const entries = new Map<string, TapTargetEntry>();

  /** Every target with its rectangle now; a click also takes targets it cannot measure (it needs no rectangle). */
  function snapshot(forClick = false): { targets: TapTargetSnapshot[]; nodes: Map<unknown, string> } {
    const targets: TapTargetSnapshot[] = [];
    const nodes = new Map<unknown, string>();
    for (const [id, entry] of entries) {
      const node = entry.node();
      const rect = node === null || node === undefined ? null : host.rectOf(node, id);
      if (node !== null && node !== undefined) nodes.set(node, id);
      if (rect === null && !forClick) continue;
      targets.push({ id, rect: rect ?? NO_RECT, disabled: entry.disabled(), ...(entry.lockMs === undefined ? {} : { lockMs: entry.lockMs }) });
    }
    return { targets, nodes };
  }

  function publishLock(): void {
    const remaining = boardLockRemaining(state, host.now());
    if (lockTimer !== null) {
      host.clearTimer(lockTimer);
      lockTimer = null;
    }
    if (remaining > 0) lockTimer = host.setTimer(publishLock, remaining);
    const locked = remaining > 0;
    if (locked !== lockedNow) {
      lockedNow = locked;
      host.onLockChange(locked);
    }
  }

  function apply(event: TapEvent): void {
    const out = tapStep(state, event, config);
    state = out.state;
    const nextPressed = pressedTargets(state);
    if (!sameSet(nextPressed, pressed)) {
      pressed = nextPressed;
      host.onPressedChange(nextPressed);
    }
    if (out.commits.length > 0 || event.type === 'lock') publishLock();
    for (const id of out.commits) entries.get(id)?.commit();
  }

  function each(event: TapResponderEvent, type: 'down' | 'move' | 'up'): void {
    const { targets, nodes } = snapshot();
    const at = host.timeOf(event.timeStamp);
    for (const touch of touchesOf(event)) {
      const base = { touchId: touchKey(touch), point: pointOf(touch), at, targets };
      if (type === 'down') {
        const hit = host.hitAt(touch.target, nodes);
        apply({ type, ...base, ...(hit === undefined ? {} : { hit }) });
      } else {
        apply({ type, ...base });
      }
    }
  }

  const handlers: TapBoardHandlers = {
    onStartShouldSetResponderCapture: (event) => {
      const touch = touchesOf(event)[0]!;
      const { targets, nodes } = snapshot();
      return claimsTouch(pointOf(touch), targets, host.hitAt(touch.target, nodes));
    },
    onStartShouldSetResponder: () => false,
    // Both platforms send onResponderStart for the granting touch too; the model ignores the repeat.
    onResponderGrant: (event) => each(event, 'down'),
    onResponderStart: (event) => each(event, 'down'),
    onResponderMove: (event) => each(event, 'move'),
    onResponderEnd: (event) => each(event, 'up'),
    onResponderRelease: () => {
      // Every finger is up: a finger whose end the board missed must not hold it.
      if (state.touches.length > 0) apply({ type: 'cancel', at: host.now() });
    },
    onResponderTerminate: () => apply({ type: 'cancel', at: host.now() }),
    onResponderTerminationRequest: (event) => {
      const native = event.nativeEvent;
      if (native.type === 'scroll' || native.contentOffset !== undefined) return true;
      return state.touches.length === 0;
    },
  };

  return {
    handlers,
    configure: (next) => {
      config = next;
    },
    register: (id, entry) => {
      entries.set(id, entry);
      return () => {
        if (entries.get(id) === entry) entries.delete(id);
      };
    },
    click: (id, stamp) => apply({ type: 'click', targetId: id, at: host.timeOf(stamp), targets: snapshot(true).targets }),
    lock: (ms) => apply({ type: 'lock', ms, at: host.now() }),
    isLocked: () => boardLockRemaining(state, host.now()) > 0,
    dispose: () => {
      if (lockTimer !== null) host.clearTimer(lockTimer);
      lockTimer = null;
    },
  };
}
