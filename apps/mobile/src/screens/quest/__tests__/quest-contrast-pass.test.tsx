import { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { questById } from '../../../content';
import { useLocaleStore } from '../../../store/locale-store';
import { useProfileStore } from '../../../store/profile-store';
import { setFirstRoundAnswerListener, useQuestRunStore } from '../../../store/quest-run-store';
import { buttonsNamed, press, render, screenTexts, unmount } from '../../../test-support/render';
import { QuestPlayerView } from '../QuestPlayerView';

/**
 * [MP] AMENDMENTS-MINIMAL-PAIRS section 3.6 and 3.8, row MP-2b, in the quest player: a contrast step with nothing to play
 * is passed by (on Next, on Previous, on a resumed run), after the pack wait, without a mark on the run; one that plays is
 * a step like another, but never a score, a cap or an answer.
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

/** What the contrast chunk says: the real chunk reads the catalogue (no set approved), this one is told. */
const kit = vi.hoisted(() => ({ playable: false, failLoad: false, calls: 0, order: [] as string[] }));
vi.mock('../../minigames/contrast-entry', () => ({
  loadContrastKit: () => {
    kit.order.push('kit');
    return kit.failLoad
      ? Promise.reject(new Error('offline'))
      : Promise.resolve({
          contrastStepPlayable: () => {
            kit.calls += 1;
            return kit.playable;
          },
        });
  },
}));
vi.mock('../../../platform/audio-assets-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../platform/audio-assets-store')>();
  return {
    ...actual,
    waitForClipPacks: () => {
      kit.order.push('wait');
      return Promise.resolve();
    },
  };
});

/** Which sets the start bundle says are approved (`contrast-approved.ts`, empty today), and how many blank waiting frames were drawn. */
const start = vi.hoisted(() => ({ ids: [] as string[], waiting: 0 }));
vi.mock('../../../content/__generated__/contrast-approved', () => ({
  get CONTRAST_APPROVED_SET_IDS() {
    return start.ids;
  },
}));
vi.mock('../../lesson-content', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lesson-content')>();
  const { createElement } = await import('react');
  return {
    ...actual,
    LessonWaiting: () => {
      start.waiting += 1;
      return createElement(actual.LessonWaiting);
    },
  };
});

const QUEST = questById('quest:stage1-life-q3')!;
const at = (id: string): number => QUEST.steps.findIndex((s) => s.id === id);
const PRACTICE = at('s3');
const CONTRAST = at('s3p');
const APPLY = at('s4');
const CHECK = at('s5');
const mounted: ReactTestRenderer[] = [];

