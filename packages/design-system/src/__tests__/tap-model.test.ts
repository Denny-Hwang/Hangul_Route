import { describe, expect, it } from 'vitest';
import {
  CLICK_ECHO_MS,
  GAP_REACH,
  INITIAL_TAP_STATE,
  KEY_BOUNCE_MS,
  RELEASE_REACH,
  TAP_LOCK_MS,
  TAP_TRAVEL,
  boardLockRemaining,
  boardTouchAction,
  claimTarget,
  isTargetLocked,
  pressGuardAllows,
  pressedTargets,
  rectDistance,
  tapStep,
  type TapBoardConfig,
  type TapEvent,
  type TapModelState,
  type TapTargetSnapshot,
} from '../tap-model';
import { motion, spacing } from '../tokens';

/**
 * The forgiving tap (docs/specs/AMENDMENTS-TOUCH.md section 3; design/components/TapBoard/spec.md): the pure model a
 * `TapBoard` runs. Rows T1-T16 of section 3.3 are the `it` names below; the e2e half of each lives in the app's touch
 * suites. Points and rectangles share one space (page pixels on the web, window points on native).
 */

const A: TapTargetSnapshot = { id: 'A', rect: { x: 0, y: 0, width: 96, height: 96 } };
// B sits 12 px right of A: the gap is x 96..108.
const B: TapTargetSnapshot = { id: 'B', rect: { x: 108, y: 0, width: 96, height: 96 } };
const TARGETS = [A, B];

const FIRST_BOARD: TapBoardConfig = { lock: 'board', multiTouch: 'first', disabled: false };
const FIRST_TARGET: TapBoardConfig = { lock: 'target', multiTouch: 'first', disabled: false };
const KEYS: TapBoardConfig = { lock: 'target', multiTouch: 'each', disabled: false };

interface Run {
  state: TapModelState;
  commits: string[];
}

/** Runs events in order and gathers every commit. */
function run(config: TapBoardConfig, events: TapEvent[], from: TapModelState = INITIAL_TAP_STATE): Run {
  let state = from;
  const commits: string[] = [];
  for (const event of events) {
    const out = tapStep(state, event, config);
    state = out.state;
    commits.push(...out.commits);
  }
  return { state, commits };
}

const down = (touchId: string, x: number, y: number, at: number, targets = TARGETS): TapEvent => ({ type: 'down', touchId, point: { x, y }, at, targets });
const move = (touchId: string, x: number, y: number, at: number, targets = TARGETS): TapEvent => ({ type: 'move', touchId, point: { x, y }, at, targets });
const up = (touchId: string, x: number, y: number, at: number, targets = TARGETS): TapEvent => ({ type: 'up', touchId, point: { x, y }, at, targets });
/** A clean tap at a point: down and up at once. */
const tap = (touchId: string, x: number, y: number, at: number, targets = TARGETS): TapEvent[] => [down(touchId, x, y, at, targets), up(touchId, x, y, at + 60, targets)];

describe('constants (section 3.1)', () => {
  it('the distances are their spacing tokens', () => {
    expect(TAP_TRAVEL).toBe(spacing.xxl);
    expect(RELEASE_REACH).toBe(spacing.xl);
    expect(GAP_REACH).toBe(spacing.lg);
    expect([TAP_TRAVEL, RELEASE_REACH, GAP_REACH]).toEqual([32, 24, 16]);
  });

  it('the timings: a 400 ms lock, a 700 ms click echo, a 120 ms key bounce (motion.duration.fast)', () => {
    expect(TAP_LOCK_MS).toBe(400);
    expect(CLICK_ECHO_MS).toBe(700);
    expect(KEY_BOUNCE_MS).toBe(motion.duration.fast);
    expect(KEY_BOUNCE_MS).toBe(120);
  });
});

