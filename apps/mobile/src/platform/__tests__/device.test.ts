import { beforeEach, describe, expect, it, vi } from 'vitest';

const mem = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../storage', () => ({
  readJson: vi.fn(async (k: string) => mem.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    mem.set(k, v);
  }),
}));
vi.mock('expo-crypto', () => ({ randomUUID: vi.fn(() => '11111111-2222-3333-4444-555555555555') }));

import { getDeviceId, resetDeviceIdCache } from '../device';

describe('platform/device', () => {
  beforeEach(() => {
    mem.clear();
    resetDeviceIdCache();
  });

  it('creates one random id, persists it, and reuses it', async () => {
    const first = await getDeviceId();
    expect(first).toBe('device-11111111-2222-3333-4444-555555555555');
    expect(mem.get('device:id')).toBe(first);
    resetDeviceIdCache();
    mem.set('device:id', 'device-saved');
    expect(await getDeviceId()).toBe('device-saved');
    expect(await getDeviceId()).toBe('device-saved');
  });
});
