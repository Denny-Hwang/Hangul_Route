import { LayoutProvider, TAP_LOCK_MS, TapLockProvider, layoutClassFor, motion } from '@hangul-route/design-system';
import { useState, type ReactElement } from 'react';
import { View } from 'react-native';
import { act, type ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClozeRound, PickRound, ReviewRound } from '../../../logic/reviews/review-rounds';
import { byTestId, render } from '../../../test-support/render';
import { RoundView } from '../ReviewRounds';

/**
 * AMENDMENTS-TOUCH row KT-3 (section 6, the Daily Review row; T19; KT-D5): the Daily Review's own pick and cloze rounds
 * (`ReviewRounds.tsx`) put their answers on a `board` TapBoard, and the lock lives on the app-level clock
 * (`TapLockProvider`), so it outlives the screen's keyed round remount after a right answer (the advance runs after
 * `motion.duration.slow`, 320 ms). A bounce that lands on the next round's card at 350 ms gives that round no blind
 * first answer; a tap at 450 ms is its first answer. The harness keys each round by its index, as
 * `DailyReviewScreen.tsx` does. The taps go straight to the host's click handler, with fake timers driving the clock.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock('../../../platform/audio', async (importOriginal) => ({ ...(await importOriginal<object>()), playPrompt: vi.fn(async () => 'played'), stop: vi.fn() }));
vi.mock('../../../platform/telemetry', async (importOriginal) => ({ ...(await importOriginal<object>()), track: vi.fn(async () => undefined) }));

const question = (itemId: string, format: 'read-pick' | 'cloze-pick') =>
  ({ itemId, kind: format === 'cloze-pick' ? 'pat' : 'lex', rung: 'read', format, theme: 'life', stretch: false, voiceFallback: false }) as const;

const pick = (itemId: string, ko: string, ids: [string, string, string]): PickRound => ({
  type: 'pick',
  question: question(itemId, 'read-pick'),
  answer: { ko: { ko, romanization: itemId.slice(4) }, gloss: itemId.slice(4) },
  heard: false,
  ask: 'meaning',
  prompt: { ko, romanization: itemId.slice(4) },
  options: ids.map((id) => ({ id, label: id.slice(4) })),
  answerId: itemId,
});

const CLOZE: ClozeRound = {
  type: 'cloze',
  question: question('pat:chaegi-isseoyo', 'cloze-pick'),
  gapped: { ko: '책이 ___.', romanization: 'chaegi ___' },
  meaning: 'There is a book.',
  tiles: [
    { id: 'pat:chaegi-isseoyo#1:0', ko: { ko: '없어요', romanization: 'eopseoyo' } },
    { id: 'pat:chaegi-isseoyo#1', ko: { ko: '있어요', romanization: 'isseoyo' } },
    { id: 'pat:chaegi-isseoyo#1:1', ko: { ko: '마셔요', romanization: 'masyeoyo' } },
  ],
  answerId: 'pat:chaegi-isseoyo#1',
  answer: { ko: { ko: '책이 있어요.', romanization: 'chaegi isseoyo' }, gloss: 'There is a book.' },
};

const ROUNDS: ReviewRound[] = [pick('lex:mul', '물', ['lex:bap', 'lex:mul', 'lex:cha']), CLOZE, pick('lex:san', '산', ['lex:gang', 'lex:san', 'lex:bada'])];

/** The rounds in order, each keyed by its index (as the Daily Review screen keys them); records each round's first answer. */
function Rounds({ firsts }: { firsts: Array<[number, boolean]> }): ReactElement {
  const [index, setIndex] = useState(0);
  const round = ROUNDS[index];
  if (round === undefined) return <View testID="rounds-done" />;
  return (
    <View key={index}>
      <RoundView
        round={round}
        reducedMotion={false}
        onFirst={(answer) => firsts.push([index, answer.correct])}
        onSolved={() => setIndex((i) => i + 1)}
        grade={() => 'miss'}
      />
    </View>
  );
}

const node = (root: ReactTestInstance, optionId: string): ReactTestInstance => {
  const found = byTestId(root, `daily-review-option-${optionId}`).find((n) => typeof n.props.onClick === 'function');
  if (!found) throw new Error(`no option ${optionId}`);
  return found;
};
/** A click as react-native-web's press responder gets it, straight to the host's handler: the tap clock is not moved. */
const click = async (root: ReactTestInstance, optionId: string): Promise<void> => {
  const target = node(root, optionId);
  const currentTarget = { getAttribute: (name: string): unknown => target.props[name] ?? null, tagName: String(target.type) };
  await act(async () => {
    (target.props.onClick as (e: unknown) => void)({ altKey: false, currentTarget, nativeEvent: {}, preventDefault: () => undefined, stopPropagation: () => undefined });
  });
};
const tick = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Daily Review pick and cloze rounds on a board (AMENDMENTS-TOUCH KT-3, T19)', () => {
  it('a right answer, then a tap at 350 ms on the next round records no answer; a tap at 450 ms does (pick, cloze, pick)', async () => {
    expect(motion.duration.slow).toBe(320);
    const firsts: Array<[number, boolean]> = [];
    const r = await render(
      <LayoutProvider value={layoutClassFor({ width: 320, height: 568 })}>
        <TapLockProvider>
          <Rounds firsts={firsts} />
        </TapLockProvider>
      </LayoutProvider>,
    );
    await tick(TAP_LOCK_MS);

    // Pick round 1 -> cloze round 2: the bounce lands on a cloze tile at 350 ms.
    await click(r.root, 'lex:mul');
    expect(firsts).toEqual([[0, true]]);
    await tick(350);
    expect(byTestId(r.root, 'daily-review-cloze-sentence').length).toBeGreaterThan(0);
    await click(r.root, 'pat:chaegi-isseoyo#1:0');
    expect(firsts).toEqual([[0, true]]);
    expect(byTestId(r.root, 'daily-review-miss')).toHaveLength(0);
    // Past the lock: a deliberate tap there is the round's first answer.
    await tick(100);
    await click(r.root, 'pat:chaegi-isseoyo#1:0');
    expect(firsts).toEqual([
      [0, true],
      [1, false],
    ]);

    // Cloze round 2's right tile (not scored again) -> pick round 3: same rule across the other remount.
    await tick(TAP_LOCK_MS);
    await click(r.root, 'pat:chaegi-isseoyo#1');
    await tick(350);
    expect(byTestId(r.root, 'daily-review-option-lex:gang').length).toBeGreaterThan(0);
    await click(r.root, 'lex:gang');
    expect(firsts).toHaveLength(2);
    expect(byTestId(r.root, 'daily-review-miss')).toHaveLength(0);
    await tick(100);
    await click(r.root, 'lex:gang');
    expect(firsts.at(-1)).toEqual([2, false]);
  });
});