describe('rectDistance', () => {
  it('is 0 inside and on the edge, the straight distance outside', () => {
    expect(rectDistance({ x: 48, y: 48 }, A.rect)).toBe(0);
    expect(rectDistance({ x: 96, y: 96 }, A.rect)).toBe(0);
    expect(rectDistance({ x: 100, y: 48 }, A.rect)).toBe(4);
    expect(rectDistance({ x: 48, y: -10 }, A.rect)).toBe(10);
    expect(rectDistance({ x: 99, y: 100 }, A.rect)).toBe(5);
  });
});

describe('claimTarget (rules 1 and 2)', () => {
  it('a point inside a target claims it', () => {
    expect(claimTarget({ x: 10, y: 10 }, TARGETS)).toBe('A');
    expect(claimTarget({ x: 150, y: 10 }, TARGETS)).toBe('B');
  });

  it('T4: a point in the gap 4 px from A goes to A', () => {
    expect(claimTarget({ x: 100, y: 48 }, TARGETS)).toBe('A');
    expect(claimTarget({ x: 105, y: 48 }, TARGETS)).toBe('B');
  });

  it('T5: a point exactly midway (or within 1 px of a tie) is nobody\'s', () => {
    expect(claimTarget({ x: 102, y: 48 }, TARGETS)).toBeNull();
    expect(claimTarget({ x: 102.5, y: 48 }, TARGETS)).toBeNull();
  });

  it('a point farther than GAP_REACH from every target falls through', () => {
    expect(claimTarget({ x: 48, y: 96 + GAP_REACH }, TARGETS)).toBe('A');
    expect(claimTarget({ x: 48, y: 96 + GAP_REACH + 1 }, TARGETS)).toBeNull();
    expect(claimTarget({ x: 500, y: 500 }, TARGETS)).toBeNull();
    expect(claimTarget({ x: 0, y: 0 }, [])).toBeNull();
  });

  it('another control is never claimed, even within GAP_REACH; a target found by the host wins', () => {
    expect(claimTarget({ x: 100, y: 48 }, TARGETS, { kind: 'control' })).toBeNull();
    expect(claimTarget({ x: 10, y: 10 }, TARGETS, { kind: 'control' })).toBeNull();
    expect(claimTarget({ x: 100, y: 48 }, TARGETS, { kind: 'target', id: 'B' })).toBe('B');
    // A host hit on a target that is not registered falls back to the rectangles.
    expect(claimTarget({ x: 10, y: 10 }, TARGETS, { kind: 'target', id: 'gone' })).toBe('A');
  });
});

