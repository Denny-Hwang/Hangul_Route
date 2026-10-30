import { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetRemoteConfigForTests, useRemoteConfigStore } from '../../../store/remote-config-store';
import { useProfileStore } from '../../../store/profile-store';
import { byTestId, render, unmount } from '../../../test-support/render';
import { CultureTip } from '../culture-tip-entry';

/**
 * The start bundle's door to the Did you know? tip (F-CURR-002 §5.7 and §10, row CM-3C): while `upperCards` is off the
 * tip's chunk (`screen-chunk:culture-tip`) is never asked for. The chunk is replaced here by a stand-in that counts its
 * loads, and nothing in this file imports it itself, so a load counted is the door's own `import()`.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const chunk = vi.hoisted(() => ({ loads: 0 }));
vi.mock('../culture-tip-chunk', async () => {
  chunk.loads += 1;
  const { createElement } = await import('react');
  return { Tip: () => createElement('div', { 'data-testid': 'culture-tip-stub' }) };
});

const PROFILE = 'profile:mina';
const mounted: ReactTestRenderer[] = [];

/** Lets any pending `import()` and state update finish, without importing the chunk itself. */
const idle = async (): Promise<void> => {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

async function door(): Promise<ReactTestRenderer> {
  const r = await render(<CultureTip questId="quest:stage2-nature-q1" />);
  mounted.push(r);
  await idle();
  return r;
}

beforeEach(() => {
  resetRemoteConfigForTests();
  useProfileStore.setState({
    profiles: [{ id: PROFILE, displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z', learnerType: 'self' }],
    activeId: PROFILE,
  });
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  useProfileStore.setState({ profiles: [], activeId: null });
  resetRemoteConfigForTests();
});

describe('the CultureTip door (row CM-3C)', () => {
  it('off with no remote copy stored (the built-in pct 0, the launch state): nothing drawn, the chunk never loads', async () => {
    useRemoteConfigStore.setState({ hydrated: true, cache: null });
    const r = await door();
    expect(byTestId(r.root, 'culture-tip-stub')).toEqual([]);
    expect(chunk.loads).toBe(0);
  });

  it('off before the stored copy is read: nothing drawn, the chunk never loads', async () => {
    const r = await door();
    expect(byTestId(r.root, 'culture-tip-stub')).toEqual([]);
    expect(chunk.loads).toBe(0);
  });

  it.each([
    ['switched off', { on: false, pct: 0 }],
    ['on at pct 0', { on: true, pct: 0 }],
  ])('off (%s): nothing drawn, the chunk never loads', async (_name, upperCards) => {
    useRemoteConfigStore.setState({ hydrated: true, cache: { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags: { upperCards } } });
    const r = await door();
    expect(byTestId(r.root, 'culture-tip-stub')).toEqual([]);
    expect(chunk.loads).toBe(0);
  });

  it('on: the chunk loads once and the tip is drawn', async () => {
    useRemoteConfigStore.setState({ hydrated: true, cache: { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags: { upperCards: { on: true, pct: 100 } } } });
    const r = await door();
    expect(byTestId(r.root, 'culture-tip-stub')).toHaveLength(1);
    expect(chunk.loads).toBe(1);
  });
});
