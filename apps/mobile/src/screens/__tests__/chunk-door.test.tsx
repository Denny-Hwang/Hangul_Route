import { act, type ReactTestRenderer } from 'react-test-renderer';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buttonsNamed, byTestId, press, render, unmount } from '../../test-support/render';

/**
 * AMENDMENTS-FINISH-2026-11 FN-7: the doors of the new screen chunks (`chunk-door.tsx`). A door loads its chunk once,
 * shows the lesson waiting screen until it is in, draws the screen with the props it was given, and shows the crash
 * screen's Try again when the chunk cannot load. The route doors are checked here with stand-in chunks that count their
 * loads; the game doors are exercised by the minigame and story render tests with the real chunks.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const { chunks, standIn } = vi.hoisted(() => {
  const chunks = { loads: {} as Record<string, number>, props: [] as unknown[] };
  const standIn = (name: string, component: string) => async () => {
    chunks.loads[name] = (chunks.loads[name] ?? 0) + 1;
    const { createElement: h } = await import('react');
    return {
      [component]: (props: unknown) => {
        chunks.props.push(props);
        return h('div', { 'data-testid': `${name}-stub` });
      },
    };
  };
  return { chunks, standIn };
});
vi.mock('../sync/join-space-chunk', standIn('join-space', 'JoinSpaceScreen'));
vi.mock('../route/route-proposal-chunk', standIn('route-proposal', 'RouteProposalScreen'));
vi.mock('../vocab/speed-round-chunk', standIn('speed-round', 'VocabSpeedRoundScreen'));
vi.mock('../placement/placement-chunk', standIn('placement', 'PlacementScreen'));
// The chunk retry's backoff, at once.
vi.mock('../../logic/lessons/chunk-retry', () => ({ retryLoad: <T,>(load: () => Promise<T>) => load() }));

const { chunkDoor } = await import('../chunk-door');
const { JoinSpaceScreen } = await import('../sync/join-space-entry');
const { RouteProposalScreen } = await import('../route/route-proposal-entry');
const { VocabSpeedRoundScreen } = await import('../vocab/speed-round-entry');
const { PlacementScreen } = await import('../placement/placement-entry');

const mounted: ReactTestRenderer[] = [];
const settle = async (): Promise<void> => {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  });
};
/** Waits until `ready` holds: a chunk arrives through a dynamic `import()`, an unknown number of ticks away (more under load). */
async function until(ready: () => boolean): Promise<void> {
  await vi.waitFor(
    async () => {
      await settle();
      if (!ready()) throw new Error('not yet');
    },
    { timeout: 10_000, interval: 10 },
  );
}

afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  chunks.props.length = 0;
});

const props = (name: string) => ({ navigation: { goBack: vi.fn() }, route: { key: `k-${name}`, name, params: {} } });

describe('chunkDoor (FN-7)', () => {
  it('loads once, shares the load, and keeps no failure', async () => {
    let calls = 0;
    let fail = true;
    const door = chunkDoor(async () => {
      calls += 1;
      if (fail) throw new Error('offline');
      return { ok: true };
    });
    expect(door.now()).toBeNull();
    // The real retry is stubbed here: one call per load.
    await expect(door.load()).rejects.toThrow('offline');
    fail = false;
    const [a, b] = await Promise.all([door.load(), door.load()]);
    expect(a).toBe(b);
    expect(await door.load()).toBe(a);
    expect(door.now()).toBe(a);
    expect(calls).toBe(2);
  });
});

describe('the route doors (FN-7)', () => {
  const routes = [
    ['join-space', 'JoinSpace', JoinSpaceScreen],
    ['route-proposal', 'RouteProposal', RouteProposalScreen],
    ['speed-round', 'VocabSpeedRound', VocabSpeedRoundScreen],
    ['placement', 'Placement', PlacementScreen],
  ] as const;

  for (const [name, route, Door] of routes) {
    it(`${route}: the screen from its chunk with the route's props; loaded once`, async () => {
      const given = props(route);
      const r = await render(createElement(Door as never, given as never));
      mounted.push(r);
      await until(() => byTestId(r.root, `${name}-stub`).length > 0);
      expect(byTestId(r.root, `${name}-stub`)).toHaveLength(1);
      expect(chunks.props.at(-1)).toEqual(given);
      // A second open draws at once from the loaded chunk.
      const again = await render(createElement(Door as never, given as never));
      mounted.push(again);
      expect(byTestId(again.root, `${name}-stub`)).toHaveLength(1);
      expect(chunks.loads[name]).toBe(1);
    });
  }

  it('a chunk that cannot load shows the crash screen; Try again asks again', async () => {
    // The route doors above are loaded for the session, so a door of its own drawn the way they draw.
    const { useChunk } = await import('../chunk-door');
    const { LessonWaiting } = await import('../lesson-content');
    const { OopsScreen } = await import('../system/OopsScreen');
    let attempts = 0;
    const flaky = chunkDoor(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('offline');
      return { Screen: () => createElement('div', { 'data-testid': 'flaky-stub' }) };
    });
    function Door(): ReturnType<typeof LessonWaiting> {
      const { chunk, failed, retry } = useChunk(flaky);
      if (failed) return createElement(OopsScreen, { onRetry: retry });
      if (chunk === null) return createElement(LessonWaiting);
      return createElement(chunk.Screen);
    }
    const r = await render(createElement(Door));
    mounted.push(r);
    await until(() => buttonsNamed(r.root, 'Try again').length > 0);
    expect(byTestId(r.root, 'lesson-waiting')).toHaveLength(0);
    expect(buttonsNamed(r.root, 'Try again')).toHaveLength(1);
    await press(buttonsNamed(r.root, 'Try again')[0]!);
    await until(() => byTestId(r.root, 'flaky-stub').length > 0);
    expect(byTestId(r.root, 'flaky-stub')).toHaveLength(1);
    expect(attempts).toBe(2);
  });
});