describe('the forgiving tap (rules 3 to 6)', () => {
  it('T1: down on A, 24 px down, lift: A commits once', () => {
    const out = run(FIRST_BOARD, [down('1', 48, 48, 0), move('1', 48, 60, 20), move('1', 48, 72, 40), up('1', 48, 72, 80)]);
    expect(out.commits).toEqual(['A']);
  });

  it('a press shows at once on down (no delay) and only while inside', () => {
    const first = tapStep(INITIAL_TAP_STATE, down('1', 48, 48, 0), FIRST_BOARD);
    expect([...pressedTargets(first.state)]).toEqual(['A']);
    const away = tapStep(first.state, move('1', 48, 200, 50), FIRST_BOARD);
    expect(pressedTargets(away.state).size).toBe(0);
    const back = tapStep(away.state, move('1', 48, 90, 80), FIRST_BOARD);
    expect([...pressedTargets(back.state)]).toEqual(['A']);
  });

  it('T2: travel of 40 px that ends 20 px below A still commits (inside RELEASE_REACH)', () => {
    const out = run(FIRST_BOARD, [down('1', 48, 76, 0), move('1', 48, 116, 40), up('1', 48, 116, 80)]);
    expect(out.commits).toEqual(['A']);
  });

  it('inside by travel alone: 32 px from the down point counts even outside the reach', () => {
    // A narrow target: down at its top edge, slide up 32 px (outside by 32, more than RELEASE_REACH).
    const thin: TapTargetSnapshot = { id: 'T', rect: { x: 0, y: 100, width: 96, height: 20 } };
    const out = run(FIRST_BOARD, [down('1', 48, 100, 0, [thin]), up('1', 48, 68, 50, [thin])]);
    expect(out.commits).toEqual(['T']);
    const far = run(FIRST_BOARD, [down('1', 48, 100, 0, [thin]), up('1', 48, 66 - RELEASE_REACH, 50, [thin])]);
    expect(far.commits).toEqual([]);
  });

  it('T3: 80 px away and lift: nothing commits; the press look went off as the finger left', () => {
    const left = run(FIRST_BOARD, [down('1', 48, 48, 0), move('1', 48, 128, 30)]);
    expect(pressedTargets(left.state).size).toBe(0);
    const out = run(FIRST_BOARD, [up('1', 48, 128, 60)], left.state);
    expect(out.commits).toEqual([]);
    expect(out.state.presses).toEqual([]);
  });

  it('on a first-finger board the target never changes during a touch', () => {
    const out = run(FIRST_BOARD, [down('1', 90, 48, 0), move('1', 115, 48, 30), up('1', 115, 48, 60)]);
    // 25 px of travel: still A, released over B.
    expect(out.commits).toEqual(['A']);
  });

  it('T10: down on A, hold 900 ms, lift: A commits', () => {
    expect(run(FIRST_BOARD, [down('1', 48, 48, 0), up('1', 48, 48, 900)]).commits).toEqual(['A']);
  });

  it('T11: down on A, responder terminated: no commit, no press look, nothing locked', () => {
    const out = run(FIRST_BOARD, [down('1', 48, 48, 0), { type: 'cancel', at: 40 }, up('1', 48, 48, 80)]);
    expect(out.commits).toEqual([]);
    expect(pressedTargets(out.state).size).toBe(0);
    expect(boardLockRemaining(out.state, 80)).toBe(0);
    expect(out.state.lastReleaseAt).toBeNull();
  });

  it('a release with no touch down (or an unknown finger) does nothing', () => {
    expect(run(FIRST_BOARD, [up('9', 48, 48, 0), move('9', 48, 48, 10)]).commits).toEqual([]);
  });

  it('a target that left the board before the release does not commit', () => {
    const out = run(FIRST_BOARD, [down('1', 48, 48, 0), move('1', 48, 50, 10, [B]), up('1', 48, 50, 20, [B])]);
    expect(out.commits).toEqual([]);
  });

  it('a touch in a dead area that a host claimed anyway commits nothing', () => {
    const out = run(FIRST_BOARD, [down('1', 500, 500, 0), up('1', 500, 500, 40)]);
    expect(out.commits).toEqual([]);
    expect(out.state.lastReleaseAt).toBe(40);
  });
});

