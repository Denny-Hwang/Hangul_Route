import { LayoutProvider, TextSizeProvider, layoutClassFor, motion as motionTokens } from '@hangul-route/design-system';
import { localeCopyProblems, reviewScoreProblems } from '@hangul-route/content-schema/lint';
import { getMessages } from '@hangul-route/i18n';
import fc from 'fast-check';
import type { ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { currBuiltInPct } from '../../../config/flags';
import type { PlannedSession, RoundAnswer } from '../../../logic/reviews/daily-review';
import type { PickRound, ReviewRound, TypeRound } from '../../../logic/reviews/review-rounds';
import { reviewStars } from '../../../logic/reviews/star-calc';
import { YUT_REVIEW_FLAG, boardAfter, sessionSeed } from '../../../logic/reviews/yut-board';
import { resetRemoteConfigForTests, useRemoteConfigStore } from '../../../store/remote-config-store';
import { byTestId, cleanup, press, render, resetPlatform, screenTexts, setPlatform } from '../../../test-support/render';

/**
 * F-CURR-002 section 7.1 F10 and row CM-39 (design/wireframes/minigame/yut-review.md): the Yut Review skin over the
 * Daily Review. Every round that ends throws, whatever its answer; the board is the session seed and the count of
 * ended rounds and nothing else; the answers, stars and result are the same with the skin on and off (property test);
 * off, the plain screen; reduced motion places the piece at once; the throw is read out once, its name tagged Korean
 * (queued on iOS, the live region on Android and the web); the last item's throw shows before the plain result; a
 * band that fails to draw hides and the session goes on.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

/** Every station the piece is drawn at, render by render (a frame that flashes still shows up here). */
const drawn = vi.hoisted(() => [] as number[]);
vi.mock('react-native-svg', async () => {
  const { createElement } = await import('react');
  const shape =
    (name: string) =>
    ({ children, ...props }: { children?: ReactNode; testID?: string }) => {
      if (name === 'Circle' && typeof props.testID === 'string' && props.testID.startsWith('yut-piece-')) drawn.push(Number(props.testID.slice('yut-piece-'.length)));
      return createElement(`svg-${name}`, props, children);
    };
  const names = ['Circle', 'ClipPath', 'Defs', 'Ellipse', 'G', 'Line', 'LinearGradient', 'Path', 'Polygon', 'Polyline', 'Rect', 'Stop', 'Text'];
  return { default: shape('Svg'), Svg: shape('Svg'), ...Object.fromEntries(names.map((n) => [n, shape(n)])) };
});
/** When on, the board's rules throw: the band must hide and the session go on. */
const broken = vi.hoisted(() => ({ on: false }));
vi.mock('../../../logic/reviews/yut-board', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../logic/reviews/yut-board')>();
  return {
    ...real,
    boardAfter: (seed: number, finished: number) => {
      if (broken.on) throw new Error('the board cannot be drawn');
      return real.boardAfter(seed, finished);
    },
  };
});

vi.mock('@react-navigation/native', () => ({ CommonActions: { reset: (state: unknown) => ({ type: 'RESET', payload: state }) } }));

/** Every call the screen makes into the review API, in order: what the skin must never change. */
const calls = vi.hoisted(() => [] as unknown[]);
const plan = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('../../../logic/memory/boot', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  memoryChunk: async () => ({
    dailyReviewApi: () => ({
      readWorld: async () => ({ kind: 'ready', world: {} }),
      openingKind: () => 'daily',
      doneTodayOffer: () => 'empty',
      startSession: async (_w: unknown, kind: string) => {
        calls.push(['start', kind]);
        return plan.current;
      },
      recordRound: async (_w: unknown, _p: unknown, index: number, answer: RoundAnswer) => {
        calls.push(['record', index, answer]);
      },
      noteStopped: () => undefined,
      finishSession: async (_w: unknown, p: PlannedSession, answers: Map<number, RoundAnswer>) => {
        const list = [...answers.entries()].sort((a, b) => a[0] - b[0]);
        calls.push(['finish', list]);
        const right = list.filter(([, a]) => a.correct).length;
        return { finished: { stars: reviewStars(right, p.rounds.length), stronger: right, after: 'empty' }, world: {} };
      },
      // The whole word is right, its first letter alone a one-letter slip (hinted), anything else a miss.
      gradeTyped: (target: string, typed: string) => (typed === target ? 'right' : typed === target.slice(0, 1) ? 'hinted' : 'miss'),
    }),
  }),
}));
const motion = vi.hoisted(() => ({ reduced: true }));
vi.mock('../../../platform/motion', () => ({ useReducedMotion: () => motion.reduced }));

