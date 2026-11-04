import { TAP_LOCK_MS, TapLockProvider, motion } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import { act, type ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PickRound, QuestReviewPlan } from '../../../logic/reviews/quest-review-session';
import { useProgressStore } from '../../../store/progress-store';
import { byTestId, render } from '../../../test-support/render';
import { QuestReviewSession } from '../quest-review-chunk';

/**
 * AMENDMENTS-TOUCH row KT-3 (section 6, the Daily Review row; KT-D5): the review's pick round is a `board` TapBoard
 * and the lock lives on the app-level clock (`TapLockProvider`), so it outlives the keyed `PickRoundView` remount after
 * a right answer (the advance runs after `motion.duration.slow`, 320 ms). A bounce that lands on the next round's card
 * at 350 ms gives that round no blind first-try answer; a tap at 450 ms counts. The taps go straight to the host's
 * click handler (no `press()`, which would move the tap clock past the lock), with fake timers driving the clock.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock('../../../logic/memory/boot', async (importOriginal) => ({ ...(await importOriginal<object>()), recordAnswers: async () => undefined }));
vi.mock('../../../platform/telemetry', async (importOriginal) => ({ ...(await importOriginal<object>()), track: vi.fn(async () => undefined) }));
vi.mock('../../../platform/audio', async (importOriginal) => ({ ...(await importOriginal<object>()), playPrompt: vi.fn(async () => 'played'), stop: vi.fn() }));

const A11Y = getMessages('en').a11y.minigame.option;
const TODAY = '2026-10-10';

const round = (n: number, ids: [string, string, string]): PickRound => ({
  key: `warmup:${n}:${ids[1]}`,
  itemId: ids[1],
  rung: 'read',
  instruction: 'seeMeaning',
  mode: 'see',
  ko: '물',
  romanization: 'mul',
  showRomanization: true,
  options: ids.map((id) => ({ id, label: id.slice(4) })),
  answerId: ids[1],
});
const FIRST = round(0, ['lex:bap', 'lex:mul', 'lex:cha']);
const SECOND = round(1, ['lex:san', 'lex:gang', 'lex:bada']);
const plan: QuestReviewPlan = {
  kind: 'warmup',
  rounds: [FIRST, SECOND],
  soundNotice: false,
  ctx: { index: { items: [], byId: new Map(), retired: new Set() }, states: {}, today: TODAY, voice: true },
};

const node = (root: ReactTestInstance, optionId: string): ReactTestInstance => {
  const found = byTestId(root, `quest-review-option-${optionId}`).find((n) => typeof n.props.onClick === 'function');
  if (!found) throw new Error(`no option ${optionId}`);
  return found;
};
const label = (root: ReactTestInstance, optionId: string): string => String(node(root, optionId).props['aria-label']);
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
  useProgressStore.setState({ byProfile: {} });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Daily Review pick round on a board (AMENDMENTS-TOUCH KT-3, KT-D5)', () => {
  it('a right answer, then a tap at 350 ms on the next round records no answer; a tap at 450 ms does', async () => {
    expect(motion.duration.slow).toBe(320);
    const r = await render(
      <TapLockProvider>
        <QuestReviewSession plan={plan} profileId="profile:mina" onDone={() => undefined} />
      </TapLockProvider>,
    );
    await tick(TAP_LOCK_MS);
    await click(r.root, 'lex:mul');
    expect(label(r.root, 'lex:mul')).toBe(A11Y.correct('mul'));
    // The advance at 320 ms remounts the round (keyed); the bounce lands on the new round's first card at 350 ms.
    await tick(350);
    expect(byTestId(r.root, 'quest-review-option-lex:san').length).toBeGreaterThan(0);
    await click(r.root, 'lex:san');
    expect(label(r.root, 'lex:san')).toBe('san');
    // Past the lock: a deliberate tap on the same card is the round's first answer.
    await tick(100);
    await click(r.root, 'lex:san');
    expect(label(r.root, 'lex:san')).toBe(A11Y.wrong('san'));
  });
});