describe('locks (rule 9, KT-D5)', () => {
  it('T6: board scope, taps on A at 0 and 150 ms: one commit', () => {
    expect(run(FIRST_BOARD, [...tap('1', 48, 48, 0), ...tap('2', 48, 48, 150)]).commits).toEqual(['A']);
  });

  it('board scope locks every target, and frees them after TAP_LOCK_MS', () => {
    const out = run(FIRST_BOARD, [...tap('1', 48, 48, 0), ...tap('2', 150, 48, 200)]);
    expect(out.commits).toEqual(['A']);
    // The lock started at the release (60 ms): free from 460.
    expect(boardLockRemaining(out.state, 300)).toBe(160);
    expect(run(FIRST_BOARD, tap('3', 150, 48, 60 + TAP_LOCK_MS), out.state).commits).toEqual(['B']);
  });

  it('a locked target is claimed but shows no press look and commits nothing, even when lifted after the lock ends', () => {
    const locked = run(FIRST_BOARD, tap('1', 48, 48, 0)).state;
    const pressed = tapStep(locked, down('2', 48, 48, 100), FIRST_BOARD);
    expect(pressedTargets(pressed.state).size).toBe(0);
    expect(tapStep(pressed.state, up('2', 48, 48, 700), FIRST_BOARD).commits).toEqual([]);
  });

  it('T7: target scope, tap A then B 150 ms later: both commit', () => {
    expect(run(FIRST_TARGET, [...tap('1', 48, 48, 0), ...tap('2', 150, 48, 150)]).commits).toEqual(['A', 'B']);
  });

  it('T8: target scope, taps on A at 0 and 150 ms: one commit', () => {
    const out = run(FIRST_TARGET, [...tap('1', 48, 48, 0), ...tap('2', 48, 48, 150)]);
    expect(out.commits).toEqual(['A']);
    expect(isTargetLocked(out.state, 'A', 300)).toBe(true);
    expect(isTargetLocked(out.state, 'B', 300)).toBe(false);
    expect(isTargetLocked(out.state, 'A', 60 + TAP_LOCK_MS)).toBe(false);
  });

  it('lock(ms) extends the board lock, never shortens it', () => {
    const locked = run(FIRST_TARGET, [{ type: 'lock', ms: 900, at: 0 }]).state;
    expect(boardLockRemaining(locked, 100)).toBe(800);
    expect(run(FIRST_TARGET, tap('1', 48, 48, 500), locked).commits).toEqual([]);
    const shorter = run(FIRST_TARGET, [{ type: 'lock', ms: 100, at: 100 }], locked).state;
    expect(boardLockRemaining(shorter, 100)).toBe(800);
    expect(run(FIRST_TARGET, tap('2', 48, 48, 900), locked).commits).toEqual(['A']);
  });

  it('a lock that starts while a finger is down stops that release', () => {
    const out = run(FIRST_BOARD, [down('1', 48, 48, 0), { type: 'lock', ms: 520, at: 20 }, up('1', 48, 48, 60)]);
    expect(out.commits).toEqual([]);
  });

  it('expired target locks are dropped as new commits come', () => {
    const out = run(FIRST_TARGET, [...tap('1', 48, 48, 0), ...tap('2', 150, 48, 1000)]);
    expect(Object.keys(out.state.targetLockedUntil)).toEqual(['B']);
  });
});

describe('fingers (rule 7, KT-D4)', () => {
  it('T9: finger 1 on A, finger 2 on B 40 ms later, 1 lifts, 2 lifts: A commits, B does not', () => {
    const out = run(FIRST_TARGET, [down('1', 48, 48, 0), down('2', 150, 48, 40), up('1', 48, 48, 80), up('2', 150, 48, 120)]);
    expect(out.commits).toEqual(['A']);
  });

  it('a second finger shows no press look and cancels nothing; the board ignores it until it lifts', () => {
    const two = run(FIRST_TARGET, [down('1', 48, 48, 0), down('2', 150, 48, 40)]);
    expect([...pressedTargets(two.state)]).toEqual(['A']);
    const firstUp = run(FIRST_TARGET, [up('1', 48, 48, 80)], two.state);
    // Finger 2 is still down and still ignored; a third finger is ignored too while it stays.
    const third = run(FIRST_TARGET, [down('3', 150, 48, 600), up('3', 150, 48, 650)], firstUp.state);
    expect(third.commits).toEqual([]);
    const after = run(FIRST_TARGET, [up('2', 150, 48, 700), ...tap('4', 150, 48, 800)], third.state);
    expect(after.commits).toEqual(['B']);
  });

  it('a repeated down for a finger already down is ignored', () => {
    const out = run(FIRST_BOARD, [down('1', 48, 48, 0), down('1', 48, 48, 5), up('1', 48, 48, 50)]);
    expect(out.commits).toEqual(['A']);
    expect(out.state.touches).toEqual([]);
  });
});