const { DailyReviewScreen } = await import('../DailyReviewScreen');

const EN = getMessages('en');

function pickRound(i: number): PickRound {
  const id = `lex:w${i}`;
  return {
    type: 'pick',
    heard: false,
    ask: 'meaning',
    prompt: { ko: '산', romanization: 'san' },
    options: [
      { id, label: `right ${i}` },
      { id: `lex:other${i}`, label: `other ${i}` },
    ],
    answerId: id,
    question: { itemId: id, kind: 'lex', rung: 'read', format: 'read-pick', theme: 'nature', stretch: false, voiceFallback: false },
    answer: { ko: { ko: '산', romanization: 'san' }, gloss: `right ${i}` },
  } as PickRound;
}

function typeRound(i: number): TypeRound {
  return {
    type: 'type',
    mode: 'see',
    target: '호야',
    question: { itemId: `lex:t${i}`, kind: 'lex', rung: 'produce', format: 'type-see', theme: 'nature', stretch: false, voiceFallback: false },
    answer: { ko: { ko: '호야', romanization: 'hoya' }, gloss: 'Hoya' },
  };
}

function planOf(n: number, hows?: readonly How[]): PlannedSession {
  const rounds: ReviewRound[] = Array.from({ length: n }, (_, i) => (hows !== undefined && hows[i]!.startsWith('type') ? typeRound(i) : pickRound(i)));
  return { kind: 'daily', rounds, soundNotice: false };
}

const seedOf = (p: PlannedSession): number => sessionSeed([p.kind, ...p.rounds.map((r) => r.question.itemId)]);

function setYut(on: boolean | null): void {
  useRemoteConfigStore.setState({ hydrated: true, cache: on === null ? null : { v: 1, fetchedAt: 0, maxAgeS: 300, flags: { [YUT_REVIEW_FLAG]: { on, pct: 100 } } } });
}

const nav = () => ({ dispatch: () => undefined, goBack: () => undefined, canGoBack: () => true, addListener: () => () => undefined }) as never;

async function settle(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
  });
}

async function open(size = { width: 320, height: 640 }, textSize: 'standard' | 'largest' = 'standard'): Promise<ReactTestRenderer> {
  const r = await render(
    <TextSizeProvider step={textSize}>
      <LayoutProvider value={layoutClassFor(size)}>
        <DailyReviewScreen navigation={nav()} route={{ key: 'DailyReview', name: 'DailyReview' } as never} />
      </LayoutProvider>
    </TextSizeProvider>,
  );
  await settle();
  return r;
}

const tap = async (root: ReactTestInstance, id: string): Promise<void> => {
  const node = byTestId(root, id).find((n) => typeof n.props.onClick === 'function');
  expect(node, id).toBeDefined();
  await press(node!);
};

/**
 * How a round ends: a pick right first time or wrong and then right; a typed word right first time, a one-letter slip
 * (hinted, the right form shown, then Next), or a miss and then right. The round ends every way.
 */
type How = 'first' | 'retry' | 'type-right' | 'type-hinted' | 'type-miss';

const typeKeys = async (root: ReactTestInstance, jamo: string): Promise<void> => {
  for (const j of jamo) await tap(root, `hangul-key-${j}`);
};

/** Answers round `i` the given way, then lets its own pause run (only the pending timers: never the result's wait). */
async function answer(root: ReactTestInstance, i: number, how: How): Promise<void> {
  if (how === 'first' || how === 'retry') {
    if (how === 'retry') await tap(root, `daily-review-option-lex:other${i}`);
    await tap(root, `daily-review-option-lex:w${i}`);
  } else if (how === 'type-hinted') {
    await typeKeys(root, 'ㅎㅗ');
    await tap(root, 'daily-review-type-done');
    expect(byTestId(root, 'daily-review-miss').length).toBeGreaterThan(0);
    // Next ends the round at once (no pause of its own to run).
    await tap(root, 'daily-review-type-next');
    await settle();
    return;
  } else {
    if (how === 'type-miss') {
      await typeKeys(root, 'ㄴㅏ');
      await tap(root, 'daily-review-type-done');
      expect(byTestId(root, 'daily-review-miss').length).toBeGreaterThan(0);
    }
    await typeKeys(root, 'ㅎㅗㅇㅑ');
    await tap(root, 'daily-review-type-done');
  }
  await act(async () => {
    await vi.runOnlyPendingTimersAsync();
  });
  await settle();
}

