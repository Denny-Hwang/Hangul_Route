import { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { byTestId, render, unmount } from '../../../test-support/render';

/**
 * The start bundle's door to the grown-up reports (F-CURR-002 section 10): `LearnerReport` and `PlacementReport` draw
 * their screens from the reports chunk (`screen-chunk:reports`) once it is in, with the route's own props, and the
 * chunk loads once for both. The chunk is a stand-in here that counts its loads.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const chunk = vi.hoisted(() => ({ loads: 0, props: [] as unknown[] }));
vi.mock('../reports-chunk', async () => {
  chunk.loads += 1;
  const { createElement } = await import('react');
  return {
    LearnerReportScreen: (props: unknown) => {
      chunk.props.push(props);
      return createElement('div', { 'data-testid': 'learner-report-stub' });
    },
    PlacementReportScreen: (props: unknown) => {
      chunk.props.push(props);
      return createElement('div', { 'data-testid': 'placement-report-stub' });
    },
  };
});
const { LearnerReportRoute, PlacementReportRoute } = await import('../reports-entry');

const mounted: ReactTestRenderer[] = [];
const idle = async (): Promise<void> => {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  });
};
/** Waits until `ready` holds: the chunk arrives through a dynamic `import()`, an unknown number of ticks away. */
async function until(ready: () => boolean): Promise<void> {
  await vi.waitFor(
    async () => {
      await idle();
      if (!ready()) throw new Error('not yet');
    },
    { timeout: 5_000, interval: 10 },
  );
}

afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  chunk.props.length = 0;
});

describe('the reports door', () => {
  it('LearnerReport draws the learner report from the chunk, with the route and navigation it was given', async () => {
    const navigation = { goBack: vi.fn() } as unknown as Parameters<typeof LearnerReportRoute>[0]['navigation'];
    const route = { key: 'k1', name: 'LearnerReport', params: { profileId: 'profile:mina' } } as unknown as Parameters<typeof LearnerReportRoute>[0]['route'];
    const r = await render(<LearnerReportRoute navigation={navigation} route={route} />);
    mounted.push(r);
    await until(() => byTestId(r.root, 'learner-report-stub').length > 0);
    expect(byTestId(r.root, 'learner-report-stub')).toHaveLength(1);
    expect(chunk.props[0]).toEqual({ navigation, route });
  });

  it('PlacementReport draws the level-check report from the same chunk, loaded once', async () => {
    const navigation = { goBack: vi.fn() } as unknown as Parameters<typeof PlacementReportRoute>[0]['navigation'];
    const route = { key: 'k2', name: 'PlacementReport', params: { profileId: 'profile:mina' } } as unknown as Parameters<typeof PlacementReportRoute>[0]['route'];
    const r = await render(<PlacementReportRoute navigation={navigation} route={route} />);
    mounted.push(r);
    await until(() => byTestId(r.root, 'placement-report-stub').length > 0);
    expect(byTestId(r.root, 'placement-report-stub')).toHaveLength(1);
    expect(chunk.props[0]).toEqual({ navigation, route });
    expect(chunk.loads).toBe(1);
  });
});
