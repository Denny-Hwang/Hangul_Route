import type { WriteFrameRound } from '@hangul-route/content-schema';
import React from 'react';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_ROUNDS, type WriteFrameFixture } from '../../../logic/write-frame/e2e-rounds';
import { SENTENCE_PAUSE_MS } from '../../../logic/write-frame/flow';
import { byTestId, press, render, screenTexts, unmount } from '../../../test-support/render';
import { BrowseMinigameScreen } from '../../browse/BrowseLessonScreens';
import { MinigameScreen } from '../MinigameScreen';

/**
 * F-CURR-001 G-5 through the real hosts: MinigameScreen on a Write Frame step and the All lessons
 * preview (BrowseMinigameScreen). The preview opens the name round on the cast name 호야 wherever
 * the round sits in the step, a learner's step opens it empty, and test P-1 on the real close path:
 * `minigame.finished` carries the kind and where the step sits, never what was written.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const fixture = vi.hoisted(() => ({ rounds: [] as string[] }));
const track = vi.hoisted(() => vi.fn<(event: unknown) => Promise<void>>(() => Promise.resolve()));

vi.mock('../../../platform/telemetry', () => ({ track }));
// The native navigation package has no build that loads in Node: the preview frame's focus effect runs once.
vi.mock('@react-navigation/native', async () => {
  const { createContext, useEffect } = await import('react');
  return {
    NavigationContext: createContext(undefined),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    useNavigation: () => ({ goBack: () => undefined, navigate: () => undefined }),
  };
});
// The stroke game draws with the native gesture handler, which has no build that loads in Node; this suite never plays it.
vi.mock('../TraceStrokeGame', () => ({ TraceStrokeGame: () => null }));
vi.mock('../../use-practice-session', () => ({ usePracticeSession: () => undefined }));
vi.mock('../../../content', () => ({
  questById: (id: string) => (id === 'q-write' ? { id, steps: [{ kind: 'minigame', minigameRef: 'mg-write-frame' }] } : undefined),
}));
vi.mock('../../../logic/minigame-config', async () => {
  const { FIXTURE_ROUNDS: rounds } = await import('../../../logic/write-frame/e2e-rounds');
  return {
    scopeFor: (ref: string) => {
      if (ref !== 'mg-write-frame') return undefined;
      const list = fixture.rounds.map((k) => rounds[k as WriteFrameFixture] as WriteFrameRound);
      return { kind: 'write-frame', rounds: list.length, writeFrame: { rounds: list } };
    },
  };
});
vi.mock('../../../logic/content-locale', () => ({ localizeScope: (scope: unknown) => scope, localizeQuest: (quest: unknown) => quest }));

const route = { key: 'Minigame-1', name: 'Minigame' as const, params: { questId: 'q-write', episodeId: 'e-write', stepIndex: 0 } };
const field = (r: ReactTestRenderer): string[] => screenTexts(byTestId(r.root, 'write-frame-field')[0]!);
const tap = async (r: ReactTestRenderer, id: string): Promise<void> => {
  const node = byTestId(r.root, id).find((n: ReactTestInstance) => typeof n.props.onClick === 'function');
  expect(node, id).toBeDefined();
  await press(node!);
};

beforeEach(() => {
  track.mockClear();
  expect(Object.keys(FIXTURE_ROUNDS)).toContain('name');
});

describe('Write Frame through the real hosts', () => {
  it('the All lessons preview opens the name round on 호야, even after a bank frame', async () => {
    fixture.rounds = ['food', 'name'];
    vi.useFakeTimers();
    const navigation = { goBack: vi.fn(), navigate: vi.fn() };
    const r = await render(<BrowseMinigameScreen route={route as never} navigation={navigation as never} />);
    await tap(r, 'write-frame-word-1');
    for (const key of ['ㄱ', 'ㅣ', 'ㅁ', 'ㅂ', 'ㅏ', 'ㅂ']) await tap(r, `hangul-key-${key}`);
    await tap(r, 'write-frame-done');
    await act(async () => {
      vi.advanceTimersByTime(SENTENCE_PAUSE_MS);
    });
    expect(field(r).join('')).toContain('호야');
    await unmount(r);
    vi.useRealTimers();
  });

  it('a learner step opens the name round empty', async () => {
    fixture.rounds = ['name'];
    const r = await render(<MinigameScreen route={route} onBack={() => undefined} />);
    expect(field(r).join('')).not.toContain('호야');
    await unmount(r);
  });

  it('test P-1: the real close path sends minigame.finished with the kind and the step only', async () => {
    fixture.rounds = ['name'];
    vi.useFakeTimers();
    const r = await render(<MinigameScreen route={route} inPreview onBack={() => undefined} />);
    await tap(r, 'write-frame-done');
    await act(async () => {
      vi.advanceTimersByTime(SENTENCE_PAUSE_MS);
    });
    await tap(r, 'write-frame-continue');
    expect(track).toHaveBeenCalledTimes(1);
    const event = track.mock.calls[0]?.[0] as { name: string; payload: unknown };
    expect(event.name).toBe('minigame.finished');
    expect(event.payload).toEqual({ kind: 'write-frame', questId: 'q-write', stepIndex: 0 });
    expect(JSON.stringify(event)).not.toMatch(/[ㄱ-ㆎ가-힣]|hoya/i);
    await unmount(r);
    vi.useRealTimers();
  });
});
