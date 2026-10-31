import { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetRemoteConfigForTests, useRemoteConfigStore } from '../../../store/remote-config-store';
import { byTestId, render, unmount } from '../../../test-support/render';

/**
 * The start bundle's door to "This week in Korea" (F-CURR-002 §5.7, §10 and §12.2, row CM-48): while `weeklyDrop` is off
 * (its built-in pct 0, the launch state: the row merges dark) or the local week has no drop, the chunk
 * (`screen-chunk:week-drop`) is never asked for and Home draws nothing. The chunk is a stand-in here that counts its loads.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const chunk = vi.hoisted(() => ({ loads: 0, props: [] as unknown[] }));
vi.mock('../week-drop-chunk', async () => {
  chunk.loads += 1;
  const { createElement } = await import('react');
  return {
    WeekDropCard: (props: unknown) => {
      chunk.props.push(props);
      return createElement('div', { 'data-testid': 'week-drop-card-stub' });
    },
    WeekDropScreen: () => createElement('div', { 'data-testid': 'week-drop-screen-stub' }),
  };
});
const { WeekDropHomeSlot, WeekDropRoute } = await import('../week-drop-entry');

const mounted: ReactTestRenderer[] = [];
const idle = async (): Promise<void> => {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  });
};
const on = (value: boolean, pct = 100): void =>
  useRemoteConfigStore.setState({ hydrated: true, cache: { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags: { weeklyDrop: { on: value, pct } } } });
async function slot(today: string, profileId: string | null = 'profile:mina'): Promise<ReactTestRenderer> {
  const r = await render(<WeekDropHomeSlot profileId={profileId} today={today} />);
  mounted.push(r);
  await idle();
  return r;
}

beforeEach(() => {
  resetRemoteConfigForTests();
  chunk.props.length = 0;
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  resetRemoteConfigForTests();
});

describe('WeekDropHomeSlot (row CM-48)', () => {
  it('off at the launch state (no remote copy: built-in pct 0): no card, the chunk never loads', async () => {
    useRemoteConfigStore.setState({ hydrated: true, cache: null });
    const r = await slot('2026-10-30');
    expect(byTestId(r.root, 'week-drop-card-stub')).toEqual([]);
    expect(chunk.loads).toBe(0);
  });

  it.each([
    ['switched off', false, 100],
    ['on at pct 0', true, 0],
  ])('off (%s): no card, the chunk never loads', async (_name, value, pct) => {
    on(value, pct);
    const r = await slot('2026-10-30');
    expect(byTestId(r.root, 'week-drop-card-stub')).toEqual([]);
    expect(chunk.loads).toBe(0);
  });

  it('on, in a week with no drop, or with no profile: nothing loads', async () => {
    on(true);
    expect(byTestId((await slot('2026-10-20')).root, 'week-drop-card-stub')).toEqual([]);
    expect(byTestId((await slot('2026-10-30', null)).root, 'week-drop-card-stub')).toEqual([]);
    expect(chunk.loads).toBe(0);
  });

  it("on, in a week with a drop: the chunk loads once and the card gets the week's Monday", async () => {
    on(true);
    const r = await slot('2026-11-05');
    expect(byTestId(r.root, 'week-drop-card-stub')).toHaveLength(1);
    expect(chunk.props[0]).toEqual({ profileId: 'profile:mina', week: '2026-11-02' });
    expect(chunk.loads).toBe(1);
  });
});

describe('WeekDropRoute (row CM-48)', () => {
  it('draws the screen from the chunk (the screen itself goes back when the switch is off)', async () => {
    on(true);
    const goBack = vi.fn();
    const navigation = { canGoBack: () => true, goBack } as unknown as Parameters<typeof WeekDropRoute>[0]['navigation'];
    const route = { key: 'k', name: 'WeekDrop' } as Parameters<typeof WeekDropRoute>[0]['route'];
    const r = await render(<WeekDropRoute navigation={navigation} route={route} />);
    mounted.push(r);
    await idle();
    expect(byTestId(r.root, 'week-drop-screen-stub')).toHaveLength(1);
    expect(goBack).not.toHaveBeenCalled();
  });
});
