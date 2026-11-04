import {
  INITIAL_TAP_STATE,
  boardLockRemaining,
  claimsTouch,
  flingStep,
  hasLivePress,
  pressedTargets,
  tapStep,
  FLING_FRAME_MS,
  type TapAxis,
  type TapEvent,
  type TapHit,
  type TapLockScope,
  type TapModelState,
  type TapMultiTouch,
  type TapPoint,
  type TapRect,
  type TapScroll,
  type TapTargetSnapshot,
} from '../../tap-model';

/**
 * The responder half of `TapBoard` (docs/specs/AMENDMENTS-TOUCH.md section 4.1): it turns the responder events of
 * react-native and react-native-web into the events of the pure model (`tap-model.ts`), reads the targets' and
 * controls' rectangles at each event through its host, calls a target's commit, drives the board's scroller (rule 5,
 * with the fling), folds in the app-level lock (rule 10), and tells the board what to paint. No React here, so the
 * rules are tested without a renderer.
 *
 * - It owns the responder by capture, and only for a touch the model claims (`claimsTouch`): every other touch falls
 *   through to whatever is under it, and the `Pressable` inside a target never gets the touch.
 * - It blocks the native responder on grant (a native ScrollView cannot take a graze from it; the board scrolls itself,
 *   rule 5), and on the web it prevents the default of the `touchend` of a touch it claimed, so the browser sends no
 *   `click` for it to another board or a control nearby (rule 9; the echo window stays as the backstop).
 * - It commits on `onResponderEnd` for the owning finger (`onResponderRelease` waits for every finger).
 * - It refuses a termination request for a responder transfer and for `contextmenu` (a long hold must not end the
 *   tap), and accepts one for `scroll` (unless it is the scroll the board is driving) and `selectionchange`; a
 *   termination is a cancel (rule 7). A scroll of its scroller that it did not drive also cancels a live press.
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
  /** The web: the DOM event's `preventDefault` (react-native-web forwards it). */
  preventDefault?: () => void;
  nativeEvent: TapResponderTouch & {
    changedTouches?: readonly TapResponderTouch[];
    /** The web DOM event type (`touchstart`, `scroll`, `contextmenu`, ...). */
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
  /** The target lock after a commit on a `target` board (the keyboard's keys: `KEY_BOUNCE_MS`). */
  lockMs?: number;
  /** `false` for a take-back target: no gap fill (rule 2). */
  gapFill?: boolean;
  commit: () => void;
}

/** A non-target control inside the board (`TapControl`): never claimed (rule 2). */
export interface TapControlEntry {
  node: () => unknown;
}

/** The scroller a board drives (`TapScroller`, section 4.1). `scrollBy` returns the offset it moved to. */
export interface TapScrollerLike {
  axis: TapAxis;
  canScroll: boolean;
  scrollBy(delta: number): number;
  onScroll(listener: (offset: number) => void): () => void;
}

/** The app-level `board` lock (`TapLockProvider`, rule 10), on the board's clock. */
export interface TapAppLock {
  until(): number;
  extendTo(at: number): void;
}

/** The platform side: the clock, rectangles, the hit test, timers, the app lock and the scroller, and the paint. */
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
  /** Asks for a fresh rectangle later (native: the cache, rule 1). */
  remeasure?(node: unknown, id: string): void;
  /** What is under the finger before any rectangle test (the DOM on the web); undefined when the host cannot tell. */
  hitAt(eventTarget: unknown, nodes: ReadonlyMap<unknown, string>): TapHit | undefined;
  /** The app-level lock, or null without a provider (the board then keeps its own clock). */
  appLock(): TapAppLock | null;
  /** The scroller this board may drive now, or null. */
  scroller(): TapScrollerLike | null;
  onPressedChange(pressed: ReadonlySet<string>): void;
  onLockChange(locked: boolean): void;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
}

export interface TapBoardHandlers {
  onStartShouldSetResponderCapture(event: TapResponderEvent): boolean;
  onStartShouldSetResponder(): boolean;
  /** Returns true: on native that blocks the native responder (a ScrollView), so only the board decides the touch. */
  onResponderGrant(event: TapResponderEvent): boolean;
  onResponderStart(event: TapResponderEvent): void;
  onResponderMove(event: TapResponderEvent): void;
  onResponderEnd(event: TapResponderEvent): void;
  onResponderRelease(event: TapResponderEvent): void;
  onResponderTerminate(): void;
  onResponderTerminationRequest(event: TapResponderEvent): boolean;
}

export interface TapControllerConfig {
  lock: TapLockScope;
  multiTouch: TapMultiTouch;
  disabled: boolean;
  scroll: TapScroll;
}

