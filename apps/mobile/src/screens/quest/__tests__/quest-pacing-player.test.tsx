import { getMessages } from '@hangul-route/i18n';
import React from 'react';
import { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { questById } from '../../../content';
import { scopeFor } from '../../../logic/minigame-config';
import { resetQuestAdaptForTests } from '../../../logic/quest-flow/quest-adapt';
import { setFirstRoundAnswerListener, useQuestRunStore, type FirstRoundAnswer } from '../../../store/quest-run-store';
import { useRemoteConfigStore } from '../../../store/remote-config-store';
import { byTestId, press, render, screenTexts } from '../../../test-support/render';
import { QuestPlayerView } from '../QuestPlayerView';
import { questPacingChunk, resetQuestPacingChunkForTests } from '../quest-pacing';

/**
 * F-CURR-002 section 4.6 (row CM-24) in the quest player, with the real pacing chunk: a strong Practice makes the
 * next quest of the cell compact (the second Discover page on one card, Apply one round shorter), a hard Practice
 * plays one scaffold round before Apply. The steps, the step counter and the score are the quest's own throughout,
 * and with `questAdapt` off every quest plays its standard path.
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
const Q2 = questById('quest:stage2-nature-q2')!;
const PRACTICE = Q1.steps.findIndex((s) => s.kind === 'practice');
const PROFILE = 'profile:mina';

const settle = async (ms = 0): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
};

function adaptOn(on: boolean): void {
  useRemoteConfigStore.setState({ hydrated: true, cache: { v: 1, fetchedAt: 0, maxAgeS: 300, flags: { questAdapt: { on, pct: 100 } } } });
}

async function player(questId: string, step: number, reviewsFor: string | null = PROFILE) {
  const ports = { start: () => step, end: vi.fn(), finish: vi.fn(), leave: vi.fn(), track: vi.fn() };
  const r = await render(<QuestPlayerView questId={questId} episodeId={CELL} ports={ports} onOpenGame={() => undefined} onBack={() => undefined} reviewsFor={reviewsFor} />);
  // The chunk loads as the run begins (a moment in the app, a module transform here).
  await act(async () => {
    await questPacingChunk();
  });
  await settle();
  return { r, ports };
}

/** The Pic-Word Practice of quest 1, answered as the game does: `wrong` first-try misses among its six pairs, then on. */
async function playPractice(wrong: number): Promise<void> {
  expect(useQuestRunStore.getState().stepIndex).toBe(PRACTICE);
  const ids = ['haneul', 'byeol', 'namu', 'san', 'dal', 'bada'];
  await act(async () => {
    const scope = scopeFor(Q1.steps[PRACTICE]!.minigameRef!)!;
    ids.forEach((id, i) => useQuestRunStore.getState().answerRound(`pair:${i}`, i >= wrong, { scope, itemId: id }));
    useQuestRunStore.getState().goNextStep();
  });
  await settle();
}

const counter = (texts: string[]): string | undefined => texts.find((t) => /^\d+ \/ \d+$/.test(t));
const adaptEvents = (track: ReturnType<typeof vi.fn>) => track.mock.calls.map(([e]) => e).filter((e: { name: string }) => e.name === 'quest.adapt');

beforeEach(() => {
  resetQuestAdaptForTests();
  resetQuestPacingChunkForTests();
  useQuestRunStore.getState().reset();
  adaptOn(true);
});
afterEach(() => {
  setFirstRoundAnswerListener(null);
  useQuestRunStore.getState().reset();
  useRemoteConfigStore.setState({ hydrated: false, cache: null });
});

describe('a strong Practice: the next quest of the cell is compact', () => {
  it('draws the second Discover page on one card, each word with its Hear it, and Continue at once', async () => {
    const first = await player(Q1.id, PRACTICE);
    await playPractice(0);
    // 6 of 6 is strong; quest 1 itself plays on as it was: no scaffold, the counter on Apply.
    expect(counter(screenTexts(first.r.root))).toBe(`${PRACTICE + 2} / ${Q1.steps.length}`);
    expect(adaptEvents(first.ports.track)).toEqual([]);

    const second = await player(Q2.id, 1);
    const page2 = Q2.steps[1]!.discover!.pages[1]!;
    expect(byTestId(second.r.root, 'discover-compact')).toHaveLength(0);
    await press(byTestId(second.r.root, 'discover-continue')[0]!);
    const [card] = byTestId(second.r.root, 'discover-compact');
    expect(card).toBeDefined();
    const shown = screenTexts(card!);
    expect(shown).toContain(EN.learner.quest.discover.compactLine);
    for (const item of page2.items) expect(shown.join(' ')).toContain(item.type === 'word' ? item.word.ko : '');
    const hears = card!.findAll((n) => typeof n.type === 'string' && /^discover-hear-.*\|sound$/.test(String(n.props['data-testid'] ?? '')));
    expect(hears).toHaveLength(2);
    const [cont] = byTestId(second.r.root, 'discover-continue');
    expect(cont!.props['aria-disabled']).not.toBe(true);
    // The step counter is the quest's own, and the compact pace is reported once.
    expect(counter(screenTexts(second.r.root))).toBe(`2 / ${Q2.steps.length}`);
    expect(adaptEvents(second.ports.track)).toEqual([{ name: 'quest.adapt', payload: { questId: Q2.id, dir: 'compact' } }]);
  });

  it('plays its Apply one round shorter: the run carries the shorter scope for the game screen', async () => {
    await player(Q1.id, PRACTICE);
    await playPractice(0);
    await player(Q2.id, 0);
    const apply = Q2.steps.findIndex((s) => s.kind === 'apply');
    const short = useQuestRunStore.getState().short;
    expect(short?.step).toBe(apply);
    expect(short?.scope.cardPairs).toHaveLength(3);
  });

  it('never makes the quest itself, an earlier quest, another learner or the off switch compact', async () => {
    await player(Q2.id, PRACTICE);
    await playPractice(0);
    const earlier = await player(Q1.id, 1);
    await press(byTestId(earlier.r.root, 'discover-continue')[0]!);
    expect(byTestId(earlier.r.root, 'discover-compact')).toHaveLength(0);
    expect(useQuestRunStore.getState().short).toBeNull();

    resetQuestAdaptForTests();
    await player(Q1.id, PRACTICE);
    await playPractice(0);
    const other = await player(Q2.id, 1, 'profile:jun');
    await press(byTestId(other.r.root, 'discover-continue')[0]!);
    expect(byTestId(other.r.root, 'discover-compact')).toHaveLength(0);

    adaptOn(false);
    const off = await player(Q2.id, 1);
    await press(byTestId(off.r.root, 'discover-continue')[0]!);
    expect(byTestId(off.r.root, 'discover-compact')).toHaveLength(0);
    expect(adaptEvents(off.ports.track)).toEqual([]);
  });

  it('5 of 6 right (83%) is not strong', async () => {
    await player(Q1.id, PRACTICE);
    await playPractice(1);
    resetQuestAdaptForTests();
    await player(Q1.id, PRACTICE);
    await act(async () => {
      for (let i = 0; i < 6; i += 1) useQuestRunStore.getState().answerRound(`p${i}`, i !== 2);
      useQuestRunStore.getState().goNextStep();
    });
    const second = await player(Q2.id, 1);
    await press(byTestId(second.r.root, 'discover-continue')[0]!);
    expect(byTestId(second.r.root, 'discover-compact')).toHaveLength(0);
  });
});

describe('a hard Practice: one scaffold round before Apply', () => {
  it('two first-try misses play one Listen & Pick round of the same items with the hint showing, outside the score', async () => {
    const heard: FirstRoundAnswer[] = [];
    setFirstRoundAnswerListener((a) => heard.push(a));
    const { r, ports } = await player(Q1.id, PRACTICE);
    await playPractice(2);
    const before = { ...useQuestRunStore.getState() };
    heard.length = 0;
    // The round: its hint line, the right card ringed ("Look here"), no step counter; nothing about speed.
    expect(screenTexts(r.root)).toContain(EN.learner.quest.adapt.scaffoldHint);
    expect(counter(screenTexts(r.root))).toBe('1 / 1');
    const options = r.root.findAll((n) => typeof n.type === 'string' && /^listen-pick-option-o\d$/.test(String(n.props['data-testid'] ?? '')));
    expect(options.length).toBeGreaterThanOrEqual(2);
    const labels = options.map((o) => String(o.props['aria-label'] ?? ''));
    expect(labels.filter((l) => l.startsWith('Look here'))).toHaveLength(1);
    // The last miss (별) is asked; the first miss (하늘) is an option.
    expect(labels.find((l) => l.startsWith('Look here'))).toContain('별');
    expect(labels.some((l) => l.includes('하늘'))).toBe(true);
    expect(adaptEvents(ports.track)).toEqual([{ name: 'quest.adapt', payload: { questId: Q1.id, dir: 'scaffold' } }]);

    const ringed = options.find((o) => String(o.props['aria-label']).startsWith('Look here'))!;
    await press(ringed);
    await settle(800);
    // Recorded with the hint, as the memory store records every round; the quest's score and steps are untouched.
    expect(heard).toMatchObject([{ questId: Q1.id, episodeId: CELL, correct: true, hinted: true, asked: { itemId: 'scaffold:1' } }]);
    const after = useQuestRunStore.getState();
    expect([after.correctCount, after.totalCount, after.stepIndex, after.tries.length]).toEqual([before.correctCount, before.totalCount, before.stepIndex, before.tries.length]);
    expect(screenTexts(r.root)).not.toContain(EN.learner.quest.adapt.scaffoldHint);
    expect(counter(screenTexts(r.root))).toBe(`${PRACTICE + 2} / ${Q1.steps.length}`);
  });

  it('one miss, a skipped Practice, the off switch or no learner: Apply comes next as always', async () => {
    for (const run of [
      async () => playPractice(1),
      async () => {
        await act(async () => useQuestRunStore.getState().goNextStep());
        await settle();
      },
    ]) {
      const { r, ports } = await player(Q1.id, PRACTICE);
      await run();
      expect(screenTexts(r.root)).not.toContain(EN.learner.quest.adapt.scaffoldHint);
      expect(adaptEvents(ports.track)).toEqual([]);
    }
    adaptOn(false);
    const off = await player(Q1.id, PRACTICE);
    await playPractice(3);
    expect(screenTexts(off.r.root)).not.toContain(EN.learner.quest.adapt.scaffoldHint);
    adaptOn(true);
    const preview = await player(Q1.id, PRACTICE, null);
    await playPractice(3);
    expect(screenTexts(preview.r.root)).not.toContain(EN.learner.quest.adapt.scaffoldHint);
  });
});
