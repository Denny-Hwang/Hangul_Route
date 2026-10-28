import { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clozeFixtureScope } from '../../../logic/cloze-pick/e2e-rounds';
import { resetRemoteConfigForTests, useRemoteConfigStore } from '../../../store/remote-config-store';
import { byTestId, render, unmount } from '../../../test-support/render';
import { CHUNK_TIMEOUT_MS, ClozePickStep, type ClozePickRendered } from '../cloze-pick-entry';

/**
 * F-CURR-002 sections 12.2 and 14, row CM-30: the launch state, with the real remote-config store (no mock of the
 * switch). A device with no stored copy waits for the stored copy to be read, then plays the built-in pct 0: the
 * Listen & Pick fallback, without loading the Cloze Pick chunk. A copy that turns the game on for everyone loads the
 * chunk; one that never answers is given up after `CHUNK_TIMEOUT_MS` and the step plays the fallback.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const chunk = vi.hoisted(() => ({ asked: 0 }));
// A chunk request that never answers (a hung network with no worker in control).
vi.mock('../cloze-pick-chunk', () => {
  chunk.asked += 1;
  return new Promise(() => undefined);
});

const mounted: ReactTestRenderer[] = [];
const host = { mode: 'quest' as const, answer: () => undefined, complete: () => undefined };

async function step() {
  const rendered: ClozePickRendered[] = [];
  const r = await render(<ClozePickStep scope={clozeFixtureScope(['word'])} host={host} onRendered={(k) => rendered.push(k)} />);
  mounted.push(r);
  return { r, rendered };
}

beforeEach(() => {
  resetRemoteConfigForTests();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  vi.useRealTimers();
  resetRemoteConfigForTests();
});

describe('Cloze Pick at launch (built-in pct 0, the real store)', () => {
  it('waits for the stored copy, then, with none stored, plays the fallback and loads nothing', async () => {
    const asked = chunk.asked;
    const { r, rendered } = await step();
    expect(byTestId(r.root, 'lesson-waiting').length).toBeGreaterThan(0);
    expect(rendered).toEqual([]);
    await act(async () => {
      await useRemoteConfigStore.getState().hydrate();
    });
    expect(useRemoteConfigStore.getState().cache).toBeNull();
    expect(rendered).toEqual(['listen-pick']);
    expect(byTestId(r.root, 'listen-pick-text-prompt').length).toBeGreaterThan(0);
    expect(byTestId(r.root, 'listen-pick-options').length).toBeGreaterThan(0);
    expect(chunk.asked).toBe(asked);
  });

  it('a copy that turns the game on loads the chunk; one that never answers gives way to the fallback', async () => {
    useRemoteConfigStore.setState({ hydrated: true, cache: { v: 1, fetchedAt: 0, maxAgeS: 300, flags: { 'game.cloze-pick': { on: true, pct: 100 } } } });
    const asked = chunk.asked;
    const { r, rendered } = await step();
    await act(async () => {
      await Promise.resolve();
    });
    expect(chunk.asked).toBe(asked + 1);
    expect(byTestId(r.root, 'lesson-waiting').length).toBeGreaterThan(0);
    await act(async () => {
      vi.advanceTimersByTime(CHUNK_TIMEOUT_MS);
    });
    expect(rendered).toEqual(['listen-pick']);
    expect(byTestId(r.root, 'listen-pick-text-prompt').length).toBeGreaterThan(0);
  });
});

describe('the build floor (EXPO_PUBLIC_CURR_GAMES_OFF=cloze-pick)', () => {
  it('keeps the game off even when the remote copy turns it on for everyone', async () => {
    const before = process.env.EXPO_PUBLIC_CURR_GAMES_OFF;
    process.env.EXPO_PUBLIC_CURR_GAMES_OFF = 'cloze-pick';
    try {
      vi.resetModules();
      const store = await import('../../../store/remote-config-store');
      const flags: Record<string, { on: boolean; pct: number }> = { 'game.cloze-pick': { on: true, pct: 100 } };
      const cache = { v: 1, fetchedAt: 0, maxAgeS: 300, flags } as Parameters<typeof store.currFlagOn>[2];
      store.useRemoteConfigStore.setState({ hydrated: true, cache: cache ?? null });
      expect(store.currFlagOn('game.cloze-pick', 'profile-a')).toBe(false);
      expect(store.currFlagOn('game.cloze-pick', null)).toBe(false);
    } finally {
      if (before === undefined) delete process.env.EXPO_PUBLIC_CURR_GAMES_OFF;
      else process.env.EXPO_PUBLIC_CURR_GAMES_OFF = before;
      vi.resetModules();
    }
  });
});