/** The plain result's own wait after the last round (the last throw shows first); nothing waits with the board off. */
async function finishHold(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10_000);
  });
  await settle();
}

/** The first answer of a round as the screen records it. */
const firstAnswerRight = (how: How): boolean => how === 'first' || how === 'type-right' || how === 'type-hinted';

const pieceAt = (root: ReactTestInstance): number | null => {
  const node = root.findAll((n) => String(n.type) === 'svg-Circle' && typeof n.props.testID === 'string' && (n.props.testID as string).startsWith('yut-piece-'))[0];
  return node === undefined ? null : Number((node.props.testID as string).slice('yut-piece-'.length));
};
const legNames = (root: ReactTestInstance): string[] =>
  root
    .findAll((n) => typeof n.type === 'string' && String(n.props['data-testid'] ?? '').startsWith('yut-throw-name-'))
    .map((n) => String(n.props['data-testid']).slice('yut-throw-name-'.length));

beforeEach(() => {
  vi.useFakeTimers();
  resetRemoteConfigForTests();
  calls.length = 0;
  drawn.length = 0;
  motion.reduced = true;
  broken.on = false;
});
afterEach(async () => {
  await cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  resetPlatform();
});

describe('the switch (section 12.2)', () => {
  it('game.yut-review ships at built-in pct 0: a device that never fetched the config plays the plain screen (merges dark)', async () => {
    expect(currBuiltInPct(YUT_REVIEW_FLAG)).toBe(0);
    setYut(null);
    plan.current = planOf(3);
    const r = await open();
    expect(byTestId(r.root, 'daily-review-round').length).toBeGreaterThan(0);
    expect(byTestId(r.root, 'yut-review-skin')).toHaveLength(0);
  });

  it('off: the plain review screen, the same rounds; on: the board band over the same round', async () => {
    setYut(false);
    plan.current = planOf(3);
    const off = await open();
    expect(byTestId(off.root, 'yut-review-skin')).toHaveLength(0);
    expect(byTestId(off.root, 'daily-review-option-lex:w0').length).toBeGreaterThan(0);
    await cleanup();
    setYut(true);
    const on = await open();
    expect(byTestId(on.root, 'yut-review-skin').length).toBeGreaterThan(0);
    expect(byTestId(on.root, 'yut-board').length).toBeGreaterThan(0);
    expect(byTestId(on.root, 'daily-review-option-lex:w0').length).toBeGreaterThan(0);
    // Board idle before the first round ends: the piece at the start, the tray its label alone.
    expect(pieceAt(on.root)).toBe(0);
    expect(byTestId(on.root, 'yut-tray-piece')).toHaveLength(0);
    expect(screenTexts(byTestId(on.root, 'yut-tray')[0]!)).toEqual([EN.learner.yutReview.home]);
  });
});

