import { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { questById } from '../../../content';
import { useLocaleStore } from '../../../store/locale-store';
import { useProfileStore } from '../../../store/profile-store';
import { useQuestRunStore } from '../../../store/quest-run-store';
import { buttonsNamed, press, render, screenTexts, unmount } from '../../../test-support/render';
import { QuestPlayerView } from '../QuestPlayerView';

/**
 * [AU] AMENDMENTS-AUDIT-2026-11 row AU-9 (audit FUNC-4): skipping a game caps the stars. One perfect game and a skip
 * used to be 3 stars; it is now at most 2, and a run that skipped every game at most 1. The Check has no Skip.
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

const QUEST = questById('quest:stage1-rites-q1')!;
const at = (kind: string): number => QUEST.steps.findIndex((s) => s.kind === kind);
const PRACTICE = at('practice');
const APPLY = at('apply');
const CHECK = at('check');
const REWARD = at('reward');
const mounted: ReactTestRenderer[] = [];

async function settle(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function playerAt(step: number, ownsCard?: (id: string) => boolean) {
  const ports = { start: () => step, end: vi.fn(), finish: vi.fn(), leave: vi.fn(), track: vi.fn(), ...(ownsCard ? { ownsCard } : {}) };
  const r = await render(
    <QuestPlayerView questId={QUEST.id} episodeId="episode:stage1-rites" ports={ports} onOpenGame={() => undefined} onBack={() => undefined} reviewsFor={null} />,
  );
  mounted.push(r);
  await settle();
  return { r, ports };
}

async function tap(r: ReactTestRenderer, label: string): Promise<void> {
  await press(buttonsNamed(r.root, label)[0]!);
  await settle();
}

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
  useProfileStore.setState({ profiles: [], activeId: null });
  useLocaleStore.setState({ device: 'en' });
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  useQuestRunStore.getState().reset();
});

describe('[AU] skipping a game caps the stars (row AU-9)', () => {
  it('the quest under test has two games with Skip for now, then a Check, then the reward', () => {
    expect([PRACTICE, APPLY, CHECK, REWARD]).toEqual([2, 3, 4, 5]);
  });

  it('a perfect game, one Skip for now and a perfect Check finish with 2 stars', async () => {
    const { r, ports } = await playerAt(PRACTICE);
    await playGame(4, 4);
    expect(useQuestRunStore.getState().stepIndex).toBe(APPLY);
    await tap(r, 'Skip for now');
    expect(useQuestRunStore.getState().stepIndex).toBe(CHECK);
    expect(useQuestRunStore.getState().skippedSteps).toEqual([APPLY]);
    await playGame(2, 2);
    await tap(r, 'See results');
    expect(ports.finish).toHaveBeenCalledWith({ stars: 2, correct: 6, total: 6, played: true, retries: 0 });
  });

  it('every game skipped and a perfect Check finish with 1 star', async () => {
    const { r, ports } = await playerAt(PRACTICE);
    await tap(r, 'Skip for now');
    await tap(r, 'Skip for now');
    await playGame(2, 2);
    await tap(r, 'See results');
    expect(ports.finish).toHaveBeenCalledWith({ stars: 1, correct: 2, total: 2, played: true, retries: 0 });
  });

  it('a run that played every game keeps 3 stars', async () => {
    const { r, ports } = await playerAt(PRACTICE);
    await playGame(4, 4);
    await playGame(3, 3);
    await playGame(2, 2);
    await tap(r, 'See results');
    expect(ports.finish).toHaveBeenCalledWith({ stars: 3, correct: 9, total: 9, played: true, retries: 0 });
  });

  it('the Check has no Skip for now', async () => {
    const { r } = await playerAt(CHECK);
    expect(buttonsNamed(r.root, 'Skip for now')).toHaveLength(0);
    expect(buttonsNamed(r.root, 'Go').length).toBeGreaterThan(0);
  });

  it('the reward step tells the same story as Results: with every game skipped (1 star at most) the card is waiting', async () => {
    const { r } = await playerAt(PRACTICE, () => false);
    await tap(r, 'Skip for now');
    await tap(r, 'Skip for now');
    await playGame(2, 2);
    const text = screenTexts(r.root).join(' | ');
    expect(text).not.toContain('joins your library');
    expect(text).toContain('The Lunar New Year card is waiting');
  });

  it('with one skip (2 stars) the card still joins the Library', async () => {
    const { r } = await playerAt(PRACTICE, () => false);
    await playGame(4, 4);
    await tap(r, 'Skip for now');
    await playGame(2, 2);
    expect(screenTexts(r.root).join(' | ')).toContain('A Lunar New Year card joins your library!');
  });
});
