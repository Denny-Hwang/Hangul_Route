import { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { questById } from '../../../content';
import { useLocaleStore } from '../../../store/locale-store';
import { useProfileStore } from '../../../store/profile-store';
import { useQuestRunStore } from '../../../store/quest-run-store';
import { render, screenTexts, unmount } from '../../../test-support/render';
import { QuestPlayerView } from '../QuestPlayerView';

/**
 * Owner request OW-3 (2026-11-04): after the first Holidays quest at 1 star the reward step said "Seollal Card! A
 * Lunar New Year card joins your library!", but a quest's own card is earned at 2 stars (F-STORY-006 §3.1, F-MOTION-003
 * §3.5), so the Library rightly had no Seollal card. The reward step now tells what this run did.
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
const REWARD = QUEST.steps.findIndex((s) => s.kind === 'reward');
const mounted: ReactTestRenderer[] = [];

/** The reward step of the Seollal quest after a run of `correct` of `total` first-try rounds. */
async function rewardStep(correct: number, total: number, ownsCard: ((id: string) => boolean) | undefined): Promise<string> {
  const ports = { start: () => REWARD, end: vi.fn(), finish: vi.fn(), leave: vi.fn(), track: vi.fn(), ...(ownsCard ? { ownsCard } : {}) };
  const r = await render(
    <QuestPlayerView questId={QUEST.id} episodeId="episode:stage1-rites" ports={ports} onOpenGame={() => undefined} onBack={() => undefined} reviewsFor={null} />,
  );
  mounted.push(r);
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await act(async () => {
    useQuestRunStore.setState({ correctCount: correct, totalCount: total });
  });
  return screenTexts(r.root).join(' | ');
}

beforeEach(() => {
  useProfileStore.setState({ profiles: [], activeId: null });
  useLocaleStore.setState({ device: 'en' });
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
});

describe('the reward step tells the truth about the quest card (OW-3)', () => {
  it('at 3 stars the card joins the Library, in the authored words', async () => {
    const text = await rewardStep(5, 5, () => false);
    expect(text).toContain('Seollal Card!');
    expect(text).toContain('A Lunar New Year card joins your library!');
  });

  it('at 2 stars too', async () => {
    const text = await rewardStep(3, 5, () => false);
    expect(text).toContain('A Lunar New Year card joins your library!');
  });

  it('at 1 star it does not say the card joins the Library: it says how to get it, by the quest and by the episode', async () => {
    const text = await rewardStep(2, 5, () => false);
    expect(text).not.toContain('joins your library');
    expect(text).not.toContain('Seollal Card!');
    expect(text).toContain('The Lunar New Year card is waiting');
    expect(text).toContain('Get 2 stars in this quest to earn the Lunar New Year card.');
    expect(text).toContain('You also get it when you finish every quest in New Year & Festivals');
  });

  it('with every game skipped (0 stars) it says the same, without a judgement of the run', async () => {
    const text = await rewardStep(0, 0, () => false);
    expect(text).toContain('The Lunar New Year card is waiting');
    expect(text).not.toMatch(/fail|wrong|miss|lost/i);
  });

  it('a replay of a quest whose card is already held keeps the authored lines, at any stars: nothing is waiting', async () => {
    for (const [correct, total] of [[2, 5], [5, 5]] as const) {
      const text = await rewardStep(correct, total, (id) => id === 'card:seollal');
      expect(text).not.toContain('is waiting');
      expect(text).toContain('Seollal Card!');
    }
  });

  it('the All lessons preview (no ownership port) keeps the authored lines', async () => {
    const text = await rewardStep(2, 5, undefined);
    expect(text).toContain('Seollal Card!');
  });

  it('the Spanish and Korean words follow the language', async () => {
    useLocaleStore.setState({ device: 'ko' });
    const ko = await rewardStep(2, 5, () => false);
    expect(ko).toContain('카드가 기다리고 있어요');
    expect(ko).toContain('별을 2개 받으면');
    useLocaleStore.setState({ device: 'es' });
    const es = await rewardStep(2, 5, () => false);
    expect(es).toContain('te espera');
    expect(es).toContain('Consigue 2 estrellas');
  });
});
