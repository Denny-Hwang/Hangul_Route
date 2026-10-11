import { beforeEach, describe, expect, it, vi } from 'vitest';

const mem = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (k: string) => mem.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    mem.set(k, v);
  }),
}));

import { readJson, writeJson } from '../../platform/storage';
import { LAYOUT_PREFS_KEY, useLayoutStore } from '../layout-store';

beforeEach(() => {
  mem.clear();
  vi.mocked(writeJson).mockClear();
  useLayoutStore.setState({ allowedSideways: false, hydrated: false });
});

describe('layout-store: device:layout (F-LAYOUT-001 §3.4)', () => {
  it('uses the key device:layout', () => {
    expect(LAYOUT_PREFS_KEY).toBe('device:layout');
  });

  it('hydrate reads a saved "Keep sideways"', async () => {
    mem.set('device:layout', { v: 1, allowedSideways: true });
    await useLayoutStore.getState().hydrate();
    expect(useLayoutStore.getState()).toMatchObject({ allowedSideways: true, hydrated: true });
  });

  it('a missing value means false', async () => {
    await useLayoutStore.getState().hydrate();
    expect(useLayoutStore.getState()).toMatchObject({ allowedSideways: false, hydrated: true });
  });

  it('a corrupt value means false and is not overwritten by hydrate', async () => {
    for (const bad of ['yes', 7, [], null, { allowedSideways: true }, { v: 2, allowedSideways: true }, { v: 1, allowedSideways: 'true' }]) {
      mem.set('device:layout', bad);
      useLayoutStore.setState({ allowedSideways: false, hydrated: false });
      await useLayoutStore.getState().hydrate();
      expect(useLayoutStore.getState()).toMatchObject({ allowedSideways: false, hydrated: true });
    }
    expect(writeJson).not.toHaveBeenCalled();
  });

  it('allowSideways persists { v: 1, allowedSideways: true }', async () => {
    useLayoutStore.getState().allowSideways();
    expect(useLayoutStore.getState().allowedSideways).toBe(true);
    expect(writeJson).toHaveBeenCalledWith('device:layout', { v: 1, allowedSideways: true });
    useLayoutStore.setState({ allowedSideways: false, hydrated: false });
    await useLayoutStore.getState().hydrate();
    expect(useLayoutStore.getState().allowedSideways).toBe(true);
  });

  it('a storage failure keeps the choice for the session and does not throw', async () => {
    vi.mocked(writeJson).mockRejectedValueOnce(new Error('quota'));
    expect(() => useLayoutStore.getState().allowSideways()).not.toThrow();
    await Promise.resolve();
    expect(useLayoutStore.getState().allowedSideways).toBe(true);
  });

  it('a tap during the read is not undone by the stored value', async () => {
    let release: (v: unknown) => void = () => undefined;
    vi.mocked(readJson).mockImplementationOnce(() => new Promise((r) => (release = r)));
    const pending = useLayoutStore.getState().hydrate();
    useLayoutStore.getState().allowSideways();
    release({ v: 1, allowedSideways: false });
    await pending;
    expect(useLayoutStore.getState()).toMatchObject({ allowedSideways: true, hydrated: true });
  });
});
