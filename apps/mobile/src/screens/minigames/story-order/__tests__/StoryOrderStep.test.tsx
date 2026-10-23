import { getMessages } from '@hangul-route/i18n';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RomanizationModeOverride } from '../../../../i18n/use-romanization-mode';
import { STORY_ORDER_FIXTURES } from '../../../../navigation/story-order-e2e-fixture';
import { useQuestRunStore } from '../../../../store/quest-run-store';
import { useRemoteConfigStore } from '../../../../store/remote-config-store';
import { buttonsNamed, byTestId, press, render, screenTexts, unmount } from '../../../../test-support/render';
import type { MinigameHost } from '../../host';
import { StoryOrderStep } from '../StoryOrderStep';

/**
 * F-CURR-002 §12.2, row CM-34: `game.story-order` decides, once when the step opens, between the game (its own chunk)
 * and its fallback, each round as Story Sequence with text cards (board O3). Built-in pct 0: with no remote copy the
 * fallback plays.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;
vi.mock('../../../../platform/audio', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  playPrompt: vi.fn(async () => ({ status: 'played' })),
  stop: vi.fn(),
}));

const SEQ = getMessages('en').learner.story.sequence;
const mounted: ReactTestRenderer[] = [];
const [day, morning] = STORY_ORDER_FIXTURES.twoRounds.storyOrder!.rounds;

function flag(on: boolean | null): void {
  useRemoteConfigStore.setState({ hydrated: true, cache: on === null ? null : { v: 1, fetchedAt: 0, maxAgeS: 300, flags: { 'game.story-order': { on, pct: 100 } } } });
}

async function open(fixture: keyof typeof STORY_ORDER_FIXTURES): Promise<{ r: ReactTestRenderer; host: MinigameHost; finished: () => number }> {
  let finished = 0;
  const host: MinigameHost = { mode: 'quest', answer: vi.fn(), complete: vi.fn() };
  const r = await render(
    <RomanizationModeOverride mode="always">
      <StoryOrderStep scope={STORY_ORDER_FIXTURES[fixture]} host={host} sequenceId="minigame:fixture" onFallbackFinish={() => (finished += 1)} />
    </RomanizationModeOverride>,
  );
  mounted.push(r);
  return { r, host, finished: () => finished };
}

const pressable = (root: ReactTestInstance, id: string): ReactTestInstance => {
  const node = byTestId(root, id).find((n) => typeof n.props.onClick === 'function');
  if (!node) throw new Error(`no pressable ${id}`);
  return node;
};
const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
};

beforeEach(() => {
  useQuestRunStore.getState().beginQuest('quest:fixture', 'episode:fixture');
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  useRemoteConfigStore.setState({ hydrated: false, cache: null });
});

describe('StoryOrderStep: game.story-order off (its built-in pct 0)', () => {
  it('with no remote copy, each round plays as Story Sequence with text cards, the gloss as the caption', async () => {
    flag(null);
    const { r } = await open('twoRounds');
    expect(screenTexts(r.root)).toContain(SEQ.title);
    expect(byTestId(r.root, 'story-order-cards')).toHaveLength(0);
    for (const p of day!.panels) expect(screenTexts(r.root)).toContain(p.caption.en);
    // Story Sequence draws story scene art only: a panel's word picture is not drawn.
    expect(r.root.findAll((n) => typeof n.props['data-testid'] === 'string' && (n.props['data-testid'] as string).startsWith('story-sequence-card-art-'))).toHaveLength(0);
  });

  it('round 2 follows round 1 with its own slot keys; only the last round completes the step and finishes once', async () => {
    flag(false);
    const { r, finished } = await open('twoRounds');
    for (const p of day!.panels) await press(pressable(r.root, `story-sequence-card-${p.id}`));
    await press(pressable(r.root, 'story-sequence-done'));
    expect(finished()).toBe(0);
    expect(useQuestRunStore.getState().pendingAdvance).toBe(false);
    for (const p of morning!.panels) await press(pressable(r.root, `story-sequence-card-${p.id}`));
    await press(pressable(r.root, 'story-sequence-done'));
    expect(finished()).toBe(1);
    const run = useQuestRunStore.getState();
    expect(run.pendingAdvance).toBe(true);
    expect(run.scoredRounds).toEqual(['0:so:day:0', '0:so:day:1', '0:so:day:2', '0:so:day:3', '0:so:morning:0', '0:so:morning:1', '0:so:morning:2', '0:so:morning:3']);
    expect(run).toMatchObject({ correctCount: 8, totalCount: 8 });
  });

  it('Skip this one in round 1 ends the step', async () => {
    flag(false);
    const { r, finished } = await open('twoRounds');
    const [skip] = buttonsNamed(r.root, SEQ.skip.cta);
    await press(skip!);
    expect(finished()).toBe(1);
    expect(useQuestRunStore.getState().pendingAdvance).toBe(true);
  });

  it('a scope with no round to order shows Story Sequence\'s empty line', async () => {
    flag(false);
    const { r, finished } = await open('empty');
    expect(screenTexts(r.root)).toContain(SEQ.emptyLine);
    expect(finished()).toBe(0);
  });

  it('a remote copy that lands mid-step never swaps the game', async () => {
    useRemoteConfigStore.setState({ hydrated: false, cache: null });
    const { r } = await open('captions');
    flag(true);
    await settle();
    expect(screenTexts(r.root)).toContain(SEQ.title);
    expect(byTestId(r.root, 'story-order-cards')).toHaveLength(0);
  });
});

describe('StoryOrderStep: game.story-order on', () => {
  it('loads the game from its chunk', async () => {
    flag(true);
    const { r } = await open('captions');
    // The chunk is a dynamic import: the waiting state first, then the game once the module is in.
    for (let i = 0; i < 100 && byTestId(r.root, 'story-order-cards').length === 0; i += 1) await settle();
    expect(byTestId(r.root, 'story-order-cards')).toHaveLength(1);
    expect(screenTexts(r.root)).toContain(getMessages('en').learner.storyOrder.title);
  });
});
