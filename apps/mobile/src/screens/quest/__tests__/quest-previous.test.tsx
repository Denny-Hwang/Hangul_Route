import { touchTarget } from '@hangul-route/design-system';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { questById } from '../../../content';
import { useLocaleStore } from '../../../store/locale-store';
import { useProfileStore } from '../../../store/profile-store';
import { useQuestRunStore } from '../../../store/quest-run-store';
import { buttonsNamed, byTestId, press, render, screenTexts, unmount } from '../../../test-support/render';
import { QuestPlayerView } from '../QuestPlayerView';

/**
 * [QB] AMENDMENTS-QUEST-SOUND-BACK rows QB-2 and QB-3 on the quest player: Previous between steps, the launcher of a
 * step shown again (Continue, Play again, no Skip for now), and nothing tallied changing on the way back.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock('@react-navigation/native', async () => {
  const { createContext, useEffect } = await import('react');
  return {
    NavigationContext: createContext(undefined),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    useNavigation: () => ({ goBack: () => undefined, navigate: () => undefined }),
  };
});
const audio = vi.hoisted(() => ({ stops: 0 }));
vi.mock('../../../platform/audio', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../platform/audio')>();
  return {
    ...actual,
    stop: () => {
      audio.stops += 1;
      actual.stop();
    },
  };
});

const QUEST = questById('quest:stage1-rites-q1')!;
const at = (kind: string): number => QUEST.steps.findIndex((s) => s.kind === kind);
const INTRO = at('intro');
const DISCOVER = at('discover');
const PRACTICE = at('practice');
const APPLY = at('apply');
const CHECK = at('check');
const REWARD = at('reward');
const PAGES = QUEST.steps[DISCOVER]!.discover!.pages.length;
const mounted: ReactTestRenderer[] = [];

async function settle(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function playerAt(step: number) {
  const ports = { start: () => step, end: vi.fn(), finish: vi.fn(), leave: vi.fn(), track: vi.fn() };
  const onOpenGame = vi.fn();
  const r = await render(
    <QuestPlayerView questId={QUEST.id} episodeId="episode:stage1-rites" ports={ports} onOpenGame={onOpenGame} onBack={() => undefined} reviewsFor={null} />,
  );
  mounted.push(r);
  await settle();
  return { r, ports, onOpenGame };
}

const named = (r: ReactTestRenderer, label: string): ReactTestInstance[] => buttonsNamed(r.root, label);
async function tap(r: ReactTestRenderer, label: string): Promise<void> {
  await press(named(r, label)[0]!);
  await settle();
}
const run = () => useQuestRunStore.getState();
const texts = (r: ReactTestRenderer): string => screenTexts(r.root).join(' | ');

/** A game played through: `right` of `rounds` first tries, then the game ends and the player comes back to the quest. */
async function playGame(right: number, rounds: number): Promise<void> {
  await act(async () => {
    const store = useQuestRunStore.getState();
    for (let i = 0; i < rounds; i += 1) store.answerRound(i, i < right);
    store.markStepComplete();
    store.consumePendingAdvance();
  });
  await settle();
}

beforeEach(() => {
  audio.stops = 0;
  useProfileStore.setState({ profiles: [], activeId: null });
  useLocaleStore.setState({ device: 'en' });
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  useQuestRunStore.getState().reset();
});

