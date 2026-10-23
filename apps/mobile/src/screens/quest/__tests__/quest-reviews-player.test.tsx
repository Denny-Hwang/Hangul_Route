import { getMessages } from '@hangul-route/i18n';
import { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { episodesAll } from '../../../content/episodes';
import { questsAll } from '../../../content/quests';
import { useQuestRunStore } from '../../../store/quest-run-store';
import { buttonsNamed, byTestId, press, render, screenTexts } from '../../../test-support/render';
import { QuestPlayerView, TRY_AGAIN_DECIDE_MS, WARMUP_DECIDE_MS } from '../QuestPlayerView';

/**
 * F-CURR-002 section 4.5 (row CM-15) in the quest player: the warm-up opens a quest before its first step and Try
 * these again sits on the reward step, both outside the six steps, so the step counter, the run and its score are
 * the quest's own (F-CURR-001 U-5: the standard path is unchanged). With the switches off the chunk never loads.
 * The sessions themselves are `quest-review-session.test.tsx`; here the chunk is a stand-in.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const gate = vi.hoisted(() => ({
  warm: false,
  again: false,
  loads: 0,
  warmPlan: null as unknown,
  againPlan: null as unknown,
  hold: false,
  missedSeen: [] as unknown[],
  preloads: [] as Array<string | null>,
  handed: [] as unknown[],
}));

vi.mock('../quest-reviews', async () => {
  const { Pressable: P, Text: T } = await import('react-native');
  const R = await import('react');
  const Session = ({ plan, onDone }: { plan: { kind: string }; onDone: () => void }) =>
    R.createElement(P, { testID: `session-${plan.kind}`, onPress: onDone, accessibilityRole: 'button' }, R.createElement(T, null, `session ${plan.kind}`));
  const Offer = ({ onTry, onSeeResults }: { onTry: () => void; onSeeResults: () => void }) =>
    R.createElement(
      R.Fragment,
      null,
      R.createElement(P, { onPress: onTry, accessibilityRole: 'button', accessibilityLabel: 'Try these again' }, R.createElement(T, null, 'Try these again')),
      R.createElement(T, null, 'A quick second look at the tricky ones.'),
      R.createElement(P, { onPress: onSeeResults, accessibilityRole: 'button', accessibilityLabel: 'See results' }, R.createElement(T, null, 'See results')),
    );
  const chunk = {
    QuestReviewSession: Session,
    TryAgainOffer: Offer,
    planQuestWarmup: () => (gate.hold ? new Promise(() => undefined) : Promise.resolve(gate.warmPlan)),
    planQuestTryAgain: (input: { missed: unknown[] }) => {
      gate.missedSeen = input.missed;
      return gate.hold ? new Promise(() => undefined) : Promise.resolve(gate.againPlan);
    },
  };
  return {
    warmupWanted: (profileId: string | null) => gate.warm && profileId !== null,
    tryAgainWanted: (profileId: string | null, misses: number) => gate.again && profileId !== null && misses > 0,
    questReviewChunk: async () => {
      gate.loads += 1;
      return chunk;
    },
    preloadQuestReviews: (profileId: string | null) => {
      gate.preloads.push(profileId);
    },
    handTryAgainToResults: (session: unknown) => {
      gate.handed.push(session);
    },
  };
});
vi.mock('@react-navigation/native', async () => {
  const { createContext, useEffect } = await import('react');
  return {
    NavigationContext: createContext(undefined),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    useNavigation: () => ({ goBack: () => undefined, navigate: () => undefined }),
  };
});

const Q = getMessages('en').learner.quest;
const T = getMessages('en').learner.tryAgain;
const settle = async (ms = 0): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
};

const episodeOf = (questId: string): string => episodesAll.find((e) => e.questIds.includes(questId))?.id ?? 'episode:none';
/** A Stage 2+ lesson quest of six steps that ends on its reward step. */
const quest = questsAll.find((q) => q.steps.length === 6 && q.steps[5]!.kind === 'reward' && /^episode:stage[2-7]-/.test(episodeOf(q.id)))!;
const LAST = quest.steps.length - 1;

function portsAt(step: number) {
  return { start: () => step, end: vi.fn(), finish: vi.fn(), leave: vi.fn(), track: vi.fn() };
}

async function player(step: number, reviewsFor: string | null = 'profile:mina') {
  const ports = portsAt(step);
  const r = await render(
    <QuestPlayerView questId={quest.id} episodeId={episodeOf(quest.id)} ports={ports} onOpenGame={() => undefined} onBack={() => undefined} reviewsFor={reviewsFor} />,
  );
  await settle();
  return { r, ports };
}

/** The player one step before the reward step, then on to it: `miss` adds a first-try miss in between, as a game does. */
async function toReward(miss: boolean, reviewsFor: string | null = 'profile:mina') {
  const out = await player(LAST - 1, reviewsFor);
  await act(async () => {
    if (miss) useQuestRunStore.getState().answerRound(1, false, { texts: ['물'] });
    useQuestRunStore.getState().goNextStep();
  });
  await settle();
  return out;
}

const stepCounter = (texts: string[]): string | undefined => texts.find((t) => /^\d+ \/ \d+$/.test(t));
const plan = (kind: string) => ({ kind, rounds: [{ key: 'k' }], soundNotice: false, ctx: {} });

beforeEach(() => {
  Object.assign(gate, { warm: false, again: false, loads: 0, warmPlan: null, againPlan: null, hold: false, missedSeen: [], preloads: [], handed: [] });
  useQuestRunStore.getState().reset();
});
afterEach(() => {
  useQuestRunStore.getState().reset();
});

describe('the warm-up before the first step', () => {
  it('with questWarmup off the quest opens on its first step at once and the chunk never loads', async () => {
    const { r } = await player(0);
    expect(byTestId(r.root, 'lesson-waiting')).toHaveLength(0);
    expect(stepCounter(screenTexts(r.root))).toBe(`1 / ${quest.steps.length}`);
    expect(gate.loads).toBe(0);
  });

  it('opens the quest outside the six steps: Continue starts step 1 with the counter and the run untouched', async () => {
    gate.warm = true;
    gate.warmPlan = plan('warmup');
    const { r } = await player(0);
    expect(byTestId(r.root, 'session-warmup')).not.toHaveLength(0);
    expect(stepCounter(screenTexts(r.root))).toBeUndefined();
    expect(useQuestRunStore.getState()).toMatchObject({ stepIndex: 0, totalCount: 0, correctCount: 0 });
    await press(byTestId(r.root, 'session-warmup').find((n) => typeof n.props.onClick === 'function')!);
    expect(stepCounter(screenTexts(r.root))).toBe(`1 / ${quest.steps.length}`);
    expect(useQuestRunStore.getState()).toMatchObject({ stepIndex: 0, totalCount: 0, correctCount: 0 });
  });

  it('is skipped when nothing is due (no plan), and never holds the quest longer than its limit', async () => {
    gate.warm = true;
    const none = await player(0);
    expect(stepCounter(screenTexts(none.r.root))).toBe(`1 / ${quest.steps.length}`);
    gate.hold = true;
    const slow = await player(0);
    expect(byTestId(slow.r.root, 'lesson-waiting')).not.toHaveLength(0);
    await settle(WARMUP_DECIDE_MS + 50);
    expect(stepCounter(screenTexts(slow.r.root))).toBe(`1 / ${quest.steps.length}`);
  });

  it('a quest that resumes past its first step gets none', async () => {
    gate.warm = true;
    gate.warmPlan = plan('warmup');
    const { r } = await player(2);
    expect(byTestId(r.root, 'session-warmup')).toHaveLength(0);
    expect(stepCounter(screenTexts(r.root))).toBe(`3 / ${quest.steps.length}`);
  });

  it('the All lessons preview (no learner) never gets one', async () => {
    gate.warm = true;
    gate.warmPlan = plan('warmup');
    const { r } = await player(0, null);
    expect(byTestId(r.root, 'session-warmup')).toHaveLength(0);
    expect(gate.loads).toBe(0);
  });
});

describe('Try these again on the reward step', () => {
  it('with misses it is the default suggestion and See results stays right under it; it plans from the misses of this play', async () => {
    gate.again = true;
    gate.againPlan = plan('again');
    const { r, ports } = await toReward(true);
    expect(gate.missedSeen).toEqual([{ texts: ['물'] }]);
    const [tryAgain] = buttonsNamed(r.root, T.cta);
    expect(tryAgain).toBeDefined();
    expect(screenTexts(r.root)).toContain(T.intro);
    expect(buttonsNamed(r.root, Q.seeResults.cta)).not.toHaveLength(0);
    await press(tryAgain!);
    // The quest finishes first, with its own score (0 of 1), so Results writes it before Try these again plays there:
    // closing the app during the session never loses the quest, its stars or its card.
    expect(ports.finish).toHaveBeenCalledTimes(1);
    expect(ports.finish.mock.calls[0]![0]).toMatchObject({ correct: 0, total: 1 });
    expect(gate.handed).toEqual([expect.objectContaining({ questId: quest.id, profileId: 'profile:mina', plan: gate.againPlan })]);
    expect(byTestId(r.root, 'session-again')).toHaveLength(0);
  });

  it('the player starts loading the sessions while the lesson loads, for its learner only', async () => {
    await player(0);
    await player(0, null);
    expect(gate.preloads).toEqual(['profile:mina', null]);
  });

  it('See results skips it and finishes the quest as always', async () => {
    gate.again = true;
    gate.againPlan = plan('again');
    const { r, ports } = await toReward(true);
    expect(buttonsNamed(r.root, T.cta)).not.toHaveLength(0);
    await press(buttonsNamed(r.root, Q.seeResults.cta)[0]!);
    expect(ports.finish).toHaveBeenCalledTimes(1);
    expect(gate.handed).toEqual([]);
  });

  it('without a miss, with missedPractice off, or when no miss can be asked, the reward step is the one it always was', async () => {
    gate.again = true;
    gate.againPlan = plan('again');
    const clean = await toReward(false);
    expect(buttonsNamed(clean.r.root, T.cta)).toHaveLength(0);
    expect(gate.loads).toBe(0);
    gate.again = false;
    const off = await toReward(true);
    expect(buttonsNamed(off.r.root, T.cta)).toHaveLength(0);
    expect(gate.loads).toBe(0);
    gate.again = true;
    gate.againPlan = null;
    const none = await toReward(true);
    expect(buttonsNamed(none.r.root, T.cta)).toHaveLength(0);
    expect(buttonsNamed(none.r.root, Q.seeResults.cta)).not.toHaveLength(0);
  });

  it('a slow plan holds the buttons a moment at most, then the reward step shows See results', async () => {
    gate.again = true;
    gate.hold = true;
    const { r } = await toReward(true);
    expect(byTestId(r.root, 'quest-try-again-deciding')).not.toHaveLength(0);
    expect(buttonsNamed(r.root, Q.seeResults.cta)).toHaveLength(0);
    await settle(TRY_AGAIN_DECIDE_MS + 50);
    expect(byTestId(r.root, 'quest-try-again-deciding')).toHaveLength(0);
    expect(buttonsNamed(r.root, Q.seeResults.cta)).not.toHaveLength(0);
  });
});
