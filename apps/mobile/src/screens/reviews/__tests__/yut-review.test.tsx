import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import fc from 'fast-check';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { currBuiltInPct } from '../../../config/flags';
import type { PlannedSession, RoundAnswer } from '../../../logic/reviews/daily-review';
import type { PickRound } from '../../../logic/reviews/review-rounds';
import { reviewStars } from '../../../logic/reviews/star-calc';
import { YUT_REVIEW_FLAG, boardAfter, sessionSeed } from '../../../logic/reviews/yut-board';
import { resetRemoteConfigForTests, useRemoteConfigStore } from '../../../store/remote-config-store';
import { byTestId, cleanup, press, render, screenTexts } from '../../../test-support/render';

/**
 * F-CURR-002 section 7.1 F10 and row CM-39 (design/wireframes/minigame/yut-review.md): the Yut Review skin over the
 * Daily Review. Every round that ends throws, whatever its answer; the board is the session seed and the count of
 * ended rounds and nothing else; the answers, stars and result are the same with the skin on and off (property test);
 * off, the plain screen; reduced motion places the piece at once; the throw is read out once, its name tagged Korean.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

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
      gradeTyped: () => 'miss',
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

function planOf(n: number): PlannedSession {
  return { kind: 'daily', rounds: Array.from({ length: n }, (_, i) => pickRound(i)), soundNotice: false };
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

async function open(size = { width: 320, height: 640 }): Promise<ReactTestRenderer> {
  const r = await render(
    <LayoutProvider value={layoutClassFor(size)}>
      <DailyReviewScreen navigation={nav()} route={{ key: 'DailyReview', name: 'DailyReview' } as never} />
    </LayoutProvider>,
  );
  await settle();
  return r;
}

const tap = async (root: ReactTestInstance, id: string): Promise<void> => {
  const node = byTestId(root, id).find((n) => typeof n.props.onClick === 'function');
  expect(node, id).toBeDefined();
  await press(node!);
};

type How = 'first' | 'retry';

/** Answers round `i`: right first time, or wrong first and then right (the round ends either way). */
async function answer(root: ReactTestInstance, i: number, how: How): Promise<void> {
  if (how === 'retry') await tap(root, `daily-review-option-lex:other${i}`);
  await tap(root, `daily-review-option-lex:w${i}`);
  await act(async () => {
    await vi.runOnlyPendingTimersAsync();
  });
  await settle();
}

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
  motion.reduced = true;
});
afterEach(async () => {
  await cleanup();
  vi.useRealTimers();
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

  it('the result is the plain one: no board, no lap count', async () => {
    setYut(true);
    plan.current = planOf(3);
    const r = await open();
    for (let i = 0; i < 3; i += 1) await answer(r.root, i, 'first');
    expect(byTestId(r.root, 'daily-review-result').length).toBeGreaterThan(0);
    expect(byTestId(r.root, 'yut-review-skin')).toHaveLength(0);
    expect(byTestId(r.root, 'yut-board')).toHaveLength(0);
  });
});

describe('play only: the randomness never decides stars, points or any reward (property)', () => {
  it('for any seed and any mix of first tries and misses, every API call and the result are the same on and off', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.constantFrom<How>('first', 'retry'), { minLength: 3, maxLength: 6 }), fc.integer({ min: 0, max: 999 }), async (hows, salt) => {
        // The salt changes the item ids, so the seed (and every throw) changes.
        const p = planOf(hows.length);
        p.rounds.forEach((round, i) => {
          round.question = { ...round.question, itemId: `lex:w${i}|${salt}` };
        });
        const run = async (on: boolean): Promise<{ calls: unknown[]; result: string[]; throws: number }> => {
          await cleanup();
          calls.length = 0;
          setYut(on);
          plan.current = p;
          const r = await open();
          let throws = 0;
          for (const [i, how] of hows.entries()) {
            await answer(r.root, i, how);
            if (i < hows.length - 1 && on) throws += legNames(r.root).length > 0 ? 1 : 0;
          }
          return { calls: [...calls], result: screenTexts(byTestId(r.root, 'daily-review-result')[0]!), throws };
        };
        const off = await run(false);
        const on = await run(true);
        expect(on.calls).toEqual(off.calls);
        expect(on.result).toEqual(off.result);
        expect(on.throws).toBe(hows.length - 1);
        const right = hows.filter((h) => h === 'first').length;
        expect(on.result).toContain(EN.a11y.dailyReview.stars(reviewStars(right, hows.length)));
      }),
      { numRuns: 12 },
    );
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
});
