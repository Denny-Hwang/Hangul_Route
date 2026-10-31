import { describe, expect, it } from 'vitest';
import { CLICK_ECHO_MS, FLING_DECAY, TAP_LOCK_MS, type TapHit, type TapRect } from '../../../tap-model';
import { createTapBoardController, type TapAppLock, type TapBoardHost, type TapControllerConfig, type TapResponderEvent, type TapScrollerLike } from '../controller';

/**
 * The board's responder (AMENDMENTS-TOUCH sections 3.2 and 4.1; design/components/TapBoard/spec.md): the capture
 * responder claims only a touch the model claims, commits on the owning finger's `onResponderEnd`, refuses a
 * termination request for a transfer and `contextmenu` but accepts `scroll` and `selectionchange`, drives its scroller
 * (and flings), cancels on a scroll it did not drive, and folds in the app-level lock. Driven with responder events
 * shaped as react-native-web and react-native send them, against a host with fixed rectangles, a manual clock and
 * manual timers.
 */

interface Node {
  name: string;
}

const BOARD: TapControllerConfig = { lock: 'board', multiTouch: 'latest', disabled: false, scroll: 'auto' };
const TARGET: TapControllerConfig = { ...BOARD, lock: 'target' };

type FakeScroller = TapScrollerLike & { offset: number; calls: number[]; emit(offset: number): void; listeners: Set<(o: number) => void> };

