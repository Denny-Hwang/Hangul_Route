import { describe, expect, it } from 'vitest';
import {
  CLICK_ECHO_MS,
  FLING_DECAY,
  FLING_FRAME_MS,
  FLING_MIN_VELOCITY,
  FLING_WINDOW_MS,
  GAP_REACH,
  INITIAL_TAP_STATE,
  KEY_BOUNCE_MS,
  NEIGHBOUR_DEPTH,
  PALM_HOLD_MS,
  RELEASE_REACH,
  TAP_LOCK_MS,
  TAP_TRAVEL,
  boardLockRemaining,
  boardTouchAction,
  claimTarget,
  claimsTouch,
  flingStep,
  hasLivePress,
  isTargetLocked,
  pressGuardAllows,
  pressedTargets,
  rectDistance,
  tapStep,
  targetTouchAction,
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

const FIRST_BOARD: TapBoardConfig = { lock: 'board', multiTouch: 'latest', disabled: false };
const FIRST_TARGET: TapBoardConfig = { lock: 'target', multiTouch: 'latest', disabled: false };
const KEYS: TapBoardConfig = { lock: 'target', multiTouch: 'each', disabled: false };

interface Run {
  state: TapModelState;
  commits: string[];
  /** Every scroll the board asked for, and the fling at the end, if any. */
  scrolls: number[];
  fling: number | null;
}

/** Runs events in order and gathers every commit. */
function run(config: TapBoardConfig, events: TapEvent[], from: TapModelState = INITIAL_TAP_STATE): Run {
  let state = from;
  const commits: string[] = [];
  const scrolls: number[] = [];
  let fling: number | null = null;
  for (const event of events) {
    const out = tapStep(state, event, config);
    state = out.state;
    commits.push(...out.commits);
    if (out.scrollBy !== 0) scrolls.push(out.scrollBy);
    if (out.fling !== null) fling = out.fling;
  }
  return { state, commits, scrolls, fling };
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
    expect(NEIGHBOUR_DEPTH).toBe(spacing.sm);
    expect(NEIGHBOUR_DEPTH).toBe(8);
  });

  it('the timings: a 400 ms lock, a 700 ms click echo, a 120 ms key bounce (motion.duration.fast)', () => {
    expect(TAP_LOCK_MS).toBe(400);
    expect(CLICK_ECHO_MS).toBe(700);
    expect(KEY_BOUNCE_MS).toBe(motion.duration.fast);
    expect(KEY_BOUNCE_MS).toBe(120);
    expect(PALM_HOLD_MS).toBe(1500);
  });

  it('the fling: 0.95 per 16 ms frame, stops under 0.05 px/ms, velocity over the last 100 ms', () => {
    expect([FLING_DECAY, FLING_FRAME_MS, FLING_MIN_VELOCITY, FLING_WINDOW_MS]).toEqual([0.95, 16, 0.05, 100]);
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

  it('a tie is judged against the nearest target, whatever the order', () => {
    // Three targets around a gap at (0, 0): 10, 9.2 and 8.5 px away. The two nearest are within 1 px: nobody's.
    const at = (id: string, d: number): TapTargetSnapshot => ({ id, rect: { x: d, y: -5, width: 10, height: 10 } });
    const three = [at('far', 10), at('mid', 9.2), at('near', 8.5)];
    expect(claimTarget({ x: 0, y: 0 }, three)).toBeNull();
    expect(claimTarget({ x: 0, y: 0 }, [at('far', 10), at('near', 8.5)])).toBe('near');
  });

  it('the board still takes a tie (it commits nothing), but never a point near no target or on a control', () => {
    expect(claimsTouch({ x: 102, y: 48 }, TARGETS)).toBe(true);
    expect(claimsTouch({ x: 100, y: 48 }, TARGETS)).toBe(true);
    expect(claimsTouch({ x: 48, y: 96 + GAP_REACH + 1 }, TARGETS)).toBe(false);
    expect(claimsTouch({ x: 100, y: 48 }, TARGETS, { kind: 'control' })).toBe(false);
    const tie = run(FIRST_TARGET, [...tap('1', 102, 48, 0), { type: 'click', targetId: 'B', at: 90, targets: TARGETS }]);
    expect(tie.commits).toEqual([]);
  });

  it('a point farther than GAP_REACH from every target falls through', () => {
    expect(claimTarget({ x: 48, y: 96 + GAP_REACH }, TARGETS)).toBe('A');
    expect(claimTarget({ x: 48, y: 96 + GAP_REACH + 1 }, TARGETS)).toBeNull();
    expect(claimTarget({ x: 500, y: 500 }, TARGETS)).toBeNull();
    expect(claimTarget({ x: 0, y: 0 }, [])).toBeNull();
  });

  it('another control the host found is never claimed, even within GAP_REACH', () => {
    expect(claimTarget({ x: 100, y: 48 }, TARGETS, { kind: 'control' })).toBeNull();
    expect(claimTarget({ x: 10, y: 10 }, TARGETS, { kind: 'control' })).toBeNull();
  });

  it('T20: a speaker registered through TapControl 6 px from A is never claimed', () => {
    const speaker = { x: 102, y: 0, width: 4, height: 40 };
    expect(claimsTouch({ x: 104, y: 20 }, TARGETS, undefined, [speaker])).toBe(false);
    // Beside the speaker, the gap still fills.
    expect(claimTarget({ x: 100, y: 60 }, TARGETS, undefined, [speaker])).toBe('A');
  });

  it('T18: a take-back target (gapFill false) is reached only from inside its own rectangle', () => {
    const z: TapTargetSnapshot = { id: 'Z', rect: { x: 104, y: 0, width: 96, height: 96 }, gapFill: false };
    // 3 px from Z, 5 px from A: A.
    expect(claimTarget({ x: 101, y: 48 }, [A, z])).toBe('A');
    // 3 px from Z with A out of reach: nobody's, yet the board takes it (KT-6), so the browser's touch adjustment cannot
    // send its click into Z; past GAP_REACH it falls through.
    expect(claimTarget({ x: 101, y: 48 }, [z])).toBeNull();
    expect(claimsTouch({ x: 101, y: 48 }, [z])).toBe(true);
    expect(claimsTouch({ x: 104 - GAP_REACH - 1, y: 48 }, [z])).toBe(false);
    expect(claimTarget({ x: 110, y: 48 }, [A, z])).toBe('Z');
  });
});