describe('[QB] Previous between steps (row QB-2)', () => {
  it('the quest under test: intro, Look and learn, two games, the Check, the finish page', () => {
    expect([INTRO, DISCOVER, PRACTICE, APPLY, CHECK, REWARD]).toEqual([0, 1, 2, 3, 4, 5]);
    expect(PAGES).toBeGreaterThanOrEqual(2);
  });

  it('the first step has no Previous and is drawn as before', async () => {
    const { r } = await playerAt(INTRO);
    expect(named(r, 'Previous')).toHaveLength(0);
    expect(byTestId(r.root, 'quest-step-actions')).toHaveLength(0);
    expect(named(r, 'Continue')).toHaveLength(1);
  });

  it('from the second step on every step shows Previous: Look and learn page 1, a game, the Check, the finish page', async () => {
    const { r } = await playerAt(DISCOVER);
    expect(named(r, 'Previous')).toHaveLength(1);
    for (let i = 0; i < PAGES; i += 1) await tap(r, 'Continue');
    expect(run().stepIndex).toBe(PRACTICE);
    expect(named(r, 'Previous')).toHaveLength(1);
    expect(named(r, 'Play minigame')).toHaveLength(1);
    expect(named(r, 'Skip for now')).toHaveLength(1);
    await tap(r, 'Skip for now');
    await tap(r, 'Skip for now');
    expect(run().stepIndex).toBe(CHECK);
    expect(named(r, 'Previous')).toHaveLength(1);
    expect(named(r, 'Go')).toHaveLength(1);
    await playGame(2, 2);
    expect(run().stepIndex).toBe(REWARD);
    expect(named(r, 'Previous')).toHaveLength(1);
    expect(named(r, 'See results')).toHaveLength(1);
  });

  it('Previous on Look and learn page 1 shows the intro as it was; Continue goes forward again', async () => {
    const { r } = await playerAt(INTRO);
    const intro = texts(r);
    await tap(r, 'Continue');
    expect(run().stepIndex).toBe(DISCOVER);
    await tap(r, 'Previous');
    expect(run()).toMatchObject({ stepIndex: INTRO, furthestStep: DISCOVER });
    expect(texts(r)).toContain(QUEST.steps[INTRO]!.titleEn);
    expect(named(r, 'Previous')).toHaveLength(0);
    // The same words and the same one button as on the first visit (the step dots aside).
    expect(texts(r).replace(/2 of 6/g, '1 of 6')).toBe(intro);
    await tap(r, 'Continue');
    expect(run().stepIndex).toBe(DISCOVER);
    // Forward: the step opens on its first page.
    expect(texts(r)).toContain(`Page 1 of ${PAGES}`);
  });

  it('arriving on Look and learn by Previous opens its last page, with every page dot filled', async () => {
    const { r } = await playerAt(DISCOVER);
    for (let i = 0; i < PAGES; i += 1) await tap(r, 'Continue');
    expect(run().stepIndex).toBe(PRACTICE);
    await tap(r, 'Previous');
    expect(run().stepIndex).toBe(DISCOVER);
    expect(texts(r)).toContain(`Page ${PAGES} of ${PAGES}`);
    expect(byTestId(r.root, 'discover-page-dots')[0]!.props['aria-valuenow']).toBe(PAGES);
    // Previous again is the page before, inside the step.
    await tap(r, 'Previous');
    expect(run().stepIndex).toBe(DISCOVER);
    expect(texts(r)).toContain(`Page ${PAGES - 1} of ${PAGES}`);
  });

  it('a game step shown again: Continue is the main button, Play again opens the game, no Skip for now', async () => {
    const { r, onOpenGame } = await playerAt(PRACTICE);
    await playGame(4, 4);
    expect(run().stepIndex).toBe(APPLY);
    await tap(r, 'Previous');
    expect(run().stepIndex).toBe(PRACTICE);
    expect(named(r, 'Skip for now')).toHaveLength(0);
    expect(named(r, 'Play minigame')).toHaveLength(0);
    expect(named(r, 'Continue')).toHaveLength(1);
    expect(named(r, 'Play again')).toHaveLength(1);
    expect(named(r, 'Previous')).toHaveLength(1);
    await tap(r, 'Play again');
    expect(onOpenGame).toHaveBeenCalledWith(PRACTICE);
    await tap(r, 'Continue');
    expect(run().stepIndex).toBe(APPLY);
    // The furthest step is a first visit again: Play and Skip for now.
    expect(named(r, 'Play minigame')).toHaveLength(1);
    expect(named(r, 'Skip for now')).toHaveLength(1);
  });

  it('a skipped game shown again has no Skip either: it is already skipped', async () => {
    const { r } = await playerAt(PRACTICE);
    await tap(r, 'Skip for now');
    await tap(r, 'Previous');
    expect(run().stepIndex).toBe(PRACTICE);
    expect(named(r, 'Skip for now')).toHaveLength(0);
    expect(named(r, 'Continue')).toHaveLength(1);
    expect(named(r, 'Play again')).toHaveLength(1);
    expect(run().skippedSteps).toEqual([PRACTICE]);
  });

  it('the Check shown again: Continue and Play again, still no Skip', async () => {
    const { r, onOpenGame } = await playerAt(CHECK);
    await playGame(2, 2);
    await tap(r, 'Previous');
    expect(run().stepIndex).toBe(CHECK);
    expect(named(r, 'Go')).toHaveLength(0);
    expect(named(r, 'Skip for now')).toHaveLength(0);
    expect(named(r, 'Continue')).toHaveLength(1);
    await tap(r, 'Play again');
    expect(onOpenGame).toHaveBeenCalledWith(CHECK);
  });

  it('a game finished on a revisit moves forward one step, as a first play does', async () => {
    const { r } = await playerAt(PRACTICE);
    await playGame(4, 4);
    await playGame(3, 3);
    expect(run().stepIndex).toBe(CHECK);
    await tap(r, 'Previous');
    await tap(r, 'Previous');
    expect(run().stepIndex).toBe(PRACTICE);
    await playGame(0, 4);
    expect(run()).toMatchObject({ stepIndex: APPLY, furthestStep: CHECK });
  });

  it('the step dots keep the furthest step and ring the step shown; the count names the step shown', async () => {
    const { r } = await playerAt(PRACTICE);
    await playGame(4, 4);
    await playGame(3, 3);
    const dots = (): ReactTestInstance => byTestId(r.root, 'quest-step-dots')[0]!;
    expect(dots().props['aria-valuenow']).toBe(CHECK + 1);
    expect(byTestId(r.root, 'quest-step-dots-current')).toHaveLength(0);
    await tap(r, 'Previous');
    await tap(r, 'Previous');
    expect(dots().props['aria-valuenow']).toBe(CHECK + 1);
    expect(dots().props['aria-valuetext']).toBe(`${PRACTICE + 1} of ${QUEST.steps.length}`);
    expect(byTestId(r.root, 'quest-step-dots-current')).toHaveLength(1);
    expect(texts(r)).toContain(`${PRACTICE + 1} / ${QUEST.steps.length}`);
  });

  it('Previous stops what the step was saying, and never asks the leave question or leaves the quest', async () => {
    const { r, ports } = await playerAt(PRACTICE);
    const before = audio.stops;
    await tap(r, 'Previous');
    expect(audio.stops).toBeGreaterThan(before);
    expect(ports.leave).not.toHaveBeenCalled();
    expect(ports.finish).not.toHaveBeenCalled();
    expect(texts(r)).not.toContain('Leave this quest?');
  });

  it('the row: Previous first, then the main button, both at least 64 high', async () => {
    const { r } = await playerAt(PRACTICE);
    const row = byTestId(r.root, 'quest-step-actions')[0]!;
    const buttons = row.findAll((n) => typeof n.type === 'string' && n.props.role === 'button');
    expect(buttons.map((b) => screenTexts(b)[0])).toEqual(['Previous', 'Play minigame']);
    for (const b of buttons) {
      const style = Object.assign({}, ...[b.props.style].flat(Infinity)) as { minHeight?: number | string };
      expect(Number.parseFloat(String(style.minHeight))).toBeGreaterThanOrEqual(touchTarget.min);
    }
  });

  it('a finished quest still ends from the finish page after a look back', async () => {
    const { r, ports } = await playerAt(PRACTICE);
    await playGame(4, 4);
    await playGame(3, 3);
    await playGame(2, 2);
    await tap(r, 'Previous');
    await tap(r, 'Continue');
    expect(run().stepIndex).toBe(REWARD);
    await tap(r, 'See results');
    expect(ports.finish).toHaveBeenCalledWith({ stars: 3, correct: 9, total: 9, played: true, retries: 0 });
  });

  it.each([
    ['es', 'Anterior', 'Jugar otra vez'],
    ['ko', '이전', '다시 하기'],
  ] as const)('%s: Previous and Play again come from the dictionary', async (locale, previous, again) => {
    useLocaleStore.setState({ device: locale });
    const { r } = await playerAt(PRACTICE);
    await playGame(4, 4);
    await tap(r, previous);
    expect(run().stepIndex).toBe(PRACTICE);
    expect(named(r, again)).toHaveLength(1);
  });
});

