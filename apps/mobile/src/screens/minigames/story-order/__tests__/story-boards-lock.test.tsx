import { TAP_LOCK_MS, TapLockProvider } from '@hangul-route/design-system';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RomanizationModeOverride } from '../../../../i18n/use-romanization-mode';
import { STORY_ORDER_FIXTURES } from '../../../../navigation/story-order-e2e-fixture';
import { useQuestRunStore } from '../../../../store/quest-run-store';
import { useRemoteConfigStore } from '../../../../store/remote-config-store';
import { byTestId, render, unmount } from '../../../../test-support/render';
import type { MinigameHost } from '../../host';
import { StoryOrderGame } from '../StoryOrderGame';
import { StoryOrderStep } from '../StoryOrderStep';

/**
 * AMENDMENTS-TOUCH row KT-5 (section 6, the Story Sequence and Story Order row; F4, KT-D10): the cards are one `board`
 * TapBoard on the app-level lock. A right card leaves the row and the others reflow, so a bounce 150 ms later lands on
 * another card: it is swallowed, never scored as a miss. A tap after `TAP_LOCK_MS` counts. Story Sequence is reached
 * through Story Order's fallback (its rounds are keyed Story Sequence games); Story Order is its chunk's game. The taps
 * go straight to the host's click handler (rule 9's path, the same lock), with fake timers driving the boards' clock.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock('../../../../platform/audio', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  playPrompt: vi.fn(async () => ({ status: 'played' })),
  stop: vi.fn(),
}));
vi.mock('../../../../platform/telemetry', async (importOriginal) => ({ ...(await importOriginal<object>()), track: vi.fn(async () => undefined) }));

const mounted: ReactTestRenderer[] = [];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] });
  useQuestRunStore.getState().beginQuest('quest:fixture', 'episode:fixture');
  // game.story-order off: the step plays each round as Story Sequence.
  useRemoteConfigStore.setState({ hydrated: true, cache: { v: 1, fetchedAt: 0, maxAgeS: 300, flags: { 'game.story-order': { on: false, pct: 100 } } } });
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  useRemoteConfigStore.setState({ hydrated: false, cache: null });
  vi.useRealTimers();
});

const tick = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

/** A click as react-native-web's press responder gets it, straight to the host's handler: the tap clock is not moved. */
async function click(root: ReactTestInstance, testId: string): Promise<void> {
  const target = byTestId(root, testId).find((n) => typeof n.props.onClick === 'function');
  if (target === undefined) throw new Error(`no ${testId}`);
  const currentTarget = { getAttribute: (name: string): unknown => target.props[name] ?? null, tagName: String(target.type) };
  await act(async () => {
    (target.props.onClick as (e: unknown) => void)({ altKey: false, currentTarget, nativeEvent: {}, preventDefault: () => undefined, stopPropagation: () => undefined });
  });
}

function hostOf(answers: Array<[string, boolean]>): MinigameHost {
  return { mode: 'quest', answer: (key, correct) => void answers.push([String(key), correct]), complete: () => undefined };
}

describe('Story Sequence and Story Order cards on a board: a bounce on the reflowed card is no miss (AMENDMENTS-TOUCH KT-5, F4)', () => {
  it('Story Sequence (Story Order fallback round): a right card, a bounce 150 ms later on another card: one answer; 450 ms later it counts', async () => {
    const answers: Array<[string, boolean]> = [];
    const r = await render(
      <TapLockProvider>
        <RomanizationModeOverride mode="always">
          <StoryOrderStep scope={STORY_ORDER_FIXTURES.twoRounds} host={hostOf(answers)} sequenceId="minigame:fixture" onFallbackFinish={() => undefined} />
        </RomanizationModeOverride>
      </TapLockProvider>,
    );
    mounted.push(r);
    await tick(TAP_LOCK_MS);
    // Round 1 ("day"): sun, bread, rain, star.
    await click(r.root, 'story-sequence-card-sun');
    expect(answers).toEqual([['so:day:0', true]]);
    await tick(150);
    await click(r.root, 'story-sequence-card-rain');
    expect(answers).toHaveLength(1);
    await tick(300);
    await click(r.root, 'story-sequence-card-rain');
    expect(answers).toEqual([
      ['so:day:0', true],
      ['so:day:1', false],
    ]);
  });

  it('Story Order: a right card, a bounce 150 ms later on another card: one answer; 450 ms later it counts', async () => {
    const answers: Array<[string, boolean]> = [];
    const r = await render(
      <TapLockProvider>
        <RomanizationModeOverride mode="always">
          <StoryOrderGame scope={STORY_ORDER_FIXTURES.captions} host={hostOf(answers)} sequenceId="minigame:fixture" nonce={3} />
        </RomanizationModeOverride>
      </TapLockProvider>,
    );
    mounted.push(r);
    await tick(TAP_LOCK_MS);
    // Morning: up, wash, eat, park.
    await click(r.root, 'story-order-card-up');
    expect(answers.map(([, c]) => c)).toEqual([true]);
    await tick(150);
    await click(r.root, 'story-order-card-eat');
    expect(answers).toHaveLength(1);
    await tick(300);
    await click(r.root, 'story-order-card-eat');
    expect(answers.map(([, c]) => c)).toEqual([true, false]);
  });
});