describe('the forgiving tap (rules 3, 4, 6, 7)', () => {
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

  it('the target never changes during a touch (but the keyboard\'s): released in the gap nearer B, A commits', () => {
    const out = run(FIRST_BOARD, [down('1', 90, 48, 0), move('1', 104, 48, 30), up('1', 104, 48, 60)]);
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

describe('locks (rule 10, KT-D5)', () => {
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

describe('fingers (rule 8, KT-D4)', () => {
  it('T9: finger 1 on A, finger 2 on B 40 ms later, 1 lifts, 2 lifts: B commits once, A never', () => {
    const two = run(FIRST_TARGET, [down('1', 48, 48, 0), down('2', 150, 48, 40)]);
    expect([...pressedTargets(two.state)]).toEqual(['B']);
    const out = run(FIRST_TARGET, [up('1', 48, 48, 80), up('2', 150, 48, 120)], two.state);
    expect(out.commits).toEqual(['B']);
  });

  it('T9b: a thumb resting on A for 3 s never blocks a tap on B, and its lift answers nothing', () => {
    const out = run(FIRST_TARGET, [down('1', 48, 48, 0), ...tap('2', 150, 48, 1000), up('1', 48, 48, 3000)]);
    expect(out.commits).toEqual(['B']);
    expect(out.state.touches).toEqual([]);
  });

  it('a palm that lands on B after a tap on A and stays down past PALM_HOLD_MS answers nothing when it lifts', () => {
    const out = run(FIRST_TARGET, [down('1', 48, 48, 0), down('2', 150, 48, 60), up('1', 48, 48, 120), up('2', 150, 48, 60 + PALM_HOLD_MS)]);
    expect(out.commits).toEqual([]);
    expect(out.state.touches).toEqual([]);
    // T9 still holds for a quick second finger: it lifts well inside PALM_HOLD_MS and commits.
    expect(run(FIRST_TARGET, [down('1', 48, 48, 0), down('2', 150, 48, 60), up('1', 48, 48, 120), up('2', 150, 48, 400)]).commits).toEqual(['B']);
    // While the earlier finger is still down, a long hold of the later one is not a palm (T9b's thumb is still resting).
    expect(run(FIRST_TARGET, [down('1', 48, 48, 0), down('2', 150, 48, 60), up('2', 150, 48, 60 + PALM_HOLD_MS), up('1', 48, 48, 3000)]).commits).toEqual(['B']);
  });

  it('a finger that lands after the owner and lifts does not make a long hold a palm', () => {
    expect(run(FIRST_TARGET, [down('1', 48, 48, 0), ...tap('2', 400, 400, 20), up('1', 48, 48, 2000)]).commits).toEqual(['A']);
  });

  it('T9c: a second finger on an empty margin changes nothing; the first commits', () => {
    const out = run(FIRST_TARGET, [down('1', 48, 48, 0), down('2', 400, 400, 20), up('2', 400, 400, 60), up('1', 48, 48, 100)]);
    expect(out.commits).toEqual(['A']);
  });

  it('a repeated down for a finger already down is ignored', () => {
    const out = run(FIRST_BOARD, [down('1', 48, 48, 0), down('1', 48, 48, 5), up('1', 48, 48, 50)]);
    expect(out.commits).toEqual(['A']);
    expect(out.state.touches).toEqual([]);
  });
});

describe('a slide onto a neighbour (rule 4, T17)', () => {
  // A and C 8 px apart.
  const C: TapTargetSnapshot = { id: 'C', rect: { x: 104, y: 0, width: 96, height: 96 } };

  it('T17: down near A\'s edge, 25 px into C, lift over C: nothing commits; the press look went off on entering C', () => {
    const into = run(FIRST_BOARD, [down('1', 90, 48, 0, [A, C]), move('1', 115, 48, 30, [A, C])]);
    expect(pressedTargets(into.state).size).toBe(0);
    expect(run(FIRST_BOARD, [up('1', 115, 48, 60, [A, C])], into.state).commits).toEqual([]);
  });

  it('over the gap band of a neighbour (not its rectangle) the touch is still inside', () => {
    expect(run(FIRST_BOARD, [down('1', 90, 48, 0, [A, C]), up('1', 101, 48, 40, [A, C])]).commits).toEqual(['A']);
  });

  it('an edge graze that ends just inside the neighbour (up to NEIGHBOUR_DEPTH) still commits the tile it started on', () => {
    // A and B 12 px apart (the gap is x 96..108). 4 px inside A's edge, a 20 px slide ends 4 px inside B.
    expect(run(FIRST_BOARD, [down('1', 92, 48, 0), move('1', 102, 48, 20), move('1', 112, 48, 40), up('1', 112, 48, 60)]).commits).toEqual(['A']);
    // 8 px inside A's edge, a 24 px slide ends 4 px inside B; the press look stayed on all the way.
    const graze = run(FIRST_BOARD, [down('1', 88, 48, 0), move('1', 112, 48, 30)]);
    expect([...pressedTargets(graze.state)]).toEqual(['A']);
    expect(run(FIRST_BOARD, [up('1', 112, 48, 60)], graze.state).commits).toEqual(['A']);
    // Exactly NEIGHBOUR_DEPTH in still counts; one more pixel is over the neighbour.
    expect(run(FIRST_BOARD, [down('1', 92, 48, 0), up('1', 108 + NEIGHBOUR_DEPTH, 48, 40)]).commits).toEqual(['A']);
    expect(run(FIRST_BOARD, [down('1', 92, 48, 0), up('1', 109 + NEIGHBOUR_DEPTH, 48, 40)]).commits).toEqual([]);
  });

  it('a disabled neighbour does not count as a neighbour', () => {
    const off = { ...C, disabled: true };
    expect(run(FIRST_BOARD, [down('1', 90, 48, 0, [A, off]), up('1', 110, 48, 40, [A, off])]).commits).toEqual(['A']);
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

  it('a release over a neighbour with no move before it types the neighbour', () => {
    expect(run(KEYS, [down('1', 32, 32, 0, keys), up('1', 70, 32, 40, keys)]).commits).toEqual(['ㄴ']);
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

describe('click echo and the click path (rule 9)', () => {
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

describe('a board that can scroll drives its scroller (rule 5, T14, T15)', () => {
  const SCROLLING: TapBoardConfig = { ...FIRST_BOARD, scroller: { axis: 'y', canScroll: true } };

  it('T14: a 20 px horizontal graze on A commits', () => {
    expect(run(SCROLLING, [down('1', 48, 48, 0), move('1', 58, 48, 20), move('1', 68, 48, 40), up('1', 68, 48, 60)]).commits).toEqual(['A']);
  });

  it('T15: 16, 24 and 32 px vertical grazes on A commit each time, and nothing scrolls', () => {
    for (const d of [16, 24, 32]) {
      const out = run(SCROLLING, [down('1', 48, 48, 0), move('1', 48, 48 + d / 2, 20), move('1', 48, 48 + d, 40), up('1', 48, 48 + d, 60)]);
      expect(out.commits, `${d}`).toEqual(['A']);
      expect(out.scrolls, `${d}`).toEqual([]);
    }
  });

  it('T15b: a 72 px vertical drag from A scrolls the content 40 px with the finger; nothing commits or shows', () => {
    const drag = run(SCROLLING, [down('1', 48, 80, 0), move('1', 48, 60, 16), move('1', 48, 40, 32), move('1', 48, 8, 48)]);
    expect(pressedTargets(drag.state).size).toBe(0);
    const out = run(SCROLLING, [up('1', 48, 8, 64)], drag.state);
    // An upward drag moves the offset down the page: the content follows the finger.
    expect([...drag.scrolls, ...out.scrolls].reduce((a, b) => a + b, 0)).toBe(40);
    expect(out.commits).toEqual([]);
    expect(out.fling).toBeGreaterThan(0);
  });

  it('the turn is for good: coming back within 32 px still commits nothing', () => {
    const out = run(SCROLLING, [down('1', 48, 48, 0), move('1', 48, 100, 30), move('1', 48, 50, 60), up('1', 48, 50, 90)]);
    expect(out.commits).toEqual([]);
    expect(out.scrolls).toEqual([-20, 50]);
  });

  it('a drag along the other axis never scrolls; a slow release does not fling', () => {
    const sideways = run(SCROLLING, [down('1', 48, 48, 0), move('1', 120, 48, 30), up('1', 120, 48, 60)]);
    expect(sideways.scrolls).toEqual([]);
    const slow = run(SCROLLING, [down('1', 48, 80, 0), move('1', 48, 40, 100), move('1', 48, 38, 400), up('1', 48, 38, 500)]);
    expect(slow.fling).toBeNull();
  });

  it('a release that crosses the line in one jump still scrolls and does not commit', () => {
    const out = run(SCROLLING, [down('1', 48, 48, 0), up('1', 48, 108, 40)]);
    expect(out.commits).toEqual([]);
    expect(out.scrolls).toEqual([-28]);
  });

  it('a drag that starts in the gap band (claimed, off the target) drives the scroll too: no dead zone between tiles', () => {
    const out = run(SCROLLING, [down('1', 100, 48, 0), move('1', 100, 120, 30), up('1', 100, 120, 60)]);
    expect(out.scrolls.reduce((a, b) => a + b, 0)).toBe(-40);
    expect(out.commits).toEqual([]);
    // A tie in the gap is nobody's, but a drag from it still scrolls.
    const tie = run(SCROLLING, [down('1', 102, 48, 0), move('1', 102, 120, 30), up('1', 102, 120, 60)]);
    expect(tie.scrolls.reduce((a, b) => a + b, 0)).toBe(-40);
  });

  it('a touch that turned into a scroll never commits, even if the scroller is gone by the release', () => {
    const scrolled = run(SCROLLING, [down('1', 48, 48, 0), move('1', 48, 100, 30), move('1', 48, 50, 60)]);
    const gone: TapBoardConfig = { ...FIRST_BOARD, scroller: null };
    expect(run(gone, [up('1', 48, 50, 90)], scrolled.state).commits).toEqual([]);
  });

  it('a board that cannot scroll (it fits, or no scroller) keeps the tap model: 40 px down ends inside reach', () => {
    const fits: TapBoardConfig = { ...FIRST_BOARD, scroller: { axis: 'y', canScroll: false } };
    expect(run(fits, [down('1', 48, 76, 0), up('1', 48, 116, 40)]).commits).toEqual(['A']);
  });

  it('a horizontal scroller follows x', () => {
    const x: TapBoardConfig = { ...FIRST_BOARD, scroller: { axis: 'x', canScroll: true } };
    expect(run(x, [down('1', 48, 48, 0), move('1', 0, 48, 30), up('1', 0, 48, 60)]).scrolls).toEqual([16]);
  });

  it('T15c: a scroll the board did not drive cancels a live press (the host sends cancel): no commit, no look', () => {
    const pressed = run(SCROLLING, [down('1', 48, 48, 0)]);
    expect(hasLivePress(pressed.state)).toBe(true);
    const out = run(SCROLLING, [{ type: 'cancel', at: 20 }, up('1', 48, 48, 60)], pressed.state);
    expect(out.commits).toEqual([]);
    expect(out.state).toEqual(INITIAL_TAP_STATE);
    const scrolling = run(SCROLLING, [down('1', 48, 48, 0), move('1', 48, 120, 30)]);
    expect(hasLivePress(scrolling.state)).toBe(false);
  });

  it('a later finger on a target ends a scroll and is a normal touch', () => {
    const out = run(SCROLLING, [down('1', 48, 48, 0), move('1', 48, 120, 30), ...tap('2', 150, 48, 100), up('1', 48, 120, 300)]);
    expect(out.commits).toEqual(['B']);
  });
});

describe('flingStep', () => {
  it('moves by velocity times a frame and decays, then stops under the floor', () => {
    expect(flingStep(1)).toEqual({ delta: 16, next: 0.95 });
    expect(flingStep(-0.5)).toEqual({ delta: -8, next: -0.475 });
    expect(flingStep(0.049)).toBeNull();
  });
});

describe('touch-action (KT-D3)', () => {
  it('a board pans along its scroller only while it can scroll; otherwise pinch-zoom', () => {
    expect(boardTouchAction({ axis: 'y', canScroll: true }, true)).toBe('pan-y pinch-zoom');
    expect(boardTouchAction({ axis: 'x', canScroll: true }, true)).toBe('pan-x pinch-zoom');
    expect(boardTouchAction({ axis: 'y', canScroll: false }, true)).toBe('pinch-zoom');
    expect(boardTouchAction(null, true)).toBe('pinch-zoom');
  });

  it('a browser without pinch-zoom drops the keyword (U1)', () => {
    expect(boardTouchAction({ axis: 'y', canScroll: false }, false)).toBe('none');
    expect(boardTouchAction({ axis: 'y', canScroll: true }, false)).toBe('pan-y');
    expect(boardTouchAction({ axis: 'x', canScroll: true }, false)).toBe('pan-x');
  });

  it('a target never pans', () => {
    expect(targetTouchAction(true)).toBe('pinch-zoom');
    expect(targetTouchAction(false)).toBe('none');
  });
});

describe('pressGuardAllows (the Button guard, section 4.4)', () => {
  it('lets the first press through and drops a second within TAP_LOCK_MS', () => {
    expect(pressGuardAllows(null, 0)).toBe(true);
    expect(pressGuardAllows(0, TAP_LOCK_MS - 1)).toBe(false);
    expect(pressGuardAllows(0, TAP_LOCK_MS)).toBe(true);
  });
});