describe('the keyboard: each finger on its own (KT-D7, section 6.7)', () => {
  const K1: TapTargetSnapshot = { id: 'ㄱ', rect: { x: 0, y: 0, width: 64, height: 64 }, lockMs: KEY_BOUNCE_MS };
  const K2: TapTargetSnapshot = { id: 'ㄴ', rect: { x: 64, y: 0, width: 64, height: 64 }, lockMs: KEY_BOUNCE_MS };
  const SHIFT: TapTargetSnapshot = { id: 'shift', rect: { x: 128, y: 0, width: 64, height: 64 } };
  const keys = [K1, K2, SHIFT];

  it('a rollover types both letters in release order', () => {
    const out = run(KEYS, [down('1', 32, 32, 0, keys), down('2', 96, 32, 40, keys), up('2', 96, 32, 80, keys), up('1', 32, 32, 120, keys)]);
    expect(out.commits).toEqual(['ㄴ', 'ㄱ']);
  });

  it('the press look follows the finger and the key under it at release types', () => {
    const slid = run(KEYS, [down('1', 32, 32, 0, keys), move('1', 82, 32, 30, keys)]);
    expect([...pressedTargets(slid.state)]).toEqual(['ㄴ']);
    expect(run(KEYS, [up('1', 82, 32, 60, keys)], slid.state).commits).toEqual(['ㄴ']);
  });

  it('a release off the keyboard types nothing', () => {
    const out = run(KEYS, [down('1', 32, 32, 0, keys), move('1', 32, 200, 30, keys), up('1', 32, 200, 60, keys)]);
    expect(out.commits).toEqual([]);
  });

  it('a repeat on the same letter key within KEY_BOUNCE_MS is a bounce; after it, a real repeat', () => {
    const bounce = run(KEYS, [...tap('1', 32, 32, 0, keys), ...tap('2', 32, 32, 100, keys)]);
    expect(bounce.commits).toEqual(['ㄱ']);
    const again = run(KEYS, [...tap('1', 32, 32, 0, keys), ...tap('2', 32, 32, 60 + KEY_BOUNCE_MS, keys)]);
    expect(again.commits).toEqual(['ㄱ', 'ㄱ']);
  });

  it('Shift keeps the 400 ms target lock', () => {
    const out = run(KEYS, [...tap('1', 160, 32, 0, keys), ...tap('2', 160, 32, 300, keys), ...tap('3', 32, 32, 320, keys)]);
    expect(out.commits).toEqual(['shift', 'ㄱ']);
  });

  it('a finger that lands off every key and then slides onto one presses it', () => {
    const out = run(KEYS, [down('1', 32, 200, 0, keys), move('1', 32, 32, 20, keys), up('1', 32, 32, 60, keys)]);
    expect(out.commits).toEqual(['ㄱ']);
  });
});

describe('click echo and the click path (rule 8)', () => {
  const click = (targetId: string, at: number, targets = TARGETS): TapEvent => ({ type: 'click', targetId, at, targets });

  it('T12: a touch commit, then the browser click on A 30 ms later: one commit', () => {
    expect(run(FIRST_TARGET, [...tap('1', 48, 48, 0), click('A', 90)]).commits).toEqual(['A']);
  });

  it('a click within CLICK_ECHO_MS after a release that committed nothing is dropped too', () => {
    const out = run(FIRST_TARGET, [down('1', 48, 48, 0), move('1', 48, 300, 30), up('1', 48, 300, 60), click('B', 60 + CLICK_ECHO_MS - 1)]);
    expect(out.commits).toEqual([]);
    expect(run(FIRST_TARGET, [click('B', 60 + CLICK_ECHO_MS)], out.state).commits).toEqual(['B']);
  });

  it('T13: keyboard Enter (a click with no touch) commits once and starts the lock', () => {
    const out = run(FIRST_BOARD, [click('A', 0), click('A', 100), click('B', 200)]);
    expect(out.commits).toEqual(['A']);
    expect(boardLockRemaining(out.state, 0)).toBe(TAP_LOCK_MS);
  });

  it('a click on an unknown target does nothing', () => {
    expect(run(FIRST_BOARD, [click('gone', 0)]).commits).toEqual([]);
  });
});