describe('every round that ends throws, whatever its answer', () => {
  it('a first-try right and a miss then right each move the piece to the answer-free board', async () => {
    setYut(true);
    const p = planOf(4);
    plan.current = p;
    const seed = seedOf(p);
    const r = await open();
    const hows: How[] = ['retry', 'first', 'retry'];
    for (const [i, how] of hows.entries()) {
      await answer(r.root, i, how);
      const board = boardAfter(seed, i + 1);
      expect(pieceAt(r.root), `after round ${i + 1}`).toBe(board.state.position);
      expect(legNames(r.root)).toEqual(board.last?.legs.map((l) => l.throw.name));
      expect(byTestId(r.root, 'yut-tray-piece')).toHaveLength(board.state.laps === 0 ? 0 : ((board.state.laps - 1) % 4) + 1);
    }
  });

  it('the last item throws too: its throw shows (and is read) before the plain result, which has no board and no lap count', async () => {
    setYut(true);
    const p = planOf(3);
    plan.current = p;
    const r = await open();
    for (let i = 0; i < 3; i += 1) await answer(r.root, i, 'first');
    const last = boardAfter(seedOf(p), 3);
    expect(byTestId(r.root, 'daily-review-result')).toHaveLength(0);
    expect(pieceAt(r.root)).toBe(last.state.position);
    expect(legNames(r.root)).toEqual(last.last?.legs.map((l) => l.throw.name));
    expect(screenTexts(byTestId(r.root, 'yut-live')[0]!).join('')).toMatch(/^Throw: /);
    // Reduced motion: a still pause of motion.duration.celebration, nothing moving; then the plain result.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(motionTokens.duration.celebration - 1);
    });
    expect(byTestId(r.root, 'daily-review-result')).toHaveLength(0);
    await finishHold();
    expect(byTestId(r.root, 'daily-review-result').length).toBeGreaterThan(0);
    expect(byTestId(r.root, 'yut-review-skin')).toHaveLength(0);
    expect(byTestId(r.root, 'yut-board')).toHaveLength(0);
  });
});

describe('play only: the randomness never decides stars, points or any reward (property)', () => {
  it('for any seed and any mix of results (pick first try or retry, typed right, hinted then Next, miss then right), every round throws its own board, and every API call and the result are the same on and off', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.constantFrom<How>('first', 'retry', 'type-right', 'type-hinted', 'type-miss'), { minLength: 3, maxLength: 6 }), fc.integer({ min: 0, max: 999 }), async (hows, salt) => {
        // The salt changes the item ids, so the seed (and every throw) changes.
        const p = planOf(hows.length, hows);
        p.rounds.forEach((round, i) => {
          round.question = { ...round.question, itemId: `${round.question.itemId}|${salt}|${i}` };
        });
        const seed = seedOf(p);
        const run = async (on: boolean): Promise<{ calls: unknown[]; result: string[] }> => {
          await cleanup();
          calls.length = 0;
          setYut(on);
          plan.current = p;
          const r = await open();
          for (const [i, how] of hows.entries()) {
            await answer(r.root, i, how);
            if (!on) continue;
            // After every ended round, the last one included: the board of the seed and the count of ended rounds.
            const board = boardAfter(seed, i + 1);
            expect(pieceAt(r.root), `round ${i + 1} (${how})`).toBe(board.state.position);
            expect(legNames(r.root), `round ${i + 1} (${how})`).toEqual(board.last?.legs.map((l) => l.throw.name));
          }
          await finishHold();
          return { calls: [...calls], result: screenTexts(byTestId(r.root, 'daily-review-result')[0]!) };
        };
        const off = await run(false);
        const on = await run(true);
        expect(on.calls).toEqual(off.calls);
        expect(on.result).toEqual(off.result);
        const right = hows.filter(firstAnswerRight).length;
        expect(on.result).toContain(EN.a11y.dailyReview.stars(reviewStars(right, hows.length)));
      }),
      { numRuns: 12 },
    );
    // Typed rounds tap the Hangul keyboard key by key: a slower render than the pick rounds.
  }, 60_000);
});

describe('the band fails to draw', () => {
  it('hides; the round stays and the session goes on with the same calls and result', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const hows: How[] = ['first', 'retry', 'first'];
    const runOnce = async (on: boolean, fail: boolean): Promise<{ calls: unknown[]; result: string[] }> => {
      await cleanup();
      calls.length = 0;
      broken.on = fail;
      setYut(on);
      plan.current = planOf(3);
      const r = await open();
      if (fail) {
        expect(byTestId(r.root, 'yut-band')).toHaveLength(0);
        expect(byTestId(r.root, 'daily-review-round').length).toBeGreaterThan(0);
      }
      for (const [i, how] of hows.entries()) await answer(r.root, i, how);
      await finishHold();
      return { calls: [...calls], result: screenTexts(byTestId(r.root, 'daily-review-result')[0]!) };
    };
    const off = await runOnce(false, false);
    const failed = await runOnce(true, true);
    expect(failed.calls).toEqual(off.calls);
    expect(failed.result).toEqual(off.result);
  });
});

