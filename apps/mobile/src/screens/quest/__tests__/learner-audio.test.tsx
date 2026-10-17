import type { DiscoverPage } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import React from 'react';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { episodesAll } from '../../../content/episodes';
import { questsAll } from '../../../content/quests';
import { useAudioStore } from '../../../store/audio-store';
import { useQuestRunStore } from '../../../store/quest-run-store';
import { KO_VOICE, createAudioRig, type AudioRig } from '../../../test-support/audio-rig';
import { buttonsNamed, byTestId, press, render, textOf, unmount } from '../../../test-support/render';
import { DiscoverStep } from '../DiscoverStep';
import { QuestPlayerView } from '../QuestPlayerView';

/**
 * Discover and the quest player through the shipped web audio adapter over FakeSpeechSynthesis
 * (F-AUDIO-004 §3.5, §3.8, A-5b): a speak the browser drops (no gesture, iOS) shows "Tap to hear" on
 * the item; a new step and leaving the quest stop the voice.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const rig = vi.hoisted(() => ({ current: null as AudioRig | null, stops: 0 }));
vi.mock('../../../platform/audio', async (importOriginal) => {
  const bound = (await import('../../../test-support/audio-rig')).rigAudio(() => rig.current!);
  return {
    ...(await importOriginal<object>()),
    ...bound,
    stop: () => {
      rig.stops += 1;
      bound.stop();
    },
  };
});
const events = vi.hoisted(() => [] as Array<{ name: string; payload?: unknown }>);
vi.mock('../../../platform/telemetry', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  track: vi.fn(async (event: { name: string; payload?: unknown }) => {
    events.push(event);
  }),
}));
// The native navigation package has no build that loads in Node: the player's focus effect runs once.
vi.mock('@react-navigation/native', async () => {
  const { createContext, useEffect } = await import('react');
  return {
    NavigationContext: createContext(undefined),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    useNavigation: () => ({ goBack: () => undefined, navigate: () => undefined }),
  };
});

const AUDIO = getMessages('en').learner.audio;
const mounted: ReactTestRenderer[] = [];

beforeEach(() => {
  events.length = 0;
  rig.stops = 0;
  useAudioStore.setState({ muted: false });
});

afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  useQuestRunStore.getState().reset();
});

const pressable = (root: ReactTestInstance, id: string): ReactTestInstance => {
  const node = byTestId(root, id).find((n) => typeof n.props.onClick === 'function');
  if (!node) throw new Error(`no pressable ${id}`);
  return node;
};

const WORD_PAGE: DiscoverPage = { items: [{ type: 'word', word: { ko: '나무', romanization: 'namu', en: 'tree' } }] };

describe('DiscoverStep: a Hear it the browser drops (blocked)', () => {
  it('shows Tap to hear on that item, and the tap plays it', async () => {
    rig.current = createAudioRig({ voices: [KO_VOICE], requireGesture: true });
    const r = await render(<DiscoverStep pages={[WORD_PAGE]} onDone={() => undefined} />);
    mounted.push(r);
    await press(pressable(r.root, 'discover-hear-word:나무|sound'));
    // The voice never starts: the controller gives up after its start timeout (1.5 s) and reports `blocked`.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1700));
    });
    expect(rig.current.synth.dropped.map((u) => u.text)).toEqual(['나무']);
    const panel = byTestId(r.root, 'discover-sound-word:나무')[0]!;
    const [tap] = buttonsNamed(panel, AUDIO.action.tap_to_hear.cta);
    expect(tap).toBeDefined();
    expect(events.filter((e) => e.name === 'audio.fallback_shown').map((e) => e.payload)).toEqual([{ source: 'discover', reason: 'blocked' }]);
    // The item keeps its "say it" line; nothing else changes and Continue stays enabled.
    expect(textOf(byTestId(r.root, 'discover-item-word:나무')[0]!)).toContain('namu');

    // The tap is a gesture: the voice now plays.
    rig.current.synth.markUserGesture();
    await press(tap!);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(rig.current.synth.spoken.map((u) => [u.text, u.lang])).toEqual([['나무', 'ko-KR']]);
  });

  it('leaving the step stops the voice', async () => {
    rig.current = createAudioRig({ voices: [KO_VOICE] });
    const r = await render(<DiscoverStep pages={[WORD_PAGE]} onDone={() => undefined} />);
    mounted.splice(0);
    expect(rig.stops).toBe(0);
    await unmount(r);
    expect(rig.stops).toBe(1);
  });
});

const episodeOf = (questId: string): string => episodesAll.find((e) => e.questIds.includes(questId))?.id ?? 'episode:none';

describe('QuestPlayerView: a new step stops the voice', () => {
  const quest = questsAll.find((q) => q.steps.length >= 3 && q.steps[1]!.kind !== 'discover' && q.steps[2]!.kind !== 'discover');

  it('calls stop() when the step changes and when the player leaves', async () => {
    if (!quest) throw new Error('a quest with two steps after the first ships');
    rig.current = createAudioRig({ voices: [KO_VOICE] });
    const ports = { start: () => 1, end: vi.fn(), finish: vi.fn(), leave: vi.fn(), track: vi.fn() };
    const r = await render(
      <QuestPlayerView questId={quest.id} episodeId={episodeOf(quest.id)} ports={ports} onOpenGame={() => undefined} onBack={() => undefined} />,
    );
    expect(useQuestRunStore.getState().stepIndex).toBe(1);
    const before = rig.stops;
    await act(async () => {
      useQuestRunStore.getState().goNextStep();
    });
    expect(useQuestRunStore.getState().stepIndex).toBe(2);
    expect(rig.stops).toBe(before + 1);
    await unmount(r);
    expect(rig.stops).toBe(before + 2);
  });
});