export interface TapBoardController {
  readonly handlers: TapBoardHandlers;
  configure(config: TapControllerConfig): void;
  /** Adds (or replaces) a target; returns its unregister. */
  register(id: string, entry: TapTargetEntry): () => void;
  /** Adds a non-target control; returns its unregister. */
  registerControl(id: string, entry: TapControlEntry): () => void;
  /** A click that reached a target's `Pressable` (rule 9), with its event's time stamp when it has one. */
  click(id: string, stamp?: unknown): void;
  /** Extends the board lock (and the app lock) by `ms` from now (rule 10). */
  lock(ms: number): void;
  isLocked(): boolean;
  /** Listens to a scroller: a scroll the board did not drive cancels a live press (rule 7). Returns the stop. */
  attachScroller(scroller: TapScrollerLike): () => void;
  /** Asks every target and control for a fresh rectangle (native: after a scroll ends or the fit changes). */
  remeasure(): void;
  dispose(): void;
}

const NO_RECT: TapRect = { x: 0, y: 0, width: 0, height: 0 };
/** How long an offset the board drove is remembered, so its own scroll events are not taken for a foreign scroll. */
const DRIVEN_MEMORY_MS = 500;

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

export function createTapBoardController(host: TapBoardHost, initial: TapControllerConfig): TapBoardController {
  let config = initial;
  let state: TapModelState = INITIAL_TAP_STATE;
  let pressed: ReadonlySet<string> = new Set();
  let lockedNow = false;
  let lockTimer: unknown = null;
  let flingTimer: unknown = null;
  let driven: Array<{ offset: number; at: number }> = [];
  const entries = new Map<string, TapTargetEntry>();
  const controls = new Map<string, TapControlEntry>();
  /** The fingers the board claimed at their down (rule 2): the web drops the browser's click for each at its end. */
  const claimed = new Set<string>();

  /** Every target with its rectangle now; a click also takes targets it cannot measure (it needs no rectangle). */
  function snapshot(forClick = false): { targets: TapTargetSnapshot[]; nodes: Map<unknown, string> } {
    const targets: TapTargetSnapshot[] = [];
    const nodes = new Map<unknown, string>();
    for (const [id, entry] of entries) {
      const node = entry.node();
      const present = node !== null && node !== undefined;
      const rect = present ? host.rectOf(node, id) : null;
      if (present) nodes.set(node, id);
      if (rect === null && !forClick) continue;
      targets.push({
        id,
        rect: rect ?? NO_RECT,
        disabled: entry.disabled(),
        ...(entry.lockMs === undefined ? {} : { lockMs: entry.lockMs }),
        ...(entry.gapFill === false ? { gapFill: false } : {}),
      });
    }
    return { targets, nodes };
  }

  function controlRects(): TapRect[] {
    const rects: TapRect[] = [];
    for (const [id, entry] of controls) {
      const node = entry.node();
      const rect = node === null || node === undefined ? null : host.rectOf(node, `control:${id}`);
      if (rect !== null) rects.push(rect);
    }
    return rects;
  }

  /** The scroller this board drives under the current config (rule 5). */
  function driveable(): TapScrollerLike | null {
    if (config.scroll === 'none' || config.multiTouch === 'each') return null;
    return host.scroller();
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

  function stopFling(): void {
    if (flingTimer !== null) host.clearTimer(flingTimer);
    flingTimer = null;
  }

  /** Moves the scroller and remembers where it went, so the scroll event that follows reads as the board's own. */
  function drive(scroller: TapScrollerLike, delta: number): number {
    const at = host.now();
    const offset = scroller.scrollBy(delta);
    driven = [...driven.filter((d) => at - d.at <= DRIVEN_MEMORY_MS), { offset, at }];
    return offset;
  }

  function fling(scroller: TapScrollerLike, velocity: number): void {
    stopFling();
    let v = velocity;
    let last = Number.NaN;
    const frame = (): void => {
      flingTimer = null;
      const step = flingStep(v);
      if (step === null) return;
      const offset = drive(scroller, step.delta);
      // An edge stops the fling: the offset no longer moves.
      if (offset === last) return;
      last = offset;
      v = step.next;
      flingTimer = host.setTimer(frame, FLING_FRAME_MS);
    };
    frame();
  }

  function apply(event: TapEvent): void {
    // Rule 10: the app clock holds the `board` lock (a board that mounts during it starts locked). The keyboard
    // (`each`) neither reads nor sets it (KT-D7): a guarded press elsewhere never drops a keystroke.
    const app = config.multiTouch === 'each' ? null : host.appLock();
    if (app !== null) state = { ...state, boardLockedUntil: Math.max(state.boardLockedUntil, app.until()) };
    const scroller = driveable();
    const out = tapStep(state, event, {
      lock: config.lock,
      multiTouch: config.multiTouch,
      disabled: config.disabled,
      scroller: scroller === null ? null : { axis: scroller.axis, canScroll: scroller.canScroll },
    });
    state = out.state;
    if (app !== null && (event.type === 'lock' || (out.commits.length > 0 && config.lock === 'board'))) app.extendTo(state.boardLockedUntil);
    const nextPressed = pressedTargets(state);
    if (!sameSet(nextPressed, pressed)) {
      pressed = nextPressed;
      host.onPressedChange(nextPressed);
    }
    if (out.commits.length > 0 || event.type === 'lock') publishLock();
    if (scroller !== null && out.scrollBy !== 0) drive(scroller, out.scrollBy);
    if (scroller !== null && out.fling !== null) fling(scroller, out.fling);
    for (const id of out.commits) entries.get(id)?.commit();
  }

  function each(event: TapResponderEvent, type: 'down' | 'move' | 'up'): void {
    const { targets, nodes } = snapshot();
    const at = host.timeOf(event.timeStamp);
    let ownEnd = false;
    for (const touch of touchesOf(event)) {
      const base = { touchId: touchKey(touch), point: pointOf(touch), at, targets };
      if (type === 'down') {
        const hit = host.hitAt(touch.target, nodes);
        const rects = controlRects();
        if (claimsTouch(base.point, targets, hit, rects)) claimed.add(base.touchId);
        apply({ type, ...base, controls: rects, ...(hit === undefined ? {} : { hit }) });
      } else {
        if (type === 'up' && claimed.delete(base.touchId)) ownEnd = true;
        apply({ type, ...base });
      }
    }
    // The web: the board decided this touch, so the browser must not send its click anywhere (rule 9).
    if (ownEnd && event.nativeEvent.type === 'touchend') event.preventDefault?.();
  }

  function cancel(): void {
    claimed.clear();
    apply({ type: 'cancel', at: host.now() });
  }

  function remeasureAll(): void {
    if (host.remeasure === undefined) return;
    for (const [id, entry] of entries) host.remeasure(entry.node(), id);
    for (const [id, entry] of controls) host.remeasure(entry.node(), `control:${id}`);
  }

  const handlers: TapBoardHandlers = {
    onStartShouldSetResponderCapture: (event) => {
      // A new touch on the board stops a fling (rule 5), whether or not the board takes it.
      stopFling();
      const touch = touchesOf(event)[0]!;
      const { targets, nodes } = snapshot();
      const claimed = claimsTouch(pointOf(touch), targets, host.hitAt(touch.target, nodes), controlRects());
      // The native cache may be stale (a layout the board was not told of): ask for fresh rectangles for next time.
      remeasureAll();
      return claimed;
    },
    onStartShouldSetResponder: () => false,
    // Both platforms send onResponderStart for the granting touch too; the model ignores the repeat. `true` blocks the
    // native responder, so a native ScrollView never takes a graze from the board (the board scrolls it itself, rule 5).
    onResponderGrant: (event) => {
      each(event, 'down');
      return true;
    },
    onResponderStart: (event) => each(event, 'down'),
    onResponderMove: (event) => each(event, 'move'),
    onResponderEnd: (event) => each(event, 'up'),
    onResponderRelease: () => {
      // Every finger is up: a finger whose end the board missed must not hold it.
      if (state.touches.length > 0) cancel();
      claimed.clear();
    },
    onResponderTerminate: cancel,
    onResponderTerminationRequest: (event) => {
      const native = event.nativeEvent;
      if (native.type === 'selectionchange') return true;
      // A scroll may end the press (rule 7 then cancels it), but not the scroll the board itself is driving (rule 5).
      if (native.type === 'scroll' || native.contentOffset !== undefined) return !state.presses.some((p) => p.scrolling);
      // Another responder may not take over, and a long hold's `contextmenu` must not end the tap.
      return false;
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
    registerControl: (id, entry) => {
      controls.set(id, entry);
      return () => {
        if (controls.get(id) === entry) controls.delete(id);
      };
    },
    click: (id, stamp) => apply({ type: 'click', targetId: id, at: host.timeOf(stamp), targets: snapshot(true).targets }),
    lock: (ms) => apply({ type: 'lock', ms, at: host.now() }),
    isLocked: () => boardLockRemaining(state, host.now()) > 0,
    attachScroller: (scroller) =>
      scroller.onScroll((offset) => {
        const at = host.now();
        driven = driven.filter((d) => at - d.at <= DRIVEN_MEMORY_MS);
        if (driven.some((d) => Math.abs(d.offset - offset) <= 1)) return;
        // Rule 7: a scroll the board did not drive (a browser pan, the platform's own fling, a game's own scroll).
        if (hasLivePress(state)) apply({ type: 'cancel', at });
      }),
    remeasure: remeasureAll,
    dispose: () => {
      if (lockTimer !== null) host.clearTimer(lockTimer);
      lockTimer = null;
      stopFling();
    },
  };
}