/** A scroller with a 1000 px range that records what the board asks of it. */
function fakeScroller(canScroll = true): FakeScroller {
  const listeners = new Set<(o: number) => void>();
  const s: FakeScroller = {
    axis: 'y',
    canScroll,
    offset: 0,
    calls: [],
    listeners,
    scrollBy(delta: number) {
      s.calls.push(delta);
      s.offset = Math.min(Math.max(0, s.offset + delta), 1000);
      return s.offset;
    },
    onScroll(listener: (o: number) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit(offset: number) {
      for (const l of listeners) l(offset);
    },
  };
  return s;
}

function harness(config: TapControllerConfig = BOARD, options: { scroller?: TapScrollerLike | null; app?: TapAppLock | null; remeasure?: boolean } = {}) {
  const rects = new Map<Node, TapRect>();
  const controls = new Set<unknown>();
  const clock = { now: 0 };
  const timers: Array<{ at: number; fn: () => void; live: boolean }> = [];
  const pressedLog: string[][] = [];
  const lockLog: boolean[] = [];
  const measured: string[] = [];
  const host: TapBoardHost = {
    now: () => clock.now,
    timeOf: (stamp) => (typeof stamp === 'number' ? stamp : clock.now),
    rectOf: (node) => rects.get(node as Node) ?? null,
    ...(options.remeasure ? { remeasure: (_node: unknown, id: string) => measured.push(id) } : {}),
    hitAt: (target): TapHit | undefined => (controls.has(target) ? { kind: 'control' } : undefined),
    appLock: () => options.app ?? null,
    scroller: () => options.scroller ?? null,
    onPressedChange: (ids) => pressedLog.push([...ids].sort()),
    onLockChange: (locked) => lockLog.push(locked),
    setTimer: (fn, ms) => {
      const timer = { at: clock.now + ms, fn, live: true };
      timers.push(timer);
      return timer;
    },
    clearTimer: (handle) => {
      (handle as { live: boolean }).live = false;
    },
  };
  const board = createTapBoardController(host, config);
  const commits: string[] = [];
  const add = (id: string, rect: TapRect, extra: { disabled?: boolean; lockMs?: number; gapFill?: boolean } = {}): Node & { unregister: () => void } => {
    const node = { name: id };
    rects.set(node, rect);
    const unregister = board.register(id, { node: () => node, disabled: () => extra.disabled === true, lockMs: extra.lockMs, gapFill: extra.gapFill, commit: () => commits.push(id) });
    return Object.assign(node, { unregister });
  };
  const addControl = (id: string, rect: TapRect): Node & { unregister: () => void } => {
    const node = { name: id };
    rects.set(node, rect);
    return Object.assign(node, { unregister: board.registerControl(id, { node: () => node }) });
  };
  /** Advance the clock and run due timers, in order (a timer may set another). */
  const advance = (ms: number): void => {
    const end = clock.now + ms;
    for (;;) {
      const due = timers.filter((t) => t.live && t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (due === undefined) break;
      clock.now = Math.max(clock.now, due.at);
      due.live = false;
      due.fn();
    }
    clock.now = end;
  };
  return { board, host, clock, commits, pressedLog, lockLog, measured, add, addControl, advance, controls, timers };
}

/** A responder event with one changed touch, as both platforms shape it. */
function ev(identifier: number, pageX: number, pageY: number, target: unknown = null, type = 'touchstart'): TapResponderEvent {
  const touch = { identifier, pageX, pageY, target };
  return { nativeEvent: { changedTouches: [touch], identifier, pageX, pageY, target, type } };
}

const A_RECT = { x: 0, y: 0, width: 96, height: 96 };
const B_RECT = { x: 108, y: 0, width: 96, height: 96 };

describe('TapBoard controller: the capture responder', () => {
  it('claims a touch on a target or in its gap reach (a tie too, as nobody\'s), and lets every other touch fall through', () => {
    const h = harness();
    const a = h.add('A', A_RECT);
    h.add('B', B_RECT);
    const capture = h.board.handlers.onStartShouldSetResponderCapture;
    expect(capture(ev(1, 48, 48, a))).toBe(true);
    expect(capture(ev(1, 100, 48))).toBe(true);
    expect(capture(ev(1, 102, 48))).toBe(true);
    expect(capture(ev(1, 48, 300))).toBe(false);
    expect(h.board.handlers.onStartShouldSetResponder()).toBe(false);
  });

  it('never claims another control: one the host finds in the DOM, or one registered through TapControl (T20)', () => {
    const h = harness();
    h.add('A', A_RECT);
    const speaker = { name: 'speaker' };
    h.controls.add(speaker);
    expect(h.board.handlers.onStartShouldSetResponderCapture(ev(1, 100, 48, speaker))).toBe(false);
    const hint = h.addControl('hint', { x: 98, y: 0, width: 6, height: 40 });
    expect(h.board.handlers.onStartShouldSetResponderCapture(ev(1, 100, 20))).toBe(false);
    hint.unregister();
    expect(h.board.handlers.onStartShouldSetResponderCapture(ev(1, 100, 20))).toBe(true);
  });

  it('reads the event\'s own fields when it has no changed touches (a mouse on the web)', () => {
    const h = harness();
    h.add('A', A_RECT);
    const mouse: TapResponderEvent = { nativeEvent: { identifier: 0, pageX: 48, pageY: 48, target: null, type: 'mousedown' } };
    expect(h.board.handlers.onStartShouldSetResponderCapture(mouse)).toBe(true);
  });

  it('an unregistered target is no longer claimed; a target or control with no node is left out', () => {
    const h = harness();
    h.add('A', A_RECT).unregister();
    h.board.register('ghost', { node: () => null, disabled: () => false, commit: () => undefined });
    h.board.registerControl('ghost', { node: () => undefined });
    expect(h.board.handlers.onStartShouldSetResponderCapture(ev(1, 48, 48))).toBe(false);
  });

  it('T18: a take-back target is not gap-filled', () => {
    const h = harness();
    h.add('Z', B_RECT, { gapFill: false });
    expect(h.board.handlers.onStartShouldSetResponderCapture(ev(1, 104, 48))).toBe(false);
    expect(h.board.handlers.onStartShouldSetResponderCapture(ev(1, 110, 48))).toBe(true);
  });

  it('native: every capture asks the targets and controls for fresh rectangles', () => {
    const h = harness(BOARD, { remeasure: true });
    h.add('A', A_RECT);
    h.addControl('hint', B_RECT);
    h.board.handlers.onStartShouldSetResponderCapture(ev(1, 48, 48));
    expect(h.measured).toEqual(['A', 'control:hint']);
    h.board.remeasure();
    expect(h.measured).toHaveLength(4);
  });
});

describe('TapBoard controller: the gesture', () => {
  it('shows the press look on the first touch frame and commits on the owning finger\'s end', () => {
    const h = harness();
    h.add('A', A_RECT);
    h.board.handlers.onResponderGrant(ev(1, 48, 48));
    h.board.handlers.onResponderStart(ev(1, 48, 48));
    expect(h.pressedLog).toEqual([['A']]);
    h.advance(40);
    h.board.handlers.onResponderMove(ev(1, 48, 70, null, 'touchmove'));
    h.board.handlers.onResponderEnd(ev(1, 48, 70, null, 'touchend'));
    expect(h.commits).toEqual(['A']);
    expect(h.pressedLog).toEqual([['A'], []]);
    h.board.handlers.onResponderRelease(ev(1, 48, 70, null, 'touchend'));
    expect(h.commits).toEqual(['A']);
  });

  it('T9: the later finger on a target owns the board; the earlier one never commits', () => {
    const h = harness(TARGET);
    h.add('A', A_RECT);
    h.add('B', B_RECT);
    h.board.handlers.onResponderStart(ev(1, 48, 48));
    h.advance(40);
    h.board.handlers.onResponderStart(ev(2, 150, 48));
    expect(h.pressedLog).toEqual([['A'], ['B']]);
    h.advance(40);
    h.board.handlers.onResponderEnd(ev(1, 48, 48, null, 'touchend'));
    expect(h.commits).toEqual([]);
    h.board.handlers.onResponderEnd(ev(2, 150, 48, null, 'touchend'));
    h.board.handlers.onResponderRelease(ev(2, 150, 48, null, 'touchend'));
    expect(h.commits).toEqual(['B']);
  });

  it('moves of several fingers in one event are each applied (the keyboard)', () => {
    const h = harness({ lock: 'target', multiTouch: 'each', disabled: false, scroll: 'none' });
    h.add('ㄱ', { x: 0, y: 0, width: 64, height: 64 });
    h.add('ㄴ', { x: 64, y: 0, width: 64, height: 64 });
    h.add('ㄷ', { x: 128, y: 0, width: 64, height: 64 });
    h.board.handlers.onResponderStart(ev(1, 32, 32));
    h.board.handlers.onResponderStart(ev(2, 96, 32));
    const both: TapResponderEvent = {
      nativeEvent: {
        changedTouches: [
          { identifier: 1, pageX: 80, pageY: 32, target: null },
          { identifier: 2, pageX: 150, pageY: 32, target: null },
        ],
        type: 'touchmove',
      },
    };
    h.board.handlers.onResponderMove(both);
    expect(h.pressedLog.at(-1)).toEqual(['ㄴ', 'ㄷ']);
  });

  it('T11: a termination drops the press look and commits nothing, even when the finger then lifts', () => {
    const h = harness();
    h.add('A', A_RECT);
    h.board.handlers.onResponderStart(ev(1, 48, 48));
    h.board.handlers.onResponderTerminate();
    expect(h.pressedLog).toEqual([['A'], []]);
    h.board.handlers.onResponderEnd(ev(1, 48, 48, null, 'touchend'));
    expect(h.commits).toEqual([]);
  });

  it('a release that leaves a finger the board never saw lift clears it', () => {
    const h = harness();
    h.add('A', A_RECT);
    h.add('B', B_RECT);
    h.board.handlers.onResponderStart(ev(1, 48, 48));
    h.board.handlers.onResponderRelease(ev(1, 48, 48, null, 'touchend'));
    expect(h.pressedLog.at(-1)).toEqual([]);
    h.advance(1000);
    h.board.handlers.onResponderStart(ev(3, 150, 48));
    h.board.handlers.onResponderEnd(ev(3, 150, 48, null, 'touchend'));
    expect(h.commits).toEqual(['B']);
  });

  it('T16: a disabled target is claimed but not pressed or committed', () => {
    const h = harness();
    const a = h.add('A', A_RECT, { disabled: true });
    expect(h.board.handlers.onStartShouldSetResponderCapture(ev(1, 48, 48, a))).toBe(true);
    h.board.handlers.onResponderStart(ev(1, 48, 48, a));
    h.board.handlers.onResponderEnd(ev(1, 48, 48, a, 'touchend'));
    expect(h.pressedLog).toEqual([]);
    expect(h.commits).toEqual([]);
  });
});

describe('TapBoard controller: the platform default of a claimed touch', () => {
  const withDefault = (e: TapResponderEvent, log: string[]): TapResponderEvent => ({ ...e, preventDefault: () => log.push(e.nativeEvent.type ?? '') });

  it('native: the grant blocks the native responder (a ScrollView cannot take the graze)', () => {
    const h = harness();
    h.add('A', A_RECT);
    expect(h.board.handlers.onResponderGrant(ev(1, 48, 48))).toBe(true);
  });

  it('web: the touchend of a claimed touch is prevented, so the browser sends no click elsewhere; a touch it did not claim keeps its click', () => {
    const h = harness();
    h.add('A', A_RECT);
    h.add('B', B_RECT);
    const log: string[] = [];
    // A tie in the gap: claimed, commits nothing, and its click must not reach a target through the browser's adjustment.
    h.board.handlers.onResponderGrant(ev(1, 102, 48));
    h.board.handlers.onResponderStart(ev(1, 102, 48));
    h.board.handlers.onResponderEnd(withDefault(ev(1, 102, 48, null, 'touchend'), log));
    h.board.handlers.onResponderRelease(ev(1, 102, 48, null, 'touchend'));
    expect(h.commits).toEqual([]);
    expect(log).toEqual(['touchend']);
    // A second finger on nothing the board claims (a margin) keeps its default; the claimed finger's end does not.
    h.board.handlers.onResponderStart(ev(2, 48, 48));
    h.board.handlers.onResponderStart(ev(3, 48, 400));
    h.board.handlers.onResponderEnd(withDefault(ev(3, 48, 400, null, 'touchend'), log));
    expect(log).toEqual(['touchend']);
    h.board.handlers.onResponderEnd(withDefault(ev(2, 48, 48, null, 'touchend'), log));
    expect(log).toEqual(['touchend', 'touchend']);
    // A mouse release is never prevented (its click is the board's echo, rule 9).
    h.board.handlers.onResponderRelease(ev(2, 48, 48, null, 'touchend'));
    h.board.handlers.onResponderStart({ nativeEvent: { pageX: 48, pageY: 48, type: 'mousedown' } });
    h.board.handlers.onResponderEnd(withDefault({ nativeEvent: { pageX: 48, pageY: 48, type: 'mouseup' } }, log));
    expect(log).toEqual(['touchend', 'touchend']);
  });

  it('a terminated touch is forgotten: a later finger with the same id that the board did not claim keeps its default', () => {
    const h = harness();
    h.add('A', A_RECT);
    const log: string[] = [];
    h.board.handlers.onResponderStart(ev(1, 48, 48));
    h.board.handlers.onResponderTerminate();
    h.board.handlers.onResponderEnd(withDefault(ev(1, 48, 48, null, 'touchend'), log));
    expect(log).toEqual([]);
  });
});

describe('TapBoard controller: termination requests (rule 7)', () => {
  it('refuses a responder transfer (another view wants a touch) and a contextmenu', () => {
    const h = harness();
    h.add('A', A_RECT);
    const request = h.board.handlers.onResponderTerminationRequest;
    expect(request(ev(9, 0, 0))).toBe(false);
    h.board.handlers.onResponderStart(ev(1, 48, 48));
    expect(request(ev(2, 150, 48, null, 'touchmove'))).toBe(false);
    expect(request({ nativeEvent: { type: 'contextmenu' } })).toBe(false);
  });

  it('accepts a scroll (web scroll event, native contentOffset) and a text selection', () => {
    const h = harness();
    const request = h.board.handlers.onResponderTerminationRequest;
    expect(request({ nativeEvent: { type: 'scroll' } })).toBe(true);
    expect(request({ nativeEvent: { type: 'selectionchange' } })).toBe(true);
    expect(request({ nativeEvent: { contentOffset: { x: 0, y: 40 } } })).toBe(true);
  });

  it('refuses the scroll it is driving itself (rule 5): the drag keeps scrolling', () => {
    const scroller = fakeScroller();
    const h = harness(BOARD, { scroller });
    h.add('A', { x: 0, y: 0, width: 96, height: 200 });
    h.board.handlers.onResponderStart(ev(1, 48, 150));
    expect(h.board.handlers.onResponderTerminationRequest({ nativeEvent: { type: 'scroll' } })).toBe(true);
    h.board.handlers.onResponderMove(ev(1, 48, 100, null, 'touchmove'));
    expect(h.board.handlers.onResponderTerminationRequest({ nativeEvent: { type: 'scroll' } })).toBe(false);
    expect(h.board.handlers.onResponderTerminationRequest({ nativeEvent: { contentOffset: { x: 0, y: 18 } } })).toBe(false);
    expect(h.board.handlers.onResponderTerminationRequest({ nativeEvent: { type: 'selectionchange' } })).toBe(true);
  });
});

describe('TapBoard controller: the scroller (rule 5, T15b, T15c)', () => {
  it('T15b: a 72 px drag from a target scrolls the scroller 40 px; nothing commits', () => {
    const scroller = fakeScroller();
    const h = harness(BOARD, { scroller });
    h.add('A', { x: 0, y: 0, width: 96, height: 200 });
    h.board.handlers.onResponderStart(ev(1, 48, 100));
    for (const y of [80, 60, 28]) {
      h.advance(16);
      h.board.handlers.onResponderMove(ev(1, 48, y, null, 'touchmove'));
    }
    expect(scroller.offset).toBe(40);
    expect(h.pressedLog.at(-1)).toEqual([]);
    h.advance(200);
    h.board.handlers.onResponderEnd(ev(1, 48, 28, null, 'touchend'));
    expect(h.commits).toEqual([]);
    expect(scroller.offset).toBe(40);
  });

  it('a fast release flings with FLING_DECAY until it is slow; a new touch stops a fling', () => {
    const scroller = fakeScroller();
    const h = harness(BOARD, { scroller });
    h.add('A', { x: 0, y: 0, width: 96, height: 400 });
    h.board.handlers.onResponderStart(ev(1, 48, 300));
    h.advance(16);
    h.board.handlers.onResponderMove(ev(1, 48, 250, null, 'touchmove'));
    h.advance(16);
    h.board.handlers.onResponderEnd(ev(1, 48, 200, null, 'touchend'));
    const afterRelease = scroller.calls.length;
    // The first fling frame runs at once: 100 px in 32 ms, times a 16 ms frame.
    expect(scroller.calls[afterRelease - 1]).toBeCloseTo((100 / 32) * 16, 5);
    h.advance(16);
    expect(scroller.calls[afterRelease]).toBeCloseTo((100 / 32) * FLING_DECAY * 16, 5);
    const before = scroller.calls.length;
    h.board.handlers.onStartShouldSetResponderCapture(ev(2, 48, 48));
    h.advance(200);
    expect(scroller.calls.length).toBe(before);
  });

  it('a fling stops at the scroller\'s edge', () => {
    const scroller = fakeScroller();
    scroller.offset = 990;
    const h = harness(BOARD, { scroller });
    h.add('A', { x: 0, y: 0, width: 96, height: 400 });
    h.board.handlers.onResponderStart(ev(1, 48, 300));
    h.advance(16);
    h.board.handlers.onResponderEnd(ev(1, 48, 200, null, 'touchend'));
    h.advance(1000);
    expect(scroller.offset).toBe(1000);
    expect(h.timers.filter((t) => t.live)).toHaveLength(0);
  });

  it('T15c: a scroll the board did not drive cancels a live press; its own scroll events do not', () => {
    const scroller = fakeScroller();
    const h = harness(BOARD, { scroller });
    h.add('A', { x: 0, y: 0, width: 96, height: 200 });
    const stop = h.board.attachScroller(scroller);
    h.board.handlers.onResponderStart(ev(1, 48, 100));
    scroller.emit(25);
    expect(h.pressedLog.at(-1)).toEqual([]);
    h.board.handlers.onResponderEnd(ev(1, 48, 100, null, 'touchend'));
    expect(h.commits).toEqual([]);
    // A drag the board drives: its own offsets come back and change nothing.
    h.advance(1000);
    h.board.handlers.onResponderStart(ev(2, 48, 150));
    h.board.handlers.onResponderMove(ev(2, 48, 100, null, 'touchmove'));
    scroller.emit(scroller.offset);
    h.board.handlers.onResponderMove(ev(2, 48, 90, null, 'touchmove'));
    expect(scroller.offset).toBe(28);
    stop();
    expect(scroller.listeners.size).toBe(0);
  });

  it('a scroll with no press changes nothing; a board that cannot scroll or scroll="none" never drives', () => {
    const scroller = fakeScroller(false);
    const h = harness(BOARD, { scroller });
    h.add('A', { x: 0, y: 0, width: 96, height: 200 });
    h.board.attachScroller(scroller);
    scroller.emit(30);
    h.board.handlers.onResponderStart(ev(1, 48, 150));
    h.board.handlers.onResponderMove(ev(1, 48, 90, null, 'touchmove'));
    expect(scroller.calls).toEqual([]);
    const other = fakeScroller();
    const none = harness({ ...BOARD, scroll: 'none' }, { scroller: other });
    none.add('A', { x: 0, y: 0, width: 96, height: 200 });
    none.board.handlers.onResponderStart(ev(1, 48, 150));
    none.board.handlers.onResponderMove(ev(1, 48, 90, null, 'touchmove'));
    none.board.handlers.onResponderEnd(ev(1, 48, 90, null, 'touchend'));
    expect(other.calls).toEqual([]);
  });
});

describe('TapBoard controller: clicks and locks', () => {
  it('T12: the browser click after a handled release is dropped; a click with no touch commits (T13)', () => {
    const h = harness(TARGET);
    h.add('A', A_RECT);
    h.add('B', B_RECT);
    h.board.handlers.onResponderStart(ev(1, 48, 48));
    h.board.handlers.onResponderEnd(ev(1, 48, 48, null, 'touchend'));
    h.advance(30);
    h.board.click('A');
    h.board.click('B');
    expect(h.commits).toEqual(['A']);
    h.advance(CLICK_ECHO_MS);
    h.board.click('B');
    expect(h.commits).toEqual(['A', 'B']);
    h.board.click('nobody');
    expect(h.commits).toEqual(['A', 'B']);
  });

  it('times come from the events\' own stamps: a click handled late but sent 30 ms after the release is its echo', () => {
    const h = harness(TARGET);
    h.add('A', A_RECT);
    h.add('B', B_RECT);
    h.board.handlers.onResponderStart({ ...ev(1, 48, 48), timeStamp: 1000 });
    h.board.handlers.onResponderEnd({ ...ev(1, 48, 48, null, 'touchend'), timeStamp: 1060 });
    h.advance(2000);
    h.board.click('B', 1090);
    expect(h.commits).toEqual(['A']);
    h.board.click('B');
    expect(h.commits).toEqual(['A', 'B']);
  });

  it('a board lock is published while it runs and cleared by its timer', () => {
    const h = harness();
    h.add('A', A_RECT);
    expect(h.board.isLocked()).toBe(false);
    h.board.click('A');
    expect(h.board.isLocked()).toBe(true);
    expect(h.lockLog).toEqual([true]);
    h.advance(TAP_LOCK_MS - 1);
    expect(h.lockLog).toEqual([true]);
    h.advance(1);
    expect(h.lockLog).toEqual([true, false]);
    expect(h.board.isLocked()).toBe(false);
  });

  it('lock(ms) extends the lock and re-arms the timer once', () => {
    const h = harness(TARGET);
    h.add('A', A_RECT);
    h.board.lock(520);
    h.advance(100);
    h.board.lock(900);
    h.advance(500);
    expect(h.lockLog).toEqual([true]);
    h.board.click('A');
    expect(h.commits).toEqual([]);
    h.advance(400);
    expect(h.lockLog).toEqual([true, false]);
    h.board.click('A');
    expect(h.commits).toEqual(['A']);
  });

  it('a target lock does not lock the board', () => {
    const h = harness(TARGET);
    h.add('A', A_RECT);
    h.board.click('A');
    expect(h.board.isLocked()).toBe(false);
    expect(h.lockLog).toEqual([]);
  });

  it('T19: a board commit sets the app lock, and a board mounted 320 ms later is locked until 400 ms', () => {
    let until = 0;
    const app: TapAppLock = { until: () => until, extendTo: (at) => (until = Math.max(until, at)) };
    const first = harness(BOARD, { app });
    first.add('A', A_RECT);
    first.board.handlers.onResponderStart(ev(1, 48, 48));
    first.board.handlers.onResponderEnd(ev(1, 48, 48, null, 'touchend'));
    expect(until).toBe(TAP_LOCK_MS);
    // The keyed board remounts: a new controller on the same app clock.
    const second = harness(BOARD, { app });
    second.add('A', A_RECT);
    second.clock.now = 350;
    second.board.handlers.onResponderStart(ev(2, 48, 48));
    expect(second.pressedLog).toEqual([]);
    second.board.handlers.onResponderEnd(ev(2, 48, 48, null, 'touchend'));
    second.clock.now = 450;
    second.board.handlers.onResponderStart(ev(3, 48, 48));
    second.board.handlers.onResponderEnd(ev(3, 48, 48, null, 'touchend'));
    expect(second.commits).toEqual(['A']);
  });

  it('lock(ms) extends the app lock; a target commit leaves the app lock alone', () => {
    let until = 0;
    const app: TapAppLock = { until: () => until, extendTo: (at) => (until = Math.max(until, at)) };
    const h = harness(TARGET, { app });
    h.add('A', A_RECT);
    h.board.click('A');
    expect(until).toBe(0);
    h.board.lock(900);
    expect(until).toBe(900);
  });

  it('the keyboard (each) neither reads nor sets the app lock (KT-D7): a guarded press elsewhere drops no keystroke', () => {
    let until = 1000;
    const app: TapAppLock = { until: () => until, extendTo: (at) => (until = Math.max(until, at)) };
    const h = harness({ lock: 'target', multiTouch: 'each', disabled: false, scroll: 'none' }, { app });
    h.add('ㄱ', A_RECT, { lockMs: 120 });
    h.clock.now = 100;
    h.board.handlers.onResponderStart(ev(1, 48, 48));
    h.board.handlers.onResponderEnd(ev(1, 48, 48, null, 'touchend'));
    expect(h.commits).toEqual(['ㄱ']);
    h.board.lock(900);
    expect(until).toBe(1000);
  });

    it('configure switches the rules for the next event; dispose stops the timers', () => {
    const h = harness();
    h.add('A', A_RECT);
    h.board.configure({ ...BOARD, disabled: true });
    h.board.click('A');
    expect(h.commits).toEqual([]);
    h.board.configure(BOARD);
    h.board.click('A');
    expect(h.commits).toEqual(['A']);
    h.board.dispose();
    h.advance(TAP_LOCK_MS);
    expect(h.lockLog).toEqual([true]);
  });

  it('a commit reaches the target\'s callback registered last under that id', () => {
    const h = harness();
    const calls: string[] = [];
    h.add('A', A_RECT);
    h.board.register('A', { node: () => ({}), disabled: () => false, commit: () => calls.push('second') });
    h.board.click('A');
    expect(calls).toEqual(['second']);
  });
});