async function settle(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 6; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function playerAt(step: number) {
  const ports = { start: () => step, end: vi.fn(), finish: vi.fn(), leave: vi.fn(), track: vi.fn() };
  const r = await render(
    <QuestPlayerView questId={QUEST.id} episodeId="episode:stage1-life" ports={ports} onOpenGame={() => undefined} onBack={() => undefined} reviewsFor={null} />,
  );
  mounted.push(r);
  await settle();
  return { r, ports };
}

async function tap(r: ReactTestRenderer, label: string): Promise<void> {
  await press(buttonsNamed(r.root, label)[0]!);
  await settle();
}
const run = () => useQuestRunStore.getState();

/** A game played through: `right` of `rounds` first tries, then the game ends and the player comes back to the quest. */
async function playGame(right: number, rounds: number): Promise<void> {
  await act(async () => {
    for (let i = 0; i < rounds; i += 1) run().answerRound(i, i < right);
    run().markStepComplete();
    run().consumePendingAdvance();
  });
  await settle();
}

beforeEach(() => {
  start.ids = ['ga-ka', 'da-ta'];
  start.waiting = 0;
  kit.playable = false;
  kit.failLoad = false;
  kit.calls = 0;
  kit.order = [];
  useProfileStore.setState({ profiles: [], activeId: null });
  useLocaleStore.setState({ device: 'en' });
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  setFirstRoundAnswerListener(null);
  run().reset();
});

describe('[MP] a contrast step with none of its sets approved is passed by at once (row MP-2b)', () => {
  beforeEach(() => {
    start.ids = [];
  });

  it('goes from Match Sound to the apply step with no clip wait, no chunk and no waiting frame', async () => {
    const { r } = await playerAt(PRACTICE);
    start.waiting = 0;
    await playGame(6, 6);
    expect(run().stepIndex).toBe(APPLY);
    expect(run().skippedSteps).toEqual([]);
    expect(run().furthestStep).toBe(APPLY);
    expect(screenTexts(r.root).join(' | ')).toContain(QUEST.steps[APPLY]!.titleEn);
    expect(kit.order).toEqual([]);
    expect(kit.calls).toBe(0);
    expect(start.waiting).toBe(0);
  });

  it('is passed by at once on Previous and on a resumed run too', async () => {
    const back = await playerAt(APPLY);
    start.waiting = 0;
    await tap(back.r, 'Previous');
    expect(run().stepIndex).toBe(PRACTICE);
    await tap(back.r, 'Continue');
    expect(run().stepIndex).toBe(APPLY);
    await unmount(mounted.pop()!);
    run().reset();
    const resumed = await playerAt(CONTRAST);
    expect(run().stepIndex).toBe(APPLY);
    expect(screenTexts(resumed.r.root).join(' | ')).toContain(QUEST.steps[APPLY]!.titleEn);
    expect(kit.order).toEqual([]);
    expect(start.waiting).toBe(0);
  });

  it('a set that is approved (the fixture build) takes the wait and the chunk, as before', async () => {
    start.ids = ['da-ta'];
    kit.playable = true;
    await playerAt(PRACTICE);
    await playGame(6, 6);
    expect(run().stepIndex).toBe(CONTRAST);
    expect(kit.order).toEqual(['wait', 'kit']);
  });
});

describe('[MP] a contrast step with an approved set but nothing to play is passed by after the wait (row MP-2b)', () => {
  it('the quest under test: Match Sound, the contrast step, What Does It Mean?, the Check', () => {
    expect([PRACTICE, CONTRAST, APPLY, CHECK]).toEqual([2, 3, 4, 5]);
    expect(QUEST.steps[CONTRAST]).toMatchObject({ contrast: true, titleEn: 'Hear the Puff' });
  });

  it('goes from Match Sound straight to the apply step: no screen for it, not skipped, its dot filled, the pack wait first', async () => {
    const { r } = await playerAt(PRACTICE);
    await playGame(6, 6);
    expect(run().stepIndex).toBe(APPLY);
    expect(run().skippedSteps).toEqual([]);
    expect(run().furthestStep).toBe(APPLY);
    expect(screenTexts(r.root).join(' | ')).toContain(QUEST.steps[APPLY]!.titleEn);
    expect(screenTexts(r.root).join(' | ')).not.toContain('Hear the Puff');
    // The packs are waited for, then the chunk is asked (never the other way round).
    expect(kit.order).toEqual(['wait', 'kit']);
  });

  it('on Previous from the apply step it goes back past the step to Match Sound, and Next goes forward past it again', async () => {
    const { r } = await playerAt(APPLY);
    await tap(r, 'Previous');
    expect(run().stepIndex).toBe(PRACTICE);
    expect(run().skippedSteps).toEqual([]);
    // Match Sound is a step shown again now (Continue); Next from it goes past the contrast step to the apply step.
    await tap(r, 'Continue');
    expect(run().stepIndex).toBe(APPLY);
    expect(run().skippedSteps).toEqual([]);
  });

  it('a resumed run that opens on the step moves on to the apply step', async () => {
    const { r } = await playerAt(CONTRAST);
    expect(run().stepIndex).toBe(APPLY);
    expect(screenTexts(r.root).join(' | ')).toContain(QUEST.steps[APPLY]!.titleEn);
  });

  it('passes the step by when the chunk cannot load', async () => {
    kit.failLoad = true;
    await playerAt(PRACTICE);
    await playGame(6, 6);
    expect(run().stepIndex).toBe(APPLY);
  });

  it('the stars are what they are without the step: the same tally, stars and cap as a quest that never had it', async () => {
    const { r, ports } = await playerAt(PRACTICE);
    await playGame(6, 6);
    await playGame(4, 4);
    await playGame(2, 2);
    await tap(r, 'See results');
    expect(ports.finish).toHaveBeenCalledWith({ stars: 3, correct: 12, total: 12, played: true, retries: 0 });
  });
});

describe('[MP] a contrast step that plays is a step, and never a score (row MP-2b)', () => {
  beforeEach(() => {
    kit.playable = true;
  });

  it('shows its launcher with the step title; Skip for now moves on, is not a cap and is not scored', async () => {
    const { r, ports } = await playerAt(PRACTICE);
    await playGame(6, 6);
    expect(run().stepIndex).toBe(CONTRAST);
    expect(screenTexts(r.root).join(' | ')).toContain('Hear the Puff');
    expect(buttonsNamed(r.root, 'Play minigame')).toHaveLength(1);
    await tap(r, 'Skip for now');
    expect(run().stepIndex).toBe(APPLY);
    await playGame(4, 4);
    await playGame(2, 2);
    await tap(r, 'See results');
    // `markStepSkipped` notes the step, the cap leaves it out: three stars with the practice and the apply played in full.
    expect(ports.finish).toHaveBeenCalledWith({ stars: 3, correct: 12, total: 12, played: true, retries: 0 });
  });

  it('a played contrast step with every answer wrong ends with the same tally and nothing reaching the memory listener', async () => {
    const heard: unknown[] = [];
    setFirstRoundAnswerListener((a) => heard.push(a));
    const { r, ports } = await playerAt(PRACTICE);
    await playGame(6, 6);
    const before = { correct: run().correctCount, total: run().totalCount, tries: run().tries.length };
    // The game reports no answer for a contrast round (`scored: false`), so a played step changes no count; it completes.
    await act(async () => {
      run().markStepComplete();
      run().consumePendingAdvance();
    });
    await settle();
    expect(run().stepIndex).toBe(APPLY);
    expect({ correct: run().correctCount, total: run().totalCount, tries: run().tries.length }).toEqual(before);
    expect(heard).toEqual([]);
    await playGame(4, 4);
    await playGame(2, 2);
    await tap(r, 'See results');
    expect(ports.finish).toHaveBeenCalledWith({ stars: 3, correct: 12, total: 12, played: true, retries: 0 });
  });

  it('shows the step again after Previous, with Continue and Play again, and decides again on each entry', async () => {
    const { r } = await playerAt(APPLY);
    await tap(r, 'Previous');
    expect(run().stepIndex).toBe(CONTRAST);
    expect(buttonsNamed(r.root, 'Continue')).toHaveLength(1);
    expect(buttonsNamed(r.root, 'Play again')).toHaveLength(1);
    const first = kit.calls;
    await tap(r, 'Continue');
    await tap(r, 'Previous');
    expect(run().stepIndex).toBe(CONTRAST);
    expect(kit.calls).toBeGreaterThan(first);
    // A step that cannot play now is passed by on the way back too.
    kit.playable = false;
    await tap(r, 'Continue');
    await tap(r, 'Previous');
    expect(run().stepIndex).toBe(PRACTICE);
  });
});
