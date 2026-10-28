import type { Quest } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import type { ReactTestRenderer } from 'react-test-renderer';
import { act } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MinigameScope } from '../../../logic/minigame-config';
import { resetRemoteConfigForTests, useRemoteConfigStore } from '../../../store/remote-config-store';
import { byTestId, render, screenTexts, unmount } from '../../../test-support/render';
import { MinigameScreen } from '../MinigameScreen';

/**
 * F-CURR-002 sections 12.2 and 14 (row CM-35, review fix): with `game.role-play` off every quest renders. Through the
 * real MinigameScreen, one step of every kind the shipped quests play, and a role-play step (no shipped cell has one
 * until the Stage 4 and pack rows; the fixture scene stands in), each draws its game, never the coming-soon or
 * not-found page. A role-play step waits (the calm waiting line) until the stored copy is read, then plays Tap to
 * Respond on the same turns with the switch off, and Role Play with it on.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock('../../../platform/telemetry', () => ({ track: () => Promise.resolve() }));
// The native navigation package has no build that loads in Node: the focus effects run once, every screen is focused.
vi.mock('@react-navigation/native', async () => {
  const { createContext, useEffect } = await import('react');
  return {
    NavigationContext: createContext(undefined),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    useIsFocused: () => true,
    useNavigation: () => ({ goBack: () => undefined, navigate: () => undefined, push: () => undefined }),
  };
});
// The stroke games draw with the native gesture handler, which has no build that loads in Node: a stand-in marks them drawn.
vi.mock('../TraceStrokeGame', async () => {
  const { View } = await import('react-native');
  return { TraceStrokeGame: () => <View testID="trace-stroke-stand-in" /> };
});
vi.mock('../TraceWordGame', async () => {
  const { View } = await import('react-native');
  return { TraceWordGame: () => <View testID="trace-word-stand-in" /> };
});
vi.mock('../../use-practice-session', () => ({ usePracticeSession: () => undefined }));

const fixture = vi.hoisted(() => ({ questId: 'quest:role-play-switch', ref: 'mg:role-play-switch' }));
vi.mock('../../../content', async (orig) => {
  const real = await orig<typeof import('../../../content')>();
  const quest: Quest = {
    id: fixture.questId,
    titleEn: 'At the library',
    estimatedMinutes: 4,
    steps: [{ id: 's1', kind: 'apply', titleEn: 'Talk at the desk', minigameKind: 'role-play', minigameRef: fixture.ref }],
    rewardCardId: 'card:book',
  };
  return { ...real, questById: (id: string) => (id === fixture.questId ? quest : real.questById(id)) };
});
vi.mock('../../../logic/minigame-config', async (orig) => {
  const real = await orig<typeof import('../../../logic/minigame-config')>();
  const { LIBRARY_SCENE: scene } = await import('@hangul-route/content-schema/testing/role-play');
  const scope: MinigameScope = { kind: 'role-play', rounds: 4, rolePlay: { scene } };
  return { ...real, scopeFor: (ref: string) => (ref === fixture.ref ? scope : real.scopeFor(ref)) };
});

const copy = getMessages('en').learner.minigame;
const OFF = { v: 1 as const, fetchedAt: Date.now(), maxAgeS: 300, flags: { 'game.role-play': { on: false, pct: 0 } } };
const ON = { ...OFF, flags: { 'game.role-play': { on: true, pct: 100 } } };
/** The fixture scene's first partner line (`LIBRARY_SCENE`, turn 1). */
const FIRST_LINE = '안녕하세요!';
const nodeMock = () => ({ focus: () => undefined, scrollTo: () => undefined, scrollToEnd: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined });

const open = (questId: string, stepIndex = 0): Promise<ReactTestRenderer> =>
  render(<MinigameScreen route={{ params: { questId, episodeId: 'e', stepIndex } }} onBack={() => undefined} />, { createNodeMock: nodeMock });

afterEach(() => {
  resetRemoteConfigForTests();
});

describe('game.role-play off: every quest renders (sections 12.2 and 14, row CM-35)', () => {
  it('one step of every kind the shipped quests play, and a role-play step, draws a game: never coming soon or not found', async () => {
    const { questsAll } = await vi.importActual<typeof import('../../../content')>('../../../content');
    const { scopeFor } = await vi.importActual<typeof import('../../../logic/minigame-config')>('../../../logic/minigame-config');
    useRemoteConfigStore.setState({ cache: OFF, hydrated: true });
    const byKind = new Map<string, [string, number]>();
    for (const quest of questsAll) {
      quest.steps.forEach((step, i) => {
        const kind = step.minigameRef === undefined ? undefined : scopeFor(step.minigameRef)?.kind;
        if (kind !== undefined && !byKind.has(kind)) byKind.set(kind, [quest.id, i]);
      });
    }
    byKind.set('role-play', [fixture.questId, 0]);
    expect(byKind.size).toBeGreaterThan(10);
    for (const [kind, [questId, stepIndex]] of byKind) {
      const where = `${kind} (${questId} step ${stepIndex})`;
      const r = await open(questId, stepIndex);
      const shown = screenTexts(r.root);
      expect(shown, where).not.toContain(copy.comingSoon);
      expect(shown, where).not.toContain(copy.notFound);
      expect(byTestId(r.root, 'lesson-waiting'), where).toHaveLength(0);
      expect(byTestId(r.root, 'role-play'), where).toHaveLength(0);
      await unmount(r);
    }
  });

  it('a role-play step waits for the stored copy, then plays Tap to Respond on the same turns, and keeps it for the step', async () => {
    const r = await open(fixture.questId);
    expect(byTestId(r.root, 'lesson-waiting')).toHaveLength(1);
    expect(byTestId(r.root, 'tap-respond-hear')).toHaveLength(0);
    await act(async () => {
      useRemoteConfigStore.setState({ cache: OFF, hydrated: true });
    });
    expect(byTestId(r.root, 'lesson-waiting')).toHaveLength(0);
    expect(byTestId(r.root, 'role-play')).toHaveLength(0);
    expect(byTestId(r.root, 'tap-respond-hear').length).toBeGreaterThan(0);
    expect(screenTexts(r.root)).toContain(FIRST_LINE);
    // A copy that arrives mid-step never swaps the game: the step keeps the answer it read.
    await act(async () => {
      useRemoteConfigStore.setState({ cache: ON });
    });
    expect(byTestId(r.root, 'tap-respond-hear').length).toBeGreaterThan(0);
    expect(byTestId(r.root, 'role-play')).toHaveLength(0);
    await unmount(r);
  });

  it('with the switch on, the role-play step plays Role Play (its chunk, through the start bundle door)', async () => {
    useRemoteConfigStore.setState({ cache: ON, hydrated: true });
    const r = await open(fixture.questId);
    await vi.waitFor(async () => {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
      });
      expect(byTestId(r.root, 'role-play')).toHaveLength(1);
    });
    expect(byTestId(r.root, 'tap-respond-hear')).toHaveLength(0);
    await unmount(r);
  });
});
