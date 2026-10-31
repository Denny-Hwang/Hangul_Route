import { describe, expect, it } from 'vitest';
import { CLICK_ECHO_MS, TAP_LOCK_MS, type TapHit, type TapRect } from '../../../tap-model';
import { createTapBoardController, type TapBoardHost, type TapResponderEvent } from '../controller';

/**
 * The board's responder (AMENDMENTS-TOUCH section 4.1; design/components/TapBoard/spec.md): the capture responder claims
 * only a touch the model claims, commits on the owning finger's `onResponderEnd`, refuses a termination request while a
 * finger is down (but not a scroll's), and a termination changes nothing. Driven with responder events shaped as
 * react-native-web and react-native send them, against a host with fixed rectangles, a manual clock and manual timers.
 */

interface Node {
  name: string;
}

function harness(config: Parameters<typeof createTapBoardController>[1] = { lock: 'board', multiTouch: 'first', disabled: false }) {
  const rects = new Map<Node, TapRect>();
  const controls = new Set<unknown>();
  const clock = { now: 0 };
  const timers: Array<{ at: number; fn: () => void; live: boolean }> = [];
  const pressedLog: string[][] = [];
  const lockLog: boolean[] = [];
  const host: TapBoardHost = {
    now: () => clock.now,
    timeOf: (stamp) => (typeof stamp === 'number' ? stamp : clock.now),
    rectOf: (node) => rects.get(node as Node) ?? null,
    hitAt: (target, nodes): TapHit | undefined => {
      if (controls.has(target)) return { kind: 'control' };
      const id = nodes.get(target);
      return id === undefined ? undefined : { kind: 'target', id };
    },
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
  const add = (id: string, rect: TapRect, extra: { disabled?: boolean; lockMs?: number } = {}): Node => {
    const node = { name: id };
    rects.set(node, rect);
    const unregister = board.register(id, { node: () => node, disabled: () => extra.disabled === true, lockMs: extra.lockMs, commit: () => commits.push(id) });
    return Object.assign(node, { unregister });
  };
  /** Advance the clock and run due timers. */
  const advance = (ms: number): void => {
    clock.now += ms;
    for (const t of timers) {
      if (t.live && t.at <= clock.now) {
        t.live = false;
        t.fn();
      }
    }
  };
  return { board, host, clock, commits, pressedLog, lockLog, add, advance, controls, timers };
}

/** A responder event with one changed touch, as both platforms shape it. */
function ev(identifier: number, pageX: number, pageY: number, target: unknown = null, type = 'touchstart'): TapResponderEvent {
  const touch = { identifier, pageX, pageY, target };
  return { nativeEvent: { changedTouches: [touch], identifier, pageX, pageY, target, type } };
}

const A_RECT = { x: 0, y: 0, width: 96, height: 96 };
const B_RECT = { x: 108, y: 0, width: 96, height: 96 };

describe('TapBoard controller: the capture responder', () => {
  it('claims a touch on a target or in its gap reach, and lets every other touch fall through', () => {
    const h = harness();
    const a = h.add('A', A_RECT);
    h.add('B', B_RECT);
    const capture = h.board.handlers.onStartShouldSetResponderCapture;
    expect(capture(ev(1, 48, 48, a))).toBe(true);
    expect(capture(ev(1, 100, 48))).toBe(true);
    // A tie in the gap is taken (nobody's), so the browser's click cannot pick a target for it.
    expect(capture(ev(1, 102, 48))).toBe(true);
    expect(capture(ev(1, 48, 300))).toBe(false);
    expect(h.board.handlers.onStartShouldSetResponder()).toBe(false);
  });

  it('never claims another control in the board, even within the gap reach', () => {
    const h = harness();
    h.add('A', A_RECT);
    const speaker = { name: 'speaker' };
    h.controls.add(speaker);
    expect(h.board.handlers.onStartShouldSetResponderCapture(ev(1, 100, 48, speaker))).toBe(false);
  });

  it('reads the event\'s own fields when it has no changed touches (a mouse on the web)', () => {
    const h = harness();
    h.add('A', A_RECT);
    const mouse: TapResponderEvent = { nativeEvent: { identifier: 0, pageX: 48, pageY: 48, target: null, type: 'mousedown' } };
    expect(h.board.handlers.onStartShouldSetResponderCapture(mouse)).toBe(true);
  });

  it('an unregistered target is no longer claimed', () => {
    const h = harness();
    const a = h.add('A', A_RECT) as Node & { unregister: () => void };
    a.unregister();
    expect(h.board.handlers.onStartShouldSetResponderCapture(ev(1, 48, 48))).toBe(false);
  });

  it('a target with no rectangle (unmounted node) is left out', () => {
    const h = harness();
    h.board.register('ghost', { node: () => null, disabled: () => false, commit: () => undefined });
    expect(h.board.handlers.onStartShouldSetResponderCapture(ev(1, 48, 48))).toBe(false);
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

  it('T9: the first finger commits when it lifts, while the second is still down; the second does nothing', () => {
    const h = harness({ lock: 'target', multiTouch: 'first', disabled: false });
    h.add('A', A_RECT);
    h.add('B', B_RECT);
    h.board.handlers.onResponderStart(ev(1, 48, 48));
    h.advance(40);
    h.board.handlers.onResponderStart(ev(2, 150, 48));
    expect(h.pressedLog).toEqual([['A']]);
    h.advance(40);
    h.board.handlers.onResponderEnd(ev(1, 48, 48, null, 'touchend'));
    expect(h.commits).toEqual(['A']);
    h.advance(40);
    h.board.handlers.onResponderEnd(ev(2, 150, 48, null, 'touchend'));
    h.board.handlers.onResponderRelease(ev(2, 150, 48, null, 'touchend'));
    expect(h.commits).toEqual(['A']);
  });

  it('moves of several fingers in one event are each applied (the keyboard)', () => {
    const h = harness({ lock: 'target', multiTouch: 'each', disabled: false });
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
    // The end event for this finger never came (a lost touch): the release clears the board.
    h.board.handlers.onResponderRelease(ev(1, 48, 48, null, 'touchend'));
    expect(h.pressedLog.at(-1)).toEqual([]);
    h.advance(1000);
    h.board.handlers.onResponderStart(ev(3, 150, 48));
    h.board.handlers.onResponderEnd(ev(3, 150, 48, null, 'touchend'));
    expect(h.commits).toEqual(['B']);
  });

  it('a disabled target is claimed but not pressed or committed (T16)', () => {
    const h = harness();
    const a = h.add('A', A_RECT, { disabled: true });
    expect(h.board.handlers.onStartShouldSetResponderCapture(ev(1, 48, 48, a))).toBe(true);
    h.board.handlers.onResponderStart(ev(1, 48, 48, a));
    h.board.handlers.onResponderEnd(ev(1, 48, 48, a, 'touchend'));
    expect(h.pressedLog).toEqual([]);
    expect(h.commits).toEqual([]);
  });
});

describe('TapBoard controller: termination requests', () => {
  it('refuses while a finger is down and grants when none is', () => {
    const h = harness();
    h.add('A', A_RECT);
    const request = h.board.handlers.onResponderTerminationRequest;
    expect(request(ev(9, 0, 0))).toBe(true);
    h.board.handlers.onResponderStart(ev(1, 48, 48));
    expect(request(ev(2, 150, 48))).toBe(false);
    h.board.handlers.onResponderEnd(ev(1, 48, 48, null, 'touchend'));
    expect(request(ev(2, 150, 48))).toBe(true);
  });

  it('a scroll may always take over (web scroll event, native contentOffset): rule 6 then cancels', () => {
    const h = harness();
    h.add('A', A_RECT);
    h.board.handlers.onResponderStart(ev(1, 48, 48));
    const request = h.board.handlers.onResponderTerminationRequest;
    expect(request({ nativeEvent: { type: 'scroll' } })).toBe(true);
    expect(request({ nativeEvent: { contentOffset: { x: 0, y: 40 } } })).toBe(true);
  });
});

describe('TapBoard controller: clicks and locks', () => {
  it('T12: the browser click after a handled release is dropped; a click with no touch commits (T13)', () => {
    const h = harness({ lock: 'target', multiTouch: 'first', disabled: false });
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
    const h = harness({ lock: 'target', multiTouch: 'first', disabled: false });
    h.add('A', A_RECT);
    h.add('B', B_RECT);
    h.board.handlers.onResponderStart({ ...ev(1, 48, 48), timeStamp: 1000 });
    h.board.handlers.onResponderEnd({ ...ev(1, 48, 48, null, 'touchend'), timeStamp: 1060 });
    // The page was busy: the click is handled 900 ms later, but the browser sent it 30 ms after the release.
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
    const h = harness({ lock: 'target', multiTouch: 'first', disabled: false });
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
    const h = harness({ lock: 'target', multiTouch: 'first', disabled: false });
    h.add('A', A_RECT);
    h.board.click('A');
    expect(h.board.isLocked()).toBe(false);
    expect(h.lockLog).toEqual([]);
  });

  it('configure switches the rules for the next event; dispose stops the timer', () => {
    const h = harness();
    h.add('A', A_RECT);
    h.board.configure({ lock: 'board', multiTouch: 'first', disabled: true });
    h.board.click('A');
    expect(h.commits).toEqual([]);
    h.board.configure({ lock: 'board', multiTouch: 'first', disabled: false });
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