describe('motion and the screen reader', () => {
  it('reduced motion: no walk; every throw of the item shows at once and the piece is placed at its station', async () => {
    setYut(true);
    const p = planOf(3);
    plan.current = p;
    const r = await open();
    await tap(r.root, 'daily-review-option-lex:w0');
    // The round's own pause is 0 with reduced motion; nothing else waits.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await settle();
    const board = boardAfter(seedOf(p), 1);
    expect(pieceAt(r.root)).toBe(board.state.position);
    expect(legNames(r.root)).toEqual(board.last?.legs.map((l) => l.throw.name));
  });

  it('with motion: the throw shows, the sticks fall, then the piece walks station by station', async () => {
    motion.reduced = false;
    setYut(true);
    const p = planOf(3);
    plan.current = p;
    const r = await open();
    await tap(r.root, 'daily-review-option-lex:w0');
    // The round's own pause (motion.duration.slow), then round 2 opens and the throw starts.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(320);
    });
    await settle();
    const board = boardAfter(seedOf(p), 1);
    const first = board.last!.legs[0]!;
    expect(pieceAt(r.root)).toBe(0);
    expect(legNames(r.root)).toEqual([first.throw.name]);
    expect(byTestId(r.root, 'yut-sticks').length).toBeGreaterThan(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(pieceAt(r.root)).toBe(first.path[0]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(pieceAt(r.root)).toBe(board.state.position);
    expect(legNames(r.root)).toEqual(board.last?.legs.map((l) => l.throw.name));
  });

  it('with motion: a later move starts at its own first frame (the piece never flashes at the end of the walk)', async () => {
    motion.reduced = false;
    setYut(true);
    const p = planOf(4);
    plan.current = p;
    const r = await open();
    await answer(r.root, 0, 'first');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    const second = boardAfter(seedOf(p), 2).last!;
    drawn.length = 0;
    await tap(r.root, 'daily-review-option-lex:w1');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(320);
    });
    await settle();
    // Every render since round 2 opened drew the piece where the second move starts, never further on.
    expect(drawn.length).toBeGreaterThan(0);
    expect(new Set(drawn)).toEqual(new Set([second.from.position]));
    expect(legNames(r.root)).toEqual([second.legs[0]!.throw.name]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(pieceAt(r.root)).toBe(second.to.position);
  });

  it('iOS: VoiceOver is told each move once, queued after the next round\'s own announcements; no live region', async () => {
    setPlatform('ios');
    const queued = vi.fn();
    const plain = vi.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    const info = AccessibilityInfo as unknown as { announceForAccessibilityWithOptions?: unknown };
    const before = info.announceForAccessibilityWithOptions;
    info.announceForAccessibilityWithOptions = queued;
    try {
      setYut(true);
      const p = planOf(3);
      plan.current = p;
      const r = await open();
      expect(queued).not.toHaveBeenCalled();
      await answer(r.root, 0, 'retry');
      await answer(r.root, 1, 'first');
      const said = (n: number): string => {
        const move = boardAfter(seedOf(p), n).last!;
        return (
          move.legs.map((l) => EN.a11y.yutReview.throw(l.throw.ko, l.throw.romanization, l.path.length) + (l.throw.again ? ` ${EN.learner.yutReview.throwAgain}.` : '')).join(' ') +
          (move.legs.some((l) => l.home) ? ` ${EN.learner.yutReview.pieceHome}` : '')
        );
      };
      expect(queued.mock.calls).toEqual([
        [said(1), { queue: true }],
        [said(2), { queue: true }],
      ]);
      expect(plain).not.toHaveBeenCalled();
      expect(byTestId(r.root, 'yut-live')).toHaveLength(0);
    } finally {
      info.announceForAccessibilityWithOptions = before;
    }
  });

  it('Android: the move is read from the polite live region; nothing is announced over the next round', async () => {
    setPlatform('android');
    const plain = vi.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    setYut(true);
    const p = planOf(3);
    plan.current = p;
    const r = await open();
    await answer(r.root, 0, 'first');
    const move = boardAfter(seedOf(p), 1).last!;
    const region = r.root.findAll((n) => n.props.testID === 'yut-live' && typeof n.type !== 'string')[0];
    expect(region?.props.accessibilityLiveRegion).toBe('polite');
    expect(screenTexts(byTestId(r.root, 'yut-live')[0]!).join('')).toContain(EN.a11y.yutReview.throw(move.legs[0]!.throw.ko, move.legs[0]!.throw.romanization, move.legs[0]!.path.length));
    expect(plain).not.toHaveBeenCalled();
  });

  it('the throw is read once in a polite region, its Korean name tagged Korean, never against a total', async () => {
    setYut(true);
    const p = planOf(3);
    plan.current = p;
    const r = await open();
    const live = () => byTestId(r.root, 'yut-live')[0]!;
    expect(live().props['aria-live']).toBe('polite');
    expect(screenTexts(live())).toEqual([]);
    await answer(r.root, 0, 'retry');
    const move = boardAfter(seedOf(p), 1).last!;
    const said = screenTexts(live()).join('');
    const expected =
      move.legs.map((l) => EN.a11y.yutReview.throw(l.throw.ko, l.throw.romanization, l.path.length) + (l.throw.again ? ` ${EN.learner.yutReview.throwAgain}.` : '')).join(' ') +
      (move.legs.some((l) => l.home) ? ` ${EN.learner.yutReview.pieceHome}` : '');
    expect(said).toBe(expected);
    expect(said).not.toMatch(/\bof\b|\//);
    const tagged = live().findAll((n) => typeof n.type === 'string' && n.props.lang === 'ko');
    expect(tagged.map((n) => screenTexts(n).join(''))).toEqual(move.legs.map((l) => l.throw.ko));
  });
});

