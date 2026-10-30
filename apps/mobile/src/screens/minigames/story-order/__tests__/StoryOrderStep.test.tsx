import { getMessages } from '@hangul-route/i18n';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { questsAll } from '../../../../content';
import { RomanizationModeOverride } from '../../../../i18n/use-romanization-mode';
import { GAME_SWITCHES } from '../../../../logic/game-switches';
import { scopeFor } from '../../../../logic/minigame-config';
import { playableStoryOrder } from '../../../../logic/story-order/fallback';
import { STORY_ORDER_FIXTURES } from '../../../../navigation/story-order-e2e-fixture';
import { setFirstRoundAnswerListener, useQuestRunStore, type FirstRoundAnswer } from '../../../../store/quest-run-store';
import { useRemoteConfigStore } from '../../../../store/remote-config-store';
import { buttonsNamed, byTestId, press, render, screenTexts, unmount } from '../../../../test-support/render';
import type { MinigameHost } from '../../host';
import { STORY_ORDER_DECIDE_WAIT_MS, StoryOrderStep } from '../StoryOrderStep';

/**
 * F-CURR-002 §12.2, row CM-34: `game.story-order` decides, once when the step opens, between the game (its own chunk)
 * and its fallback, each round as Story Sequence with text cards (board O3). Built-in pct 0: with no remote copy the
 * fallback plays.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;
// The chunk's import fails while `chunk.fail` is set (offline before the service worker cached it).
const chunk = vi.hoisted(() => ({ fail: false }));
vi.mock('../order-game-chunk', async (importOriginal) => {
  if (chunk.fail) throw new Error('offline');
  return importOriginal<object>();
});
// What the step sends: the fallback is not a story's sequence, so `story.sequence.finished` never goes out.
const sent = vi.hoisted(() => [] as Array<{ name: string }>);
vi.mock('../../../../platform/telemetry', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  track: vi.fn(async (event: { name: string }) => {
    sent.push(event);
  }),
}));
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

type Scope = (typeof STORY_ORDER_FIXTURES)[keyof typeof STORY_ORDER_FIXTURES];

async function open(fixture: keyof typeof STORY_ORDER_FIXTURES | Scope, mode: MinigameHost['mode'] = 'quest'): Promise<{ r: ReactTestRenderer; host: MinigameHost; finished: () => number }> {
  let finished = 0;
  const scope = typeof fixture === 'string' ? STORY_ORDER_FIXTURES[fixture] : fixture;
  // As MinigameScreen's quest host: the answer goes to the run store with what it asked.
  const host: MinigameHost = {
    mode,
    answer: vi.fn((key: string | number, correct: boolean, meta?: { itemId?: string; hinted?: boolean }) =>
      useQuestRunStore.getState().answerRound(key, correct, meta?.itemId === undefined ? undefined : { scope, itemId: meta.itemId }, meta?.hinted),
    ),
    complete: vi.fn(),
  };
  const r = await render(
    <RomanizationModeOverride mode="always">
      <StoryOrderStep scope={scope} host={host} sequenceId="minigame:fixture" onFallbackFinish={() => (finished += 1)} />
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
  sent.length = 0;
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

  it('each slot reaches the memory store at the read rung, hinted (the cards show the meanings); the last slot of a round records nothing', async () => {
    flag(false);
    const heard: FirstRoundAnswer[] = [];
    setFirstRoundAnswerListener((a) => heard.push(a));
    try {
      const { r } = await open('twoRounds');
      for (const p of day!.panels) await press(pressable(r.root, `story-sequence-card-${p.id}`));
      expect(heard.map((a) => [a.asked.itemId, a.correct, a.hinted])).toEqual([
        ['day/sun', true, true],
        ['day/bread', true, true],
        ['day/rain', true, true],
      ]);
      expect(heard.every((a) => a.asked.scope === STORY_ORDER_FIXTURES.twoRounds)).toBe(true);
      // The fourth (forced) slot still scores.
      expect(useQuestRunStore.getState()).toMatchObject({ correctCount: 4, totalCount: 4 });
    } finally {
      setFirstRoundAnswerListener(null);
    }
  });

  it('sends no story-bound story.sequence.finished: not after a round, not at the end, not on a skip, not on an empty step', async () => {
    flag(false);
    const { r } = await open('twoRounds');
    for (const p of day!.panels) await press(pressable(r.root, `story-sequence-card-${p.id}`));
    await press(pressable(r.root, 'story-sequence-done'));
    const [skip] = buttonsNamed(r.root, SEQ.skip.cta);
    await press(skip!);
    const empty = await open('empty');
    const [go] = buttonsNamed(empty.r.root, SEQ.continue.cta);
    await press(go!);
    expect(sent.map((e) => e.name)).not.toContain('story.sequence.finished');
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
    flag(false);
    const { r } = await open('captions');
    expect(screenTexts(r.root)).toContain(SEQ.title);
    flag(true);
    await settle();
    expect(screenTexts(r.root)).toContain(SEQ.title);
    expect(byTestId(r.root, 'story-order-cards')).toHaveLength(0);
  });

  it('a stored copy that is never read: after the wait the step decides without it (the fallback), never a dead end', async () => {
    useRemoteConfigStore.setState({ hydrated: false, cache: null });
    const { r } = await open('captions');
    expect(screenTexts(r.root)).not.toContain(SEQ.title);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, STORY_ORDER_DECIDE_WAIT_MS + 50));
    });
    expect(screenTexts(r.root)).toContain(SEQ.title);
    expect(byTestId(r.root, 'story-order-cards')).toHaveLength(0);
  });

  it('a Check step has no Skip this one (check-launcher.ts): the fallback draws none', async () => {
    flag(false);
    const { r } = await open('twoRounds', 'check');
    expect(screenTexts(r.root)).toContain(SEQ.title);
    expect(buttonsNamed(r.root, SEQ.skip.cta)).toHaveLength(0);
    const quest = await open('twoRounds');
    expect(buttonsNamed(quest.r.root, SEQ.skip.cta)).toHaveLength(1);
  });
});

describe('StoryOrderStep: game.story-order on', () => {
  it('the chunk does not load: the rounds play as the fallback, never a dead end', async () => {
    flag(true);
    chunk.fail = true;
    try {
      const { r, finished } = await open('captions');
      for (let i = 0; i < 100 && !screenTexts(r.root).includes(SEQ.title); i += 1) await settle();
      expect(screenTexts(r.root)).toContain(SEQ.title);
      expect(byTestId(r.root, 'story-order-cards')).toHaveLength(0);
      for (const p of morning!.panels) await press(pressable(r.root, `story-sequence-card-${p.id}`));
      await press(pressable(r.root, 'story-sequence-done'));
      expect(finished()).toBe(1);
    } finally {
      chunk.fail = false;
    }
  });


  it('loads the game from its chunk', async () => {
    flag(true);
    const { r } = await open('captions');
    // The chunk is a dynamic import: the waiting state first, then the game once the module is in.
    for (let i = 0; i < 100 && byTestId(r.root, 'story-order-cards').length === 0; i += 1) await settle();
    expect(byTestId(r.root, 'story-order-cards')).toHaveLength(1);
    expect(screenTexts(r.root)).toContain(getMessages('en').learner.storyOrder.title);
  });

  it('a step opened before the stored copy is read waits for it (after the chunk tests: the chunk stays loaded), so the owner\'s ramp is never latched as off', async () => {
    useRemoteConfigStore.setState({ hydrated: false, cache: null });
    const { r } = await open('captions');
    expect(screenTexts(r.root)).not.toContain(SEQ.title);
    expect(byTestId(r.root, 'story-order-cards')).toHaveLength(0);
    // The stored copy is read and has the switch on: the game, from its chunk.
    await act(async () => {
      flag(true);
    });
    for (let i = 0; i < 100 && byTestId(r.root, 'story-order-cards').length === 0; i += 1) await settle();
    expect(byTestId(r.root, 'story-order-cards')).toHaveLength(1);
  });
});

describe('every catalogue quest step whose kind has a game switch renders its fallback with the switch off (§12.2, §14)', () => {
  // Each quest step whose kind is gated (`GAME_SWITCHES`; today only story-order). No shipped quest authors one yet, so
  // the catalogue part is empty until CM-3A / CM-46 author Story Order steps; they are rendered here without a new test.
  const gated = questsAll.flatMap((quest) =>
    quest.steps.flatMap((step, i) => {
      const scope = step.minigameRef ? scopeFor(step.minigameRef) : undefined;
      return scope && GAME_SWITCHES[scope.kind] ? [{ name: `${quest.id} step ${i} ${step.minigameRef}`, scope: scope as Scope }] : [];
    }),
  );

  it('only story-order is gated, so StoryOrderStep is the screen each gated step mounts', () => {
    expect(Object.keys(GAME_SWITCHES)).toEqual(['story-order']);
    for (const { name, scope } of gated) expect(scope.kind, name).toBe('story-order');
  });

  it('each one (and each fixture) mounts as Story Sequence with text cards: never the game, never a dead end', async () => {
    flag(false);
    const all = [...gated, ...Object.entries(STORY_ORDER_FIXTURES).map(([k, scope]) => ({ name: `fixture ${k}`, scope }))];
    for (const { name, scope } of all) {
      const { r } = await open(scope);
      const texts = screenTexts(r.root);
      expect(byTestId(r.root, 'story-order-cards'), name).toHaveLength(0);
      const first = playableStoryOrder(scope)[0];
      if (!first) {
        expect(texts, name).toContain(SEQ.emptyLine);
        continue;
      }
      expect(texts, name).toContain(SEQ.title);
      for (const p of first.panels) expect(byTestId(r.root, `story-sequence-card-${p.id}`).length, `${name} ${p.id}`).toBeGreaterThan(0);
    }
  });
});