describe('disabled (rule 3, T16)', () => {
  const lockedWrong: TapTargetSnapshot = { ...A, disabled: true };
  const targets = [lockedWrong, B];

  it('T16: a disabled target is claimed but never pressed or committed, by touch or by click', () => {
    expect(claimTarget({ x: 48, y: 48 }, targets)).toBe('A');
    const pressed = tapStep(INITIAL_TAP_STATE, down('1', 48, 48, 0, targets), FIRST_BOARD);
    expect(pressedTargets(pressed.state).size).toBe(0);
    expect(tapStep(pressed.state, up('1', 48, 48, 50, targets), FIRST_BOARD).commits).toEqual([]);
    expect(run(FIRST_BOARD, [{ type: 'click', targetId: 'A', at: 2000, targets }]).commits).toEqual([]);
  });

  it('a disabled board commits nothing and shows nothing', () => {
    const off: TapBoardConfig = { ...FIRST_BOARD, disabled: true };
    const pressed = tapStep(INITIAL_TAP_STATE, down('1', 48, 48, 0), off);
    expect(pressedTargets(pressed.state).size).toBe(0);
    expect(run(off, [...tap('1', 48, 48, 0), { type: 'click', targetId: 'B', at: 2000, targets: TARGETS }]).commits).toEqual([]);
  });
});

describe('scrolling boards (T14, T15)', () => {
  it('T14: a 20 px horizontal graze on A commits (the browser does not pan sideways on a pan-y board)', () => {
    expect(run(FIRST_BOARD, [down('1', 48, 48, 0), move('1', 58, 48, 20), move('1', 68, 48, 40), up('1', 68, 48, 60)]).commits).toEqual(['A']);
  });

  it('T15: a 40 px vertical drag that becomes a scroll cancels: nothing commits and nothing changes', () => {
    const out = run(FIRST_BOARD, [down('1', 48, 48, 0), move('1', 48, 64, 20), { type: 'cancel', at: 30 }, up('1', 48, 88, 60)]);
    expect(out.commits).toEqual([]);
    expect(out.state).toEqual(INITIAL_TAP_STATE);
  });
});

describe('boardTouchAction (KT-D3)', () => {
  it('auto: pinch-zoom when the screen fits, else pan-y pinch-zoom', () => {
    expect(boardTouchAction('auto', true, true)).toBe('pinch-zoom');
    expect(boardTouchAction('auto', false, true)).toBe('pan-y pinch-zoom');
  });

  it('x: pan-x pinch-zoom; none: pinch-zoom', () => {
    expect(boardTouchAction('x', false, true)).toBe('pan-x pinch-zoom');
    expect(boardTouchAction('none', false, true)).toBe('pinch-zoom');
  });

  it('a browser without pinch-zoom: a fitting board falls back to none; a panning one drops the zoom keyword', () => {
    expect(boardTouchAction('auto', true, false)).toBe('none');
    expect(boardTouchAction('none', false, false)).toBe('none');
    expect(boardTouchAction('auto', false, false)).toBe('pan-y');
    expect(boardTouchAction('x', true, false)).toBe('pan-x');
  });
});

describe('pressGuardAllows (the Button guard, section 4.4)', () => {
  it('lets the first press through and drops a second within TAP_LOCK_MS', () => {
    expect(pressGuardAllows(null, 0)).toBe(true);
    expect(pressGuardAllows(0, TAP_LOCK_MS - 1)).toBe(false);
    expect(pressGuardAllows(0, TAP_LOCK_MS)).toBe(true);
  });
});