describe('layout (constants table)', () => {
  /** The board drawing's size: its svg, inside the board image. */
  const boardSize = (root: ReactTestInstance): unknown => byTestId(root, 'yut-board')[0]!.findAll((n) => String(n.type) === 'svg-Svg')[0]?.props.width;

  it('128 on a phone from 600 tall, 96 below 600 tall with no sticks, 320 beside the item from regular', async () => {
    setYut(true);
    plan.current = planOf(3);
    let r = await open({ width: 360, height: 640 });
    expect(boardSize(r.root)).toBe(128);
    await answer(r.root, 0, 'first');
    expect(byTestId(r.root, 'yut-sticks').length).toBeGreaterThan(0);
    await cleanup();
    r = await open({ width: 320, height: 568 });
    expect(boardSize(r.root)).toBe(96);
    await answer(r.root, 0, 'first');
    expect(byTestId(r.root, 'yut-sticks')).toHaveLength(0);
    await cleanup();
    r = await open({ width: 768, height: 1024 });
    expect(boardSize(r.root)).toBe(320);
  });

  it('largest text (150 %) on a phone: the throw wraps under the board, and the tray wraps inside the band', async () => {
    setYut(true);
    plan.current = planOf(3);
    const bandStyle = (root: ReactTestInstance): Record<string, unknown> => {
      const band = root.findAll((n) => n.props.testID === 'yut-band' && typeof n.type !== 'string')[0]!;
      return band.props.style as Record<string, unknown>;
    };
    const trayStyle = (root: ReactTestInstance): Record<string, unknown> => root.findAll((n) => n.props.testID === 'yut-tray' && typeof n.type !== 'string')[0]!.props.style as Record<string, unknown>;
    let r = await open({ width: 320, height: 640 });
    expect(bandStyle(r.root).flexDirection).toBe('row');
    await cleanup();
    r = await open({ width: 320, height: 640 }, 'largest');
    expect(bandStyle(r.root).flexDirection).toBe('column');
    expect(trayStyle(r.root)).toMatchObject({ flexWrap: 'wrap', maxWidth: '100%' });
    await answer(r.root, 0, 'first');
    expect(byTestId(r.root, 'yut-throw-leg').length).toBeGreaterThan(0);
  });
});

describe('the a11y strings (the review-copy rule lints learner.yutReview only)', () => {
  it('a11y.yutReview reads no score, share, age or speaking wording in en, es and ko, at every throw length', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      const a = getMessages(locale).a11y.yutReview;
      const lines = [a.board, ...[1, 2, 3, 4, 5].map((n) => a.throw('개', 'gae', n))];
      for (const line of lines) {
        expect(reviewScoreProblems(line), `${locale}: ${line}`).toEqual([]);
        expect(localeCopyProblems(line, locale), `${locale}: ${line}`).toEqual([]);
      }
    }
  });
});
