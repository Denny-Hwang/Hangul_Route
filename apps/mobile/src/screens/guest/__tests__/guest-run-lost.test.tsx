import type { GuestRecord, Profile } from '@hangul-route/content-schema';
import type { ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 6.4 (row GU-3 review, Codex P2): while the `Guest` stack is mounted, a run
 * this tab had on that another tab ended (`refresh` after a save, a removal, a sweep or another run) resets the root at
 * once to Close's target, so the guest's screens never stay up writing under no learner or the active profile. The
 * stack opened with no run on (Add my name) and this tab's own exits never reset it here.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const disk = vi.hoisted(() => new Map<string, string>());
vi.mock('../../../platform/storage', () => ({
  readJson: vi.fn(async (key: string) => (disk.has(key) ? JSON.parse(disk.get(key)!) : null)),
  readJsonStrict: vi.fn(async (key: string) => (disk.has(key) ? JSON.parse(disk.get(key)!) : null)),
  readJsonExact: vi.fn(async (key: string) => (disk.has(key) ? JSON.parse(disk.get(key)!) : null)),
  writeJson: vi.fn(async (key: string, value: unknown) => void disk.set(key, JSON.stringify(value))),
  updateJson: vi.fn(async () => true),
  removeKey: vi.fn(async (key: string) => void disk.delete(key)),
  listKeys: vi.fn(async () => [...disk.keys()]),
}));
const sent = vi.hoisted(() => [] as Array<{ name: string }>);
vi.mock('../../../platform/telemetry', () => ({
  track: vi.fn(async (event: { name: string }) => {
    sent.push(event);
    return true;
  }),
  flushQueue: vi.fn(async () => undefined),
}));
vi.mock('../../../platform/profiles-channel', () => ({ postProfilesChanged: () => undefined, subscribeProfilesChanged: () => () => undefined }));

import { flags } from '../../../config/flags';
import { useGuestStore } from '../../../store/guest-store';
import { useProfileStore } from '../../../store/profile-store';
import { render, unmount } from '../../../test-support/render';
import { useLeaveWhenGuestRunLost } from '../use-guest-run-lost';

const GUEST_ID = 'profile:guest001';
const T0 = '2026-10-22T10:00:00.000Z';
const guest: GuestRecord = { v: 1, id: GUEST_ID, startedAt: T0, lastAt: T0, via: 'site', questDone: false };
const mina: Profile = { id: 'profile:mina0001', displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-blue', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z' };
const mounted: ReactTestRenderer[] = [];
const chooserBefore = flags.whoChooserEnabled;

function Stack({ root }: { root: { dispatch: (action: unknown) => void } }): null {
  useLeaveWhenGuestRunLost(root);
  return null;
}

async function mountStack(): Promise<ReturnType<typeof vi.fn>> {
  const dispatch = vi.fn();
  mounted.push(await render(<Stack root={{ dispatch }} />));
  return dispatch;
}

beforeEach(() => {
  disk.clear();
  sent.length = 0;
  disk.set('guest', JSON.stringify(guest));
  useProfileStore.setState({ profiles: [], activeId: null, hydrated: true });
  useGuestStore.setState({ record: guest, running: true, hydrated: true, memoryOnly: false, runsLost: 0 });
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  (flags as { whoChooserEnabled: boolean }).whoChooserEnabled = chooserBefore;
  useGuestStore.setState({ record: null, running: false, runsLost: 0 });
});

describe('the Guest stack when another tab ends its run (6.4)', () => {
  it('the record removed in another tab (saved or swept): the root resets to Welcome on an empty device, with no guest.left', async () => {
    const dispatch = await mountStack();
    disk.delete('guest');
    await useGuestStore.getState().refresh();
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'RESET', payload: { index: 0, routes: [{ name: 'Onboarding' }] } });
    expect(sent.map((e) => e.name)).not.toContain('guest.left');
  });

  it('another run took the record: the root resets to Close\'s target (the chooser with profiles and the chooser on, else Home)', async () => {
    useProfileStore.setState({ profiles: [mina], activeId: mina.id });
    (flags as { whoChooserEnabled: boolean }).whoChooserEnabled = true;
    const dispatch = await mountStack();
    disk.set('guest', JSON.stringify({ ...guest, id: 'profile:other001' }));
    await useGuestStore.getState().refresh();
    expect(dispatch).toHaveBeenCalledWith({ type: 'RESET', payload: { index: 0, routes: [{ name: 'WhoIsUsing', params: { trigger: 'manual' } }] } });

    (flags as { whoChooserEnabled: boolean }).whoChooserEnabled = false;
    useGuestStore.setState({ record: guest, running: true });
    disk.set('guest', JSON.stringify(guest));
    disk.delete('guest');
    await useGuestStore.getState().refresh();
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'RESET', payload: { index: 0, routes: [{ name: 'Main' }] } });
  });

  it('the same record read again, a stack opened with no run (Add my name) and this tab\'s own exits never reset it', async () => {
    const dispatch = await mountStack();
    await useGuestStore.getState().refresh();
    useGuestStore.getState().endGuestRun();
    // No run on now: a removal elsewhere loses nothing.
    disk.delete('guest');
    await useGuestStore.getState().refresh();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('once the stack is gone, a lost run resets nothing', async () => {
    const dispatch = await mountStack();
    for (const r of mounted.splice(0)) await unmount(r);
    disk.delete('guest');
    await useGuestStore.getState().refresh();
    expect(useGuestStore.getState().runsLost).toBe(1);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
