import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { questById } from '../../../content';
import { shortenScope } from '../../../logic/quest-flow/quest-adapt';
import { scopeFor } from '../../../logic/minigame-config';
import { useQuestRunStore } from '../../../store/quest-run-store';
import { render, screenTexts } from '../../../test-support/render';
import { MinigameScreen } from '../MinigameScreen';

/**
 * F-CURR-002 section 4.6 (row CM-24) on the game screen: an Apply the run marks shorter plays the run's shorter scope
 * (one round less); every other step, another quest's run and a run with nothing marked play the scope as built.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock('../../../platform/telemetry', () => ({ track: () => Promise.resolve() }));
vi.mock('@react-navigation/native', async () => {
  const { createContext, useEffect } = await import('react');
  return {
    NavigationContext: createContext(undefined),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    useNavigation: () => ({ goBack: () => undefined, navigate: () => undefined }),
  };
});
vi.mock('../TraceStrokeGame', () => ({ TraceStrokeGame: () => null }));
vi.mock('../TraceWordGame', () => ({ TraceWordGame: () => null }));
vi.mock('../../use-practice-session', () => ({ usePracticeSession: () => undefined }));

const QUEST = questById('quest:stage3-letters-q1')!;
const APPLY = QUEST.steps.findIndex((s) => s.kind === 'apply');
const EPISODE = 'episode:stage3-letters';
const full = scopeFor(QUEST.steps[APPLY]!.minigameRef!)!;

async function game(stepIndex: number) {
  const r = await render(<MinigameScreen route={{ params: { questId: QUEST.id, episodeId: EPISODE, stepIndex } }} navigation={{ goBack: () => undefined, push: () => undefined } as never} />);
  return screenTexts(r.root).find((t) => /^\d+ \/ \d+$/.test(t));
}

afterEach(() => useQuestRunStore.getState().reset());

describe('the shorter Apply', () => {
  it('plays one round less when the run marks this step', async () => {
    expect(full.kind).toBe('listen-pick');
    const rounds = full.listenPick!.rounds.length;
    useQuestRunStore.getState().beginQuest(QUEST.id, EPISODE, APPLY);
    useQuestRunStore.setState({ short: { step: APPLY, scope: shortenScope(full)! } });
    expect(await game(APPLY)).toBe(`1 / ${rounds - 1}`);
  });

  it('plays the scope as built otherwise', async () => {
    const rounds = full.listenPick!.rounds.length;
    useQuestRunStore.getState().beginQuest(QUEST.id, EPISODE, APPLY);
    expect(await game(APPLY)).toBe(`1 / ${rounds}`);
    useQuestRunStore.getState().beginQuest('quest:stage3-letters-q2', EPISODE, APPLY);
    useQuestRunStore.setState({ short: { step: APPLY, scope: shortenScope(full)! } });
    expect(await game(APPLY)).toBe(`1 / ${rounds}`);
  });
});
