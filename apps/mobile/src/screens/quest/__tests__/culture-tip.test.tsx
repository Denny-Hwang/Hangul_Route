import { getMessages } from '@hangul-route/i18n';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { questById } from '../../../content';
import { useLocaleStore } from '../../../store/locale-store';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { resetRemoteConfigForTests, useRemoteConfigStore } from '../../../store/remote-config-store';
import { buttonsNamed, byTestId, hostNodes, press, render, textOf, unmount } from '../../../test-support/render';
import { CardDetailView } from '../../library/CardDetailView';
import { QuestPlayerView } from '../QuestPlayerView';

/**
 * The Did you know? tip (F-CURR-002 §5.7, row CM-3C), with its real chunk: at a quest's reward step and on the back of
 * the cell's card, one sourced note of the lesson cell with its source line, behind `upperCards` (built-in pct 0). Off,
 * the reward step and the card page are as before.
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

const EN = getMessages('en');
const CELL = 'episode:stage2-nature';
const Q1 = questById('quest:stage2-nature-q1')!;
const REWARD = Q1.steps.findIndex((s) => s.kind === 'reward');
const PROFILE = 'profile:mina';
const mounted: ReactTestRenderer[] = [];

const settle = async (): Promise<void> => {
  await act(async () => {
    await import('../culture-tip-chunk');
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

/** For the off cases: lets pending work finish without importing the chunk (the door's own test counts its loads). */
const idle = async (): Promise<void> => {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

function switchTo(pct: number): void {
  useRemoteConfigStore.setState({ hydrated: true, cache: { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags: { upperCards: { on: true, pct } } } });
}

async function rewardStep(questId = Q1.id, wait = settle): Promise<ReactTestRenderer> {
  const ports = { start: () => REWARD, end: vi.fn(), finish: vi.fn(), leave: vi.fn(), track: vi.fn() };
  const r = await render(<QuestPlayerView questId={questId} episodeId={CELL} ports={ports} onOpenGame={() => undefined} onBack={() => undefined} reviewsFor={PROFILE} />);
  mounted.push(r);
  await wait();
  return r;
}

beforeEach(() => {
  resetRemoteConfigForTests();
  useProfileStore.setState({
    profiles: [{ id: PROFILE, displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z', learnerType: 'self' }],
    activeId: PROFILE,
  });
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  useProfileStore.setState({ profiles: [], activeId: null });
  useProgressStore.setState({ byProfile: {} });
  useLocaleStore.setState({ device: 'en', detected: 'en' });
  resetRemoteConfigForTests();
});

describe('the reward step (row CM-3C)', () => {
  it("on: the quest's note of its cell, a named region with a Did you know? heading, its Korean marked, and its source line", async () => {
    switchTo(100);
    const r = await rewardStep();
    const [tip] = byTestId(r.root, 'culture-tip-reward');
    expect(tip).toBeDefined();
    expect([tip!.props.role, tip!.props['aria-label']]).toEqual(['region', EN.learner.cultureTip.region]);
    const [title] = byTestId(tip!, 'culture-tip-title');
    expect(title!.props.role).toBe('heading');
    expect(textOf(title!)).toBe('Did you know?');
    // Quest 1 of Outdoor Words shows the cell's first culture note: the magpie and the tiger in minhwa.
    const text = textOf(byTestId(tip!, 'culture-tip-text')[0]!);
    expect(text).toMatch(/Korean folk paintings, called/);
    expect(text).toMatch(/minhwa/);
    const korean = hostNodes(tip!, (n) => n.props.lang === 'ko').map((n) => textOf(n).trim());
    expect(korean).toEqual(expect.arrayContaining(['민화', '까치호랑이', '국립민속박물관']));
    const source = textOf(byTestId(tip!, 'culture-tip-source')[0]!).replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')').replace(/ ,/g, ',');
    expect(source).toBe('Source: 국립민속박물관 (National Folk Museum of Korea) — 한국민속대백과사전, 까치호랑이 (한국민속예술사전) and 1 more source');
    // Never a web address on a learner surface.
    expect(textOf(tip!)).not.toMatch(/https?:|folkency/);
    // See results stays the step's own button.
    expect(buttonsNamed(r.root, EN.learner.quest.seeResults.cta)).toHaveLength(1);
  });

  it('the note follows the UI language (the cell\'s culture.<id>.text gloss)', async () => {
    switchTo(100);
    await act(async () => useLocaleStore.setState({ device: 'es', detected: 'en' }));
    const r = await rewardStep();
    await settle();
    const [tip] = byTestId(r.root, 'culture-tip-reward');
    expect(textOf(byTestId(tip!, 'culture-tip-title')[0]!)).toBe(getMessages('es').learner.cultureTip.title);
    expect(textOf(byTestId(tip!, 'culture-tip-text')[0]!)).toMatch(/Las pinturas populares coreanas/);
  });

  it('off (the built-in pct 0): no tip, the reward step as before', async () => {
    switchTo(0);
    const r = await rewardStep(Q1.id, idle);
    expect(byTestId(r.root, 'culture-tip-reward')).toEqual([]);
    expect(hostNodes(r.root, (n) => n.props.role === 'region' && n.props['aria-label'] === EN.learner.cultureTip.region)).toEqual([]);
  });
});

describe('the card back (row CM-3C)', () => {
  const CARD = 'card:byeol';
  function hold(): void {
    useProgressStore.setState({
      byProfile: {
        [PROFILE]: {
          profileId: PROFILE,
          updatedAt: '2026-10-02T00:00:00.000Z',
          episodes: [],
          quests: [],
          cards: [{ cardId: CARD, unlockedAt: '2026-10-02T00:00:00.000Z', newSinceLastView: false }],
          sessions: [],
          homework: [],
          reviews: [],
          streakDays: 1,
        },
      },
    });
  }
  async function card(wait = settle): Promise<ReactTestRenderer> {
    const r = await render(<CardDetailView cardId={CARD} />);
    mounted.push(r);
    await wait();
    await wait();
    return r;
  }

  it("on: the fact card under the card names the note of the quest that awards it; the back shows it inside the flip button", async () => {
    switchTo(100);
    hold();
    const r = await card();
    const [facts] = byTestId(r.root, 'culture-tip-fact-card');
    expect(facts!.props.role).toBe('region');
    expect(textOf(facts!)).toMatch(/Korean folk paintings, called/);
    const flip = hostNodes(r.root, (n) => n.props.role === 'button' && n.props['aria-label'] === EN.a11y.flipToBack)[0]!;
    await press(flip);
    await settle();
    const [back] = byTestId(r.root, 'culture-tip-back');
    expect(back).toBeDefined();
    // Inside the button it is drawn only: no region of its own (the fact card is where a screen reader reads it).
    expect(back!.props.role).toBeUndefined();
    expect(textOf(back!)).toMatch(/까치호랑이/);
  });

  it('off: no tip on either face', async () => {
    switchTo(0);
    hold();
    const r = await card(idle);
    expect(byTestId(r.root, 'culture-tip-fact-card')).toEqual([]);
    const flip = hostNodes(r.root, (n) => n.props.role === 'button' && n.props['aria-label'] === EN.a11y.flipToBack)[0]!;
    await press(flip);
    await idle();
    expect(byTestId(r.root, 'culture-tip-back')).toEqual([]);
  });
});