describe('[QB] going back changes no score (row QB-3)', () => {
  const sent = (ports: { track: ReturnType<typeof vi.fn> }, name: string): unknown[] =>
    ports.track.mock.calls.map((c) => c[0] as { name: string; payload: unknown }).filter((e) => e.name === name).map((e) => e.payload);

  it('a game played again on a revisit leaves the result as it was: same stars, same counts, same retries', async () => {
    const { r, ports } = await playerAt(PRACTICE);
    await playGame(3, 4);
    await playGame(3, 3);
    await playGame(2, 2);
    expect(run().stepIndex).toBe(REWARD);
    const before = { correct: run().correctCount, total: run().totalCount, retries: run().retryCount, stars: run().stars(QUEST.steps) };
    // Back to Practice, play it again all wrong with second taps, forward, play Apply again all right, forward to the end.
    await tap(r, 'Previous');
    await tap(r, 'Previous');
    await tap(r, 'Previous');
    expect(run().stepIndex).toBe(PRACTICE);
    await act(async () => {
      const store = run();
      for (let i = 0; i < 4; i += 1) {
        store.answerRound(i, false);
        store.answerRound(i, true);
      }
      store.markStepComplete();
      store.consumePendingAdvance();
    });
    await settle();
    await playGame(3, 3);
    await tap(r, 'Continue');
    expect(run().stepIndex).toBe(REWARD);
    expect({ correct: run().correctCount, total: run().totalCount, retries: run().retryCount, stars: run().stars(QUEST.steps) }).toEqual(before);
    await tap(r, 'See results');
    expect(ports.finish).toHaveBeenCalledWith({ stars: before.stars, correct: 8, total: 9, played: true, retries: 0 });
  });

  it('a skipped game stays skipped (2 stars at most) when it is only looked at again', async () => {
    const { r, ports } = await playerAt(PRACTICE);
    await playGame(4, 4);
    await tap(r, 'Skip for now');
    await playGame(2, 2);
    await tap(r, 'Previous');
    await tap(r, 'Previous');
    expect(run().stepIndex).toBe(APPLY);
    await tap(r, 'Continue');
    await tap(r, 'Continue');
    await tap(r, 'See results');
    expect(ports.finish).toHaveBeenCalledWith({ stars: 2, correct: 6, total: 6, played: true, retries: 0 });
  });

  it('a skipped game played in full on the revisit is no longer skipped: its rounds score and the cap is gone', async () => {
    const { r, ports } = await playerAt(PRACTICE);
    await playGame(4, 4);
    await tap(r, 'Skip for now');
    await playGame(2, 2);
    expect(run().skippedSteps).toEqual([APPLY]);
    await tap(r, 'Previous');
    await tap(r, 'Previous');
    await playGame(3, 3);
    expect(run().skippedSteps).toEqual([]);
    expect(run().stepIndex).toBe(CHECK);
    await tap(r, 'Continue');
    await tap(r, 'See results');
    expect(ports.finish).toHaveBeenCalledWith({ stars: 3, correct: 9, total: 9, played: true, retries: 0 });
  });

  it('quest.discover_completed is sent once, however often Look and learn is passed', async () => {
    const { r, ports } = await playerAt(DISCOVER);
    for (let i = 0; i < PAGES; i += 1) await tap(r, 'Continue');
    expect(sent(ports, 'quest.discover_completed')).toHaveLength(1);
    await tap(r, 'Previous');
    expect(run().stepIndex).toBe(DISCOVER);
    await tap(r, 'Continue');
    expect(run().stepIndex).toBe(PRACTICE);
    // And once more from the intro, through every page.
    await tap(r, 'Previous');
    for (let i = 1; i < PAGES; i += 1) await tap(r, 'Previous');
    await tap(r, 'Previous');
    expect(run().stepIndex).toBe(INTRO);
    await tap(r, 'Continue');
    for (let i = 0; i < PAGES; i += 1) await tap(r, 'Continue');
    expect(run().stepIndex).toBe(PRACTICE);
    expect(sent(ports, 'quest.discover_completed')).toEqual([{ questId: QUEST.id, pages: PAGES, heard: 0 }]);
  });

  it('quest.check_completed is sent once, with the first play\'s counts, also after the Check is played again', async () => {
    const { r, ports } = await playerAt(CHECK);
    await playGame(1, 2);
    expect(sent(ports, 'quest.check_completed')).toEqual([{ questId: QUEST.id, firstTryCorrect: 1, retries: 0 }]);
    await tap(r, 'Previous');
    expect(run().stepIndex).toBe(CHECK);
    await playGame(2, 2);
    expect(run().stepIndex).toBe(REWARD);
    await tap(r, 'Previous');
    await tap(r, 'Continue');
    expect(sent(ports, 'quest.check_completed')).toHaveLength(1);
  });

  it('a Check left by Previous half-way reports all of its rounds when it ends', async () => {
    const { r, ports } = await playerAt(APPLY);
    await tap(r, 'Skip for now');
    expect(run().stepIndex).toBe(CHECK);
    // Round 1 of the Check, then the game is closed and the learner goes back to the skipped game and plays it.
    await act(async () => {
      run().answerRound(0, true);
    });
    await tap(r, 'Previous');
    await playGame(3, 3);
    expect(run().stepIndex).toBe(CHECK);
    await act(async () => {
      const store = run();
      store.answerRound(1, false);
      store.answerRound(1, true);
      store.markStepComplete();
      store.consumePendingAdvance();
    });
    await settle();
    expect(sent(ports, 'quest.check_completed')).toEqual([{ questId: QUEST.id, firstTryCorrect: 1, retries: 1 }]);
  });
});

